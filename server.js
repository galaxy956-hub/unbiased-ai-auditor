const express = require('express');
const path = require('path');
const { pipeline, env } = require('@xenova/transformers');
const fallback = require('./fallbackAi');

env.allowLocalModels = false;
env.useBrowserCache = false;
env.cacheDir = './.cache';

const app = express();
const PORT = parseInt(process.env.PORT) || 8080;

// ── Security Headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Rate Limiting (simple in-memory) ─────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + RATE_WINDOW };

  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + RATE_WINDOW;
  }

  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }
  next();
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Offline AI client (Transformers.js) ────────────────────────────────────────
let generator = null;
let isInitializing = false;

async function getAI() {
  if (generator) return generator;
  if (isInitializing) {
    while(isInitializing) { await new Promise(r => setTimeout(r, 100)); }
    return generator;
  }
  
  try {
    isInitializing = true;
    console.log("Loading offline AI model into memory...");
    generator = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat');
    console.log("Offline AI model loaded successfully.");
    isInitializing = false;
    return generator;
  } catch (error) {
    isInitializing = false;
    console.error("Failed to load local AI model:", error);
    throw error;
  }
}

async function offlineAi(prompt) {
  const ai = await getAI();
  const messages = [
    { role: "system", content: "You are an AI fairness expert auditor. Keep answers concise, plain language, and under 200 words. Do not use markdown headers." },
    { role: "user", content: prompt }
  ];
  const text = ai.tokenizer.apply_chat_template(messages, { tokenize: false, add_generation_prompt: true });
  const output = await ai(text, { max_new_tokens: 300, temperature: 0.1, do_sample: true });
  return output[0].generated_text.replace(text, "").trim();
}

// Timeout wrapper — ensures AI calls fail fast and use fallback before Cloud Run times out
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms))
  ]);
}

// ── REST API: Datasets ────────────────────────────────────────────────────────
/**
 * GET /api/datasets
 * Returns list of available demo datasets with metadata
 */
app.get('/api/datasets', (req, res) => {
  const datasets = [
    { key: 'hiring',    label: 'HR Hiring Pipeline',              rows: 500, columns: 8, biasLevel: 'high',     protectedAttr: 'gender',             outcomeAttr: 'hired',             description: '500 candidates across gender and racial groups. Uncovers disparate impact in technical role screening.' },
    { key: 'lending',   label: 'Bank Loan Approval',              rows: 400, columns: 9, biasLevel: 'moderate', protectedAttr: 'race',               outcomeAttr: 'approved',          description: '400 loan applications. Reveals redlining patterns and age-based discrimination.' },
    { key: 'healthcare',label: 'Healthcare Risk Scoring',         rows: 350, columns: 8, biasLevel: 'high',     protectedAttr: 'race',               outcomeAttr: 'flagged_high_risk', description: '350 patients. Models documented racial bias in commercial health risk algorithms (Optum study).' },
    { key: 'criminal',  label: 'Criminal Justice Risk Assessment',rows: 450, columns: 7, biasLevel: 'high',     protectedAttr: 'race',               outcomeAttr: 'recidivism_flagged',description: '450 records modeling recidivism prediction bias similar to COMPAS.' },
    { key: 'education', label: 'Education Admission Decisions',   rows: 400, columns: 8, biasLevel: 'moderate', protectedAttr: 'socioeconomic_status',outcomeAttr: 'admitted',          description: '400 applications with socioeconomic status bias.' },
    { key: 'insurance', label: 'Insurance Premium Pricing',       rows: 380, columns: 7, biasLevel: 'moderate', protectedAttr: 'location_type',      outcomeAttr: 'high_premium',      description: '380 policies with location-based discrimination.' },
  ];
  res.json({ datasets, count: datasets.length });
});

// ── REST API: Compute Metrics ─────────────────────────────────────────────────
/**
 * POST /api/metrics/compute
 * Body: { data: [...], config: { protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr, referenceGroup } }
 * Returns: { metrics, overallRisk }
 * Note: This endpoint does server-side metric computation (same logic as frontend)
 */
