// Report Generation & Export
var Report = (function () {

  function formatPct(v) { return (v * 100).toFixed(1) + '%'; }
  function badge(sev) {
    var map = { pass: '✅ PASS', warning: '⚠️ WARNING', critical: '🚨 CRITICAL' };
    return map[sev] || sev;
  }

  function generateJSON(metrics, protectedAttr, targetAttr) {
    return JSON.stringify({
      generated: new Date().toISOString(),
      dataset: { rows: metrics.totalRows, protectedAttribute: protectedAttr, targetAttribute: targetAttr },
      biasScore: metrics.biasScore,
      flags: metrics.flags,
      metrics: {
        disparateImpact: { value: metrics.disparateImpact.value, severity: metrics.disparateImpact.severity },
        statisticalParity: { value: metrics.statisticalParity.value, severity: metrics.statisticalParity.severity },
        equalOpportunity: metrics.equalOpportunity ? { value: metrics.equalOpportunity.value, severity: metrics.equalOpportunity.severity } : null,
        demographicParity: { value: metrics.demographicParity.value, severity: metrics.demographicParity.severity }
      },
      groupSelectionRates: metrics.rates,
      representation: metrics.representation
    }, null, 2);
  }

  function downloadJSON(metrics, protectedAttr, targetAttr) {
    var json = generateJSON(metrics, protectedAttr, targetAttr);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'fairness-audit-report.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function buildHTMLReport(metrics, protectedAttr, targetAttr) {
    var scoreColor = metrics.biasScore >= 60 ? '#ef4444' : metrics.biasScore >= 30 ? '#f59e0b' : '#22d3a5';
    var allMetrics = [metrics.disparateImpact, metrics.statisticalParity, metrics.equalOpportunity, metrics.demographicParity].filter(Boolean);
    var metricsRows = allMetrics.map(function (m) {
      return '<tr><td>' + m.name + '</td><td><code>' + m.display + '</code></td><td>' + m.threshold + '</td><td class="sev-' + m.severity + '">' + badge(m.severity) + '</td></tr>';
    }).join('');
    var flagRows = metrics.flags.length ? metrics.flags.map(function (f) {
      return '<tr><td class="sev-' + f.severity + '">' + badge(f.severity) + '</td><td>' + f.metric + '</td><td>' + f.message + '</td></tr>';
    }).join('') : '<tr><td colspan="3">No critical issues detected.</td></tr>';
    var groupRows = metrics.groupNames.map(function (g) {
      var rep = metrics.representation[g];
      return '<tr><td>' + g + '</td><td>' + rep.count + '</td><td>' + rep.pct.toFixed(1) + '%</td><td>' + formatPct(rep.rate) + '</td></tr>';
    }).join('');

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Fairness Audit Report</title><style>' +
      'body{font-family:Inter,system-ui,sans-serif;background:#0a0a1a;color:#e2e8f0;padding:40px;max-width:900px;margin:auto}' +
      'h1{background:linear-gradient(135deg,#4f8ef7,#22d3a5);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:2rem}' +
      'h2{color:#4f8ef7;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:8px;margin-top:32px}' +
      'table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:10px 14px;text-align:left;border-bottom:1px solid rgba(255,255,255,0.08)}' +
      'th{color:#94a3b8;font-size:0.8rem;text-transform:uppercase;letter-spacing:.05em}' +
      'code{background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-size:0.9em}' +
      '.score{font-size:4rem;font-weight:800;color:' + scoreColor + ';text-align:center;margin:20px 0}' +
      '.sev-pass{color:#22d3a5}.sev-warning{color:#f59e0b}.sev-critical{color:#ef4444}' +
      '@media print{body{background:#fff;color:#000}h1{-webkit-text-fill-color:#1a1a2e}code{background:#eee}.score{color:' + (metrics.biasScore >= 60 ? '#c00' : metrics.biasScore >= 30 ? '#b45309' : '#059669') + '}}' +
      '</style></head><body>' +
      '<h1>⚖️ Fairness Audit Report</h1>' +
      '<p>Generated: ' + new Date().toLocaleString() + ' &nbsp;|&nbsp; Dataset rows: ' + metrics.totalRows + ' &nbsp;|&nbsp; Protected attribute: <strong>' + protectedAttr + '</strong> &nbsp;|&nbsp; Outcome: <strong>' + targetAttr + '</strong></p>' +
      '<h2>Overall Bias Score</h2><div class="score">' + metrics.biasScore + ' / 100</div>' +
      '<p style="text-align:center;color:#94a3b8">Higher score = more bias detected. Score above 50 = significant concern.</p>' +
      '<h2>Fairness Metrics</h2><table><thead><tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Status</th></tr></thead><tbody>' + metricsRows + '</tbody></table>' +
      '<h2>Flagged Issues</h2><table><thead><tr><th>Severity</th><th>Metric</th><th>Finding</th></tr></thead><tbody>' + flagRows + '</tbody></table>' +
      '<h2>Group Breakdown</h2><table><thead><tr><th>Group</th><th>Count</th><th>Representation</th><th>Selection Rate</th></tr></thead><tbody>' + groupRows + '</tbody></table>' +
      '<h2>Recommendations</h2><ul>' +
      (metrics.flags.some(function(f){return f.metric==='Disparate Impact';}) ? '<li><strong>Re-weighting</strong>: Apply inverse-frequency sample weights to balance group representation during model training.</li>' : '') +
      (metrics.flags.some(function(f){return f.metric==='Equal Opportunity';}) ? '<li><strong>Threshold Calibration</strong>: Use group-specific decision thresholds to equalize true positive rates.</li>' : '') +
      (metrics.flags.some(function(f){return f.metric==='Proxy Features';}) ? '<li><strong>Feature Removal</strong>: Remove or decorrelate features highly correlated with the protected attribute.</li>' : '') +
      '<li><strong>Regular Audits</strong>: Re-run this audit quarterly and after any model update.</li>' +
      '<li><strong>Diverse Data Collection</strong>: Expand training data to better represent underrepresented groups.</li>' +
      '</ul></body></html>';
  }

  function printReport(metrics, protectedAttr, targetAttr) {
    var html = buildHTMLReport(metrics, protectedAttr, targetAttr);
    var win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 500);
  }

  function renderReportTab(metrics, protectedAttr, targetAttr) {
    var el = document.getElementById('report-content');
    if (!el) return;
    var allMetrics = [metrics.disparateImpact, metrics.statisticalParity, metrics.equalOpportunity, metrics.demographicParity].filter(Boolean);
    var scoreColor = metrics.biasScore >= 60 ? 'var(--critical)' : metrics.biasScore >= 30 ? 'var(--warning)' : 'var(--pass)';
    var metricsHTML = allMetrics.map(function (m) {
      return '<tr><td class="col-name">' + m.name + '</td><td><span class="mono">' + m.display + '</span></td><td class="col-thresh">' + m.threshold + '</td><td><span class="badge badge-' + m.severity + '">' + m.severity.toUpperCase() + '</span></td></tr>';
    }).join('');
    var flagsHTML = metrics.flags.length ? metrics.flags.map(function (f) {
      return '<div class="flag-item flag-' + f.severity + '"><span class="flag-metric">' + f.metric + '</span><p>' + f.message + '</p></div>';
    }).join('') : '<p class="no-issues">✅ No significant bias flags detected.</p>';
    var groupHTML = metrics.groupNames.map(function (g) {
      var rep = metrics.representation[g];
      return '<tr><td>' + g + '</td><td>' + rep.count + '</td><td>' + rep.pct.toFixed(1) + '%</td><td>' + formatPct(rep.rate) + '</td></tr>';
    }).join('');
    el.innerHTML = '<div class="report-hero"><div class="report-score" style="color:' + scoreColor + '">' + metrics.biasScore + '</div><div class="report-score-label">Bias Score <span>/100</span></div><p class="report-date">Generated ' + new Date().toLocaleString() + '</p></div>' +
      '<div class="report-grid"><div class="report-section"><h3>Fairness Metrics</h3><table class="report-table"><thead><tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Status</th></tr></thead><tbody>' + metricsHTML + '</tbody></table></div>' +
      '<div class="report-section"><h3>Flagged Issues</h3>' + flagsHTML + '</div>' +
      '<div class="report-section"><h3>Group Breakdown</h3><table class="report-table"><thead><tr><th>Group</th><th>Count</th><th>% Dataset</th><th>Selection Rate</th></tr></thead><tbody>' + groupHTML + '</tbody></table></div></div>';
  }

  return { downloadJSON: downloadJSON, printReport: printReport, renderReportTab: renderReportTab, generateJSON: generateJSON };
})();
