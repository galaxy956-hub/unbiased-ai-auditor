// Main App Controller
var App = (function () {
  var state = {
    data: [], columns: {}, protectedAttr: null, targetAttr: null,
    positiveValue: null, metrics: null, activeTab: 'home'
  };

  // ── Navigation ──────────────────────────────────────────────────────────────
  function navigate(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(function (div) {
      div.classList.toggle('active', div.id === 'tab-' + tab);
    });
    if (tab === 'visualizations' && state.metrics) setTimeout(function(){ Charts.renderAll(state.metrics); }, 100);
    if (tab === 'report' && state.metrics) Report.renderReportTab(state.metrics, state.protectedAttr, state.targetAttr);
    if (tab === 'mitigation' && state.metrics) renderMitigation();
  }

  // ── Data Loading ─────────────────────────────────────────────────────────────
  function loadData(data, source) {
    state.data = data;
    state.columns = Parser.profileColumns(data);
    updateStatusIndicator(data.length + ' rows loaded');
    populateColumnSelectors();
    renderDataPreview();
    navigate('explorer');
  }

  function loadDemo() {
    var scenario = DEMO_SCENARIOS.hiring;
    state.protectedAttr = scenario.protectedAttr;
    state.targetAttr = scenario.targetAttr;
    state.positiveValue = scenario.positiveValue;
    loadData(scenario.data, 'demo');
    setTimeout(function () {
      document.getElementById('sel-protected').value = state.protectedAttr;
      document.getElementById('sel-target').value = state.targetAttr;
      document.getElementById('sel-positive').value = state.positiveValue;
      updatePositiveValues();
    }, 50);
  }

  function handleCSV(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var parsed = Parser.parseCSV(e.target.result);
      if (!parsed.length) { showToast('Could not parse CSV — check file format.', 'error'); return; }
      loadData(parsed, 'upload');
    };
    reader.readAsText(file);
  }

  // ── Explorer UI ──────────────────────────────────────────────────────────────
  function populateColumnSelectors() {
    var cols = Object.keys(state.columns);
    ['sel-protected', 'sel-target'].forEach(function (id) {
      var sel = document.getElementById(id);
      sel.innerHTML = '<option value="">— select column —</option>';
      cols.forEach(function (c) { sel.innerHTML += '<option value="' + c + '">' + c + '</option>'; });
    });
    if (state.protectedAttr) document.getElementById('sel-protected').value = state.protectedAttr;
    if (state.targetAttr) document.getElementById('sel-target').value = state.targetAttr;
    updatePositiveValues();
    renderColumnCards();
  }

  function updatePositiveValues() {
    var targetCol = document.getElementById('sel-target').value;
    var sel = document.getElementById('sel-positive');
    sel.innerHTML = '<option value="">— select value —</option>';
    if (targetCol && state.data.length) {
      var unique = Parser.getUniqueValues(state.data, targetCol);
      unique.forEach(function (v) { sel.innerHTML += '<option value="' + v + '">' + v + '</option>'; });
      if (state.positiveValue) sel.value = state.positiveValue;
    }
  }

  function renderDataPreview() {
    var el = document.getElementById('data-preview');
    if (!el || !state.data.length) return;
    var cols = Object.keys(state.columns);
    var rows = state.data.slice(0, 20);
    var html = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + r[c] + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><p class="preview-note">Showing first 20 of ' + state.data.length + ' rows</p>';
    el.innerHTML = html;
  }

  function renderColumnCards() {
    var el = document.getElementById('column-cards');
    if (!el) return;
    el.innerHTML = Object.values(state.columns).map(function (col) {
      var typeIcon = col.type === 'numeric' ? '🔢' : col.type === 'categorical' ? '🏷️' : '📝';
      var detail = col.type === 'numeric'
        ? 'Min: ' + col.min.toFixed(1) + ' · Max: ' + col.max.toFixed(1) + ' · Mean: ' + col.mean.toFixed(1)
        : col.unique.slice(0, 5).join(', ') + (col.uniqueCount > 5 ? '…' : '');
      return '<div class="col-card"><div class="col-card-header"><span class="col-icon">' + typeIcon + '</span><span class="col-name">' + col.name + '</span><span class="col-type-badge">' + col.type + '</span></div><div class="col-detail">' + detail + '</div><div class="col-stats">' + col.uniqueCount + ' unique &nbsp;·&nbsp; ' + col.nullCount + ' nulls</div></div>';
    }).join('');
  }

  // ── Analysis ─────────────────────────────────────────────────────────────────
  function runAnalysis() {
    var pAttr = document.getElementById('sel-protected').value;
    var tAttr = document.getElementById('sel-target').value;
    var pVal = document.getElementById('sel-positive').value;
    if (!pAttr || !tAttr || !pVal) { showToast('Please select protected attribute, target column, and positive outcome value.', 'error'); return; }
    state.protectedAttr = pAttr; state.targetAttr = tAttr; state.positiveValue = pVal;
    state.metrics = Metrics.computeAllMetrics(state.data, pAttr, tAttr, pVal);
    renderMetricsTab();
    navigate('metrics');
    showToast('Analysis complete! ' + state.metrics.flags.length + ' issue(s) found.', state.metrics.flags.length ? 'warning' : 'success');
  }

  // ── Metrics Tab ───────────────────────────────────────────────────────────────
  function renderMetricsTab() {
    var m = state.metrics;
    var el = document.getElementById('metrics-content');
    if (!el) return;
    var allM = [m.disparateImpact, m.statisticalParity, m.equalOpportunity, m.demographicParity].filter(Boolean);
    var cards = allM.map(function (metric) {
      var icon = metric.severity === 'pass' ? '✅' : metric.severity === 'warning' ? '⚠️' : '🚨';
      return '<div class="metric-card metric-' + metric.severity + '"><div class="metric-card-header"><span class="metric-icon">' + icon + '</span><span class="badge badge-' + metric.severity + '">' + metric.severity.toUpperCase() + '</span></div>' +
        '<div class="metric-name">' + metric.name + '</div>' +
        '<div class="metric-value">' + metric.display + '</div>' +
        '<div class="metric-threshold">Threshold: ' + metric.threshold + '</div>' +
        '<p class="metric-desc">' + metric.description + '</p>' +
        '<div class="metric-formula"><code>' + metric.formula + '</code></div></div>';
    }).join('');

    var groupTable = '<table class="data-table"><thead><tr><th>Group</th><th>Count</th><th>% Dataset</th><th>Selection Rate</th></tr></thead><tbody>' +
      m.groupNames.map(function (g) {
        var r = m.representation[g];
        var isMin = g === m.minorityGroup;
        return '<tr class="' + (isMin ? 'row-minor' : '') + '"><td><strong>' + g + '</strong>' + (isMin ? ' <span class="badge badge-critical" style="font-size:0.65rem">minority</span>' : '') + '</td><td>' + r.count + '</td><td>' + r.pct.toFixed(1) + '%</td><td><div class="rate-bar-wrap"><div class="rate-bar" style="width:' + (r.rate * 100).toFixed(0) + '%"></div><span>' + (r.rate * 100).toFixed(1) + '%</span></div></td></tr>';
      }).join('') + '</tbody></table>';

    el.innerHTML = '<div class="gauge-section"><canvas id="gauge-canvas" width="300" height="180"></canvas></div>' +
      '<div class="metrics-grid">' + cards + '</div>' +
      '<div class="section-card"><h3>Group Breakdown — ' + state.protectedAttr + '</h3>' + groupTable + '</div>';

    setTimeout(function () { Charts.animateGauge('gauge-canvas', m.biasScore); }, 100);
  }

  // ── Mitigation Tab ────────────────────────────────────────────────────────────
  function renderMitigation() {
    var m = state.metrics;
    var el = document.getElementById('mitigation-content');
    if (!el || !m) return;
    var strategies = [
      { id: 'reweight', icon: '⚖️', title: 'Re-weighting', desc: 'Assign higher sample weights to underrepresented groups during model training so the algorithm treats all groups proportionally.', when: 'Representation imbalance or disparate impact', applies: m.disparateImpact.severity !== 'pass' },
      { id: 'resample', icon: '🔄', title: 'Resampling (Oversampling)', desc: 'Use SMOTE or random oversampling to generate synthetic examples for underrepresented groups, balancing the training distribution.', when: 'Small minority group size', applies: m.representation[m.minorityGroup] && m.representation[m.minorityGroup].pct < 30 },
      { id: 'threshold', icon: '🎚️', title: 'Threshold Calibration', desc: 'Apply group-specific decision thresholds (e.g., lower threshold for disadvantaged groups) to equalize true positive rates across groups.', when: 'Equal opportunity violations', applies: m.equalOpportunity && m.equalOpportunity.severity !== 'pass' },
      { id: 'proxy', icon: '🔍', title: 'Remove Proxy Features', desc: 'Identify and remove features highly correlated with the protected attribute. These act as "proxies" that allow the model to discriminate indirectly.', when: 'High proxy correlations detected', applies: Object.values(m.correlations).some(function (v) { return Math.abs(v) > 0.3; }) },
      { id: 'adversarial', icon: '🤖', title: 'Adversarial Debiasing', desc: 'Train an adversarial neural network that simultaneously optimizes for accuracy and fairness — the model learns to make predictions that an adversary cannot use to predict group membership.', when: 'Systemic bias across multiple metrics', applies: m.biasScore > 50 },
      { id: 'audit', icon: '📋', title: 'Ongoing Monitoring', desc: 'Implement automated fairness monitoring in production. Re-run bias audits quarterly and after any model update or data distribution shift.', when: 'Always recommended', applies: true }
    ];

    var flagsHTML = m.flags.length
      ? m.flags.map(function (f) {
        return '<div class="flag-item flag-' + f.severity + '"><div class="flag-header"><span class="badge badge-' + f.severity + '">' + f.severity.toUpperCase() + '</span><strong>' + f.metric + '</strong></div><p>' + f.message + '</p></div>';
      }).join('')
      : '<div class="no-issues-box">✅ No critical bias flags detected in this dataset.</div>';

    var stratHTML = strategies.map(function (s) {
      return '<div class="strategy-card ' + (s.applies ? 'strategy-active' : 'strategy-inactive') + '"><div class="strategy-header"><span class="strategy-icon">' + s.icon + '</span><div><div class="strategy-title">' + s.title + '</div><div class="strategy-when">When: ' + s.when + '</div></div>' + (s.applies ? '<span class="badge badge-warning" style="margin-left:auto">Recommended</span>' : '<span class="badge" style="margin-left:auto;background:rgba(255,255,255,0.05);color:#64748b">Optional</span>') + '</div><p class="strategy-desc">' + s.desc + '</p></div>';
    }).join('');

    // What-If simulator
    var simulatorHTML = '<div class="section-card"><h3>🎛️ What-If Threshold Simulator</h3><p style="color:#94a3b8;margin-bottom:16px">Adjust the decision threshold for the minority group (<strong>' + m.minorityGroup + '</strong>) and see the projected impact on the disparate impact ratio.</p><div class="simulator-row"><label>Threshold adjustment for <strong>' + m.minorityGroup + '</strong>: <span id="thresh-val">0%</span></label><input type="range" id="thresh-slider" min="-20" max="20" value="0" step="1"></div><div class="simulator-result" id="sim-result"></div></div>';

    el.innerHTML = '<div class="section-card"><h3>🚩 Detected Issues</h3>' + flagsHTML + '</div>' +
      '<div class="section-card"><h3>🛠 Mitigation Strategies</h3><div class="strategies-grid">' + stratHTML + '</div></div>' +
      simulatorHTML;

    // Wire simulator
    var slider = document.getElementById('thresh-slider');
    if (slider) {
      slider.addEventListener('input', function () {
        var adj = parseInt(this.value);
        document.getElementById('thresh-val').textContent = (adj >= 0 ? '+' : '') + adj + '%';
        var newMinorRate = Math.max(0, Math.min(1, m.rates[m.minorityGroup] + adj / 100));
        var newDI = m.rates[m.majorityGroup] > 0 ? newMinorRate / m.rates[m.majorityGroup] : 1;
        var newSPD = newMinorRate - m.rates[m.majorityGroup];
        var color = newDI >= 0.8 ? 'var(--pass)' : newDI >= 0.6 ? 'var(--warning)' : 'var(--critical)';
        document.getElementById('sim-result').innerHTML =
          '<div class="sim-metrics"><div class="sim-metric"><div class="sim-label">Projected Selection Rate (' + m.minorityGroup + ')</div><div class="sim-value" style="color:' + color + '">' + (newMinorRate * 100).toFixed(1) + '%</div></div>' +
          '<div class="sim-metric"><div class="sim-label">Projected Disparate Impact</div><div class="sim-value" style="color:' + color + '">' + newDI.toFixed(3) + '</div></div>' +
          '<div class="sim-metric"><div class="sim-label">Projected Parity Difference</div><div class="sim-value" style="color:' + color + '">' + (newSPD >= 0 ? '+' : '') + newSPD.toFixed(3) + '</div></div>' +
          '<div class="sim-metric"><div class="sim-label">Threshold Status</div><div class="sim-value" style="color:' + color + '">' + (newDI >= 0.8 ? '✅ PASS' : newDI >= 0.6 ? '⚠️ WARNING' : '🚨 CRITICAL') + '</div></div></div>';
      });
      slider.dispatchEvent(new Event('input'));
    }
  }

  // ── Utilities ────────────────────────────────────────────────────────────────
  function updateStatusIndicator(text) {
    var dot = document.querySelector('.status-dot');
    var label = document.getElementById('data-status-text');
    if (dot) { dot.style.background = 'var(--pass)'; dot.style.boxShadow = '0 0 6px var(--pass)'; }
    if (label) label.textContent = text;
  }

  function showToast(msg, type) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3500);
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    // Tab navigation
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () { navigate(btn.dataset.tab); });
    });

    // Home CTAs
    var demoBtn = document.getElementById('btn-load-demo');
    if (demoBtn) demoBtn.addEventListener('click', loadDemo);
    var uploadCTA = document.getElementById('btn-upload-cta');
    if (uploadCTA) uploadCTA.addEventListener('click', function () { navigate('explorer'); });

    // File upload
    var dropzone = document.getElementById('dropzone');
    var fileInput = document.getElementById('file-input');
    if (dropzone) {
      dropzone.addEventListener('click', function () { fileInput.click(); });
      dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('drag-over'); });
      dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('drag-over'); });
      dropzone.addEventListener('drop', function (e) {
        e.preventDefault(); dropzone.classList.remove('drag-over');
        var file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) handleCSV(file);
        else showToast('Please drop a valid .csv file.', 'error');
      });
    }
    if (fileInput) fileInput.addEventListener('change', function () { if (fileInput.files[0]) handleCSV(fileInput.files[0]); });
    var demoBtn2 = document.getElementById('btn-demo-explorer');
    if (demoBtn2) demoBtn2.addEventListener('click', loadDemo);

    // Column selectors
    var selTarget = document.getElementById('sel-target');
    if (selTarget) selTarget.addEventListener('change', updatePositiveValues);

    // Analyze button
    var analyzeBtn = document.getElementById('btn-analyze');
    if (analyzeBtn) analyzeBtn.addEventListener('click', runAnalysis);

    // Report buttons
    var jsonBtn = document.getElementById('btn-export-json');
    if (jsonBtn) jsonBtn.addEventListener('click', function () {
      if (!state.metrics) { showToast('Run analysis first.', 'error'); return; }
      Report.downloadJSON(state.metrics, state.protectedAttr, state.targetAttr);
    });
    var printBtn = document.getElementById('btn-print-report');
    if (printBtn) printBtn.addEventListener('click', function () {
      if (!state.metrics) { showToast('Run analysis first.', 'error'); return; }
      Report.printReport(state.metrics, state.protectedAttr, state.targetAttr);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  return { navigate: navigate, loadDemo: loadDemo };
})();
