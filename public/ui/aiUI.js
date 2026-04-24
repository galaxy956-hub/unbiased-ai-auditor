// AI UI — Gemini-powered features: metric explainer, chat widget, report narrative
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
    const btnSelector = `[data-explain="${metricName}"]`;
    // Find and update the nearest explain result div
    const allBtns = document.querySelectorAll('.ai-explain-btn');
    let targetBtn = null;
    allBtns.forEach(b => { if (b.textContent.includes('Explain with AI') && b.onclick?.toString().includes(metricName)) targetBtn = b; });

    const resultDiv = targetBtn ? targetBtn.closest('.metric-card')?.querySelector('.ai-explain-result') : null;

    if (resultDiv) {
      resultDiv.innerHTML = `<div class="ai-loading">✨ Gemini is thinking…</div>`;
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
        resultDiv.innerHTML = `<div class="ai-result-text">✨ <strong>Gemini:</strong> ${data.explanation || data.error}</div>`;
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
    box.innerHTML = `<div class="ai-loading">✨ Gemini is writing your executive summary…</div>`;
    box.style.display = 'block';

    try {
      const resp = await fetch('/api/ai/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, config, datasetLabel, rowCount })
      });
      const data = await resp.json();
      box.innerHTML = `<div class="ai-result-text">${data.narrative || data.error}</div>`;
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
    box.innerHTML = `<div class="ai-loading">✨ Gemini is building your remediation plan…</div>`;
    box.style.display = 'block';

    try {
      const resp = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, config, datasetLabel })
      });
      const data = await resp.json();
      box.innerHTML = `<div class="ai-result-text">${(data.recommendations || data.error).replace(/\n/g, '<br>')}</div>`;
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
    box.innerHTML = `<div class="ai-loading">✨ Gemini is architecting your fairness pipeline…</div>`;
    box.style.display = 'block';

    try {
      const resp = await fetch('/api/ai/code', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ metrics, config, method, datasetLabel })
      });
      const data = await resp.json();
      
      let html = `<div class="ai-result-text" style="margin-bottom:1rem;">${data.explanation}</div>`;
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
      <button class="chat-toggle" id="chat-toggle-btn" onclick="AiUI.toggleChat()">
        <span class="chat-icon">✨</span>
        <span class="chat-label">Ask AI</span>
      </button>
      <div class="chat-panel" id="chat-panel" style="display:none;">
        <div class="chat-header">
          <span>✨ Gemini Bias Assistant</span>
          <button onclick="AiUI.toggleChat()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2rem;">×</button>
        </div>
        <div class="chat-messages" id="chat-messages">
          <div class="chat-msg ai-msg">Hi! I'm Gemini. Ask me anything about your fairness audit results — metrics, implications, or how to fix bias.</div>
        </div>
        <div class="chat-input-row">
          <input type="text" id="chat-input" placeholder="Ask about your audit…" onkeydown="if(event.key==='Enter')AiUI.sendChat()">
          <button onclick="AiUI.sendChat()" class="chat-send-btn">↑</button>
        </div>
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
    messages.innerHTML += `<div class="chat-msg ai-msg thinking" id="chat-thinking">Gemini is thinking…</div>`;
    messages.scrollTop = messages.scrollHeight;

    // Build context from AppState
    const ctx = {
      datasetLabel: (Datasets?.configs?.[AppState?.datasetKey] || {}).label || 'loaded dataset',
      config: AppState?.config || {},
      metricsummary: {
        grade: AppState?.metrics?.overallRisk?.grade,
        score: AppState?.metrics?.overallRisk?.score,
        disparateImpact: AppState?.metrics?.disparateImpact?.value,
        equalOpportunity: AppState?.metrics?.equalOpportunity?.value,
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
      messages.innerHTML += `<div class="chat-msg ai-msg">${data.reply || data.error}</div>`;
    } catch (err) {
      const thinking = document.getElementById('chat-thinking');
      if (thinking) thinking.textContent = `Error: ${err.message}`;
    }
    messages.scrollTop = messages.scrollHeight;
  },

  // ── SERVER STATUS BANNER ────────────────────────────────────────────────────
  async showBanner() {
    if (!this.isServerMode) {
      const banner = document.createElement('div');
      banner.className = 'ai-offline-banner';
      banner.innerHTML = `⚡ Running in <strong>local file mode</strong>. AI features require the Node.js server. Run <code>npm start</code> to enable Gemini AI.`;
      document.body.insertBefore(banner, document.body.firstChild);
      return;
    }
    try {
      const resp = await fetch('/api/health');
      const data = await resp.json();
      if (!data.aiEnabled) {
        const banner = document.createElement('div');
        banner.className = 'ai-offline-banner';
        banner.innerHTML = `⚠️ Gemini AI is disabled. Set the <code>GEMINI_API_KEY</code> environment variable and restart the server.`;
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
/* Chat widget */
#ai-chat-widget{position:fixed;bottom:1.5rem;right:1.5rem;z-index:200;font-family:Inter,sans-serif;}
.chat-toggle{display:flex;align-items:center;gap:.5rem;background:linear-gradient(135deg,var(--primary),#4f46e5);border:none;color:#fff;padding:.7rem 1.2rem;border-radius:99px;cursor:pointer;font-size:.85rem;font-weight:600;box-shadow:0 4px 20px rgba(99,102,241,.5);transition:all .2s;}
.chat-toggle:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(99,102,241,.6);}
.chat-icon{font-size:1rem;}
.chat-panel{position:absolute;bottom:3.5rem;right:0;width:340px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);flex-direction:column;overflow:hidden;max-height:500px;}
.chat-header{padding:.8rem 1rem;background:linear-gradient(135deg,var(--primary),#4f46e5);display:flex;justify-content:space-between;align-items:center;font-size:.85rem;font-weight:600;color:#fff;}
.chat-messages{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem;min-height:200px;max-height:340px;}
.chat-msg{padding:.65rem .85rem;border-radius:12px;font-size:.8rem;line-height:1.6;max-width:92%;}
.ai-msg{background:var(--surface2);color:var(--text-dim);align-self:flex-start;border-radius:12px 12px 12px 3px;}
.user-msg{background:linear-gradient(135deg,var(--primary),#4f46e5);color:#fff;align-self:flex-end;border-radius:12px 12px 3px 12px;}
.thinking{font-style:italic;opacity:.7;}
.chat-input-row{display:flex;gap:.5rem;padding:.75rem;border-top:1px solid var(--border);}
#chat-input{flex:1;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:.5rem .8rem;border-radius:8px;font-size:.8rem;font-family:inherit;outline:none;}
#chat-input:focus{border-color:var(--primary);}
.chat-send-btn{background:var(--primary);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;}
/* Code Blocks */
.code-wrap{background:var(--bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:.5rem;}
.code-header{padding:.4rem .8rem;background:var(--surface2);display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:var(--text-muted);border-bottom:1px solid var(--border);}
.code-header button{background:transparent;border:none;color:var(--primary-light);cursor:pointer;font-size:.7rem;font-weight:600;}
.code-block{padding:1rem;font-family:monospace;font-size:.75rem;color:var(--text-dim);overflow-x:auto;margin:0;}
`;
document.head.appendChild(_aiStyle);
