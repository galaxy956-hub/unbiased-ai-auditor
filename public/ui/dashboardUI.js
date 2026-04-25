const DashboardUI = {
  _instances: {},

  _destroyAll() {
    Object.values(this._instances).forEach(c => { try { c.destroy(); } catch(e){} });
    this._instances = {};
  },

  render(root, state) {
    this._destroyAll();
    if (!state.data.length || !state.metrics) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state"><div class="empty-icon">📊</div><p>Load a dataset to view the dashboard.</p><button class="btn-primary mt-2" onclick="AppRouter.go('explorer')">Load Dataset</button></div></div>`;
      return;
    }

    const m = state.metrics;
    const cfg = state.config;
    const datasetLabel = state.datasetKey ? (Datasets.configs[state.datasetKey]?.label || 'Custom Dataset') : 'Custom Dataset';

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>📊 Executive Dashboard</h2>
        <p>Real-time overview of fairness metrics, risk assessment, and remediation priorities.</p>
      </div>

      <!-- Key Metrics Cards -->
      <div class="grid-4" style="margin-bottom: 1.5rem;">
        <div class="card text-center" style="background: linear-gradient(135deg, var(--surface), var(--surface2));">
          <div class="label">Overall Grade</div>
          <div class="risk-grade ${m.overallRisk.grade}" style="font-size: 3rem;">${m.overallRisk.grade}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${m.overallRisk.score}/100</div>
        </div>
        <div class="card text-center">
          <div class="label">Disparate Impact</div>
          <div class="stat-num" style="font-size: 2rem; color: ${m.disparateImpact.status === 'critical' ? 'var(--danger)' : m.disparateImpact.status === 'warning' ? 'var(--warning)' : 'var(--success)'};">${m.disparateImpact.value.toFixed(3)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Threshold: ≥ 0.8</div>
        </div>
        <div class="card text-center">
          <div class="label">Critical Issues</div>
          <div class="stat-num" style="font-size: 2rem; color: var(--danger);">${this._countStatus(m, 'critical')}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">of 11 metrics</div>
        </div>
        <div class="card text-center">
          <div class="label">Total Records</div>
          <div class="stat-num" style="font-size: 2rem;">${state.data.length.toLocaleString()}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${datasetLabel}</div>
        </div>
      </div>

      <!-- Fairness Radar Chart -->
      <div class="grid-2" style="margin-bottom: 1.5rem;">
        <div class="chart-card">
          <div class="chart-title">Fairness Radar</div>
          <div class="chart-subtitle">Normalized scores across all fairness dimensions</div>
          <div class="chart-wrap">
            <canvas id="dashboard-radar"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Metric Distribution</div>
          <div class="chart-subtitle">Pass/Warning/Critical breakdown</div>
          <div class="chart-wrap">
            <canvas id="dashboard-distribution"></canvas>
          </div>
        </div>
      </div>

      <!-- Priority Actions -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div class="label" style="margin-bottom: 1rem;">🎯 Priority Remediation Actions</div>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${this._priorityActions(m, cfg)}
        </div>
      </div>

      <!-- Quick Access -->
      <div class="grid-3">
        <div class="card" style="text-align: center; cursor: pointer;" onclick="AppRouter.go('metrics')">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚖️</div>
          <div style="font-weight: 600;">View All Metrics</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Detailed breakdown</div>
        </div>
        <div class="card" style="text-align: center; cursor: pointer;" onclick="AppRouter.go('lab')">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔧</div>
          <div style="font-weight: 600;">Mitigation Lab</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Apply debiasing</div>
        </div>
        <div class="card" style="text-align: center; cursor: pointer;" onclick="AppRouter.go('report')">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
          <div style="font-weight: 600;">Generate Report</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Export audit</div>
        </div>
      </div>
    </div>`;

    this._initCharts(m);
  },

  _countStatus(metrics, status) {
    const statusMetrics = ['disparateImpact', 'statisticalParity', 'equalOpportunity', 'equalizedOdds', 'predictiveParity', 'calibration', 'individualFairness', 'intersectionality', 'counterfactualFairness', 'treatmentInequality', 'consistency'];
    return statusMetrics.filter(key => metrics[key] && metrics[key].status === status).length;
  },

  _priorityActions(metrics, config) {
    const actions = [];
    
    if (metrics.disparateImpact?.status === 'critical') {
      actions.push({ priority: 'high', text: 'Disparate Impact violation detected - immediate reweighing recommended', action: 'Go to Mitigation Lab', link: 'lab' });
    }
    if (metrics.equalOpportunity?.status === 'critical') {
      actions.push({ priority: 'high', text: 'Equal Opportunity gap exceeds threshold - consider post-processing', action: 'View Details', link: 'metrics' });
    }
    if (metrics.calibration?.status === 'warning') {
      actions.push({ priority: 'medium', text: 'Calibration error indicates potential score miscalibration', action: 'Investigate', link: 'visuals' });
    }
    if (metrics.intersectionality?.status === 'critical') {
      actions.push({ priority: 'high', text: 'Intersectionality bias detected - multiple protected attributes interacting', action: 'Analyze Groups', link: 'explorer' });
    }
    
    if (actions.length === 0) {
      actions.push({ priority: 'low', text: 'All metrics within acceptable thresholds - continue monitoring', action: 'View Monitoring', link: 'monitor' });
    }

    return actions.map((a, i) => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg); border-radius: 8px; border-left: 4px solid ${a.priority === 'high' ? 'var(--danger)' : a.priority === 'medium' ? 'var(--warning)' : 'var(--success)'};">
        <div style="flex: 1;">
          <span class="badge badge-${a.priority === 'high' ? 'critical' : a.priority === 'medium' ? 'warning' : 'pass'}" style="margin-right: 0.5rem;">${a.priority.toUpperCase()}</span>
          <span style="font-size: 0.85rem;">${a.text}</span>
        </div>
        <button class="btn-sm btn-outline" onclick="AppRouter.go('${a.link}')">${a.action}</button>
      </div>
    `).join('');
  },

  _initCharts(metrics) {
    // Radar Chart
    const radarCtx = document.getElementById('dashboard-radar');
    if (radarCtx) {
      const metricNames = ['Disparate Impact', 'Statistical Parity', 'Equal Opportunity', 'Equalized Odds', 'Predictive Parity', 'Calibration', 'Individual Fairness', 'Intersectionality'];
      const metricKeys = ['disparateImpact', 'statisticalParity', 'equalOpportunity', 'equalizedOdds', 'predictiveParity', 'calibration', 'individualFairness', 'intersectionality'];
      const data = metricKeys.map(k => metrics[k]?.value || 0);
      
      this._instances.radar = new Chart(radarCtx, {
        type: 'radar',
        data: {
          labels: metricNames,
          datasets: [{
            label: 'Fairness Score',
            data: data,
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(99, 102, 241, 1)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 1,
              ticks: { color: '#64748b', backdropColor: 'transparent' },
              grid: { color: 'rgba(99, 179, 237, 0.1)' },
              pointLabels: { color: '#e2e8f0', font: { size: 11 } }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // Distribution Chart
    const distCtx = document.getElementById('dashboard-distribution');
    if (distCtx) {
      const pass = this._countStatus(metrics, 'pass');
      const warning = this._countStatus(metrics, 'warning');
      const critical = this._countStatus(metrics, 'critical');
      
      this._instances.distribution = new Chart(distCtx, {
        type: 'doughnut',
        data: {
          labels: ['Pass', 'Warning', 'Critical'],
          datasets: [{
            data: [pass, warning, critical],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#e2e8f0', padding: 15 }
            }
          }
        }
      });
    }
  }
};
