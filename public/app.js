// ── Global App State ──────────────────────────────────────────────────────────
const AppState = {
  data: [],
  headers: [],
  columnInfo: [],
  datasetKey: null,
  config: {
    protectedAttr: 'gender',
    outcomeAttr: 'hired',
    groundTruthAttr: 'qualified',
    scoreAttr: 'interview_score',
    referenceGroup: 'Male',
  },
  metrics: null,
  labMethod: 'reweighing',
  labStrength: 0.7,
  whatIfRow: null,
  monitoringData: [],
  // In-memory audit history (last 3 runs)
  auditHistory: [],

  loadDemo(key) {
    const cfg = Datasets.configs[key];
    if (!cfg) return;
    const data = Datasets.generate(key);
    this.data = data;
    this.headers = cfg.columns;
    this.datasetKey = key;
    this.config = {
      protectedAttr: cfg.protectedAttr,
      outcomeAttr: cfg.outcomeAttr,
      groundTruthAttr: cfg.groundTruthAttr,
      scoreAttr: cfg.scoreAttr,
      referenceGroup: cfg.referenceGroup,
    };
    this.columnInfo = DataParser.getColumnInfo(data, cfg.columns);
    this.whatIfRow = data[0] ? { ...data[0] } : null;
    this._computeMetrics();
    this._syncConfigBar();
    this._updateNavStatus();
  },

  loadCustom(rows, headers, filename) {
    this.data = rows;
    this.headers = headers;
    this.datasetKey = null;
    this.columnInfo = DataParser.getColumnInfo(rows, headers);

    // Auto-detect columns by type
    const cats = this.columnInfo.filter(c => c.type === 'categorical');
    const nums = this.columnInfo.filter(c => c.type === 'numeric');
    const binaryNums = nums.filter(c => c.min === 0 && c.max === 1);

    // Outcome: prefer last binary numeric column
    const outcomeCol = binaryNums.length > 0 ? binaryNums[binaryNums.length - 1] : nums[nums.length - 1];
    // Ground truth: second-to-last binary numeric
    const gtCandidates = binaryNums.filter(c => c.name !== outcomeCol?.name);
    const gtCol = gtCandidates.length > 0 ? gtCandidates[gtCandidates.length - 1] : null;
    // Score: any non-binary numeric
    const scoreCandidates = nums.filter(c => !(c.min === 0 && c.max === 1));
    const scoreCol = scoreCandidates.length > 0 ? scoreCandidates[0] : null;

    this.config = {
      protectedAttr: cats[0]?.name || headers[0],
      outcomeAttr: outcomeCol?.name || headers[headers.length - 1],
      groundTruthAttr: gtCol?.name || null,
      scoreAttr: scoreCol?.name || null,
      referenceGroup: null,
    };

    // Auto-detect reference group (most frequent in protected attribute)
    const attr = this.config.protectedAttr;
    const freq = {};
    rows.forEach(r => { const v = r[attr]; if (v) freq[v] = (freq[v] || 0) + 1; });
    this.config.referenceGroup = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    this.whatIfRow = rows[0] ? { ...rows[0] } : null;
    this._computeMetrics();
    this._syncConfigBar();
    this._updateNavStatus();
  },

  setProtected(val) {
    this.config.protectedAttr = val;
    const groups = [...new Set(this.data.map(r => r[val]))].filter(Boolean);
    this.config.referenceGroup = groups[0] || null;
    this._syncReferenceOptions();
    this._computeMetrics();
  },
  setOutcome(val) { this.config.outcomeAttr = val; this._computeMetrics(); },
  setReference(val) { this.config.referenceGroup = val; this._computeMetrics(); },

  switchDataset(key) { this.loadDemo(key); AppRouter.go(AppRouter.current); },

  _computeMetrics() {
    if (!this.data.length) return;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
    setTimeout(() => {
      this.metrics = BiasMetrics.computeAll(this.data, this.config);

      // Save to audit history (max 3)
      if (this.metrics) {
        const label = this.datasetKey
          ? (Datasets.configs[this.datasetKey]?.label || 'Dataset')
          : `Custom (${this.data.length} rows)`;
        this.auditHistory.unshift({
          label,
          grade: this.metrics.overallRisk.grade,
          score: this.metrics.overallRisk.score,
          timestamp: new Date().toLocaleTimeString(),
          config: { ...this.config }
        });
        if (this.auditHistory.length > 3) this.auditHistory.pop();
      }

      if (overlay) overlay.style.display = 'none';
      AppRouter.refresh();
    }, 50);
  },

  _syncConfigBar() {
    const bar = document.getElementById('config-bar');
    if (!bar) return;
    bar.style.display = this.data.length ? 'block' : 'none';

    const dsSel = document.getElementById('cfg-dataset');
    if (dsSel && this.datasetKey) dsSel.value = this.datasetKey;

    const cats = this.columnInfo.filter(c => c.type === 'categorical');
    const protSel = document.getElementById('cfg-protected');
    if (protSel) {
      protSel.innerHTML = cats.map(c =>
        `<option value="${c.name}" ${c.name === this.config.protectedAttr ? 'selected' : ''}>${c.name}</option>`
      ).join('');
    }

    const binaryNums = this.columnInfo.filter(c => c.type === 'numeric' && c.min === 0 && c.max === 1);
    const allNums = this.columnInfo.filter(c => c.type === 'numeric');
    const outcomeCols = binaryNums.length > 0 ? binaryNums : allNums;
    const outSel = document.getElementById('cfg-outcome');
    if (outSel) {
      outSel.innerHTML = outcomeCols.map(c =>
        `<option value="${c.name}" ${c.name === this.config.outcomeAttr ? 'selected' : ''}>${c.name}</option>`
      ).join('');
    }

    this._syncReferenceOptions();

    const countEl = document.getElementById('cfg-count');
    if (countEl) countEl.textContent = this.data.length.toLocaleString();
  },

  _syncReferenceOptions() {
    const refSel = document.getElementById('cfg-reference');
    if (!refSel) return;
    const groups = [...new Set(this.data.map(r => r[this.config.protectedAttr]))].filter(Boolean).sort();
    refSel.innerHTML = groups.map(g =>
      `<option value="${g}" ${g === this.config.referenceGroup ? 'selected' : ''}>${g}</option>`
    ).join('');
  },

  // Fixed: was referencing wrong element ID 'status-label' — should be 'status-text'
  _updateNavStatus() {
    const dot = document.querySelector('.status-dot');
    const label = document.getElementById('status-text'); // Fixed: was 'status-label'
    if (!dot || !label) return;
    if (this.data.length) {
      dot.classList.add('active');
      const cfg = Datasets.configs[this.datasetKey];
      label.textContent = cfg ? cfg.label : `${this.data.length.toLocaleString()} rows loaded`;
    } else {
      dot.classList.remove('active');
      label.textContent = 'No dataset loaded';
    }
  }
};

