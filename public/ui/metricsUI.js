const MetricsUI = {
  render(root, state) {
    if (!state.data.length) {
      root.innerHTML = `<div class="tab-inner"><div class="empty-state"><div class="empty-icon">⚖️</div><p>Load a dataset first to compute fairness metrics.</p><button class="btn-primary mt-2" onclick="AppRouter.go('explorer')">Go to Data Explorer</button></div></div>`;
      return;
    }
    const m = state.metrics;
    if (!m) { root.innerHTML = `<div class="tab-inner"><div class="empty-state"><div class="empty-icon">⏳</div><p>Computing metrics…</p></div></div>`; return; }

    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>⚖️ Bias Metrics</h2>
        <p>Analyzing <strong>${state.data.length} records</strong> · Protected attribute: <strong>${state.config.protectedAttr}</strong> · Reference group: <strong>${state.config.referenceGroup}</strong></p>
      </div>

      <!-- Overall Risk Score -->
      <div class="card" style="margin-bottom:1.5rem;background:linear-gradient(135deg,var(--surface),var(--surface2));">
        <div style="display:flex;align-items:center;gap:2rem;flex-wrap:wrap;">
          <div class="risk-score-block" style="padding:1rem;">
            <div class="risk-grade ${m.overallRisk.grade}">${m.overallRisk.grade}</div>
            <div class="risk-score-num">Risk Score: ${m.overallRisk.score}/100</div>
          </div>
          <div style="flex:1;min-width:200px;">
            <div style="font-size:1rem;font-weight:700;margin-bottom:0.5rem;">Overall Fairness Assessment</div>
            <div style="font-size:0.85rem;color:var(--text-dim);line-height:1.7;">${this._gradeNarrative(m.overallRisk.grade, state.config)}</div>
            <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
              ${this._statusSummary(m)}
            </div>
          </div>
        </div>
      </div>

      <!-- Metric Cards Grid -->
      <div class="grid-auto">
        ${this._cardDI(m)}
        ${this._cardSP(m)}
        ${m.equalOpportunity ? this._cardEO(m) : ''}
        ${m.equalizedOdds ? this._cardEOdds(m) : ''}
        ${m.predictiveParity ? this._cardPP(m) : ''}
        ${m.calibration ? this._cardCal(m) : ''}
        ${m.individualFairness ? this._cardIF(m) : ''}
        ${m.intersectionality ? this._cardInter(m) : ''}
        ${m.counterfactualFairness ? this._cardCF(m) : ''}
        ${m.treatmentInequality ? this._cardTI(m) : ''}
        ${m.consistency ? this._cardCS(m) : ''}
      </div>

      ${m.confusionByGroup ? this._confusionSection(m, state.config) : ''}
    </div>`;
  },

  _statusSummary(m) {
    const checks = [
      ['DI', m.disparateImpact?.status],
      ['SP', m.statisticalParity?.status],
      ['EO', m.equalOpportunity?.status],
      ['EqOdds', m.equalizedOdds?.status],
      ['PP', m.predictiveParity?.status],
      ['Cal', m.calibration?.status],
      ['IF', m.individualFairness?.status],
      ['IX', m.intersectionality?.status],
      ['CF', m.counterfactualFairness?.status],
      ['TI', m.treatmentInequality?.status],
      ['CS', m.consistency?.status],
    ].filter(([,s]) => s);
    return checks.map(([name, status]) =>
      `<span class="badge badge-${status}">${name}</span>`
    ).join('');
  },

  _cardDI(m) {
    const di = m.disparateImpact;
    if (!di) return '';
    const val = di.value;
    const pct = Math.round(val * 100);
    const groups = Object.entries(di.byGroup).filter(([g]) => g !== m.referenceGroup);
    return this._card(di.status, 'Disparate Impact Ratio',
      'The 4/5ths Rule (EEOC): minority group selection rate ÷ majority group selection rate. Below 0.8 indicates adverse impact.',
      val.toFixed(3), `Must be ≥ 0.8 (EEOC 4/5ths Rule)`,
      groups.map(([g, r]) => ({ g, rate: r, display: r.toFixed(3) })),
      val < 0.8 ? `⚠️ The ${m.referenceGroup} group is being selected at a rate ${Math.round((1/val-1)*100)}% higher than disadvantaged groups. This falls below the legal EEOC threshold and may constitute adverse impact.`
                : `✅ The selection rate ratio meets the EEOC 4/5ths threshold. Continue monitoring for intersectional effects.`
    );
  },

  _cardSP(m) {
    const sp = m.statisticalParity;
    if (!sp) return '';
    const maxDiff = sp.value;
    const groups = Object.entries(sp.byGroup).filter(([g]) => g !== m.referenceGroup);
    return this._card(sp.status, 'Statistical Parity Difference',
      'Absolute difference in positive outcome rates between groups. A value of 0 means equal outcomes regardless of group membership.',
      (maxDiff > 0 ? '-' : '') + maxDiff.toFixed(3), 'Threshold: |diff| ≤ 0.1',
      groups.map(([g, d]) => ({ g, rate: Math.abs(d), display: (d >= 0 ? '+' : '') + d.toFixed(3) })),
      maxDiff > 0.1 ? `⚠️ There is a ${(maxDiff*100).toFixed(1)} percentage point gap in positive outcomes between groups. This suggests the model systematically advantages one group over another.`
                    : `✅ Outcome rates are within acceptable parity thresholds across all groups.`
    );
  },

  _cardEO(m) {
    const eo = m.equalOpportunity;
    const groups = Object.entries(eo.byGroup).filter(([g]) => g !== m.referenceGroup);
    return this._card(eo.status, 'Equal Opportunity',
      'True Positive Rate (TPR) difference: among truly qualified candidates, do all groups have equal probability of a positive decision?',
      eo.value.toFixed(3), 'Threshold: |TPR diff| ≤ 0.1',
      groups.map(([g, r]) => ({ g, rate: r, display: (r*100).toFixed(1)+'%' })),
      eo.value > 0.1 ? `⚠️ Qualified individuals from minority groups are ${(eo.value*100).toFixed(0)}% less likely to receive a positive decision — even when they meet the same criteria as the reference group.`
                     : `✅ Qualified individuals across all groups receive positive decisions at comparable rates.`
    );
  },

  _cardEOdds(m) {
    const eo = m.equalizedOdds;
    const groups = Object.entries(eo.tpr).filter(([g]) => g !== m.referenceGroup);
    return this._card(eo.status, 'Equalized Odds',
      'Requires equal True Positive AND False Positive Rates across groups. The strictest combined fairness criterion.',
      eo.value.toFixed(3), 'Threshold: max(|ΔTPR|, |ΔFPR|) ≤ 0.1',
      groups.map(([g]) => ({ g, rate: Math.abs(eo.tprDiffs[g]), display: `TPR Δ${(eo.tprDiffs[g]*100).toFixed(0)}%` })),
      eo.value > 0.1 ? `⚠️ The model fails equalized odds. Both qualified and unqualified individuals receive inconsistent treatment across demographic groups.`
                     : `✅ The model achieves equalized odds — consistent error rates for all demographic groups.`
    );
  },

  _cardPP(m) {
    const pp = m.predictiveParity;
    const groups = Object.entries(pp.byGroup).filter(([g]) => g !== m.referenceGroup);
    return this._card(pp.status, 'Predictive Parity',
      'Precision difference: when the model predicts positive for a group, is that prediction equally accurate across groups?',
      pp.value.toFixed(3), 'Threshold: |Precision diff| ≤ 0.1',
      groups.map(([g, r]) => ({ g, rate: r, display: (r*100).toFixed(1)+'%' })),
      pp.value > 0.1 ? `⚠️ Positive predictions carry different reliability across groups. Some groups face more false positives, creating disproportionate harm.`
                     : `✅ Positive predictions are equally reliable (precise) across all demographic groups.`
    );
  },

  _cardCal(m) {
    const cal = m.calibration;
    return this._card(cal.status, 'Score Calibration',
      'Does the model\'s score mean the same thing for all groups? A score of 70 should imply the same outcome probability for everyone.',
      cal.value.toFixed(3), 'Threshold: calibration error ≤ 0.1',
      [], cal.value > 0.1 ? `⚠️ The model's scores are not calibrated equally across groups. A given score has different predictive meaning depending on group membership — a form of implicit bias.`
                          : `✅ Model scores are well-calibrated across all groups. The scores carry consistent meaning regardless of demographic background.`
    );
  },

  _cardIF(m) {
    const ifv = m.individualFairness;
    return this._card(ifv.status, 'Individual Fairness',
      'Similar individuals should receive similar decisions. Measures outcome consistency among equally-qualified people across different groups.',
      ifv.value.toFixed(3), 'Threshold: inconsistency ≤ 0.15',
      [], ifv.value > 0.15 ? `⚠️ Two similarly-qualified people from different groups receive different decisions more often than expected. The model treats like cases unlike.`
                           : `✅ Similarly qualified individuals receive consistent decisions regardless of group membership.`
    );
  },

  _cardInter(m) {
    const ix = m.intersectionality;
    const topCombos = Object.entries(ix.combinations).sort((a,b)=>b[1].rate-a[1].rate).slice(0,4);
    return this._card(ix.status, 'Intersectionality',
      `Bias at the intersection of multiple attributes (${m.intersectionality.crossAttr} × protected attribute). Compounded discrimination can be invisible to single-attribute analysis.`,
      ix.value.toFixed(3), 'Threshold: spread ≤ 0.25',
      topCombos.map(([label, d]) => ({ g: label, rate: d.rate, display: (d.rate*100).toFixed(0)+'% (n='+d.n+')' })),
      ix.value > 0.25 ? `⚠️ Significant bias amplification detected at the intersection of demographic groups. Some combined identities face compounded disadvantage not visible in individual metrics.`
                      : `✅ No significant intersectional amplification detected.`
    );
  },

  _cardCF(m) {
    const cf = m.counterfactualFairness;
    return this._card(cf.status, 'Counterfactual Fairness',
      'Measures how much outcomes would change if protected attributes were flipped while keeping other features constant. Detects "local" bias for specific cases.',
      cf.value.toFixed(3), 'Threshold: inconsistency ≤ 0.15',
      [],
      cf.value > 0.15 ? `⚠️ High counterfactual inconsistency detected. Similar individuals from different groups receive different decisions, indicating the model relies on protected attributes.`
                       : `✅ Outcomes remain stable under counterfactual changes to protected attributes.`
    );
  },

  _cardTI(m) {
    const ti = m.treatmentInequality;
    return this._card(ti.status, 'Treatment Inequality',
      'Measures outcome differences between groups after conditioning on similar features/scores. Detects bias that persists even among similar individuals.',
      ti.value.toFixed(3), 'Threshold: inequality ≤ 0.1',
      [],
      ti.value > 0.1 ? `⚠️ Significant treatment inequality detected. Even with similar qualifications, different groups receive different outcomes.`
                     : `✅ Treatment is equitable across groups when controlling for similar features.`
    );
  },

  _cardCS(m) {
    const cs = m.consistency;
    return this._card(cs.status, 'Consistency',
      'Measures how often similar individuals (based on all features) receive the same outcome. Uses k-nearest neighbors to assess decision consistency.',
      cs.value.toFixed(3), 'Threshold: inconsistency ≤ 0.2',
      [],
      cs.value > 0.2 ? `⚠️ Low consistency detected. Similar individuals receive different decisions, indicating arbitrary or biased decision boundaries.`
                    : `✅ High consistency - similar cases receive similar outcomes regardless of group membership.`
    );
  },

  _card(status, name, desc, value, threshold, groups, interpretation) {
    const color = status === 'critical' ? 'var(--danger)' : status === 'warning' ? 'var(--warning)' : 'var(--success)';
    return `<div class="metric-card ${status}">
      <div class="metric-card-header">
        <div>
          <div class="metric-name">${name}</div>
          <div class="metric-desc">${desc}</div>
        </div>
        <span class="badge badge-${status}">${status === 'critical' ? '🚨 Critical' : status === 'warning' ? '⚠️ Warning' : '✅ Pass'}</span>
      </div>
      <div class="metric-value ${status}" style="color:${color}">${value}</div>
      <div class="metric-threshold">${threshold}</div>
      ${groups.length > 0 ? `<div class="metric-groups">
        ${groups.map(({g,rate,display}) => `
          <div class="group-row">
            <span class="group-name">${g}</span>
            <div class="group-bar-wrap"><div class="group-bar" style="width:${Math.min(100,Math.round(rate*100))}%;background:${color}"></div></div>
            <span class="group-val">${display}</span>
          </div>`).join('')}
      </div>` : ''}
      <div class="metric-interpretation">${interpretation}</div>
    </div>`;
  },

  _confusionSection(m, config) {
    const groups = Object.entries(m.confusionByGroup);
    return `
    <div class="card mt-3">
      <div class="label">Confusion Matrix by Group</div>
      <p style="font-size:0.78rem;color:var(--text-muted);margin:0.5rem 0 1rem;">
        How the model's predictions break down by demographic group. FN (False Negatives) in hiring = qualified candidates rejected; FP = unqualified candidates selected.
      </p>
      <div class="grid-auto">
        ${groups.map(([g, cm]) => `
          <div class="card" style="background:var(--bg2);padding:1rem;">
            <div style="font-size:0.8rem;font-weight:700;margin-bottom:0.75rem;color:var(--primary-light);">${g} (n=${cm.n})</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
              <div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:0.6rem;text-align:center;">
                <div style="font-size:1.2rem;font-weight:800;color:var(--success);">${cm.TP}</div>
                <div style="font-size:0.65rem;color:var(--text-muted);">True Pos.</div>
              </div>
              <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.25);border-radius:6px;padding:0.6rem;text-align:center;">
                <div style="font-size:1.2rem;font-weight:800;color:var(--danger);">${cm.FP}</div>
                <div style="font-size:0.65rem;color:var(--text-muted);">False Pos.</div>
              </div>
              <div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.25);border-radius:6px;padding:0.6rem;text-align:center;">
                <div style="font-size:1.2rem;font-weight:800;color:var(--warning);">${cm.FN}</div>
                <div style="font-size:0.65rem;color:var(--text-muted);">False Neg.</div>
              </div>
              <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);border-radius:6px;padding:0.6rem;text-align:center;">
                <div style="font-size:1.2rem;font-weight:800;color:var(--text-dim);">${cm.TN}</div>
                <div style="font-size:0.65rem;color:var(--text-muted);">True Neg.</div>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  },

  _gradeNarrative(grade, config) {
    const narratives = {
      A: `This model demonstrates excellent fairness across all measured dimensions. The ${config.protectedAttr} attribute has minimal influence on decisions.`,
      B: `Minor fairness concerns detected. Some metrics fall slightly outside ideal thresholds but legal compliance is maintained.`,
      C: `Moderate bias detected. Several metrics indicate that ${config.protectedAttr} meaningfully influences outcomes. Review and mitigation is recommended.`,
      D: `Significant bias detected across multiple metrics. This model likely produces discriminatory outcomes and requires immediate remediation before deployment.`,
      F: `Severe algorithmic bias detected. This model fails multiple fairness criteria and poses serious legal and ethical risks. Do not deploy without comprehensive redesign.`
    };
    return narratives[grade] || '';
  }
};
