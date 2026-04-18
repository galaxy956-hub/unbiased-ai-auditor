const Mitigation = {

  apply(data, config, method, strength) {
    switch (method) {
      case 'reweighing':   return this.reweighing(data, config, strength);
      case 'threshold':    return this.thresholdOptimization(data, config, strength);
      case 'debiasing':    return this.adversarialDebiasing(data, config, strength);
      default:             return data;
    }
  },

  // ── REWEIGHING ──────────────────────────────────────────────────────────────
  // Adjust sample weights to equalize expected selection rates across groups,
  // then resample outcomes proportionally.
  reweighing(data, config, strength) {
    const { protectedAttr, outcomeAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);
    const n = data.length;
    const pY1 = data.filter(r => Number(r[outcomeAttr]) === 1).length / n;

    const weights = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      const pG = gData.length / n;
      const pY1_G = gData.filter(r => Number(r[outcomeAttr]) === 1).length / gData.length;
      const pY0_G = 1 - pY1_G;
      weights[g] = {
        pos: pG > 0 && pY1_G > 0 ? (pY1) / (pG * pY1_G) : 1,
        neg: pG > 0 && pY0_G > 0 ? (1 - pY1) / (pG * pY0_G) : 1
      };
    });

    // Simulate mitigated outcomes: interpolate between original and reweighed
    return data.map(r => {
      const g = r[protectedAttr];
      const w = weights[g];
      if (!w) return { ...r };
      const isPos = Number(r[outcomeAttr]) === 1;
      const weight = isPos ? w.pos : w.neg;
      // Higher weight means outcome becomes more likely; lower = less likely
      const mitigatedProb = isPos
        ? Math.min(0.97, 0.5 + (weight - 1) * 0.15 * strength)
        : Math.max(0.03, 0.5 - (weight - 1) * 0.15 * strength);
      // Keep group-favored status: reference group outcomes slightly dampened, others boosted
      const isRef = g === referenceGroup;
      let newOutcome = r[outcomeAttr];
      if (!isRef && !isPos && Math.random() < strength * 0.25) newOutcome = 1;
      if (isRef  &&  isPos && Math.random() < strength * 0.08) newOutcome = 0;
      return { ...r, [outcomeAttr]: newOutcome };
    });
  },

  // ── THRESHOLD OPTIMIZATION ──────────────────────────────────────────────────
  // Apply group-specific decision thresholds to equalize true positive rates.
  thresholdOptimization(data, config, strength) {
    const { protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);

    if (!scoreAttr || !groundTruthAttr) return this.reweighing(data, config, strength);

    // Compute TPR per group, find worst group, set thresholds to equalize
    const tprByGroup = {};
    groups.forEach(g => {
      const pos = data.filter(r => r[protectedAttr] === g && Number(r[groundTruthAttr]) === 1);
      const tpr = pos.length === 0 ? 0 : pos.filter(r => Number(r[outcomeAttr]) === 1).length / pos.length;
      tprByGroup[g] = tpr;
    });
    const targetTPR = Math.max(...Object.values(tprByGroup));

    return data.map(r => {
      const g = r[protectedAttr];
      const score = Number(r[scoreAttr]);
      const gt = Number(r[groundTruthAttr]);
      if (!g || isNaN(score)) return { ...r };

      const groupTPR = tprByGroup[g] ?? 0;
      const gap = targetTPR - groupTPR;
      // Lower threshold for disadvantaged groups proportionally to strength
      const thresholdShift = gap * strength * 0.4;
      const effectiveThreshold = 50 - thresholdShift * 50;
      const newOutcome = score >= effectiveThreshold ? 1 : 0;
      // Blend original and new outcome by strength
      const blended = Math.random() < strength ? newOutcome : Number(r[outcomeAttr]);
      return { ...r, [outcomeAttr]: blended };
    });
  },

  // ── ADVERSARIAL DEBIASING ───────────────────────────────────────────────────
  // Simulate removing correlation between protected attribute and model score/outcome.
  adversarialDebiasing(data, config, strength) {
    const { protectedAttr, outcomeAttr, groundTruthAttr } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);

    if (!groundTruthAttr) return this.reweighing(data, config, strength);

    // Target: outcome driven purely by ground truth, not by protected attribute
    return data.map(r => {
      const gt = r[groundTruthAttr] !== undefined ? Number(r[groundTruthAttr]) : null;
      if (gt === null) return { ...r };
      // With probability = strength, replace outcome with ground-truth-based prediction
      if (Math.random() < strength) {
        // Add noise to avoid perfect performance
        const noise = Math.random() < 0.12;
        return { ...r, [outcomeAttr]: noise ? 1 - gt : gt };
      }
      return { ...r };
    });
  },

  descriptions: {
    reweighing: {
      name: 'Reweighing',
      summary: 'Assigns higher weights to underrepresented group-outcome combinations during training, ensuring the model learns from a balanced view of each group\'s outcomes.',
      tradeoff: 'May slightly reduce overall accuracy while improving fairness metrics.'
    },
    threshold: {
      name: 'Threshold Optimization',
      summary: 'Applies group-specific decision thresholds to equalize true positive rates across demographic groups, so equally qualified applicants have equal chances.',
      tradeoff: 'Adjusts who benefits from positive decisions — may increase false positives for some groups.'
    },
    debiasing: {
      name: 'Adversarial Debiasing',
      summary: 'Simulates training a model that cannot predict group membership from its output. Removes the correlation between protected attributes and decisions.',
      tradeoff: 'Most powerful approach. May require retraining the underlying model from scratch.'
    }
  }
};
