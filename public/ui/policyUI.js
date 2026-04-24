const PolicyUI = {
  render(root, state) {
    const thresholds = BiasMetrics.thresholds || {
      disparateImpact: 0.8,
      statisticalParity: 0.1,
      equalOpportunity: 0.1
    };

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>⚖️ Fairness Policy Manager</h2>
        <p>Define your organization's ethical thresholds and regulatory compliance targets.</p>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="label">Compliance Thresholds</div>
          <div class="mt-2">
            <div class="control-row">
              <div class="control-label">Disparate Impact Ratio (Min)</div>
              <div class="slider-wrap">
                <input type="range" min="0.5" max="0.95" step="0.01" value="${thresholds.disparateImpact}" 
                       oninput="PolicyUI.update('disparateImpact', this.value)">
                <span class="slider-val" id="policy-di-val">${thresholds.disparateImpact.toFixed(2)}</span>
              </div>
            </div>
            <p class="text-muted" style="font-size:0.7rem; margin-bottom:1.5rem;">Standard regulatory threshold is 0.80 (4/5ths Rule).</p>
            
            <div class="control-row">
              <div class="control-label">Statistical Parity Diff (Max)</div>
              <div class="slider-wrap">
                <input type="range" min="0.01" max="0.2" step="0.01" value="${thresholds.statisticalParity}" 
                       oninput="PolicyUI.update('statisticalParity', this.value)">
                <span class="slider-val" id="policy-sp-val">${thresholds.statisticalParity.toFixed(2)}</span>
              </div>
            </div>
            
            <div class="control-row mt-1">
              <div class="control-label">Equal Opportunity Diff (Max)</div>
              <div class="slider-wrap">
                <input type="range" min="0.01" max="0.2" step="0.01" value="${thresholds.equalOpportunity}" 
                       oninput="PolicyUI.update('equalOpportunity', this.value)">
                <span class="slider-val" id="policy-eo-val">${thresholds.equalOpportunity.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="label">Organizational Risk Appetite</div>
          <div class="mt-2">
            <div class="method-pills">
              <button class="method-pill active" onclick="PolicyUI.setRisk('strict')">Strict Compliance</button>
              <button class="method-pill" onclick="PolicyUI.setRisk('balanced')">Balanced</button>
              <button class="method-pill" onclick="PolicyUI.setRisk('lenient')">Internal Review Only</button>
            </div>
            <div class="narrative-box mt-2" style="font-size:0.85rem; line-height: 1.6;">
              <strong>Policy Enforcement:</strong> These thresholds globally affect the 'Critical', 'Warning', and 'Pass' status of every metric across the platform. 
              Changes will trigger a re-computation of all audit results.
            </div>
            <button class="btn-primary mt-2" style="width:100%;" onclick="PolicyUI.apply()">Apply Policy Changes</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  update(key, val) {
    const v = parseFloat(val);
    if (!BiasMetrics.thresholds) BiasMetrics.thresholds = { disparateImpact: 0.8, statisticalParity: 0.1, equalOpportunity: 0.1 };
    BiasMetrics.thresholds[key] = v;
    
    const idMap = { disparateImpact: 'policy-di-val', statisticalParity: 'policy-sp-val', equalOpportunity: 'policy-eo-val' };
    const el = document.getElementById(idMap[key]);
    if (el) el.textContent = v.toFixed(2);
  },

  setRisk(mode) {
    const buttons = document.querySelectorAll('#tab-policy .method-pill');
    buttons.forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().includes(mode)));
    
    if (mode === 'strict') {
      this.update('disparateImpact', 0.85);
      this.update('statisticalParity', 0.05);
      this.update('equalOpportunity', 0.05);
    } else if (mode === 'lenient') {
      this.update('disparateImpact', 0.70);
      this.update('statisticalParity', 0.15);
      this.update('equalOpportunity', 0.15);
    } else {
      this.update('disparateImpact', 0.80);
      this.update('statisticalParity', 0.10);
      this.update('equalOpportunity', 0.10);
    }
    this.render(document.getElementById('policy-root'), AppState);
  },

  apply() {
    AppState._computeMetrics();
    alert('Global Fairness Policy updated. All audit metrics have been re-calculated based on your new thresholds.');
    AppRouter.go('metrics');
  }
};
