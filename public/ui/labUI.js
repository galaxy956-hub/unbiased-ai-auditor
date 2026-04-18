const LabUI = {
  _mitigatedMetrics: null,
  _running: false,

  render(root, state) {
    if (!state.data.length || !state.metrics) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state"><div class="empty-icon">🔬</div><p>Load a dataset and compute metrics before using the Mitigation Lab.</p><button class="btn-primary mt-2" onclick="AppRouter.go('explorer')">Get Started</button></div></div>`;
      return;
    }
    const method = state.labMethod || 'reweighing';
    const strength = state.labStrength !== undefined ? state.labStrength : 0.7;
    const desc = Mitigation.descriptions[method];

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>🔬 Mitigation Lab</h2>
        <p>Apply algorithmic debiasing strategies and compare outcomes before and after mitigation.</p>
      </div>

      <!-- Controls -->
      <div class="lab-controls" style="margin-bottom:1.5rem;">
        <h3>⚙️ Mitigation Configuration</h3>
        <div class="control-row">
          <span class="control-label">Strategy</span>
          <div class="method-pills">
            ${['reweighing','threshold','debiasing'].map(m => `
              <button class="method-pill ${m===method?'active':''}" onclick="LabUI.setMethod('${m}')">${Mitigation.descriptions[m].name}</button>
            `).join('')}
          </div>
        </div>
        <div class="control-row">
          <span class="control-label">Aggressiveness</span>
          <div class="slider-wrap">
            <input type="range" id="lab-strength" min="0.1" max="1.0" step="0.05" value="${strength}"
                   oninput="LabUI.updateStrength(this.value)">
            <span class="slider-val" id="lab-strength-val">${Math.round(strength*100)}%</span>
          </div>
        </div>
        <div class="card" style="background:var(--bg2);margin-top:0.75rem;">
          <div style="font-size:0.82rem;font-weight:700;margin-bottom:0.3rem;color:var(--primary-light);">${desc.name}</div>
          <div style="font-size:0.8rem;color:var(--text-dim);line-height:1.7;">${desc.summary}</div>
          <div style="font-size:0.75rem;color:var(--warning);margin-top:0.5rem;">⚖️ Trade-off: ${desc.tradeoff}</div>
        </div>
        <div style="margin-top:1rem;">
          <button class="btn-primary" id="lab-run-btn" onclick="LabUI.run()">▶ Apply Mitigation</button>
        </div>
      </div>

      <!-- Results -->
      <div id="lab-results">
        <div class="empty-state" style="padding:2rem;">
          <div class="empty-icon">⏳</div>
          <p>Click "Apply Mitigation" to see the before/after comparison.</p>
        </div>
      </div>
    </div>`;
  },

  setMethod(method) {
    AppState.labMethod = method;
    LabUI.render(document.getElementById('lab-root'), AppState);
  },

  updateStrength(val) {
    AppState.labStrength = parseFloat(val);
    const el = document.getElementById('lab-strength-val');
    if (el) el.textContent = Math.round(val * 100) + '%';
  },

  run() {
    if (this._running) return;
    this._running = true;
    const btn = document.getElementById('lab-run-btn');
    if (btn) { btn.textContent = '⏳ Running…'; btn.disabled = true; }

    setTimeout(() => {
      const method = AppState.labMethod || 'reweighing';
      const strength = AppState.labStrength !== undefined ? AppState.labStrength : 0.7;
      const mitigated = Mitigation.apply(AppState.data, AppState.config, method, strength);
      const mMetrics = BiasMetrics.computeAll(mitigated, AppState.config);
      this._mitigatedMetrics = mMetrics;
      this._running = false;
      this._renderResults(AppState.metrics, mMetrics, AppState.config);
    }, 80);
  },

  _renderResults(before, after, config) {
    const root = document.getElementById('lab-results');
    if (!root) return;

    const metricRows = [
      { key: 'disparateImpact', label: 'Disparate Impact', fmt: v => v.value?.toFixed(3) ?? '—', higherBetter: true },
      { key: 'statisticalParity', label: 'Statistical Parity', fmt: v => v.value?.toFixed(3) ?? '—', higherBetter: false },
      { key: 'equalOpportunity', label: 'Equal Opportunity', fmt: v => v.value?.toFixed(3) ?? '—', higherBetter: false },
      { key: 'equalizedOdds', label: 'Equalized Odds', fmt: v => v.value?.toFixed(3) ?? '—', higherBetter: false },
      { key: 'predictiveParity', label: 'Predictive Parity', fmt: v => v.value?.toFixed(3) ?? '—', higherBetter: false },
      { key: 'calibration', label: 'Calibration', fmt: v => v.value?.toFixed(3) ?? '—', higherBetter: false },
      { key: 'individualFairness', label: 'Individual Fairness', fmt: v => v.value?.toFixed(3) ?? '—', higherBetter: false },
    ].filter(r => before[r.key]);

    // Group-level selection rates comparison
    const groups = before.groups;
    const beforeRates = before.selectionRates;
    const afterRates = after.selectionRates;

    root.innerHTML = `
      <!-- Score comparison banner -->
      <div class="card" style="background:linear-gradient(135deg,var(--surface),var(--surface2));margin-bottom:1.5rem;">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:1rem;align-items:center;text-align:center;">
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.3rem;">BEFORE</div>
            <div class="risk-grade ${before.overallRisk.grade}" style="font-size:3.5rem;">${before.overallRisk.grade}</div>
            <div style="color:var(--text-muted);font-size:0.8rem;">${before.overallRisk.score}/100</div>
          </div>
          <div style="font-size:2rem;color:var(--primary);">→</div>
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.3rem;">AFTER</div>
            <div class="risk-grade ${after.overallRisk.grade}" style="font-size:3.5rem;">${after.overallRisk.grade}</div>
            <div style="color:var(--text-muted);font-size:0.8rem;">${after.overallRisk.score}/100</div>
          </div>
        </div>
        ${after.overallRisk.score > before.overallRisk.score ?
          `<div style="text-align:center;margin-top:0.75rem;font-size:0.85rem;color:var(--success);">✅ Fairness improved by ${after.overallRisk.score - before.overallRisk.score} points</div>` :
          `<div style="text-align:center;margin-top:0.75rem;font-size:0.85rem;color:var(--warning);">⚠️ Minimal improvement — try increasing aggressiveness</div>`
        }
      </div>

      <!-- Selection rates comparison -->
      <div class="compare-grid" style="margin-bottom:1.5rem;">
        <div class="compare-panel">
          <div class="compare-label before">BEFORE — Selection Rates by Group</div>
          ${groups.map(g => {
            const r = beforeRates[g] || 0;
            return `<div class="delta-row"><span class="delta-name">${g}</span><div style="flex:1;margin:0 0.75rem;background:var(--bg);border-radius:99px;height:6px;overflow:hidden;"><div style="width:${Math.round(r*100)}%;height:100%;background:var(--danger);border-radius:99px;"></div></div><span class="delta-before">${(r*100).toFixed(1)}%</span></div>`;
          }).join('')}
        </div>
        <div class="compare-panel">
          <div class="compare-label after">AFTER — Selection Rates by Group</div>
          ${groups.map(g => {
            const r = afterRates[g] || 0;
            return `<div class="delta-row"><span class="delta-name">${g}</span><div style="flex:1;margin:0 0.75rem;background:var(--bg);border-radius:99px;height:6px;overflow:hidden;"><div style="width:${Math.round(r*100)}%;height:100%;background:var(--success);border-radius:99px;"></div></div><span class="delta-after">${(r*100).toFixed(1)}%</span></div>`;
          }).join('')}
        </div>
      </div>

      <!-- Metric-level comparison -->
      <div class="card">
        <div class="label" style="margin-bottom:1rem;">Fairness Metrics — Before vs After</div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr><th>Metric</th><th>Before</th><th>After</th><th>Δ Change</th><th>Status</th></tr></thead>
            <tbody>
              ${metricRows.map(r => {
                const b = before[r.key], a = after[r.key];
                const bv = b?.value ?? 0, av = a?.value ?? 0;
                const delta = av - bv;
                const improved = r.higherBetter ? delta > 0 : delta < 0;
                const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(3);
                return `<tr>
                  <td style="font-weight:600;">${r.label}</td>
                  <td><span class="badge badge-${b?.status}">${r.fmt(b)}</span></td>
                  <td><span class="badge badge-${a?.status}">${r.fmt(a)}</span></td>
                  <td style="color:${improved?'var(--success)':Math.abs(delta)<0.005?'var(--text-muted)':'var(--danger)'};">${deltaStr}</td>
                  <td>${a?.status === 'pass' ? '✅' : a?.status === 'warning' ? '⚠️' : '🚨'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }
};
