const ReportUI = {
  render(root, state) {
    if (!state.data.length || !state.metrics) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state"><div class="empty-icon">📄</div><p>Load a dataset to generate an audit report.</p><button class="btn-primary mt-2" onclick="AppRouter.go('explorer')">Get Started</button></div></div>`;
      return;
    }
    const m = state.metrics;
    const cfg = state.config;
    const datasetLabel = (Datasets.configs[state.datasetKey] || {}).label || 'Custom Dataset';
    const date = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>📄 Audit Report</h2>
        <p>Auto-generated fairness audit for regulatory review and organizational accountability.</p>
      </div>

      <!-- Export bar -->
      <div class="export-bar" style="margin-bottom:1.5rem;">
        <button class="btn-primary btn-sm" onclick="ReportUI.exportJSON()">⬇ Export JSON Report</button>
        <button class="btn-outline btn-sm" onclick="ReportUI.downloadScorecard()">📄 Download Scorecard (PDF)</button>
        <button class="btn-outline btn-sm" onclick="window.print()">🖨 Print to PDF</button>
      </div>

      <!-- Header Card -->
      <div class="card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,#0f1f40,#162040);">
        <div style="display:grid;grid-template-columns:1fr auto;gap:1rem;align-items:start;">
          <div>
            <div style="font-size:0.7rem;font-weight:700;color:var(--primary-light);text-transform:uppercase;letter-spacing:1px;">AI Fairness Audit Report</div>
            <div style="font-size:1.4rem;font-weight:800;margin:0.4rem 0;">${datasetLabel}</div>
            <div style="font-size:0.82rem;color:var(--text-muted);">Generated: ${date} · ${state.data.length} records analyzed · Protected attribute: <strong style="color:var(--text);">${cfg.protectedAttr}</strong></div>
            <div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;">${this._metricBadges(m)}</div>
          </div>
          <div style="text-align:center;">
            <div class="risk-grade ${m.overallRisk.grade}" style="font-size:5rem;">${m.overallRisk.grade}</div>
            <div style="font-size:0.78rem;color:var(--text-muted);">Overall Grade<br>${m.overallRisk.score}/100</div>
          </div>
        </div>
      </div>

      <!-- Executive Summary -->
      <div class="card" style="margin-bottom:1.5rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
          <div class="label" style="margin:0;">Executive Summary</div>
          <button class="ai-btn" id="ai-narrative-btn" onclick="AiUI.generateNarrative(AppState.metrics, AppState.config, '${datasetLabel}', ${state.data.length})">✨ Generate with Gemini</button>
        </div>
        <div class="narrative-box">${this._generateNarrative(m, cfg, datasetLabel, date)}</div>
        <div class="ai-narrative-box" id="ai-narrative-box"></div>
      </div>

      <!-- Findings Table -->
      <div class="card" style="margin-bottom:1.5rem;">
        <div class="label" style="margin-bottom:0.75rem;">Detailed Findings</div>
        <div class="data-table-wrap">
          <table class="findings-table">
            <thead><tr><th>Metric</th><th>Value</th><th>Threshold</th><th>Status</th><th>Impact Level</th><th>Recommendation</th></tr></thead>
            <tbody>${this._findingsRows(m, cfg)}</tbody>
          </table>
        </div>
      </div>

      <!-- Regulatory Compliance -->
      <div class="card" style="margin-bottom:1.5rem;">
        <div class="label" style="margin-bottom:0.75rem;">Regulatory Compliance Checklist</div>
        <div>${this._complianceChecklist(m, cfg)}</div>
      </div>

      <!-- Recommendations -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
          <div class="label" style="margin:0;">Prioritized Remediation Actions</div>
          <button class="ai-btn" id="ai-recs-btn" onclick="AiUI.generateRecommendations(AppState.metrics, AppState.config, '${datasetLabel}')">✨ AI Recommendations</button>
        </div>
        <div>${this._recommendations(m, cfg)}</div>
        <div class="ai-narrative-box" id="ai-recs-box" style="margin-top:1rem;"></div>
      </div>
    </div>`;
  },

  _metricBadges(m) {
    const metrics = ['disparateImpact','statisticalParity','equalOpportunity','equalizedOdds','predictiveParity','calibration','individualFairness','intersectionality'];
    const labels = { disparateImpact:'DI', statisticalParity:'SP', equalOpportunity:'EO', equalizedOdds:'EqOdds', predictiveParity:'PP', calibration:'Cal', individualFairness:'IF', intersectionality:'IX' };
    return metrics.filter(k => m[k]).map(k => `<span class="badge badge-${m[k].status}">${labels[k]}: ${m[k].status}</span>`).join('');
  },

  _generateNarrative(m, cfg, datasetLabel, date) {
    const grade = m.overallRisk.grade;
    const score = m.overallRisk.score;
    const criticals = Object.entries(m).filter(([,v]) => v && v.status === 'critical').map(([k]) => k);
    const warnings = Object.entries(m).filter(([,v]) => v && v.status === 'warning').map(([k]) => k);

    const metricNames = { disparateImpact:'Disparate Impact', statisticalParity:'Statistical Parity', equalOpportunity:'Equal Opportunity', equalizedOdds:'Equalized Odds', predictiveParity:'Predictive Parity', calibration:'Score Calibration', individualFairness:'Individual Fairness', intersectionality:'Intersectionality' };
    const critNames = criticals.map(k => metricNames[k]).filter(Boolean);
    const warnNames = warnings.map(k => metricNames[k]).filter(Boolean);

    let text = `This report presents the results of an automated fairness audit conducted on <strong>${datasetLabel}</strong> using ${m.overallRisk.score > 0 ? 'the Unbiased AI Auditor' : 'standard fairness metrics'}. `;
    text += `The analysis evaluated ${Object.keys(m).filter(k=>m[k]&&m[k].status).length} fairness metrics across ${cfg.protectedAttr} groups, designating <strong>${cfg.referenceGroup}</strong> as the reference (privileged) group. `;

    if (grade === 'A') {
      text += `The system received an overall fairness grade of <strong>A (${score}/100)</strong>, indicating exemplary performance across all measured dimensions. No significant bias patterns were detected.`;
    } else if (grade === 'B') {
      text += `The system received an overall fairness grade of <strong>B (${score}/100)</strong>. While generally compliant, ${warnNames.length > 0 ? `minor concerns were identified in: ${warnNames.join(', ')}` : 'some metrics fell slightly below ideal thresholds'}.`;
    } else if (grade === 'C') {
      text += `The system received an overall fairness grade of <strong>C (${score}/100)</strong>, indicating <em>moderate bias</em> that warrants attention. `;
      if (critNames.length) text += `Critical violations detected in: <strong>${critNames.join(', ')}</strong>. `;
      text += `These patterns suggest that ${cfg.protectedAttr} meaningfully influences outcomes in ways that may disadvantage certain groups.`;
    } else if (grade === 'D') {
      text += `The system received an overall fairness grade of <strong>D (${score}/100)</strong>, indicating <em>significant algorithmic bias</em>. `;
      if (critNames.length) text += `The following metrics showed critical violations: <strong>${critNames.join(', ')}</strong>. `;
      text += `This system is likely producing discriminatory outcomes and should not be deployed without remediation.`;
    } else {
      text += `The system received an overall fairness grade of <strong>F (${score}/100)</strong>, indicating <em>severe, pervasive bias</em>. `;
      text += `Critical violations were detected in ${critNames.length} metric${critNames.length !== 1 ? 's' : ''}: <strong>${critNames.join(', ')}</strong>. `;
      text += `This system poses serious legal and ethical risks. Immediate intervention, model redesign, and independent review are strongly recommended before any deployment.`;
    }

    if (m.disparateImpact && m.disparateImpact.value < 0.8) {
      text += ` <strong>The Disparate Impact Ratio of ${m.disparateImpact.value.toFixed(3)} falls below the EEOC 4/5ths Rule threshold of 0.8</strong>, potentially constituting adverse impact under U.S. employment law.`;
    }
    return text;
  },

  _findingsRows(m, cfg) {
    const defs = [
      { key:'disparateImpact', name:'Disparate Impact Ratio', threshold:'≥ 0.8', impact:'Legal/Regulatory', rec:'Apply reweighing or threshold optimization to equalize selection rates.' },
      { key:'statisticalParity', name:'Statistical Parity Difference', threshold:'≤ 0.1', impact:'Outcome Equity', rec:'Review decision criteria for systemic group-based patterns.' },
      { key:'equalOpportunity', name:'Equal Opportunity Difference', threshold:'≤ 0.1', impact:'Qualified Candidate Access', rec:'Adjust score thresholds per group to equalize TPRs.' },
      { key:'equalizedOdds', name:'Equalized Odds', threshold:'≤ 0.1', impact:'Error Rate Equity', rec:'Redesign scoring to reduce both TPR and FPR disparities.' },
      { key:'predictiveParity', name:'Predictive Parity', threshold:'≤ 0.1', impact:'Reliability Equity', rec:'Audit training data for label noise correlated with group membership.' },
      { key:'calibration', name:'Score Calibration', threshold:'≤ 0.1', impact:'Score Trustworthiness', rec:'Recalibrate model scores per group using Platt Scaling.' },
      { key:'individualFairness', name:'Individual Fairness', threshold:'≤ 0.15', impact:'Case-by-Case Equity', rec:'Add similarity constraints to the objective function during training.' },
      { key:'intersectionality', name:'Intersectional Bias', threshold:'≤ 0.25', impact:'Compounded Discrimination', rec:'Disaggregate model evaluation to all subgroup combinations.' },
    ];
    return defs.filter(d => m[d.key]).map(d => {
      const metric = m[d.key];
      const impactIcon = metric.status === 'critical' ? '🔴 High' : metric.status === 'warning' ? '🟡 Medium' : '🟢 Low';
      return `<tr>
        <td style="font-weight:600;">${d.name}</td>
        <td>${metric.value?.toFixed(3) ?? '—'}</td>
        <td style="color:var(--text-muted);">${d.threshold}</td>
        <td><span class="badge badge-${metric.status}">${metric.status === 'critical' ? '🚨 Critical' : metric.status === 'warning' ? '⚠️ Warning' : '✅ Pass'}</span></td>
        <td>${impactIcon}</td>
        <td style="font-size:0.78rem;color:var(--text-dim);">${metric.status !== 'pass' ? d.rec : '— No action required'}</td>
      </tr>`;
    }).join('');
  },

  _complianceChecklist(m, cfg) {
    const diOk = !m.disparateImpact || m.disparateImpact.value >= 0.8;
    const eoOk = !m.equalOpportunity || m.equalOpportunity.status !== 'critical';
    const spOk = !m.statisticalParity || m.statisticalParity.status !== 'critical';

    const items = [
      { ok: diOk, framework:'EEOC 4/5ths Rule (US)', desc:'Selection rates for protected groups must be ≥ 80% of the highest-selected group. Applies to employment decisions.', violation:'Disparate Impact Ratio below 0.8 indicates potential adverse impact under Title VII.' },
      { ok: eoOk && spOk, framework:'EU AI Act — High-Risk AI', desc:'High-risk AI systems (hiring, credit, healthcare) must ensure non-discrimination and equal treatment. Annual bias audits required.', violation:'Multiple critical fairness violations place this system in the non-compliant category under EU AI Act Article 10.' },
      { ok: eoOk, framework:'Equal Credit Opportunity Act (ECOA)', desc:'Lenders may not discriminate based on race, color, religion, national origin, sex, marital status, or age.', violation:'Equal Opportunity violations may indicate ECOA non-compliance for lending systems.' },
      { ok: diOk && spOk, framework:'Fair Housing Act (FHA)', desc:'Prohibits discrimination in housing-related decisions including mortgage lending based on protected characteristics.', violation:'Disparate impact in lending or housing decisions may violate FHA protections.' },
    ];
    return items.map(item => `
      <div class="checklist-item">
        <span class="check-icon">${item.ok ? '✅' : '❌'}</span>
        <div class="check-text">
          <strong>${item.framework}</strong>
          <span>${item.ok ? item.desc : `<span style="color:var(--warning);">⚠️ ${item.violation}</span>`}</span>
        </div>
      </div>`).join('');
  },

  _recommendations(m, cfg) {
    const recs = [];
    if (m.disparateImpact?.status === 'critical') recs.push({ priority: 1, title: 'Address Disparate Impact Immediately', detail: `The DI ratio of ${m.disparateImpact.value.toFixed(3)} is below the EEOC legal threshold. Conduct an adverse impact analysis and apply reweighing or threshold optimization.`, icon: '🔴' });
    if (m.equalOpportunity?.status === 'critical') recs.push({ priority: 2, title: 'Equalize Access for Qualified Candidates', detail: `Qualified individuals from minority groups are significantly less likely to be selected. Apply per-group threshold optimization to equalize true positive rates.`, icon: '🔴' });
    if (m.intersectionality?.status !== 'pass') recs.push({ priority: 3, title: 'Conduct Intersectional Subgroup Analysis', detail: `Bias is amplified at intersections of demographic attributes. Disaggregate all evaluations and monitoring by combined subgroups.`, icon: '🟡' });
    if (m.calibration?.status !== 'pass') recs.push({ priority: 4, title: 'Recalibrate Model Scores', detail: `Model scores carry different meaning for different groups. Apply group-specific Platt Scaling or isotonic regression to achieve consistent calibration.`, icon: '🟡' });
    recs.push({ priority: 5, title: 'Establish Ongoing Monitoring', detail: `Fairness is not static. Implement automated bias monitoring dashboards with quarterly reviews, and re-audit after any model update.`, icon: '🟢' });
    recs.push({ priority: 6, title: 'Conduct a Sociotechnical Audit', detail: `Algorithmic metrics alone are insufficient. Engage affected communities, subject matter experts, and legal counsel to understand real-world impact.`, icon: '🟢' });

    return recs.sort((a,b) => a.priority - b.priority).map((r, i) => `
      <div style="display:flex;gap:0.75rem;padding:0.85rem 0;border-bottom:1px solid var(--border);">
        <span style="font-size:1.1rem;flex-shrink:0;">${r.icon}</span>
        <div>
          <div style="font-size:0.85rem;font-weight:700;margin-bottom:0.25rem;">${i+1}. ${r.title}</div>
          <div style="font-size:0.8rem;color:var(--text-dim);line-height:1.6;">${r.detail}</div>
        </div>
      </div>`).join('');
  },

  exportJSON() {
    const m = AppState.metrics;
    const cfg = AppState.config;
    const report = {
      generated: new Date().toISOString(),
      dataset: (Datasets.configs[AppState.datasetKey] || {}).label || 'Custom',
      rowCount: AppState.data.length,
      config: cfg,
      overallRisk: m.overallRisk,
      metrics: {
        disparateImpact: m.disparateImpact,
        statisticalParity: m.statisticalParity,
        equalOpportunity: m.equalOpportunity,
        equalizedOdds: m.equalizedOdds,
        predictiveParity: m.predictiveParity,
        calibration: m.calibration ? { value: m.calibration.value, status: m.calibration.status } : null,
        individualFairness: m.individualFairness,
        intersectionality: m.intersectionality ? { value: m.intersectionality.value, status: m.intersectionality.status } : null,
      }
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `fairness-audit-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  },

  downloadScorecard() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const m = AppState.metrics;
    const cfg = AppState.config;
    const datasetLabel = (Datasets.configs[AppState.datasetKey] || {}).label || 'Custom Dataset';

    // PDF Styling & Header
    doc.setFillColor(5, 13, 26);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('FAIRNESS SCORECARD', 15, 25);
    doc.setFontSize(10);
    doc.text('Unbiased AI Auditor — Model Nutrition Label', 15, 32);

    // Body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Model Overview', 15, 55);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Dataset: ${datasetLabel}`, 15, 62);
    doc.text(`Protected Attribute: ${cfg.protectedAttr}`, 15, 67);
    doc.text(`Reference Group: ${cfg.referenceGroup}`, 15, 72);
    doc.text(`Audit Date: ${new Date().toLocaleDateString()}`, 15, 77);

    // Score Circle
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1);
    doc.circle(170, 65, 15);
    doc.setFontSize(20);
    doc.text(m.overallRisk.grade, 166, 68);
    doc.setFontSize(8);
    doc.text('GRADE', 163, 83);

    // Metrics Table
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Fairness Metrics', 15, 95);

    const metrics = [
      { name: 'Disparate Impact', val: m.disparateImpact.value.toFixed(3), status: m.disparateImpact.status },
      { name: 'Statistical Parity', val: m.statisticalParity.value.toFixed(3), status: m.statisticalParity.status },
      { name: 'Equal Opportunity', val: m.equalOpportunity ? m.equalOpportunity.value.toFixed(3) : 'N/A', status: m.equalOpportunity ? m.equalOpportunity.status : 'pass' }
    ];

    let y = 105;
    metrics.forEach(item => {
      doc.setFillColor(item.status === 'critical' ? 255 : 240, item.status === 'critical' ? 240 : 240, item.status === 'critical' ? 240 : 240);
      doc.rect(15, y, 180, 10, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(item.name, 20, y + 6);
      doc.text(item.val, 100, y + 6);
      doc.setFont('helvetica', 'bold');
      doc.text(item.status.toUpperCase(), 160, y + 6);
      y += 12;
    });

    // Recommendations
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Recommendations', 15, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('1. Address critical bias violations before deployment.', 15, y + 18);
    doc.text('2. Implement automated drift monitoring for production models.', 15, y + 23);
    doc.text('3. Disaggregate audit results for intersectional sub-groups.', 15, y + 28);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Unbiased AI Auditor — Accountability through Transparency.', 15, 285);

    doc.save(`fairness-scorecard-${Date.now()}.pdf`);
  }
};
