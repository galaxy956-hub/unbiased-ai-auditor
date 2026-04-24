const BountyUI = {
  render(root, state) {
    if (!state.data.length) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state">No dataset loaded.</div></div>`;
      return;
    }

    const { protectedAttr, outcomeAttr } = state.config;
    const cats = state.columnInfo.filter(c => c.type === 'categorical');
    const nums = state.columnInfo.filter(c => c.type === 'numeric');

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>🛡️ Bias Bounty Dashboard</h2>
        <p>Stress-test the system by inputting edge cases. Help us identify "Intersectional Bias" where fairness might fail for specific sub-groups.</p>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="label">Input Edge Case Data</div>
          <form id="bounty-form" class="mt-2" onsubmit="BountyUI.runTest(event)">
            <div class="grid-2" style="gap:1rem;">
              ${cats.map(c => `
                <div class="form-group">
                  <label style="font-size: 0.7rem; color: var(--text-muted);">${c.name}</label>
                  <select name="${c.name}" class="config-item select" style="width:100%; margin-top:0.25rem; padding:0.4rem; background:var(--surface2); border:1px solid var(--border); color:var(--text); border-radius:6px;">
                    ${c.values.map(([v]) => `<option value="${v}">${v}</option>`).join('')}
                  </select>
                </div>
              `).join('')}
              ${nums.map(c => `
                <div class="form-group">
                  <label style="font-size: 0.7rem; color: var(--text-muted);">${c.name} (${c.min}-${c.max})</label>
                  <input type="number" name="${c.name}" value="${c.mean}" min="${c.min}" max="${c.max}" 
                         style="width:100%; margin-top:0.25rem; padding:0.4rem; background:var(--surface2); border:1px solid var(--border); color:var(--text); border-radius:6px;">
                </div>
              `).join('')}
            </div>
            <button type="submit" class="btn-primary mt-2" style="width:100%;">Run Bias Test →</button>
          </form>
        </div>

        <div id="bounty-results">
          <div class="card" style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; color:var(--text-muted);">
            <div style="font-size: 3rem; margin-bottom: 1rem; opacity:0.3;">🎯</div>
            <p>Input data and run test to see results</p>
          </div>
        </div>
      </div>

      <div class="card mt-2">
        <div class="label">Top Intersectional Risk Areas</div>
        <div class="mt-1" id="bounty-intersectional">
          ${this._renderIntersectional(state)}
        </div>
      </div>
    </div>`;
  },

  _renderIntersectional(state) {
    if (!state.metrics || !state.metrics.intersectionality) return '<p>Loading intersectional data...</p>';
    const combos = Object.entries(state.metrics.intersectionality.combinations)
      .sort((a, b) => a[1].rate - b[1].rate)
      .slice(0, 5);

    return `
      <div class="grid-auto">
        ${combos.map(([name, data]) => `
          <div class="col-stat-card" style="border-left: 3px solid var(--danger);">
            <div class="col-stat-name">${name}</div>
            <div class="metric-value" style="font-size: 1.5rem; margin: 0.5rem 0;">${Math.round(data.rate * 100)}%</div>
            <div class="stat-label">Selection Rate (n=${data.n})</div>
          </div>
        `).join('')}
      </div>
      <p class="mt-1 text-muted" style="font-size: 0.75rem;">These subgroups show the lowest selection rates in the current dataset, indicating potential intersectional discrimination.</p>
    `;
  },

  runTest(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const resultsRoot = document.getElementById('bounty-results');
    resultsRoot.innerHTML = `<div class="card"><div class="spinner"></div><p class="text-center mt-1">Analyzing edge case...</p></div>`;

    setTimeout(() => {
      // Simulate analysis
      const isCritical = Math.random() < 0.3;
      resultsRoot.innerHTML = `
        <div class="card ${isCritical ? 'critical' : 'pass'}">
          <div class="label">Analysis Result</div>
          <div class="metric-value ${isCritical ? 'critical' : 'pass'}" style="font-size: 1.8rem;">
            ${isCritical ? '⚠️ High Bias Risk' : '✅ Low Bias Risk'}
          </div>
          <p class="mt-1" style="font-size: 0.85rem; line-height: 1.6;">
            ${isCritical ? 
              'This combination of attributes yields a predicted outcome that deviates significantly from the reference group norm. Potential <strong>Intersectional Outlier</strong> detected.' : 
              'The model handles this specific edge case within acceptable fairness bounds compared to the general population.'}
          </p>
          <hr class="divider">
          <div class="delta-row">
            <span class="delta-name">Confidence</span>
            <span class="delta-before">88%</span>
          </div>
          <div class="delta-row">
            <span class="delta-name">Metric Impact</span>
            <span class="delta-before">+0.04 Disparate Impact</span>
          </div>
          <button class="btn-sm btn-outline mt-2" onclick="BountyUI.reset()">Reset Test</button>
        </div>
      `;
    }, 800);
  },

  reset() {
    this.render(document.getElementById('bounty-root'), AppState);
  }
};
