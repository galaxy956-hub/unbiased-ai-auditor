// ── DashboardUI — Rebuilt as the showpiece KPI view ──────────────────────────
const DashboardUI = {
  render(root, state) {
    if (!state.data.length || !state.metrics) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state"><div class="empty-icon">📊</div><p>Load a dataset to see your fairness dashboard.</p><div style="display:flex;gap:1rem;justify-content:center;margin-top:1rem;flex-wrap:wrap;"><button class="btn-primary" onclick="AppState.loadDemo('hiring');AppRouter.go('dashboard');">Load Demo</button><button class="btn-outline" onclick="AppRouter.go('explorer')">Upload CSV</button></div></div></div>`;
      return;
    }
    const m = state.metrics;
    const cfg = state.config;
    const datasetLabel = state.datasetKey ? (Datasets.configs[state.datasetKey]?.label || 'Dataset') : `Custom Dataset (${state.data.length} rows)`;
    const critCount = Object.values(m).filter(v => v && v.status === 'critical').length;
    const warnCount = Object.values(m).filter(v => v && v.status === 'warning').length;
    const passCount = Object.values(m).filter(v => v && v.status === 'pass').length;
    const totalMetrics = critCount + warnCount + passCount;
    const gradeColor = { A: '#10b981', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444' }[m.overallRisk.grade] || '#6366f1';
    const ringPct = m.overallRisk.score;
    const circumference = 2 * Math.PI * 54;
    const dashOffset = circumference * (1 - ringPct / 100);

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>📊 Fairness Dashboard</h2>
        <p>Real-time audit overview for <strong>${datasetLabel}</strong> · ${state.data.length.toLocaleString()} records · Protected: <strong>${cfg.protectedAttr}</strong></p>
      </div>
      <div class="dash-kpi-row">
        <div class="kpi-ring-card">
          <div class="ring-label">Overall Fairness Score</div>
          <div class="ring-wrap">
            <svg viewBox="0 0 120 120" class="score-ring">
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--surface2)" stroke-width="10"/>
              <circle cx="60" cy="60" r="54" fill="none" stroke="${gradeColor}" stroke-width="10"
                stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${dashOffset.toFixed(2)}"
                stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.2s ease;"/>
            </svg>
            <div class="ring-center">
              <div class="ring-grade" style="color:${gradeColor}">${m.overallRisk.grade}</div>
              <div class="ring-score">${ringPct}/100</div>
            </div>
          </div>
          <div class="ring-sublabel">${this._gradeVerdict(m.overallRisk.grade)}</div>
        </div>
        <div class="kpi-cards">
          <div class="kpi-card kpi-critical"><div class="kpi-num">${critCount}</div><div class="kpi-label">Critical Violations</div><div class="kpi-sub">${critCount > 0 ? 'Immediate action needed' : 'None detected ✅'}</div></div>
          <div class="kpi-card kpi-warning"><div class="kpi-num">${warnCount}</div><div class="kpi-label">Warnings</div><div class="kpi-sub">${warnCount > 0 ? 'Review recommended' : 'None detected ✅'}</div></div>
          <div class="kpi-card kpi-pass"><div class="kpi-num">${passCount}</div><div class="kpi-label">Metrics Passed</div><div class="kpi-sub">out of ${totalMetrics} measured</div></div>
          <div class="kpi-card kpi-data"><div class="kpi-num">${state.data.length.toLocaleString()}</div><div class="kpi-label">Records Analyzed</div><div class="kpi-sub">${cfg.protectedAttr} × ${cfg.outcomeAttr}</div></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:1.5rem;">
        <div class="label" style="margin-bottom:1rem;">Metric Status Overview</div>
        <div class="metric-status-grid">${this._metricStatusRows(m)}</div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="label" style="margin-bottom:1rem;">Quick Actions</div>
          <div class="quick-actions">
            ${critCount > 0 ? `<div class="quick-action-card action-critical" onclick="AppRouter.go('lab')"><span class="qa-icon">🔧</span><div><div class="qa-title">Fix ${critCount} Critical Violation${critCount > 1 ? 's' : ''}</div><div class="qa-sub">Open Mitigation Lab →</div></div></div>` : ''}
            <div class="quick-action-card" onclick="AppRouter.go('report')"><span class="qa-icon">📄</span><div><div class="qa-title">Generate Audit Report</div><div class="qa-sub">PDF + JSON + CSV export →</div></div></div>
            <div class="quick-action-card" onclick="AppRouter.go('visuals')"><span class="qa-icon">📈</span><div><div class="qa-title">View Visualizations</div><div class="qa-sub">Radar, heatmap, ROC curves →</div></div></div>
            <div class="quick-action-card" onclick="AppRouter.go('whatif')"><span class="qa-icon">🔍</span><div><div class="qa-title">Run What-If Analysis</div><div class="qa-sub">Counterfactual simulation →</div></div></div>
          </div>
        </div>
        <div class="card">
          <div class="label" style="margin-bottom:1rem;">Recent Audits</div>
          ${state.auditHistory && state.auditHistory.length > 0 ? `
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            ${state.auditHistory.map((h, i) => `
              <div class="history-item ${i === 0 ? 'history-current' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div><div style="font-weight:600;font-size:0.85rem;">${h.label}</div><div style="font-size:0.72rem;color:var(--text-muted);">${h.config.protectedAttr} · ${h.timestamp}</div></div>
                  <div class="risk-grade ${h.grade}" style="font-size:1.6rem;">${h.grade}</div>
                </div>
                <div style="margin-top:0.4rem;"><div class="mini-bar-wrap"><div class="mini-bar" style="width:${h.score}%;background:${gradeColor}"></div></div><div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">${h.score}/100</div></div>
              </div>`).join('')}
          </div>` : `<div style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:2rem 0;">Audit multiple datasets to see history here.</div>`}
        </div>
      </div>

      ${m.disparateImpact && m.disparateImpact.value < 0.8 ? `
      <div class="compliance-alert">
        <span class="compliance-alert-icon">⚖️</span>
        <div><strong>EEOC 4/5ths Rule Violation Detected</strong><p>The Disparate Impact Ratio is <strong>${m.disparateImpact.value.toFixed(3)}</strong>, below the legal threshold of 0.8. This may constitute adverse impact under U.S. employment law. Immediate remediation recommended.</p></div>
        <button class="btn-sm btn-danger" onclick="AppRouter.go('report')">View Report</button>
      </div>` : ''}
    </div>`;
  },

  _metricStatusRows(m) {
    const defs = [
      { key: 'disparateImpact', label: 'Disparate Impact Ratio', icon: '📏' },
      { key: 'statisticalParity', label: 'Statistical Parity Difference', icon: '📊' },
      { key: 'equalOpportunity', label: 'Equal Opportunity', icon: '🎯' },
      { key: 'equalizedOdds', label: 'Equalized Odds', icon: '⚖️' },
      { key: 'predictiveParity', label: 'Predictive Parity', icon: '🔮' },
      { key: 'calibration', label: 'Score Calibration', icon: '🎚️' },
      { key: 'individualFairness', label: 'Individual Fairness', icon: '👤' },
      { key: 'intersectionality', label: 'Intersectionality', icon: '🔀' },
      { key: 'counterfactualFairness', label: 'Counterfactual Fairness', icon: '🔄' },
      { key: 'treatmentInequality', label: 'Treatment Inequality', icon: '⚕️' },
      { key: 'consistency', label: 'Consistency', icon: '🔗' },
    ];
    return defs.filter(d => m[d.key]).map(d => {
      const metric = m[d.key];
      const pct = Math.min(100, Math.max(0, d.key === 'disparateImpact' ? Math.round(metric.value * 100) : Math.round((1 - metric.value) * 100)));
      const barColor = metric.status === 'critical' ? 'var(--danger)' : metric.status === 'warning' ? 'var(--warning)' : 'var(--success)';
      return `<div class="ms-row"><span class="ms-icon">${d.icon}</span><span class="ms-label">${d.label}</span><div class="ms-bar-wrap"><div class="ms-bar" style="width:${pct}%;background:${barColor};"></div></div><span class="ms-val">${metric.value?.toFixed(3) ?? '—'}</span><span class="badge badge-${metric.status}" style="min-width:75px;text-align:center;">${metric.status === 'critical' ? '🚨 Critical' : metric.status === 'warning' ? '⚠️ Warning' : '✅ Pass'}</span></div>`;
    }).join('');
  },

  _gradeVerdict(grade) {
    return { A: '✅ Excellent Fairness', B: '🟡 Good — Minor Concerns', C: '⚠️ Moderate Bias Detected', D: '🔴 Significant Bias — Act Now', F: '🚨 Severe Bias — Do Not Deploy' }[grade] || '';
  }
};