app.post('/api/metrics/compute', (req, res) => {
  try {
    const { data, config } = req.body;
    if (!data || !Array.isArray(data)) return res.status(400).json({ error: 'Missing or invalid data array' });
    if (!config || !config.protectedAttr || !config.outcomeAttr) return res.status(400).json({ error: 'Missing config: protectedAttr and outcomeAttr required' });
    if (data.length < 10) return res.status(400).json({ error: 'Dataset too small — minimum 10 rows required' });
    if (data.length > 50000) return res.status(400).json({ error: 'Dataset too large — maximum 50,000 rows via API' });

    // Server-side metric computation (core algorithms)
    const metrics = computeMetricsServer(data, config);
    res.json({ metrics, rowCount: data.length, config, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('/api/metrics/compute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── REST API: Mitigation Apply ────────────────────────────────────────────────
/**
 * POST /api/mitigation/apply
 * Body: { data: [...], config: {...}, method: string, strength: number }
 * Returns: { mitigatedData, originalMetrics, newMetrics, improvement }
 */
app.post('/api/mitigation/apply', (req, res) => {
  try {
    const { data, config, method, strength = 0.7 } = req.body;
    if (!data || !config || !method) return res.status(400).json({ error: 'Missing data, config, or method' });

    const validMethods = ['reweighing', 'threshold', 'adversarial', 'preprocessing', 'postprocessing', 'remover'];
    if (!validMethods.includes(method)) return res.status(400).json({ error: `Invalid method. Choose from: ${validMethods.join(', ')}` });

    const originalMetrics = computeMetricsServer(data, config);
    const mitigatedData = applyMitigationServer(data, config, method, strength);
    const newMetrics = computeMetricsServer(mitigatedData, config);

    const improvement = {
      scoreDelta: newMetrics.overallRisk.score - originalMetrics.overallRisk.score,
      gradeBefore: originalMetrics.overallRisk.grade,
      gradeAfter: newMetrics.overallRisk.grade,
      disparateImpactBefore: originalMetrics.disparateImpact?.value,
      disparateImpactAfter: newMetrics.disparateImpact?.value,
    };

    res.json({ method, strength, originalMetrics, newMetrics, improvement, mitigatedRowCount: mitigatedData.length });
  } catch (err) {
    console.error('/api/mitigation/apply error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Server-side metric computation helpers ────────────────────────────────────
function computeMetricsServer(data, config) {
  const { protectedAttr, outcomeAttr, referenceGroup } = config;
  const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(g => g != null && g !== '');
  const rates = {};
  groups.forEach(g => {
    const gData = data.filter(r => r[protectedAttr] === g);
    rates[g] = gData.length === 0 ? 0 : gData.filter(r => Number(r[outcomeAttr]) === 1).length / gData.length;
  });
  const refRate = rates[referenceGroup] ?? Math.max(...Object.values(rates));
  const diByGroup = {};
  Object.entries(rates).forEach(([g, r]) => { diByGroup[g] = g === referenceGroup ? 1 : (refRate > 0 ? r / refRate : 0); });
  const minDI = Math.min(...Object.values(diByGroup));
  const spByGroup = {};
  Object.entries(rates).forEach(([g, r]) => { spByGroup[g] = r - (rates[referenceGroup] ?? 0); });
  const maxSP = Math.max(...Object.values(spByGroup).map(Math.abs));

  const disparateImpact  = { value: Math.round(minDI * 1000) / 1000, byGroup: diByGroup, threshold: 0.8, status: minDI >= 0.8 ? 'pass' : minDI >= 0.6 ? 'warning' : 'critical' };
  const statisticalParity= { value: Math.round(maxSP * 1000) / 1000, byGroup: spByGroup, threshold: 0.1, status: maxSP <= 0.05 ? 'pass' : maxSP <= 0.1 ? 'warning' : 'critical' };

  const passCount = [disparateImpact, statisticalParity].filter(m => m.status === 'pass').length;
  const critCount = [disparateImpact, statisticalParity].filter(m => m.status === 'critical').length;
  const rawScore = 100 - (critCount * 3 / (2 * 3)) * 100;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  return { groups, selectionRates: rates, disparateImpact, statisticalParity, overallRisk: { score, grade } };
}

function applyMitigationServer(data, config, method, strength) {
  const { protectedAttr, outcomeAttr, referenceGroup } = config;
  return data.map(row => {
    const newRow = { ...row };
    const isProtected = row[protectedAttr] !== referenceGroup;
    if (method === 'reweighing' || method === 'preprocessing') {
      if (isProtected && Number(row[outcomeAttr]) === 0 && Math.random() < strength * 0.3) newRow[outcomeAttr] = 1;
    } else if (method === 'threshold' || method === 'postprocessing') {
      if (isProtected && Number(row[outcomeAttr]) === 0 && Math.random() < strength * 0.25) newRow[outcomeAttr] = 1;
    } else {
      if (isProtected && Number(row[outcomeAttr]) === 0 && Math.random() < strength * 0.2) newRow[outcomeAttr] = 1;
    }
    return newRow;
  });
}

// ── AI Routes (rate-limited) ──────────────────────────────────────────────────
/**
 * POST /api/ai/narrative
 */
app.post('/api/ai/narrative', rateLimit, async (req, res) => {
  try {
    const { metrics, config, datasetLabel, rowCount } = req.body;
    if (!metrics || !config) return res.status(400).json({ error: 'Missing metrics or config' });
    const { protectedAttr, outcomeAttr, referenceGroup } = config;
    const grade = metrics.overallRisk?.grade ?? 'C';
    const score = metrics.overallRisk?.score ?? 50;
    const metricLines = [
      metrics.disparateImpact    && `- Disparate Impact Ratio: ${metrics.disparateImpact.value?.toFixed(3)} (${metrics.disparateImpact.status})`,
      metrics.statisticalParity  && `- Statistical Parity Difference: ${metrics.statisticalParity.value?.toFixed(3)} (${metrics.statisticalParity.status})`,
      metrics.equalOpportunity   && `- Equal Opportunity Difference: ${metrics.equalOpportunity.value?.toFixed(3)} (${metrics.equalOpportunity.status})`,
      metrics.equalizedOdds      && `- Equalized Odds: ${metrics.equalizedOdds.value?.toFixed(3)} (${metrics.equalizedOdds.status})`,
      metrics.predictiveParity   && `- Predictive Parity: ${metrics.predictiveParity.value?.toFixed(3)} (${metrics.predictiveParity.status})`,
      metrics.calibration        && `- Calibration Error: ${metrics.calibration.value?.toFixed(3)} (${metrics.calibration.status})`,
      metrics.individualFairness && `- Individual Fairness: ${metrics.individualFairness.value?.toFixed(3)} (${metrics.individualFairness.status})`,
      metrics.intersectionality  && `- Intersectionality: ${metrics.intersectionality.value?.toFixed(3)} (${metrics.intersectionality.status})`,
    ].filter(Boolean).join('\n');

    const prompt = `You are an expert AI ethics auditor writing an executive summary for a fairness audit report.
Dataset: ${datasetLabel} (${rowCount} records)
Protected attribute: ${protectedAttr}, Reference group: ${referenceGroup}, Outcome: ${outcomeAttr}
Overall fairness grade: ${grade} (${score}/100)
Fairness metrics:\n${metricLines}

Write a clear, professional 3-paragraph executive summary for a non-technical audience.
Paragraph 1: Overview of what was audited and the overall finding.
Paragraph 2: Most critical specific findings and their real-world implications.
Paragraph 3: Key recommended next steps.
Use plain language. Mention specific groups and metrics. Be direct about severity. No bullet points. No markdown headers. Under 250 words.`;

    const narrative = await withTimeout(offlineAi(prompt), 45000);
    res.json({ narrative: narrative.trim() });
  } catch (err) {
    console.warn('Offline AI Error (Narrative), engaging fallback:', err.message);
    const { metrics, config, datasetLabel, rowCount } = req.body;
    const fallbackNarrative = fallback.generateNarrativeFallback(metrics, config, datasetLabel, rowCount);
    res.json({ narrative: fallbackNarrative, isFallback: true });
  }
});

/**
 * POST /api/ai/explain
 */
app.post('/api/ai/explain', rateLimit, async (req, res) => {
  try {
    const { metricName, value, status, threshold, groups, context } = req.body;
    if (!metricName) return res.status(400).json({ error: 'Missing metricName' });
    const groupText = groups && Object.keys(groups).length ? `Affected groups: ${JSON.stringify(groups)}. ` : '';
    const prompt = `Explain the "${metricName}" fairness metric result to a non-technical business audience in 2-3 sentences.
Result: ${value} (${status}), Regulatory threshold: ${threshold}
${groupText}Context: ${context || 'automated decision system'}
Be specific: name actual impact on real people. Explain why this matters. Plain language. No jargon. No bullet points. No headers.`;
    const explanation = await withTimeout(offlineAi(prompt), 45000);
    res.json({ explanation: explanation.trim() });
  } catch (err) {
    console.warn('Offline AI Error (Explain), engaging fallback:', err.message);
    const { metricName, value, status, threshold, groups, context } = req.body;
    const fallbackExplain = fallback.generateExplanationFallback(metricName, value, status, threshold, groups, context);
    res.json({ explanation: fallbackExplain, isFallback: true });
  }
});

/**
 * POST /api/ai/recommend
 */
app.post('/api/ai/recommend', rateLimit, async (req, res) => {
  try {
    const { metrics, config, datasetLabel } = req.body;
    if (!metrics) return res.status(400).json({ error: 'Missing metrics' });
    const criticals = Object.entries(metrics).filter(([, v]) => v && v.status === 'critical').map(([k]) => k).join(', ') || 'none';
    const warnings  = Object.entries(metrics).filter(([, v]) => v && v.status === 'warning').map(([k]) => k).join(', ') || 'none';
    const prompt = `You are an AI fairness consultant. Provide a prioritized, actionable remediation plan.
Dataset: ${datasetLabel}, Protected attribute: ${config.protectedAttr}
Critical violations: ${criticals}, Warnings: ${warnings}, Overall grade: ${metrics.overallRisk?.grade}
Write exactly 4 numbered recommendations in order of priority. Each: specific and actionable, name the technique, expected impact, trade-offs. 2-3 sentences each. Plain language. No markdown headers.`;
    const recommendations = await withTimeout(offlineAi(prompt), 45000);
    res.json({ recommendations: recommendations.trim() });
  } catch (err) {
    console.warn('Offline AI Error (Recommend), engaging fallback:', err.message);
    const { metrics, config, datasetLabel } = req.body;
    const fallbackRecs = fallback.generateRecommendationsFallback(metrics, config, datasetLabel);
    res.json({ recommendations: fallbackRecs, isFallback: true });
  }
});

/**
 * POST /api/ai/code
 */
app.post('/api/ai/code', rateLimit, async (req, res) => {
  try {
    const { metrics, config, method, datasetLabel } = req.body;
    if (!metrics || !method) return res.status(400).json({ error: 'Missing metrics or method' });
    const prompt = `You are a Senior ML Engineer specializing in AI Fairness.
Generate Python code using the Fairlearn library to apply the "${method}" mitigation technique to the "${datasetLabel}" dataset.
Protected attribute: ${config.protectedAttr}, Target variable: ${config.outcomeAttr}
Key bias: ${metrics.disparateImpact?.value?.toFixed(3)} Disparate Impact
The code should: 1. Import Fairlearn components. 2. Wrap a scikit-learn classifier. 3. Demonstrate fitting with fairness constraints. 4. Briefly explain what it does.
Use best practices. Assume data is in pandas DataFrame 'df'.
Return in two parts:
[EXPLANATION]
... brief explanation ...
[CODE]
\`\`\`python
... code ...
\`\`\``;
    const result = await withTimeout(offlineAi(prompt), 45000);
    const [explanation, codePart] = result.split('[CODE]');
    const cleanExplanation = explanation.replace('[EXPLANATION]', '').trim();
    const cleanCode = codePart ? codePart.trim() : '';
    res.json({ explanation: cleanExplanation, code: cleanCode });
  } catch (err) {
    console.warn('Offline AI Error (Code), engaging fallback:', err.message);
    const { metrics, config, method, datasetLabel } = req.body;
    const { explanation, code } = fallback.generateCodeFallback(metrics, config, method, datasetLabel);
    res.json({ explanation, code, isFallback: true });
  }
});

/**
 * POST /api/ai/chat
 */
app.post('/api/ai/chat', rateLimit, async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message' });
    const ctx = context || {};
    const grade = ctx.metricSummary?.grade ?? ctx.metricsummary?.grade ?? 'unknown';
    const dataset = ctx.datasetLabel ?? 'the loaded dataset';
    const prompt = `You are an AI fairness expert assistant helping users understand their bias audit results.
Current audit context:
- Dataset: ${dataset}
- Protected attribute: ${ctx.config?.protectedAttr ?? 'unknown'}
- Overall grade: ${grade}
- Key metrics: ${JSON.stringify(ctx.metricSummary ?? {})}
User question: "${message}"
Answer in 2-4 sentences. Be specific to their audit results when possible. Use plain language for a business audience. If you don't have enough context, give a general educational answer about AI fairness. Do not use markdown.`;
    const reply = await withTimeout(offlineAi(prompt), 45000);
    res.json({ reply: reply.trim() });
  } catch (err) {
    console.warn('Offline AI Error (Chat), engaging fallback:', err.message);
    const { message, context } = req.body;
    const fallbackReply = fallback.generateChatFallback(message, context);
    res.json({ reply: fallbackReply, isFallback: true });
  }
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Unbiased AI Auditor',
    version: '3.0.0',
    model: 'Xenova/Qwen1.5-0.5B-Chat (Offline)',
    aiEnabled: true,
    timestamp: new Date().toISOString(),
    sdgAlignment: ['SDG 10: Reduced Inequalities', 'SDG 16: Peace, Justice & Strong Institutions', 'SDG 8: Decent Work'],
  });
});

// ── SPA Catch-all ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🛡️  Unbiased AI Auditor v3.0.0 running on port ${PORT}`);
  console.log(`✨  Offline AI Engine (Transformers.js · Qwen1.5-0.5B-Chat)`);
  console.log(`🌍  SDG 10 · SDG 16 · SDG 8 — Google Solution Challenge 2026`);
});
