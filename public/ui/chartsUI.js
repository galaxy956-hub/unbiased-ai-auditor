const ChartsUI = {
  _instances: {},

  _destroyAll() {
    Object.values(this._instances).forEach(c => { try { c.destroy(); } catch(e){} });
    this._instances = {};
  },

  render(root, state) {
    this._destroyAll();
    if (!state.data.length || !state.metrics) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state"><div class="empty-icon">📈</div><p>Load a dataset and compute metrics to see visualizations.</p><button class="btn-primary mt-2" onclick="AppRouter.go('explorer')">Get Started</button></div></div>`;
      return;
    }

    const m = state.metrics;
    const cfg = state.config;

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>📈 Visualizations</h2>
        <p>Interactive charts to explore bias patterns across demographic groups.</p>
      </div>
      <div class="grid-2" style="gap:1.5rem;">
        <div class="chart-card">
          <div class="chart-title">Selection Rate by Group</div>
          <div class="chart-subtitle">Positive outcome rate (%) per group vs. reference group</div>
          <div class="chart-wrap"><canvas id="chart-rates"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Bias Metrics Radar</div>
          <div class="chart-subtitle">Normalized scores across all fairness dimensions (higher = fairer)</div>
          <div class="chart-wrap"><canvas id="chart-radar"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Outcome Distribution by Group</div>
          <div class="chart-subtitle">Breakdown of positive vs. negative decisions per group</div>
          <div class="chart-wrap"><canvas id="chart-outcomes"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Disparate Impact vs Threshold</div>
          <div class="chart-subtitle">Per-group DI ratio — red zone = EEOC violation</div>
          <div class="chart-wrap"><canvas id="chart-di"></canvas></div>
        </div>
        ${m.equalOpportunity ? `
        <div class="chart-card">
          <div class="chart-title">True Positive Rate by Group</div>
          <div class="chart-subtitle">Among truly qualified individuals, who gets selected?</div>
          <div class="chart-wrap"><canvas id="chart-tpr"></canvas></div>
        </div>` : ''}
        ${m.intersectionality && Object.keys(m.intersectionality.combinations).length > 0 ? `
        <div class="chart-card">
          <div class="chart-title">Intersectionality Heatmap</div>
          <div class="chart-subtitle">${cfg.protectedAttr} × ${m.intersectionality.crossAttr} positive outcome rates</div>
          <div id="inter-heatmap" style="padding:0.5rem;"></div>
        </div>` : ''}
        <div class="chart-card">
          <div class="chart-title">Feature Importance (Simulated)</div>
          <div class="chart-subtitle">Relative influence of features on decisions</div>
          <div class="chart-wrap"><canvas id="chart-features"></canvas></div>
        </div>
        ${m.equalOpportunity ? `
        <div class="chart-card">
          <div class="chart-title">ROC Curve by Group</div>
          <div class="chart-subtitle">True Positive Rate vs False Positive Rate</div>
          <div class="chart-wrap"><canvas id="chart-roc"></canvas></div>
        </div>` : ''}
      </div>
    </div>`;

    // Render after DOM is ready
    requestAnimationFrame(() => {
      this._renderRates(m, cfg);
      this._renderRadar(m);
      this._renderOutcomes(state.data, m, cfg);
      this._renderDI(m);
      if (m.equalOpportunity) this._renderTPR(m, cfg);
      if (m.intersectionality) this._renderIntersectionality(m, cfg);
      this._renderFeatureImportance(state.data, state.columnInfo, cfg);
      if (m.equalOpportunity) this._renderROC(state.data, m, cfg);
    });
  },

  _chartDefaults() {
    return {
      color: '#e2e8f0',
      plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#64748b', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    };
  },

  _renderRates(m, cfg) {
    const el = document.getElementById('chart-rates');
    if (!el) return;
    const groups = m.groups;
    const rates = groups.map(g => Math.round((m.selectionRates[g] || 0) * 100));
    const colors = groups.map(g => g === cfg.referenceGroup ? 'rgba(99,102,241,0.8)' : 'rgba(6,182,212,0.7)');
    const refRate = Math.round((m.selectionRates[cfg.referenceGroup] || 0) * 100);
    this._instances['rates'] = new Chart(el, {
      type: 'bar',
      data: { labels: groups, datasets: [{ label: 'Selection Rate (%)', data: rates, backgroundColor: colors, borderColor: colors.map(c=>c.replace('0.8','1').replace('0.7','1')), borderWidth: 1, borderRadius: 6 }] },
      options: { ...this._chartDefaults(), plugins: { ...this._chartDefaults().plugins, annotation: undefined,
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw}% selection rate` } }
      }, scales: { ...this._chartDefaults().scales, y: { ...this._chartDefaults().scales.y, min: 0, max: 100, ticks: { ...this._chartDefaults().scales.y.ticks, callback: v => v + '%' } } } }
    });
  },

  _renderRadar(m) {
    const el = document.getElementById('chart-radar');
    if (!el) return;
    const metricDefs = [
      { key: 'disparateImpact', label: 'Disparate Impact', transform: v => Math.min(1, v.value || 0) },
      { key: 'statisticalParity', label: 'Stat. Parity', transform: v => Math.max(0, 1 - (v.value || 0) * 5) },
      { key: 'equalOpportunity', label: 'Equal Opportunity', transform: v => Math.max(0, 1 - (v.value || 0) * 5) },
      { key: 'equalizedOdds', label: 'Eq. Odds', transform: v => Math.max(0, 1 - (v.value || 0) * 5) },
      { key: 'predictiveParity', label: 'Pred. Parity', transform: v => Math.max(0, 1 - (v.value || 0) * 5) },
      { key: 'calibration', label: 'Calibration', transform: v => Math.max(0, 1 - (v.value || 0) * 5) },
      { key: 'individualFairness', label: 'Indiv. Fairness', transform: v => Math.max(0, 1 - (v.value || 0) * 4) },
    ].filter(d => m[d.key]);
    const labels = metricDefs.map(d => d.label);
    const values = metricDefs.map(d => Math.round(d.transform(m[d.key]) * 100));
    this._instances['radar'] = new Chart(el, {
      type: 'radar',
      data: { labels, datasets: [
        { label: 'Fairness Score', data: values, backgroundColor: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.8)', pointBackgroundColor: 'rgba(99,102,241,1)', borderWidth: 2 },
        { label: 'Target (100)', data: labels.map(() => 100), backgroundColor: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.3)', borderDash: [4,4], borderWidth: 1, pointRadius: 0 }
      ]},
      options: { plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } } }, scales: { r: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#64748b', backdropColor: 'transparent', stepSize: 25 }, pointLabels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } } } }
    });
  },

  _renderOutcomes(data, m, cfg) {
    const el = document.getElementById('chart-outcomes');
    if (!el) return;
    const groups = m.groups;
    const positive = groups.map(g => data.filter(r => r[cfg.protectedAttr] === g && Number(r[cfg.outcomeAttr]) === 1).length);
    const negative = groups.map(g => data.filter(r => r[cfg.protectedAttr] === g && Number(r[cfg.outcomeAttr]) === 0).length);
    this._instances['outcomes'] = new Chart(el, {
      type: 'bar',
      data: { labels: groups, datasets: [
        { label: 'Positive Outcome', data: positive, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 },
        { label: 'Negative Outcome', data: negative, backgroundColor: 'rgba(239,68,68,0.5)', borderRadius: 4 }
      ]},
      options: { ...this._chartDefaults(), scales: { ...this._chartDefaults().scales, x: { ...this._chartDefaults().scales.x, stacked: true }, y: { ...this._chartDefaults().scales.y, stacked: true } } }
    });
  },

  _renderDI(m) {
    const el = document.getElementById('chart-di');
    if (!el || !m.disparateImpact) return;
    const groups = m.groups.filter(g => g !== m.referenceGroup);
    const values = groups.map(g => Math.round((m.disparateImpact.byGroup[g] || 0) * 100) / 100);
    const colors = values.map(v => v < 0.8 ? 'rgba(239,68,68,0.75)' : v < 0.9 ? 'rgba(245,158,11,0.75)' : 'rgba(16,185,129,0.75)');
    this._instances['di'] = new Chart(el, {
      type: 'bar',
      data: { labels: groups, datasets: [{ label: 'DI Ratio vs Reference', data: values, backgroundColor: colors, borderRadius: 6 }] },
      options: { ...this._chartDefaults(), plugins: { ...this._chartDefaults().plugins, legend: { display: false }, annotation: undefined }, scales: { ...this._chartDefaults().scales, y: { ...this._chartDefaults().scales.y, min: 0, max: 1.1, ticks: { ...this._chartDefaults().scales.y.ticks }, grid: { color: (ctx) => ctx.tick.value === 0.8 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.04)' } } } }
    });
  },

  _renderTPR(m, cfg) {
    const el = document.getElementById('chart-tpr');
    if (!el) return;
    const groups = m.groups;
    const tpr = groups.map(g => Math.round((m.equalOpportunity.byGroup[g] || 0) * 100));
    const colors = groups.map(g => g === cfg.referenceGroup ? 'rgba(99,102,241,0.8)' : 'rgba(245,158,11,0.75)');
    this._instances['tpr'] = new Chart(el, {
      type: 'bar',
      data: { labels: groups, datasets: [{ label: 'True Positive Rate (%)', data: tpr, backgroundColor: colors, borderRadius: 6 }] },
      options: { ...this._chartDefaults(), plugins: { ...this._chartDefaults().plugins, legend: { display: false } }, scales: { ...this._chartDefaults().scales, y: { ...this._chartDefaults().scales.y, min: 0, max: 100, ticks: { ...this._chartDefaults().scales.y.ticks, callback: v => v + '%' } } } }
    });
  },

  _renderIntersectionality(m, cfg) {
    const container = document.getElementById('inter-heatmap');
    if (!container || !m.intersectionality) return;
    const combos = Object.entries(m.intersectionality.combinations);
    if (combos.length === 0) { container.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">Not enough data for intersectional analysis.</p>'; return; }
    const max = Math.max(...combos.map(([,d]) => d.rate));
    container.innerHTML = combos.map(([label, d]) => {
      const pct = Math.round(d.rate * 100);
      const intensity = max > 0 ? d.rate / max : 0;
      const bg = `rgba(${intensity > 0.6 ? '16,185,129' : intensity > 0.3 ? '245,158,11' : '239,68,68'},${0.15 + intensity * 0.45})`;
      return `<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.35rem;font-size:0.77rem;">
        <span style="min-width:140px;color:var(--text-dim);">${label}</span>
        <div style="flex:1;background:var(--bg);border-radius:99px;height:8px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;border-radius:99px;background:${bg}transition:width 0.5s;"></div>
        </div>
        <span style="min-width:50px;color:var(--text);font-weight:600;">${pct}% <span style="color:var(--text-muted);font-weight:400;">(n=${d.n})</span></span>
      </div>`;
    }).join('');
  },

  _renderFeatureImportance(data, columnInfo, cfg) {
    const el = document.getElementById('chart-features');
    if (!el) return;
    
    // Simulate feature importance based on correlation with outcome
    const numericCols = columnInfo.filter(c => c.type === 'numeric' && c.name !== cfg.outcomeAttr);
    const importance = numericCols.map(col => {
      // Calculate simple correlation with outcome
      const values = data.map(r => Number(r[col.name]) || 0);
      const outcomes = data.map(r => Number(r[cfg.outcomeAttr]) || 0);
      const meanVal = values.reduce((a, b) => a + b, 0) / values.length;
      const meanOut = outcomes.reduce((a, b) => a + b, 0) / outcomes.length;
      
      let covariance = 0, varVal = 0, varOut = 0;
      for (let i = 0; i < data.length; i++) {
        covariance += (values[i] - meanVal) * (outcomes[i] - meanOut);
        varVal += Math.pow(values[i] - meanVal, 2);
        varOut += Math.pow(outcomes[i] - meanOut, 2);
      }
      
      const correlation = Math.abs(covariance / Math.sqrt(varVal * varOut)) || 0;
      return { name: col.name, importance: correlation };
    }).sort((a, b) => b.importance - a.importance).slice(0, 8);
    
    this._instances['features'] = new Chart(el, {
      type: 'bar',
      data: {
        labels: importance.map(i => i.name),
        datasets: [{
          label: 'Feature Importance',
          data: importance.map(i => i.importance),
          backgroundColor: importance.map((_, i) => 
            i === 0 ? 'rgba(99,102,241,0.8)' : 
            i === 1 ? 'rgba(6,182,212,0.7)' : 
            'rgba(139,92,246,0.6)'
          ),
          borderRadius: 6
        }]
      },
      options: {
        ...this._chartDefaults(),
        indexAxis: 'y',
        plugins: { ...this._chartDefaults().plugins, legend: { display: false } },
        scales: {
          x: { ...this._chartDefaults().scales.x, min: 0, max: 1 },
          y: { ...this._chartDefaults().scales.y }
        }
      }
    });
  },

  _renderROC(data, m, cfg) {
    const el = document.getElementById('chart-roc');
    if (!el || !m.equalOpportunity) return;
    
    const groups = m.groups;
    const { protectedAttr, outcomeAttr, groundTruthAttr } = cfg;
    
    // Simulate ROC curves for each group
    const datasets = groups.map((g, idx) => {
      const gData = data.filter(r => r[protectedAttr] === g);
      const tpr = m.equalOpportunity.byGroup[g] || 0;
      const fpr = m.equalizedOdds ? m.equalizedOdds.fpr[g] || 0 : 0.1;
      
      // Generate ROC curve points
      const points = [];
      for (let i = 0; i <= 10; i++) {
        const threshold = i / 10;
        points.push({
          x: fpr * (1 - threshold * 0.5),
          y: tpr * (threshold * 0.5 + 0.5)
        });
      }
      points.push({ x: 1, y: 1 });
      
      const colors = ['rgba(99,102,241,0.8)', 'rgba(6,182,212,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)', 'rgba(16,185,129,0.8)'];
      
      return {
        label: g,
        data: points,
        borderColor: colors[idx % colors.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 0
      };
    });
    
    // Add random diagonal
    datasets.push({
      label: 'Random',
      data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      borderColor: 'rgba(148,163,184,0.3)',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 0
    });
    
    this._instances['roc'] = new Chart(el, {
      type: 'line',
      data: { datasets },
      options: {
        ...this._chartDefaults(),
        plugins: { ...this._chartDefaults().plugins, legend: { display: true, position: 'bottom' } },
        scales: {
          x: { ...this._chartDefaults().scales.x, title: { display: true, text: 'False Positive Rate', color: '#64748b' } },
          y: { ...this._chartDefaults().scales.y, title: { display: true, text: 'True Positive Rate', color: '#64748b' } }
        }
      }
    });
  }
};
