// Chart Builders — uses Chart.js
var Charts = (function () {
  var chartInstances = {};

  function destroy(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
  }

  function outcomeBarChart(metrics) {
    var canvasId = 'chart-outcome-bar';
    destroy(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    var groups = metrics.groupNames;
    var rates = groups.map(function (g) { return (metrics.rates[g] * 100).toFixed(1); });
    var colors = groups.map(function (g) {
      return g === metrics.majorityGroup ? 'rgba(79,142,247,0.85)' : 'rgba(239,68,68,0.85)';
    });
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: groups,
        datasets: [{
          label: 'Positive Outcome Rate (%)',
          data: rates,
          backgroundColor: colors,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return c.parsed.y + '% selection rate'; } } }
        },
        scales: {
          y: {
            beginAtZero: true, max: 100,
            ticks: { color: '#94a3b8', callback: function (v) { return v + '%'; } },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        },
        animation: { duration: 1000, easing: 'easeOutQuart' }
      }
    });
  }

  function representationChart(metrics) {
    var canvasId = 'chart-representation';
    destroy(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    var groups = metrics.groupNames;
    var pcts = groups.map(function (g) { return metrics.representation[g].pct.toFixed(1); });
    var palette = ['rgba(79,142,247,0.85)', 'rgba(239,68,68,0.85)', 'rgba(245,158,11,0.85)', 'rgba(34,211,165,0.85)', 'rgba(168,85,247,0.85)'];
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: groups,
        datasets: [{ data: pcts, backgroundColor: palette.slice(0, groups.length), borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } },
          tooltip: { callbacks: { label: function (c) { return c.label + ': ' + c.parsed + '% of dataset'; } } }
        },
        animation: { duration: 900, easing: 'easeOutCubic' }
      }
    });
  }

  function correlationChart(metrics) {
    var canvasId = 'chart-correlation';
    destroy(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    var cols = Object.keys(metrics.correlations);
    if (!cols.length) { ctx.parentElement.innerHTML = '<p class="no-data">No numeric features for correlation analysis.</p>'; return; }
    var vals = cols.map(function (c) { return Math.abs(metrics.correlations[c]); });
    var colors = vals.map(function (v) {
      if (v >= 0.5) return 'rgba(239,68,68,0.85)';
      if (v >= 0.3) return 'rgba(245,158,11,0.85)';
      return 'rgba(34,211,165,0.85)';
    });
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cols.map(function (c) { return c.replace(/_/g, ' '); }),
        datasets: [{ label: '|Correlation| with protected attribute', data: vals.map(function(v){return v.toFixed(3);}), backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return 'r = ' + c.parsed.x; } } }
        },
        scales: {
          x: { beginAtZero: true, max: 1, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        },
        animation: { duration: 900 }
      }
    });
  }

  function rateComparisonChart(metrics) {
    var canvasId = 'chart-rate-compare';
    destroy(canvasId);
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    var groups = metrics.groupNames;
    var rates = groups.map(function (g) { return (metrics.rates[g] * 100).toFixed(1); });
    var threshold = (metrics.rates[metrics.majorityGroup] * 0.8 * 100).toFixed(1);
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: groups,
        datasets: [
          { label: 'Selection Rate', data: rates, backgroundColor: groups.map(function(g){ return g===metrics.majorityGroup?'rgba(79,142,247,0.85)':'rgba(239,68,68,0.75)'; }), borderRadius: 8, borderSkipped: false, order: 1 },
          { label: '80% Threshold', data: groups.map(function () { return threshold; }), type: 'line', borderColor: 'rgba(245,158,11,0.9)', borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false, order: 0 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } }, tooltip: { mode: 'index' } },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8', callback: function (v) { return v + '%'; } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        },
        animation: { duration: 1000, easing: 'easeOutQuart' }
      }
    });
  }

  function drawGauge(canvasId, score) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx2d = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);
    var cx = W / 2, cy = H * 0.72, r = Math.min(W, H) * 0.38;
    var startAngle = Math.PI, endAngle = 2 * Math.PI;

    // Background arc
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r, startAngle, endAngle);
    ctx2d.lineWidth = 22;
    ctx2d.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx2d.lineCap = 'round';
    ctx2d.stroke();

    // Colored arc (gradient: green → yellow → red)
    var grad = ctx2d.createLinearGradient(cx - r, cy, cx + r, cy);
    grad.addColorStop(0, '#22d3a5');
    grad.addColorStop(0.45, '#f59e0b');
    grad.addColorStop(1, '#ef4444');
    var fillAngle = startAngle + (score / 100) * Math.PI;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, r, startAngle, fillAngle);
    ctx2d.lineWidth = 22;
    ctx2d.strokeStyle = grad;
    ctx2d.lineCap = 'round';
    ctx2d.stroke();

    // Needle
    var needleAngle = startAngle + (score / 100) * Math.PI;
    ctx2d.beginPath();
    ctx2d.moveTo(cx, cy);
    ctx2d.lineTo(cx + (r - 10) * Math.cos(needleAngle), cy + (r - 10) * Math.sin(needleAngle));
    ctx2d.lineWidth = 3;
    ctx2d.strokeStyle = '#ffffff';
    ctx2d.lineCap = 'round';
    ctx2d.stroke();

    // Center dot
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 7, 0, 2 * Math.PI);
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fill();

    // Score text
    ctx2d.font = 'bold 28px Inter, sans-serif';
    ctx2d.fillStyle = score >= 60 ? '#ef4444' : score >= 30 ? '#f59e0b' : '#22d3a5';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(score, cx, cy - r * 0.35);
    ctx2d.font = '13px Inter, sans-serif';
    ctx2d.fillStyle = '#94a3b8';
    ctx2d.fillText('Bias Score', cx, cy - r * 0.35 + 22);

    // Labels
    ctx2d.font = '11px Inter, sans-serif';
    ctx2d.fillStyle = '#22d3a5';
    ctx2d.textAlign = 'left';
    ctx2d.fillText('Fair', cx - r - 5, cy + 18);
    ctx2d.fillStyle = '#ef4444';
    ctx2d.textAlign = 'right';
    ctx2d.fillText('Biased', cx + r + 5, cy + 18);
  }

  function animateGauge(canvasId, targetScore) {
    var current = 0;
    var step = function () {
      if (current < targetScore) {
        current = Math.min(current + 2, targetScore);
        drawGauge(canvasId, current);
        requestAnimationFrame(step);
      } else {
        drawGauge(canvasId, targetScore);
      }
    };
    requestAnimationFrame(step);
  }

  function renderAll(metrics) {
    outcomeBarChart(metrics);
    representationChart(metrics);
    correlationChart(metrics);
    rateComparisonChart(metrics);
    animateGauge('gauge-canvas', metrics.biasScore);
  }

  return { renderAll: renderAll, animateGauge: animateGauge, drawGauge: drawGauge };
})();
