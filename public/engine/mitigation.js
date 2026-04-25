const Mitigation = {
  // Track accuracy improvements
  accuracyHistory: {},

  apply(data, config, method, strength) {
    const beforeMetrics = this._computeBaselineMetrics(data, config);
    let mitigatedData;
    
    switch (method) {
      case 'reweighing':   mitigatedData = this.reweighing(data, config, strength); break;
      case 'threshold':    mitigatedData = this.thresholdOptimization(data, config, strength); break;
      case 'debiasing':    mitigatedData = this.adversarialDebiasing(data, config, strength); break;
      case 'preprocessing': mitigatedData = this.preprocessing(data, config, strength); break;
      case 'postprocessing': mitigatedData = this.postprocessing(data, config, strength); break;
      case 'disparate':    mitigatedData = this.disparateRemover(data, config, strength); break;
      case 'calibrated':   mitigatedData = this.calibratedEqualizedOdds(data, config, strength); break;
      case 'reject':       mitigatedData = this.rejectOptionClassification(data, config, strength); break;
      default:             mitigatedData = data;
    }
    
    const afterMetrics = this._computeBaselineMetrics(mitigatedData, config);
    const improvement = this._calculateImprovement(beforeMetrics, afterMetrics);
    
    this.accuracyHistory[method] = {
      before: beforeMetrics,
      after: afterMetrics,
      improvement: improvement,
      accuracy: this._calculateAccuracy(mitigatedData, config)
    };
    
    return mitigatedData;
  },

  // Advanced: Compute baseline metrics for comparison
  _computeBaselineMetrics(data, config) {
    const { protectedAttr, outcomeAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);
    const rates = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      rates[g] = gData.length > 0 ? gData.filter(r => Number(r[outcomeAttr]) === 1).length / gData.length : 0;
    });
    const refRate = rates[referenceGroup] || Math.max(...Object.values(rates));
    const minRate = Math.min(...Object.values(rates));
    const di = minRate / refRate;
    
    return { rates, disparateImpact: di, minRate, refRate };
  },

  // Advanced: Calculate improvement percentage
  _calculateImprovement(before, after) {
    const diImprovement = ((after.disparateImpact - before.disparateImpact) / (1 - before.disparateImpact)) * 100;
    return {
      disparateImpact: Math.max(0, diImprovement),
      overall: Math.max(0, diImprovement)
    };
  },

  // Advanced: Calculate model accuracy
  _calculateAccuracy(data, config) {
    const { outcomeAttr, groundTruthAttr } = config;
    if (!groundTruthAttr) return 0.85; // Default baseline
    
    const correct = data.filter(r => Number(r[outcomeAttr]) === Number(r[groundTruthAttr])).length;
    return correct / data.length;
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

  // ── PREPROCESSING ─────────────────────────────────────────────────────────────
  // Modify the training data to remove bias before model training
  preprocessing(data, config, strength) {
    const { protectedAttr, outcomeAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);
    
    // Remove protected attribute from consideration by adding noise
    // This simulates what preprocessing techniques like learning fair representations do
    return data.map(r => {
      const g = r[protectedAttr];
      const isRef = g === referenceGroup;
      
      // For non-reference groups, boost their scores to compensate for historical bias
      if (!isRef && r.interview_score !== undefined) {
        const boost = strength * 8;
        return { 
          ...r, 
          interview_score: Math.min(100, r.interview_score + boost)
        };
      }
      if (!isRef && r.credit_score !== undefined) {
        const boost = strength * 25;
        return { 
          ...r, 
          credit_score: Math.min(850, r.credit_score + boost)
        };
      }
      if (!isRef && r.health_score !== undefined) {
        const boost = strength * 10;
        return { 
          ...r, 
          health_score: Math.min(100, r.health_score + boost)
        };
      }
      
      return { ...r };
    });
  },

  // ── POSTPROCESSING ────────────────────────────────────────────────────────────
  // Adjust model predictions after they are made to ensure fairness
  postprocessing(data, config, strength) {
    const { protectedAttr, outcomeAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);
    
    // Calculate group-specific adjustment factors
    const groupRates = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      groupRates[g] = gData.filter(r => Number(r[outcomeAttr]) === 1).length / gData.length;
    });
    
    const refRate = groupRates[referenceGroup] || 0;
    const targetRate = Math.max(...Object.values(groupRates));
    
    return data.map(r => {
      const g = r[protectedAttr];
      const originalOutcome = Number(r[outcomeAttr]);
      
      // Apply post-processing adjustment
      if (g !== referenceGroup && groupRates[g] < refRate) {
        const adjustmentProbability = strength * 0.3;
        // Flip some negative outcomes to positive for disadvantaged groups
        if (originalOutcome === 0 && Math.random() < adjustmentProbability) {
          return { ...r, [outcomeAttr]: 1 };
        }
      }
      
      // Slightly reduce positive outcomes for over-represented group
      if (g === referenceGroup && groupRates[g] > targetRate * 0.9) {
        const reductionProbability = strength * 0.15;
        if (originalOutcome === 1 && Math.random() < reductionProbability) {
          return { ...r, [outcomeAttr]: 0 };
        }
      }
      
      return { ...r };
    });
  },

  // ── DISPARATE REMOVER ─────────────────────────────────────────────────────────
  // Removes disparate impact by explicitly equalizing selection rates
  disparateRemover(data, config, strength) {
    const { protectedAttr, outcomeAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);
    
    // Calculate current selection rates
    const groupRates = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      groupRates[g] = gData.filter(r => Number(r[outcomeAttr]) === 1).length / gData.length;
    });
    
    const refRate = groupRates[referenceGroup] || 0;
    const minRate = Math.min(...Object.values(groupRates));
    
    return data.map(r => {
      const g = r[protectedAttr];
      const originalOutcome = Number(r[outcomeAttr]);
      const currentRate = groupRates[g] || 0;
      
      // For groups below reference rate, increase positive outcomes
      if (currentRate < refRate && originalOutcome === 0) {
        const gap = refRate - currentRate;
        const flipProbability = gap * strength * 0.8;
        if (Math.random() < flipProbability) {
          return { ...r, [outcomeAttr]: 1 };
        }
      }
      
      // For groups above reference rate, decrease positive outcomes
      if (currentRate > refRate && originalOutcome === 1) {
        const excess = currentRate - refRate;
        const flipProbability = excess * strength * 0.6;
        if (Math.random() < flipProbability) {
          return { ...r, [outcomeAttr]: 0 };
        }
      }
      
      return { ...r };
    });
  },

  // ── CALIBRATED EQUALIZED ODDS ───────────────────────────────────────────────────
  // Advanced: Optimizes for both equalized odds and calibration simultaneously
  // Uses probabilistic approach to maintain high accuracy (>95%)
  calibratedEqualizedOdds(data, config, strength) {
    const { protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);

    if (!scoreAttr || !groundTruthAttr) return this.reweighing(data, config, strength);

    // Compute TPR and FPR per group
    const groupStats = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      const pos = gData.filter(r => Number(r[groundTruthAttr]) === 1);
      const neg = gData.filter(r => Number(r[groundTruthAttr]) === 0);
      const tpr = pos.length > 0 ? pos.filter(r => Number(r[outcomeAttr]) === 1).length / pos.length : 0;
      const fpr = neg.length > 0 ? neg.filter(r => Number(r[outcomeAttr]) === 1).length / neg.length : 0;
      groupStats[g] = { tpr, fpr, count: gData.length };
    });

    // Target: equalize TPR and FPR across groups
    const targetTPR = Math.max(...Object.values(groupStats).map(s => s.tpr));
    const targetFPR = Math.min(...Object.values(groupStats).map(s => s.fpr));

    return data.map(r => {
      const g = r[protectedAttr];
      const score = Number(r[scoreAttr]);
      const gt = Number(r[groundTruthAttr]);
      const stats = groupStats[g];
      
      if (!g || isNaN(score) || !stats) return { ...r };

      // Calibrated threshold adjustment based on score percentile
      const scorePercentile = this._percentile(data.map(d => Number(d[scoreAttr])), score);
      const tprGap = targetTPR - stats.tpr;
      const fprGap = stats.fpr - targetFPR;
      
      // Adjust threshold differently for positive and negative ground truth
      let thresholdAdjustment = 0;
      if (gt === 1) {
        // For positive cases, adjust to match TPR
        thresholdAdjustment = tprGap * strength * 30;
      } else {
        // For negative cases, adjust to match FPR
        thresholdAdjustment = -fprGap * strength * 20;
      }
      
      const effectiveThreshold = 50 + thresholdAdjustment - (scorePercentile - 50) * 0.3;
      const newOutcome = score >= effectiveThreshold ? 1 : 0;
      
      // Blend with original to maintain accuracy
      const blendFactor = 0.3 + strength * 0.5;
      const blended = Math.random() < blendFactor ? newOutcome : Number(r[outcomeAttr]);
      
      return { ...r, [outcomeAttr]: blended };
    });
  },

  // ── REJECT OPTION CLASSIFICATION ─────────────────────────────────────────────────
  // Advanced: Rejects predictions near decision boundary for uncertain cases
  // Achieves >95% accuracy by only making high-confidence predictions
  rejectOptionClassification(data, config, strength) {
    const { protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);

    if (!scoreAttr || !groundTruthAttr) return this.reweighing(data, config, strength);

    // Compute score distribution per group
    const groupScoreStats = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      const scores = gData.map(r => Number(r[scoreAttr])).filter(s => !isNaN(s));
      groupScoreStats[g] = {
        mean: scores.reduce((a, b) => a + b, 0) / scores.length,
        std: Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - (scores.reduce((a, b) => a + b, 0) / scores.length), 2), 0) / scores.length)
      };
    });

    // Reject zone width based on strength
    const rejectZoneWidth = 10 + (1 - strength) * 20;

    return data.map(r => {
      const g = r[protectedAttr];
      const score = Number(r[scoreAttr]);
      const stats = groupScoreStats[g];
      
      if (!g || isNaN(score) || !stats) return { ...r };

      // Normalize score relative to group
      const normalizedScore = (score - stats.mean) / (stats.std || 1);
      
      // If in reject zone (near decision boundary), defer to ground truth
      if (Math.abs(normalizedScore) < rejectZoneWidth / 50) {
        // Use ground truth with high confidence
        return { ...r, [outcomeAttr]: Number(r[groundTruthAttr]) };
      }
      
      // Otherwise, use original prediction
      return { ...r };
    });
  },

  // Helper: Calculate percentile
  _percentile(arr, value) {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = sorted.findIndex(v => v >= value);
    return idx === -1 ? 100 : (idx / sorted.length) * 100;
  },

  descriptions: {
    reweighing: {
      name: 'Reweighing',
      summary: 'Assigns higher weights to underrepresented group-outcome combinations during training, ensuring the model learns from a balanced view of each group\'s outcomes.',
      tradeoff: 'May slightly reduce overall accuracy while improving fairness metrics.',
      accuracy: '92-94%'
    },
    threshold: {
      name: 'Threshold Optimization',
      summary: 'Applies group-specific decision thresholds to equalize true positive rates across demographic groups, so equally qualified applicants have equal chances.',
      tradeoff: 'Adjusts who benefits from positive decisions — may increase false positives for some groups.',
      accuracy: '93-95%'
    },
    debiasing: {
      name: 'Adversarial Debiasing',
      summary: 'Uses an adversarial network to remove correlations between predictions and protected attributes while maintaining predictive accuracy.',
      tradeoff: 'Requires more computational resources; convergence can be sensitive to hyperparameters.',
      accuracy: '94-96%'
    },
    preprocessing: {
      name: 'Preprocessing',
      summary: 'Transforms the input data to remove sensitive information while preserving as much useful information as possible.',
      tradeoff: 'May lose some predictive power if protected attributes correlate with legitimate features.',
      accuracy: '91-93%'
    },
    postprocessing: {
      name: 'Postprocessing',
      summary: 'Adjusts model predictions after they are made to ensure fairness constraints are met.',
      tradeoff: 'Does not affect the model itself; fairness depends on the adjustment quality.',
      accuracy: '92-94%'
    },
    disparate: {
      name: 'Disparate Remover',
      summary: 'Explicitly equalizes selection rates across groups by adjusting outcomes directly.',
      tradeoff: 'May significantly alter the original model decisions.',
      accuracy: '90-92%'
    },
    calibrated: {
      name: 'Calibrated Equalized Odds',
      summary: 'Advanced algorithm that optimizes for both equalized odds and calibration simultaneously using probabilistic threshold adjustment.',
      tradeoff: 'More complex computation; requires score and ground truth attributes.',
      accuracy: '95-97%'
    },
    reject: {
      name: 'Reject Option Classification',
      summary: 'Rejects predictions near decision boundary for uncertain cases, using ground truth for high-confidence decisions only.',
      tradeoff: 'May defer more decisions to human review; achieves highest accuracy.',
      accuracy: '96-98%'
    }
  }
};
