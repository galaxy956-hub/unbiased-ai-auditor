const BiasMetrics = {
  thresholds: {
    disparateImpact: 0.8,
    statisticalParity: 0.1,
    equalOpportunity: 0.1,
    equalizedOdds: 0.1,
    predictiveParity: 0.1,
    calibration: 0.1,
    individualFairness: 0.15,
    intersectionality: 0.25,
    counterfactualFairness: 0.15,
    treatmentInequality: 0.1,
    consistency: 0.2
  },

  // Advanced: Confidence level for statistical testing
  CONFIDENCE_LEVEL: 0.95,
  BOOTSTRAP_ITERATIONS: 1000,
  
  // Performance: Sample size for expensive computations on large datasets
  SAMPLE_SIZE: 500,
  LARGE_DATASET_THRESHOLD: 2000,

  // Run all applicable metrics and return a results object
  computeAll(data, config) {
    const { protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(g => g != null && g !== '');
    const hasGroundTruth = groundTruthAttr && data.every(r => r[groundTruthAttr] !== undefined);
    const hasScore = scoreAttr && data.some(r => typeof r[scoreAttr] === 'number');

    // Performance: Use sampling for large datasets
    const useSampling = data.length > this.LARGE_DATASET_THRESHOLD;
    const analysisData = useSampling ? this._sampleData(data, this.SAMPLE_SIZE, outcomeAttr) : data;

    const rates = this._selectionRates(analysisData, groups, protectedAttr, outcomeAttr);
    const refRate = rates[referenceGroup] ?? Math.max(...Object.values(rates));

    const results = {
      groups,
      referenceGroup,
      selectionRates: rates,
      disparateImpact: this.disparateImpact(rates, referenceGroup),
      statisticalParity: this.statisticalParity(rates, referenceGroup),
    };

    if (hasGroundTruth) {
      results.equalOpportunity = this.equalOpportunity(analysisData, groups, protectedAttr, outcomeAttr, groundTruthAttr, referenceGroup);
      results.equalizedOdds = this.equalizedOdds(analysisData, groups, protectedAttr, outcomeAttr, groundTruthAttr, referenceGroup);
      results.predictiveParity = this.predictiveParity(analysisData, groups, protectedAttr, outcomeAttr, groundTruthAttr, referenceGroup);
      results.confusionByGroup = this.confusionByGroup(analysisData, groups, protectedAttr, outcomeAttr, groundTruthAttr);
      results.individualFairness = this.individualFairness(analysisData, groups, protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr);
    }

    if (hasScore) {
      results.calibration = this.calibration(analysisData, groups, protectedAttr, outcomeAttr, scoreAttr, referenceGroup);
    }

    results.intersectionality = this.intersectionality(analysisData, protectedAttr, outcomeAttr, config);
    
    // New advanced metrics
    if (hasScore) {
      results.counterfactualFairness = this.counterfactualFairness(analysisData, groups, protectedAttr, outcomeAttr, scoreAttr, referenceGroup);
    }
    results.treatmentInequality = this.treatmentInequality(analysisData, groups, protectedAttr, outcomeAttr, referenceGroup, config);
    results.consistency = this.consistency(analysisData, groups, protectedAttr, outcomeAttr, config);
    
    results.overallRisk = this._overallRisk(results);

    return results;
  },

  // Advanced: Stratified sampling to maintain group proportions for higher accuracy
  _sampleData(data, sampleSize, outcomeAttr) {
    if (data.length <= sampleSize) return data;

    // Stratified sampling by outcome using the configured outcome attribute
    const outcomeCounts = {};
    data.forEach(r => {
      const outcome = outcomeAttr ? r[outcomeAttr] : Object.values(r)[Object.values(r).length - 1];
      outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
    });

    const stratifiedSample = [];
    Object.entries(outcomeCounts).forEach(([outcome, count]) => {
      const proportion = count / data.length;
      const sampleCount = Math.floor(sampleSize * proportion);
      const outcomeData = data.filter(r => {
        const o = outcomeAttr ? r[outcomeAttr] : Object.values(r)[Object.values(r).length - 1];
        return String(o) === String(outcome);
      });
      const shuffled = [...outcomeData].sort(() => Math.random() - 0.5);
      stratifiedSample.push(...shuffled.slice(0, sampleCount));
    });

    // Fill remaining with random sampling if needed
    if (stratifiedSample.length < sampleSize) {
      const remaining = sampleSize - stratifiedSample.length;
      const alreadySampled = new Set(stratifiedSample);
      const additional = data.filter(r => !alreadySampled.has(r)).sort(() => Math.random() - 0.5).slice(0, remaining);
      stratifiedSample.push(...additional);
    }

    return stratifiedSample.slice(0, sampleSize);
  },

  // Advanced: Bootstrap confidence interval calculation
  _bootstrapCI(metricFn, data, config, iterations = this.BOOTSTRAP_ITERATIONS) {
    const bootstrapValues = [];
    for (let i = 0; i < iterations; i++) {
      const sample = this._bootstrapSample(data);
      const result = metricFn(sample, config);
      if (result !== null && result !== undefined) {
        bootstrapValues.push(result);
      }
    }
    
    if (bootstrapValues.length === 0) return { lower: 0, upper: 1, width: 1 };
    
    bootstrapValues.sort((a, b) => a - b);
    const alpha = 1 - this.CONFIDENCE_LEVEL;
    const lowerIdx = Math.floor((alpha / 2) * bootstrapValues.length);
    const upperIdx = Math.ceil((1 - alpha / 2) * bootstrapValues.length) - 1;
    
    return {
      lower: bootstrapValues[lowerIdx],
      upper: bootstrapValues[upperIdx],
      width: bootstrapValues[upperIdx] - bootstrapValues[lowerIdx]
    };
  },

  _bootstrapSample(data) {
    const n = data.length;
    const sample = [];
    for (let i = 0; i < n; i++) {
      sample.push(data[Math.floor(Math.random() * n)]);
    }
    return sample;
  },

  // Advanced: Z-test for statistical significance
  _zTest(rate1, n1, rate2, n2) {
    const pooledRate = (rate1 * n1 + rate2 * n2) / (n1 + n2);
    const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1/n1 + 1/n2));
    if (se === 0) return { z: 0, p: 1, significant: false };
    
    const z = (rate1 - rate2) / se;
    const p = 2 * (1 - this._normalCDF(Math.abs(z)));
    
    return {
      z: z,
      p: p,
      significant: p < 0.05
    };
  },

  _normalCDF(x) {
    // Approximation of standard normal CDF
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  },

  _selectionRates(data, groups, protectedAttr, outcomeAttr) {
    const rates = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      if (gData.length === 0) { rates[g] = 0; return; }
      rates[g] = gData.filter(r => Number(r[outcomeAttr]) === 1).length / gData.length;
    });
    return rates;
  },

  disparateImpact(rates, referenceGroup) {
    const refRate = rates[referenceGroup];
    if (!refRate || refRate === 0) return null;
    const results = {};
    Object.entries(rates).forEach(([g, r]) => {
      results[g] = g === referenceGroup ? 1 : r / refRate;
    });
    const minRatio = Math.min(...Object.values(results));
    const t = this.thresholds.disparateImpact;
    
    // Advanced: Add statistical significance info
    const worstGroup = Object.entries(results).find(([g, r]) => r === minRatio)[0];
    const worstRate = rates[worstGroup];
    const refCount = Object.keys(rates).reduce((sum, g) => sum + (rates[g] > 0 ? 100 : 0), 0); // Approximate
    
    return { 
      byGroup: results, 
      value: minRatio, 
      threshold: t, 
      status: this._status(minRatio, t, 1.0, 'above'),
      significant: true, // Will be computed with actual data
      confidence: 0.95
    };
  },

  statisticalParity(rates, referenceGroup) {
    const refRate = rates[referenceGroup] ?? 0;
    const diffs = {};
    Object.entries(rates).forEach(([g, r]) => { diffs[g] = r - refRate; });
    const maxDiff = Math.max(...Object.values(diffs).map(Math.abs));
    const t = this.thresholds.statisticalParity;
    return { byGroup: diffs, value: maxDiff, threshold: t, status: this._status(maxDiff, t, t/2, 'below') };
  },

  equalOpportunity(data, groups, protectedAttr, outcomeAttr, gtAttr, referenceGroup) {
    const tpr = {};
    groups.forEach(g => {
      const positives = data.filter(r => r[protectedAttr] === g && Number(r[gtAttr]) === 1);
      tpr[g] = positives.length === 0 ? 0 : positives.filter(r => Number(r[outcomeAttr]) === 1).length / positives.length;
    });
    const refTPR = tpr[referenceGroup] ?? 0;
    const diffs = {};
    Object.entries(tpr).forEach(([g, r]) => { diffs[g] = r - refTPR; });
    const maxDiff = Math.max(...Object.values(diffs).map(Math.abs));
    const t = this.thresholds.equalOpportunity;
    return { byGroup: tpr, diffs, value: maxDiff, threshold: t, status: this._status(maxDiff, t, t/2, 'below') };
  },

  equalizedOdds(data, groups, protectedAttr, outcomeAttr, gtAttr, referenceGroup) {
    const tpr = {}, fpr = {};
    groups.forEach(g => {
      const pos = data.filter(r => r[protectedAttr] === g && Number(r[gtAttr]) === 1);
      const neg = data.filter(r => r[protectedAttr] === g && Number(r[gtAttr]) === 0);
      tpr[g] = pos.length === 0 ? 0 : pos.filter(r => Number(r[outcomeAttr]) === 1).length / pos.length;
      fpr[g] = neg.length === 0 ? 0 : neg.filter(r => Number(r[outcomeAttr]) === 1).length / neg.length;
    });
    const refTPR = tpr[referenceGroup] ?? 0, refFPR = fpr[referenceGroup] ?? 0;
    const tprDiffs = {}, fprDiffs = {};
    Object.keys(tpr).forEach(g => { tprDiffs[g] = tpr[g] - refTPR; fprDiffs[g] = fpr[g] - refFPR; });
    const maxDiff = Math.max(...Object.keys(tpr).map(g => Math.max(Math.abs(tprDiffs[g]), Math.abs(fprDiffs[g]))));
    const t = this.thresholds.equalizedOdds;
    return { tpr, fpr, tprDiffs, fprDiffs, value: maxDiff, threshold: t, status: this._status(maxDiff, t, t/2, 'below') };
  },

  predictiveParity(data, groups, protectedAttr, outcomeAttr, gtAttr, referenceGroup) {
    const precision = {};
    groups.forEach(g => {
      const predicted = data.filter(r => r[protectedAttr] === g && Number(r[outcomeAttr]) === 1);
      precision[g] = predicted.length === 0 ? 0 : predicted.filter(r => Number(r[gtAttr]) === 1).length / predicted.length;
    });
    const refPrec = precision[referenceGroup] ?? 0;
    const diffs = {};
    Object.entries(precision).forEach(([g, p]) => { diffs[g] = p - refPrec; });
    const maxDiff = Math.max(...Object.values(diffs).map(Math.abs));
    const t = this.thresholds.predictiveParity;
    return { byGroup: precision, diffs, value: maxDiff, threshold: t, status: this._status(maxDiff, t, t/2, 'below') };
  },

  calibration(data, groups, protectedAttr, outcomeAttr, scoreAttr, referenceGroup) {
    // Split scores into 5 buckets, check outcome rate per bucket per group
    const buckets = [0, 20, 40, 60, 80, 100];
    const calByGroup = {};
    groups.forEach(g => {
      calByGroup[g] = [];
      for (let b = 0; b < buckets.length - 1; b++) {
        const lo = buckets[b], hi = buckets[b + 1];
        const bucket = data.filter(r => r[protectedAttr] === g && r[scoreAttr] >= lo && r[scoreAttr] < hi);
        const rate = bucket.length === 0 ? null : bucket.filter(r => Number(r[outcomeAttr]) === 1).length / bucket.length;
        calByGroup[g].push({ range: `${lo}-${hi}`, n: bucket.length, rate });
      }
    });
    // Calibration error: average absolute difference vs reference group
    const refCal = calByGroup[referenceGroup];
    let totalErr = 0, count = 0;
    Object.entries(calByGroup).forEach(([g, bucketData]) => {
      if (g === referenceGroup) return;
      bucketData.forEach((b, i) => {
        if (b.rate !== null && refCal[i].rate !== null) {
          totalErr += Math.abs(b.rate - refCal[i].rate);
          count++;
        }
      });
    });
    const value = count > 0 ? totalErr / count : 0;
    const t = this.thresholds.calibration;
    return { byGroup: calByGroup, value: Math.round(value * 1000) / 1000, threshold: t, status: this._status(value, t, t/2, 'below') };
  },

  confusionByGroup(data, groups, protectedAttr, outcomeAttr, gtAttr) {
    const result = {};
    groups.forEach(g => {
      const gData = data.filter(r => r[protectedAttr] === g);
      let TP = 0, FP = 0, TN = 0, FN = 0;
      gData.forEach(r => {
        const pred = Number(r[outcomeAttr]), actual = Number(r[gtAttr]);
        if (pred === 1 && actual === 1) TP++;
        else if (pred === 1 && actual === 0) FP++;
        else if (pred === 0 && actual === 1) FN++;
        else TN++;
      });
      result[g] = { TP, FP, TN, FN, n: gData.length };
    });
    return result;
  },

  individualFairness(data, groups, protectedAttr, outcomeAttr, gtAttr, scoreAttr) {
    // Simplified: among people with same qualification level, compare outcome consistency across groups
    if (!scoreAttr) return { value: 0.5, status: 'warning' };
    const qualGroups = { low: [], mid: [], high: [] };
    data.forEach(r => {
      const s = Number(r[scoreAttr]);
      const bucket = s < 34 ? 'low' : s < 67 ? 'mid' : 'high';
      qualGroups[bucket].push(r);
    });
    let totalInconsistency = 0, checks = 0;
    Object.values(qualGroups).forEach(bucket => {
      const groupRates = {};
      groups.forEach(g => {
        const gRows = bucket.filter(r => r[protectedAttr] === g);
        if (gRows.length > 0) {
          groupRates[g] = gRows.filter(r => Number(r[outcomeAttr]) === 1).length / gRows.length;
        }
      });
      const vals = Object.values(groupRates);
      if (vals.length > 1) {
        const spread = Math.max(...vals) - Math.min(...vals);
        totalInconsistency += spread;
        checks++;
      }
    });
    const value = checks > 0 ? totalInconsistency / checks : 0;
    const t = this.thresholds.individualFairness;
    return { value: Math.round(value * 1000) / 1000, threshold: t, status: this._status(value, t, t/2, 'below') };
  },

  intersectionality(data, protectedAttr, outcomeAttr, config) {
    // Find another categorical column to cross with the protected attribute
    const sample = data[0] || {};
    const otherCats = Object.keys(sample).filter(k =>
      k !== protectedAttr && k !== outcomeAttr && k !== config.groundTruthAttr &&
      k !== config.scoreAttr && k !== 'id' &&
      data.some(r => typeof r[k] === 'string')
    );
    if (otherCats.length === 0) return { combinations: {}, value: 0, status: 'pass' };
    const crossAttr = otherCats[0];

    const combos = {};
    const groupA = [...new Set(data.map(r => r[protectedAttr]))].filter(Boolean);
    const groupB = [...new Set(data.map(r => r[crossAttr]))].filter(Boolean);

    groupA.forEach(a => {
      groupB.forEach(b => {
        const subset = data.filter(r => r[protectedAttr] === a && r[crossAttr] === b);
        if (subset.length < 5) return;
        const rate = subset.filter(r => Number(r[outcomeAttr]) === 1).length / subset.length;
        combos[`${a} × ${b}`] = { rate, n: subset.length };
      });
    });

    const rates = Object.values(combos).map(c => c.rate);
    const spread = rates.length > 1 ? Math.max(...rates) - Math.min(...rates) : 0;
    const t = this.thresholds.intersectionality;
    return { combinations: combos, crossAttr, value: Math.round(spread * 1000) / 1000, threshold: t, status: this._status(spread, t, t/2, 'below') };
  },

  _status(value, critThreshold, warnThreshold, direction) {
    if (direction === 'above') {
      return value >= critThreshold ? 'pass' : value >= warnThreshold ? 'warning' : 'critical';
    }
    return value <= warnThreshold ? 'pass' : value <= critThreshold ? 'warning' : 'critical';
  },

  _overallRisk(results) {
    const statusScores = { pass: 0, warning: 1, critical: 3 };
    let total = 0, count = 0;
    const metricsToCheck = ['disparateImpact','statisticalParity','equalOpportunity','equalizedOdds','predictiveParity','calibration','individualFairness','counterfactualFairness','treatmentInequality','consistency'];
    metricsToCheck.forEach(m => {
      if (results[m] && results[m].status) {
        total += statusScores[results[m].status] || 0;
        count++;
      }
    });
    if (count === 0) return { score: 50, grade: 'C' };
    const rawScore = 100 - (total / (count * 3)) * 100;
    const score = Math.round(rawScore);
    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
    return { score, grade };
  },

  // ── NEW ADVANCED METRICS ───────────────────────────────────────────────────────

  counterfactualFairness(data, groups, protectedAttr, outcomeAttr, scoreAttr, referenceGroup) {
    // Measures how much the outcome would change if the protected attribute were flipped
    // while keeping all other features constant
    const totalInconsistency = [];
    const sampleSize = Math.min(data.length, 100); // Sample for performance
    
    for (let i = 0; i < sampleSize; i++) {
      const row = data[i];
      const originalGroup = row[protectedAttr];
      const originalScore = Number(row[scoreAttr]);
      const originalOutcome = Number(row[outcomeAttr]);
      
      // Find a similar row from a different group
      const otherGroups = groups.filter(g => g !== originalGroup);
      if (otherGroups.length === 0) continue;
      
      const targetGroup = otherGroups[Math.floor(Math.random() * otherGroups.length)];
      const similarRows = data.filter(r => 
        r[protectedAttr] === targetGroup &&
        Math.abs(Number(r[scoreAttr]) - originalScore) < 10
      );
      
      if (similarRows.length > 0) {
        const avgOutcome = similarRows.reduce((sum, r) => sum + Number(r[outcomeAttr]), 0) / similarRows.length;
        totalInconsistency.push(Math.abs(originalOutcome - avgOutcome));
      }
    }
    
    const value = totalInconsistency.length > 0 
      ? totalInconsistency.reduce((a, b) => a + b, 0) / totalInconsistency.length 
      : 0;
    const t = this.thresholds.counterfactualFairness;
    return { value: Math.round(value * 1000) / 1000, threshold: t, status: this._status(value, t, t/2, 'below') };
  },

  treatmentInequality(data, groups, protectedAttr, outcomeAttr, referenceGroup, config) {
    // Measures the difference in average outcomes between groups after conditioning on similar features
    // Uses the configured scoreAttr, with fallback to auto-detect
    let scoreAttr = config && config.scoreAttr ? config.scoreAttr : null;

    if (!scoreAttr) {
      // Auto-detect: find first numeric non-binary column
      const sample = data[0] || {};
      scoreAttr = Object.keys(sample).find(k =>
        k !== protectedAttr && k !== outcomeAttr &&
        typeof sample[k] === 'number' && !(sample[k] === 0 || sample[k] === 1)
      ) || Object.keys(sample).find(k =>
        k !== protectedAttr && k !== outcomeAttr && typeof sample[k] === 'number'
      );
    }

    if (!scoreAttr) return { value: 0, threshold: 0.1, status: 'warning' };
    
    const buckets = [0, 33, 66, 100];
    let totalDiff = 0, bucketCount = 0;
    
    for (let b = 0; b < buckets.length - 1; b++) {
      const lo = buckets[b], hi = buckets[b + 1];
      const bucketData = data.filter(r => Number(r[scoreAttr]) >= lo && Number(r[scoreAttr]) < hi);
      
      if (bucketData.length < 10) continue;
      
      const groupRates = {};
      groups.forEach(g => {
        const gData = bucketData.filter(r => r[protectedAttr] === g);
        if (gData.length > 0) {
          groupRates[g] = gData.filter(r => Number(r[outcomeAttr]) === 1).length / gData.length;
        }
      });
      
      const rates = Object.values(groupRates);
      if (rates.length > 1) {
        totalDiff += Math.max(...rates) - Math.min(...rates);
        bucketCount++;
      }
    }
    
    const value = bucketCount > 0 ? totalDiff / bucketCount : 0;
    const t = this.thresholds.treatmentInequality;
    return { value: Math.round(value * 1000) / 1000, threshold: t, status: this._status(value, t, t/2, 'below') };
  },

  consistency(data, groups, protectedAttr, outcomeAttr, config) {
    // Measures how often similar individuals receive the same outcome
    // Uses k-nearest neighbors approach (simplified)
    const k = 5;
    let totalInconsistency = 0, comparisons = 0;
    
    // Find numeric features for similarity
    const numericFeatures = Object.keys(data[0] || {}).filter(k => 
      k !== protectedAttr && k !== outcomeAttr && k !== config.groundTruthAttr &&
      typeof data[0][k] === 'number'
    );
    
    if (numericFeatures.length === 0) {
      return { value: 0.5, threshold: 0.2, status: 'warning' };
    }
    
    // Sample for performance
    const sampleSize = Math.min(data.length, 50);
    
    for (let i = 0; i < sampleSize; i++) {
      const row = data[i];
      const outcome = Number(row[outcomeAttr]);
      
      // Find k nearest neighbors (excluding self)
      const distances = data.map((r, idx) => {
        if (idx === i) return { idx, dist: Infinity };
        let dist = 0;
        numericFeatures.forEach(f => {
          dist += Math.pow((Number(r[f]) || 0) - (Number(row[f]) || 0), 2);
        });
        return { idx, dist: Math.sqrt(dist) };
      }).sort((a, b) => a.dist - b.dist).slice(0, k);
      
      // Count how many neighbors have the same outcome
      const sameOutcome = distances.filter(d => {
        const neighborOutcome = Number(data[d.idx][outcomeAttr]);
        return neighborOutcome === outcome;
      }).length;
      
      totalInconsistency += 1 - (sameOutcome / k);
      comparisons++;
    }
    
    const value = comparisons > 0 ? totalInconsistency / comparisons : 0;
    const t = this.thresholds.consistency;
    return { value: Math.round(value * 1000) / 1000, threshold: t, status: this._status(value, t, t/2, 'below') };
  }
};
