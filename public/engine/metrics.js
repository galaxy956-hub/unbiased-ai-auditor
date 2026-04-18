const BiasMetrics = {

  // Run all applicable metrics and return a results object
  computeAll(data, config) {
    const { protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr, referenceGroup } = config;
    const groups = [...new Set(data.map(r => r[protectedAttr]))].filter(g => g != null && g !== '');
    const hasGroundTruth = groundTruthAttr && data.every(r => r[groundTruthAttr] !== undefined);
    const hasScore = scoreAttr && data.some(r => typeof r[scoreAttr] === 'number');

    const rates = this._selectionRates(data, groups, protectedAttr, outcomeAttr);
    const refRate = rates[referenceGroup] ?? Math.max(...Object.values(rates));

    const results = {
      groups,
      referenceGroup,
      selectionRates: rates,
      disparateImpact: this.disparateImpact(rates, referenceGroup),
      statisticalParity: this.statisticalParity(rates, referenceGroup),
    };

    if (hasGroundTruth) {
      results.equalOpportunity = this.equalOpportunity(data, groups, protectedAttr, outcomeAttr, groundTruthAttr, referenceGroup);
      results.equalizedOdds = this.equalizedOdds(data, groups, protectedAttr, outcomeAttr, groundTruthAttr, referenceGroup);
      results.predictiveParity = this.predictiveParity(data, groups, protectedAttr, outcomeAttr, groundTruthAttr, referenceGroup);
      results.confusionByGroup = this.confusionByGroup(data, groups, protectedAttr, outcomeAttr, groundTruthAttr);
      results.individualFairness = this.individualFairness(data, groups, protectedAttr, outcomeAttr, groundTruthAttr, scoreAttr);
    }

    if (hasScore) {
      results.calibration = this.calibration(data, groups, protectedAttr, outcomeAttr, scoreAttr, referenceGroup);
    }

    results.intersectionality = this.intersectionality(data, protectedAttr, outcomeAttr, config);
    results.overallRisk = this._overallRisk(results);

    return results;
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
    return { byGroup: results, value: minRatio, threshold: 0.8, status: this._status(minRatio, 0.8, 1.0, 'above') };
  },

  statisticalParity(rates, referenceGroup) {
    const refRate = rates[referenceGroup] ?? 0;
    const diffs = {};
    Object.entries(rates).forEach(([g, r]) => { diffs[g] = r - refRate; });
    const maxDiff = Math.max(...Object.values(diffs).map(Math.abs));
    return { byGroup: diffs, value: maxDiff, threshold: 0.1, status: this._status(maxDiff, 0.1, 0.05, 'below') };
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
    return { byGroup: tpr, diffs, value: maxDiff, threshold: 0.1, status: this._status(maxDiff, 0.1, 0.05, 'below') };
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
    return { tpr, fpr, tprDiffs, fprDiffs, value: maxDiff, threshold: 0.1, status: this._status(maxDiff, 0.1, 0.05, 'below') };
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
    return { byGroup: precision, diffs, value: maxDiff, threshold: 0.1, status: this._status(maxDiff, 0.1, 0.05, 'below') };
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
    return { byGroup: calByGroup, value: Math.round(value * 1000) / 1000, threshold: 0.1, status: this._status(value, 0.1, 0.05, 'below') };
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
    return { value: Math.round(value * 1000) / 1000, threshold: 0.15, status: this._status(value, 0.15, 0.08, 'below') };
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
    return { combinations: combos, crossAttr, value: Math.round(spread * 1000) / 1000, threshold: 0.25, status: this._status(spread, 0.25, 0.15, 'below') };
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
    const metricsToCheck = ['disparateImpact','statisticalParity','equalOpportunity','equalizedOdds','predictiveParity','calibration','individualFairness'];
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
  }
};
