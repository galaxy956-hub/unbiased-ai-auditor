const MonitorUI = {
  chart: null,

  render(root, state) {
    if (!state.data.length) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state">No dataset loaded.</div></div>`;
      return;
    }

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header" style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <h2>📈 Drift & Fairness Monitoring</h2>
          <p>Real-time tracking of model performance and bias metrics. Detect "Model Rot" before it breaches regulatory thresholds.</p>
        </div>
        <button class="btn-primary" id="btn-start-monitor" onclick="MonitorUI.startSimulation()">Start Live Simulation</button>
      </div>

      <div class="grid-4" style="margin-bottom: 1.5rem;">
        <div class="card text-center">
          <div class="label">Current Status</div>
          <div class="stat-num" id="mon-status" style="font-size: 1.5rem; color: var(--success);">HEALTHY</div>
        </div>
        <div class="card text-center">
          <div class="label">Disparate Impact</div>
          <div class="stat-num" id="mon-di" style="font-size: 1.5rem;">${state.metrics ? state.metrics.disparateImpact.value.toFixed(2) : '0.00'}</div>
        </div>
        <div class="card text-center">
          <div class="label">Avg Drift Rate</div>
          <div class="stat-num" style="font-size: 1.5rem;">0.8% <small>/wk</small></div>
        </div>
        <div class="card text-center">
          <div class="label">Active Alerts</div>
          <div class="stat-num" id="mon-alerts" style="font-size: 1.5rem;">0</div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-title">Fairness Drift (12-Week Window)</div>
        <div class="chart-subtitle">Metric: Disparate Impact Ratio (80% Rule Threshold)</div>
        <div class="chart-wrap">
          <canvas id="monitor-chart"></canvas>
        </div>
      </div>

      <div class="card mt-2">
        <div class="label">Simulation Event Log</div>
        <div id="monitor-log" style="max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.75rem; color: var(--text-dim); margin-top: 1rem;">
          <div class="mt-1">[SYSTEM] Monitoring service initialized.</div>
          <div class="mt-1">[SYSTEM] Connected to production model stream.</div>
        </div>
      </div>
    </div>`;

    setTimeout(() => this._initChart(state), 50);
  },

  _initChart(state) {
    const ctx = document.getElementById('monitor-chart');
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    const initialDI = state.metrics ? state.metrics.disparateImpact.value : 0.85;
    
    // Generate 12 weeks of fake data
    const labels = Array.from({length: 12}, (_, i) => `Week ${i+1}`);
    const data = [initialDI];
    for (let i = 1; i < 12; i++) {
      data.push(data[i-1] - (Math.random() * 0.03));
    }
    state.monitoringData = data;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Disparate Impact Ratio',
          data: data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#6366f1'
        }, {
          label: 'Regulatory Threshold (0.80)',
          data: Array(12).fill(0.8),
          borderColor: '#ef4444',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#94a3b8', font: { size: 10 } } }
        },
        scales: {
          y: { min: 0.5, max: 1.0, ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#64748b' }, grid: { display: false } }
        }
      }
    });
  },

  startSimulation() {
    const btn = document.getElementById('btn-start-monitor');
    btn.disabled = true;
    btn.textContent = 'Simulating...';

    const log = document.getElementById('monitor-log');
    const status = document.getElementById('mon-status');
    const diNum = document.getElementById('mon-di');
    const alertNum = document.getElementById('mon-alerts');

    let week = 1;
    const interval = setInterval(() => {
      if (week > 12) {
        clearInterval(interval);
        btn.textContent = 'Simulation Complete';
        return;
      }

      const val = AppState.monitoringData[week - 1];
      diNum.textContent = val.toFixed(2);
      
      const logEntry = document.createElement('div');
      logEntry.className = 'mt-1';
      logEntry.textContent = `[WEEK ${week}] DISPARATE IMPACT: ${val.toFixed(3)}`;
      
      if (val < 0.8) {
        logEntry.style.color = 'var(--danger)';
        logEntry.textContent += ' [ALERT: Threshold Breach]';
        status.textContent = 'CRITICAL';
        status.style.color = 'var(--danger)';
        alertNum.textContent = '1';
        // Add a "Red Alert" effect to the log
        logEntry.textContent = '🚨 ' + logEntry.textContent;
      }

      log.prepend(logEntry);
      
      // Update chart highlighting current week
      // (Simplified: just log for now)

      week++;
    }, 600);
  }
};
