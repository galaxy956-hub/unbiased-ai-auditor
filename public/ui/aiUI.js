// AI UI — Local Offline AI features: metric explainer, chat widget, report narrative
const AiUI = {
  // Detect if running via Node server (not file://) so AI calls can be made
  get isServerMode() {
    return window.location.protocol !== 'file:';
  },

  // ── EXPLAIN BUTTON ──────────────────────────────────────────────────────────
  explainButton(metricName, value, status, threshold, groups, context) {
    if (!this.isServerMode) return '';
    const safeGroups = JSON.stringify(groups || {}).replace(/'/g, '&#39;');
    return `<button class="ai-explain-btn" onclick='AiUI.explain(${JSON.stringify(metricName)},${JSON.stringify(String(value))},${JSON.stringify(status)},${JSON.stringify(threshold)},${safeGroups},${JSON.stringify(context||"")})'>
      ✨ Explain with AI
    </button>`;
  },

  async explain(metricName, value, status, threshold, groups, context) {
    // Find the ai-explain-result div closest to the clicked button for this metric
    // Search by matching onclick string containing the metric name
    let resultDiv = null;
    document.querySelectorAll('.ai-explain-btn').forEach(btn => {
      if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(JSON.stringify(metricName))) {
        const card = btn.closest('.metric-card');
        if (card) resultDiv = card.querySelector('.ai-explain-result');
      }
    });

    if (resultDiv) {
      resultDiv.innerHTML = `<div class="ai-loading">✨ AI is thinking…</div>`;
      resultDiv.style.display = 'block';
    }

    try {
      const resp = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricName, value, status, threshold, groups, context })
      });
      const data = await resp.json();
      if (resultDiv) {
        const prefix = data.isFallback ? '⚡ <strong>[Fallback Rules]:</strong> ' : '✨ <strong>Offline AI:</strong> ';
        resultDiv.innerHTML = `<div class="ai-result-text">${prefix}${data.explanation || data.error}</div>`;
      }
    } catch (err) {
      if (resultDiv) resultDiv.innerHTML = `<div class="ai-error">Failed to reach AI: ${err.message}</div>`;
    }
  },

  // ── AI NARRATIVE (Report tab) ───────────────────────────────────────────────
  async generateNarrative(metrics, config, datasetLabel, rowCount) {
    const box = document.getElementById('ai-narrative-box');
    const btn = document.getElementById('ai-narrative-btn');
    if (!box || !btn) return;

    btn.disabled = true;
    btn.textContent = '✨ Generating…';
    box.innerHTML = `<div class="ai-loading">✨ Offline AI is writing your executive summary…</div>`;
    box.style.display = 'block';

    try {
      const resp = await fetch('/api/ai/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, config, datasetLabel, rowCount })
      });
      const data = await resp.json();
      const prefix = data.isFallback ? '<div style="color:var(--warning);font-size:0.75rem;margin-bottom:0.5rem;">⚡ Operating in Offline Fallback Mode</div>' : '';
      box.innerHTML = `<div class="ai-result-text">${prefix}${data.narrative || data.error}</div>`;
    } catch (err) {
      box.innerHTML = `<div class="ai-error">Failed to reach AI: ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Regenerate with AI';
    }
  },

  // ── AI RECOMMENDATIONS (Report tab) ────────────────────────────────────────
  async generateRecommendations(metrics, config, datasetLabel) {
    const box = document.getElementById('ai-recs-box');
    const btn = document.getElementById('ai-recs-btn');
    if (!box || !btn) return;

    btn.disabled = true;
    btn.textContent = '✨ Generating…';
    box.innerHTML = `<div class="ai-loading">✨ Offline AI is building your remediation plan…</div>`;
    box.style.display = 'block';

    try {
      const resp = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, config, datasetLabel })
      });
      const data = await resp.json();
      const prefix = data.isFallback ? '<div style="color:var(--warning);font-size:0.75rem;margin-bottom:0.5rem;">⚡ Operating in Offline Fallback Mode</div>' : '';
      box.innerHTML = `<div class="ai-result-text">${prefix}${(data.recommendations || data.error).replace(/\n/g, '<br>')}</div>`;
    } catch (err) {
      box.innerHTML = `<div class="ai-error">Failed to reach AI: ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Regenerate with AI';
    }
  },

  // ── AI REMEDIATION CODE (Lab tab) ──────────────────────────────────────────
  async generateRemediationCode(metrics, config, method, datasetLabel) {
    const box = document.getElementById('ai-code-box');
    const btn = document.getElementById('ai-code-btn');
    if (!box || !btn) return;

    btn.disabled = true;
    btn.textContent = '✨ Generating Code…';
    box.innerHTML = `<div class="ai-loading">✨ Offline AI is architecting your fairness pipeline…</div>`;
    box.style.display = 'block';

    try {
      const resp = await fetch('/api/ai/code', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ metrics, config, method, datasetLabel })
      });
      const data = await resp.json();
      
      const prefix = data.isFallback ? '<div style="color:var(--warning);font-size:0.75rem;margin-bottom:0.5rem;">⚡ Operating in Offline Fallback Mode</div>' : '';
      let html = `<div class="ai-result-text" style="margin-bottom:1rem;">${prefix}${data.explanation}</div>`;
      if (data.code) {
        // Extract code from markdown if present
        const code = data.code.includes('```') ? data.code.split('```')[1].replace('python\n', '') : data.code;
        html += `<div class="code-wrap">
          <div class="code-header">
            <span>Python / Fairlearn</span>
            <button onclick="navigator.clipboard.writeText(this.parentNode.nextElementSibling.textContent); this.textContent='Copied!'">Copy</button>
          </div>
          <pre class="code-block">${code.trim()}</pre>
        </div>`;
      }
      box.innerHTML = html;
    } catch (err) {
      box.innerHTML = `<div class="ai-error">Failed to reach AI: ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Get Python Remediation Code';
    }
  },

  // ── CHAT WIDGET ─────────────────────────────────────────────────────────────
  chatOpen: false,
  chatHistory: [],

  initChat() {
    if (!this.isServerMode) return;
    // Already exists?
    if (document.getElementById('ai-chat-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'ai-chat-widget';
    widget.innerHTML = `
      <button class="chat-toggle" id="chat-toggle-btn" onclick="AiUI.toggleChat()" aria-label="Open AI Robot Assistant">
        <div class="robot-face-mini">
          <div class="robot-antenna"><div class="robot-antenna-ball"></div></div>
          <div class="robot-head-mini">
            <div class="robot-eyes-mini">
              <div class="robot-eye-mini"></div>
              <div class="robot-eye-mini"></div>
            </div>
            <div class="robot-mouth-mini"></div>
          </div>
        </div>
        <span class="chat-label">Ask AI</span>
        <div class="robot-signal"></div>
      </button>
      <div class="chat-panel" id="chat-panel" style="display:none;">
        <div class="chat-header robot-header">
          <div class="robot-avatar">
            <div class="robot-ear left-ear"></div>
            <div class="robot-head">
              <div class="robot-top-panel">
                <div class="robot-bolt"></div>
                <div class="robot-top-antenna"><div class="robot-top-ball"></div></div>
                <div class="robot-bolt"></div>
              </div>
              <div class="robot-face-panel">
                <div class="robot-visor">
                  <div class="robot-eye left"></div>
                  <div class="robot-eye right"></div>
                </div>
                <div class="robot-nose"></div>
                <div class="robot-mouth-bar">
                  <span class="robot-tooth"></span>
                  <span class="robot-tooth"></span>
                  <span class="robot-tooth"></span>
                </div>
              </div>
            </div>
            <div class="robot-ear right-ear"></div>
          </div>
          <div class="robot-header-text">
            <span class="robot-name">AURA-7</span>
            <span class="robot-status-line"><span class="robot-status-dot"></span>Online · Fairness AI</span>
          </div>
          <button onclick="AiUI.toggleChat()" class="robot-close-btn" aria-label="Close">×</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="chat-msg ai-msg robot-intro">
            <span class="robot-prefix">🤖</span> Hello! I am <strong>AURA-7</strong>, your AI Fairness Auditor. Ask me anything about your bias audit results!
          </div>
        </div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" placeholder="Ask AURA-7 about your audit…" onkeydown="if(event.key==='Enter')AiUI.sendChat()">
          <button onclick="AiUI.sendChat()" class="chat-send-btn" aria-label="Send">▶</button>
        </div>
        <div class="robot-footer">⚙️ Powered by Offline AI · Transformers.js</div>
      </div>`;
    document.body.appendChild(widget);
  },

  toggleChat() {
    this.chatOpen = !this.chatOpen;
    const panel = document.getElementById('chat-panel');
    if (panel) panel.style.display = this.chatOpen ? 'flex' : 'none';
  },

  async sendChat() {
    const input = document.getElementById('chat-input');
    const messages = document.getElementById('chat-messages');
    if (!input || !messages) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    // Add user message
    messages.innerHTML += `<div class="chat-msg user-msg">${msg}</div>`;
    messages.innerHTML += `<div class="chat-msg ai-msg thinking" id="chat-thinking"><span class="robot-typing"><span></span><span></span><span></span></span> AURA-7 is processing…</div>`;
    messages.scrollTop = messages.scrollHeight;

    // Build context from AppState
    const ctx = {
      datasetLabel: (Datasets?.configs?.[AppState?.datasetKey] || {}).label || 'loaded dataset',
      config: AppState?.config || {},
      metricSummary: {
        grade: AppState?.metrics?.overallRisk?.grade,
        score: AppState?.metrics?.overallRisk?.score,
        disparateImpact: AppState?.metrics?.disparateImpact?.value,
        statisticalParity: AppState?.metrics?.statisticalParity?.value,
        equalOpportunity: AppState?.metrics?.equalOpportunity?.value,
        intersectionality: AppState?.metrics?.intersectionality?.value,
        criticalCount: Object.values(AppState?.metrics || {}).filter(v => v && v.status === 'critical').length,
      }
    };

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: ctx })
      });
      const data = await resp.json();
      const thinking = document.getElementById('chat-thinking');
      if (thinking) thinking.remove();
      if (!resp.ok) {
        const errMsg = data.error || `Server error (${resp.status})`;
        messages.innerHTML += `<div class="chat-msg ai-msg robot-error">⚠️ ${errMsg}</div>`;
      } else {
        const prefix = data.isFallback ? '⚡ ' : '🤖 ';
        messages.innerHTML += `<div class="chat-msg ai-msg">${prefix}${data.reply || data.error}</div>`;
      }
    } catch (err) {
      const thinking = document.getElementById('chat-thinking');
      if (thinking) thinking.remove();
      messages.innerHTML += `<div class="chat-msg ai-msg robot-error">⚠️ Could not reach AI: ${err.message}. Please check your connection.</div>`;
    }
    messages.scrollTop = messages.scrollHeight;
  },

  // ── SERVER STATUS BANNER ────────────────────────────────────────────────────
  async showBanner() {
    if (!this.isServerMode) {
      const banner = document.createElement('div');
      banner.className = 'ai-offline-banner';
      banner.innerHTML = `⚡ Running in <strong>local file mode</strong>. AI features require the Node.js server to run the local model. Run <code>npm start</code>.`;
      document.body.insertBefore(banner, document.body.firstChild);
      return;
    }
    try {
      const resp = await fetch('/api/health');
      const data = await resp.json();
      if (!data.aiEnabled) {
        const banner = document.createElement('div');
        banner.className = 'ai-offline-banner';
        banner.innerHTML = `⚠️ Offline AI model failed to load during startup. Check server logs.`;
        document.body.insertBefore(banner, document.body.firstChild);
      }
    } catch (e) { /* ignore */ }
  }
};

// Inject AI widget styles
const _aiStyle = document.createElement('style');
_aiStyle.textContent = `
.ai-explain-btn{margin-top:.6rem;padding:.3rem .7rem;background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(6,182,212,.15));border:1px solid rgba(99,102,241,.4);color:var(--primary-light);border-radius:99px;font-size:.72rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;}
.ai-explain-btn:hover{background:rgba(99,102,241,.35);}
.ai-explain-result{margin-top:.6rem;border-radius:8px;border-left:3px solid var(--primary);padding:.7rem;background:rgba(99,102,241,.08);display:none;}
.ai-result-text{font-size:.8rem;color:var(--text-dim);line-height:1.7;}
.ai-loading{font-size:.8rem;color:var(--primary-light);font-style:italic;}
.ai-error{font-size:.8rem;color:var(--danger);}
.ai-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;background:linear-gradient(135deg,var(--primary),#4f46e5);border:none;color:#fff;border-radius:99px;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;box-shadow:0 4px 16px rgba(99,102,241,.35);}
.ai-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(99,102,241,.5);}
.ai-btn:disabled{opacity:.5;cursor:not-allowed;}
.ai-narrative-box{margin-top:1rem;padding:1.2rem;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.2);border-radius:var(--radius-sm);display:none;}
.ai-offline-banner{background:rgba(245,158,11,.15);border-bottom:1px solid rgba(245,158,11,.3);padding:.6rem 2rem;font-size:.8rem;color:var(--warning);text-align:center;}
.ai-offline-banner code{background:rgba(245,158,11,.15);padding:.1rem .4rem;border-radius:4px;font-family:monospace;}
/* Chat widget position — visual styles handled by ui/robot.css */
#ai-chat-widget{position:fixed;bottom:1.5rem;right:1.5rem;z-index:200;font-family:Inter,sans-serif;}
/* Code Blocks */
.code-wrap{background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:.5rem;}
.code-header{padding:.4rem .8rem;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:var(--text-muted);border-bottom:1px solid var(--border);}
.code-header button{background:transparent;border:none;color:var(--primary-light);cursor:pointer;font-size:.7rem;font-weight:600;}
.code-block{padding:1rem;font-family:monospace;font-size:.75rem;color:var(--text-dim);overflow-x:auto;margin:0;}
`;
document.head.appendChild(_aiStyle);
