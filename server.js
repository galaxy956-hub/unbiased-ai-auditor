const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = parseInt(process.env.PORT) || 8080;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Gemini client (lazy init so missing key just disables AI features) ────────
let ai = null;
function getAI() {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY environment variable is not set.');
    ai = new GoogleGenAI({ apiKey: key });
  }
  return ai;
}

const MODEL = 'gemini-2.0-flash';

// Helper: call Gemini with a prompt and return text
async function gemini(prompt) {
  const client = getAI();
  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    }
  });
  return response.text();
}

// ── API Routes ────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/narrative
 * Body: { metrics, config, datasetLabel, rowCount }
 * Returns: { narrative: string }
 */
app.post('/api/ai/narrative', async (req, res) => {
  try {
    const { metrics, config, datasetLabel, rowCount } = req.body;
    if (!metrics || !config) return res.status(400).json({ error: 'Missing metrics or config' });

    const { protectedAttr, outcomeAttr, referenceGroup } = config;
    const grade = metrics.overallRisk?.grade ?? 'C';
    const score = metrics.overallRisk?.score ?? 50;

    // Summarise metric statuses for the prompt
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
Protected attribute analyzed: ${protectedAttr}
Reference (privileged) group: ${referenceGroup}
Outcome variable: ${outcomeAttr}
Overall fairness grade: ${grade} (${score}/100)

Fairness metric results:
${metricLines}

Write a clear, professional 3-paragraph executive summary for a non-technical audience. 
Paragraph 1: Overview of what was audited and the overall finding.
Paragraph 2: The most critical specific findings and their real-world implications for affected people.
Paragraph 3: Key recommended next steps.

Use plain language. Mention specific groups and metrics. Be direct about severity. Do not use bullet points.
Do not use markdown headers. Keep total length under 250 words.`;

    const narrative = await gemini(prompt);
    res.json({ narrative: narrative.trim() });
  } catch (err) {
    console.error('/api/ai/narrative error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/explain
 * Body: { metricName, value, status, threshold, groups, context }
 * Returns: { explanation: string }
 */
app.post('/api/ai/explain', async (req, res) => {
  try {
    const { metricName, value, status, threshold, groups, context } = req.body;
    if (!metricName) return res.status(400).json({ error: 'Missing metricName' });

    const groupText = groups ? `The affected groups are: ${JSON.stringify(groups)}. ` : '';

    const prompt = `Explain the "${metricName}" fairness metric result to a non-technical business audience in 2-3 sentences.

Result: ${value} (${status})
Regulatory threshold: ${threshold}
${groupText}
Context: ${context || 'automated decision system'}

Be specific: name the actual impact on real people (e.g. "qualified women are X% less likely to be hired"). 
Explain why this matters. Use plain language. No jargon. No bullet points. No headers.`;

    const explanation = await gemini(prompt);
    res.json({ explanation: explanation.trim() });
  } catch (err) {
    console.error('/api/ai/explain error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/recommend
 * Body: { metrics, config, datasetLabel }
 * Returns: { recommendations: string }
 */
app.post('/api/ai/recommend', async (req, res) => {
  try {
    const { metrics, config, datasetLabel } = req.body;
    if (!metrics) return res.status(400).json({ error: 'Missing metrics' });

    const criticals = Object.entries(metrics)
      .filter(([, v]) => v && v.status === 'critical')
      .map(([k]) => k).join(', ') || 'none';
    const warnings = Object.entries(metrics)
      .filter(([, v]) => v && v.status === 'warning')
      .map(([k]) => k).join(', ') || 'none';

    const prompt = `You are an AI fairness consultant. Provide a prioritized, actionable remediation plan for the following audit results.

Dataset: ${datasetLabel}
Protected attribute: ${config.protectedAttr}
Critical violations: ${criticals}
Warnings: ${warnings}
Overall grade: ${metrics.overallRisk?.grade}

Write exactly 4 numbered recommendations in order of priority. Each should be:
- Specific and actionable (not generic)
- Name the exact technique or approach
- Explain the expected impact
- Note any trade-offs

Keep each recommendation to 2-3 sentences. Use plain language. No markdown headers.`;

    const recommendations = await gemini(prompt);
    res.json({ recommendations: recommendations.trim() });
  } catch (err) {
    console.error('/api/ai/recommend error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ai/chat
 * Body: { message, context: { metrics, config, datasetLabel } }
 * Returns: { reply: string }
 */
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message' });

    const ctx = context || {};
    const grade = ctx.metrics?.overallRisk?.grade ?? 'unknown';
    const dataset = ctx.datasetLabel ?? 'the loaded dataset';

    const prompt = `You are an AI fairness expert assistant helping users understand their bias audit results.

Current audit context:
- Dataset: ${dataset}
- Protected attribute: ${ctx.config?.protectedAttr ?? 'unknown'}
- Overall grade: ${grade}
- Key metrics: ${JSON.stringify(ctx.metricsummary ?? {})}

User question: "${message}"

Answer in 2-4 sentences. Be specific to their audit results when possible. Use plain language suitable for a business audience. If you don't have enough context to answer specifically, give a general educational answer about AI fairness. Do not use markdown.`;

    const reply = await gemini(prompt);
    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error('/api/ai/chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    model: MODEL,
    aiEnabled: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// ── Catch-all: serve index.html for SPA ──────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Unbiased AI Auditor running on port ${PORT}`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? 'enabled (' + MODEL + ')' : 'disabled (set GEMINI_API_KEY)'}`);
});