// ── Router ────────────────────────────────────────────────────────────────────
const AppRouter = {
  current: 'home',

  go(tabId) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });

    const pane = document.getElementById(`tab-${tabId}`);
    const btn  = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (pane) pane.classList.add('active');
    if (btn) {
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    }

    this.current = tabId;
    this._renderTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Close mobile nav if open
    const navList = document.getElementById('nav-tab-list');
    if (navList) navList.classList.remove('open');
  },

  refresh() { this._renderTab(this.current); },

  _renderTab(tabId) {
    switch (tabId) {
      case 'dashboard': DashboardUI.render(document.getElementById('dashboard-root'), AppState); break;
      case 'explorer':  ExplorerUI.render(document.getElementById('explorer-root'), AppState); break;
      case 'metrics':   MetricsUI.render(document.getElementById('metrics-root'), AppState); break;
      case 'visuals':   ChartsUI.render(document.getElementById('visuals-root'), AppState); break;
      case 'whatif':    WhatIfUI.render(document.getElementById('whatif-root'), AppState); break;
      case 'bounty':    BountyUI.render(document.getElementById('bounty-root'), AppState); break;
      case 'lab':       LabUI.render(document.getElementById('lab-root'), AppState); break;
      case 'monitor':   MonitorUI.render(document.getElementById('monitor-root'), AppState); break;
      case 'policy':    PolicyUI.render(document.getElementById('policy-root'), AppState); break;
      case 'report':    ReportUI.render(document.getElementById('report-root'), AppState); break;
    }
  }
};

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Load hiring dataset by default
  AppState.loadDemo('hiring');
  AppRouter.go('home');

  // Initialize AI chat widget and server status banner
  if (typeof AiUI !== 'undefined') {
    AiUI.showBanner();
    AiUI.initChat();
  }

  // Tab click listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppRouter.go(btn.getAttribute('data-tab'));
    });
  });

  // Keyboard nav for scenario cards
  document.querySelectorAll('.scenario-card[role="button"]').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });
});