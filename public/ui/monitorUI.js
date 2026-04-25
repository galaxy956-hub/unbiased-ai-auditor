const MonitorUI = {
  chart: null,
  alerts: [],
  historicalData: {},

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
        <div style="display:flex; gap:0.5rem;">
          <button class="btn-outline" onclick="MonitorUI.clearAlerts()">Clear Alerts</button>
          <button class="btn-primary" id="btn-start-monitor" onclick="MonitorUI.startSimulation()">Start Live Simulation</button>
        </div>
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
          <div class="stat-num" id="mon-alerts" style="font-size: 1.5rem;">${this.alerts.length}</div>
        </div>
      </div>

      ${this.alerts.length > 0 ? `
      <div class="card" style="margin-bottom: 1.5rem; border-color: var(--danger); background: rgba(239,68,68,0.08);">
        <div class="label" style="color: var(--danger);">🚨 Active Alerts</div>
        <div id="alert-list" style="margin-top: 0.5rem;">
          ${this.alerts.map((alert, i) => `
            <div class="alert-item" style="padding: 0.5rem; border-bottom: 1px solid rgba(239,68,68,0.2); display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.85rem;">${alert.message}</span>
              <button class="btn-sm" style="background: var(--danger); color: white;" onclick="MonitorUI.dismissAlert(${i})">Dismiss</button>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="grid-2" style="margin-bottom: 1.5rem;">
        <div class="chart-card">
          <div class="chart-title">Fairness Drift (12-Week Window)</div>
          <div class="chart-subtitle">Metric: Disparate Impact Ratio (80% Rule Threshold)</div>
          <div class="chart-wrap">
            <canvas id="monitor-chart"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Historical Trend Analysis</div>
          <div class="chart-subtitle">Multiple fairness metrics over time</div>
          <div class="chart-wrap">
            <canvas id="trend-chart"></canvas>
          </div>
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

    setTimeout(() => {
      this._initChart(state);
      this._initTrendChart(state);
    }, 50);
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
        
        // Add alert
        if (!this.alerts.find(a => a.week === week)) {
          this.alerts.push({
            week,
            message: `Week ${week}: Disparate Impact (${val.toFixed(3)}) below 0.8 threshold`,
            timestamp: new Date().toISOString()
          });
          alertNum.textContent = this.alerts.length;
          this.render(document.getElementById('monitor-root'), AppState);
        }
        
        logEntry.textContent = '🚨 ' + logEntry.textContent;
      }

      log.prepend(logEntry);
      
      // Update trend chart
      this._updateTrendChart(week, val);

      week++;
    }, 600);
  },

  _initTrendChart(state) {
    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    const initialDI = state.metrics ? state.metrics.disparateImpact.value : 0.85;
    const initialSP = state.metrics ? state.metrics.statisticalParity?.value || 0.05 : 0.05;
    
    // Generate historical data
    const labels = Array.from({length: 12}, (_, i) => `Week ${i+1}`);
    const diData = [initialDI];
    const spData = [initialSP];
    
    for (let i = 1; i < 12; i++) {
      diData.push(diData[i-1] - (Math.random() * 0.03));
      spData.push(Math.min(0.2, spData[i-1] + (Math.random() * 0.02 - 0.01)));
    }
    
    this.historicalData = { di: diData, sp: spData };

    if (this.trendChart) this.trendChart.destroy();
    
    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Disparate Impact',
            data: diData,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          },
          {
            label: 'Statistical Parity',
            data: spData,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: '#94a3b8', font: { size: 10 } } }
        },
        scales: {
          y: { min: 0, max: 1, ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#64748b' }, grid: { display: false } }
        }
      }
    });
  },

  _updateTrendChart(week, diValue) {
    if (!this.trendChart || !this.historicalData.di) return;
    
    const weekIndex = week - 1;
    if (weekIndex < this.historicalData.di.length) {
      this.historicalData.di[weekIndex] = diValue;
      this.trendChart.data.datasets[0].data = this.historicalData.di;
      this.trendChart.update('none');
    }
  },

  dismissAlert(index) {
    this.alerts.splice(index, 1);
    this.render(document.getElementById('monitor-root'), AppState);
  },

  clearAlerts() {
    this.alerts = [];
    this.render(document.getElementById('monitor-root'), AppState);
  }
};
