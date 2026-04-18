// Fairness Metrics Engine
var Metrics = (function () {

  function selectionRate(rows, targetAttr, positiveValue) {
    if (!rows || rows.length === 0) return 0;
    var pos = rows.filter(function (r) { return String(r[targetAttr]) === String(positiveValue); }).length;
    return pos / rows.length;
  }

  function pearson(x, y) {
    var n = x.length;
    var mx = x.reduce(function (a, b) { return a + b; }, 0) / n;
    var my = y.reduce(function (a, b) { return a + b; }, 0) / n;
    var num = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) {
      num += (x[i] - mx) * (y[i] - my);
      dx += Math.pow(x[i] - mx, 2);
      dy += Math.pow(y[i] - my, 2);
    }
    return Math.sqrt(dx * dy) > 0 ? num / Math.sqrt(dx * dy) : 0;
  }

  function severity(val, warnThresh, critThresh, direction) {
    // direction: 'above' means val should be above threshold (like disparate impact)
    if (direction === 'above') {
      if (val >= warnThresh) return 'pass';
      if (val >= critThresh) return 'warning';
      return 'critical';
    } else {
      // 'below' means val should be below threshold (like parity difference)
      var abs = Math.abs(val);
      if (abs <= warnThresh) return 'pass';
      if (abs <= critThresh) return 'warning';
      return 'critical';
    }
  }

  function computeAllMetrics(data, protectedAttr, targetAttr, positiveValue) {
    var groups = Parser.groupBy(data, protectedAttr);
    var groupNames = Object.keys(groups);

    // Selection rates per group
    var rates = {};
    groupNames.forEach(function (g) {
      rates[g] = selectionRate(groups[g], targetAttr, positiveValue);
    });

    // Majority = highest selection rate, minority = lowest
    var sorted = groupNames.slice().sort(function (a, b) { return rates[b] - rates[a]; });
    var majorityGroup = sorted[0];
    var minorityGroup = sorted[sorted.length - 1];
    var majorRate = rates[majorityGroup];
    var minorRate = rates[minorityGroup];

    // 1. Disparate Impact Ratio
    var di = majorRate > 0 ? minorRate / majorRate : 1;
    var diResult = {
      name: 'Disparate Impact Ratio',
      value: di,
      display: di.toFixed(3),
      threshold: '≥ 0.80 (80% Rule)',
      pass: di >= 0.8,
      severity: severity(di, 0.8, 0.6, 'above'),
      description: 'Ratio of positive outcome rate: minority ÷ majority group. Below 0.8 triggers the "Four-Fifths Rule" — a federal employment discrimination standard.',
      formula: 'P(outcome=1 | minority) / P(outcome=1 | majority)',
      majorityGroup: majorityGroup,
      minorityGroup: minorityGroup,
      groupRates: rates
    };

    // 2. Statistical Parity Difference
    var spd = minorRate - majorRate;
    var spdResult = {
      name: 'Statistical Parity Difference',
      value: spd,
      display: (spd >= 0 ? '+' : '') + spd.toFixed(3),
      threshold: '> −0.10',
      pass: spd >= -0.10,
      severity: severity(spd, 0.10, 0.20, 'below'),
      description: 'Difference in positive outcome rates between groups. Negative means the minority group is disadvantaged. Values below −0.10 indicate meaningful disparity.',
      formula: 'P(outcome=1 | minority) − P(outcome=1 | majority)',
      groupRates: rates
    };

    // 3. Equal Opportunity — proxy: among high scorers, compare selection rates
    var numericCols = Object.keys(data[0]).filter(function (c) {
      return c !== protectedAttr && c !== targetAttr && typeof data[0][c] === 'number';
    });
    var eoResult = null;
    var scoreCol = null;
    if (numericCols.length > 0) {
      scoreCol = numericCols[numericCols.length - 1];
      var allScores = data.map(function (r) { return r[scoreCol]; }).slice().sort(function (a, b) { return a - b; });
      var median = allScores[Math.floor(allScores.length / 2)];
      var qualRates = {};
      groupNames.forEach(function (g) {
        var qualified = groups[g].filter(function (r) { return r[scoreCol] >= median; });
        qualRates[g] = selectionRate(qualified, targetAttr, positiveValue);
      });
      var eod = (qualRates[minorityGroup] || 0) - (qualRates[majorityGroup] || 0);
      eoResult = {
        name: 'Equal Opportunity Difference',
        value: eod,
        display: (eod >= 0 ? '+' : '') + eod.toFixed(3),
        threshold: '> −0.10',
        pass: eod >= -0.10,
        severity: severity(eod, 0.10, 0.20, 'below'),
        description: 'Among equally "qualified" candidates (above median ' + scoreCol.replace(/_/g,' ') + '), how different are selection rates? Captures whether the bar is set higher for one group.',
        formula: 'TPR(minority | qualified) − TPR(majority | qualified)',
        qualRates: qualRates,
        scoreCol: scoreCol
      };
    }

    // 4. Demographic Parity (% difference from expected)
    var overall = selectionRate(data, targetAttr, positiveValue);
    var dpRates = {};
    groupNames.forEach(function (g) { dpRates[g] = rates[g] - overall; });
    var maxDpDiff = Math.max.apply(null, Object.values(dpRates).map(Math.abs));
    var dpResult = {
      name: 'Demographic Parity Gap',
      value: maxDpDiff,
      display: maxDpDiff.toFixed(3),
      threshold: '< 0.10',
      pass: maxDpDiff < 0.10,
      severity: severity(maxDpDiff, 0.10, 0.20, 'below'),
      description: 'Maximum deviation of any group\'s selection rate from the overall average. Zero = perfectly proportional outcomes across groups.',
      formula: 'max |P(outcome=1 | group) − P(outcome=1)|',
      deviations: dpRates,
      overall: overall
    };

    // 5. Proxy Correlations
    var correlations = {};
    var protectedEncoded = data.map(function (r) { return String(r[protectedAttr]) === majorityGroup ? 0 : 1; });
    numericCols.forEach(function (col) {
      var vals = data.map(function (r) { return r[col]; });
      correlations[col] = pearson(protectedEncoded, vals);
    });

    // 6. Representation balance
    var representation = {};
    groupNames.forEach(function (g) {
      representation[g] = {
        count: groups[g].length,
        pct: groups[g].length / data.length * 100,
        rate: rates[g]
      };
    });

    // Overall Bias Score (0–100)
    var biasScore = 0;
    biasScore += di < 0.8 ? Math.min(35, (0.8 - di) / 0.8 * 100 * 0.4) : 0;
    biasScore += Math.abs(spd) > 0.1 ? Math.min(35, Math.abs(spd) * 200) : 0;
    if (eoResult) biasScore += Math.abs(eoResult.value) > 0.1 ? Math.min(20, Math.abs(eoResult.value) * 150) : 0;
    biasScore += maxDpDiff > 0.1 ? Math.min(10, maxDpDiff * 60) : 0;
    biasScore = Math.min(100, Math.round(biasScore));

    var flags = [];
    if (diResult.severity !== 'pass') flags.push({ metric: 'Disparate Impact', severity: diResult.severity, message: 'Selection rate ratio is ' + diResult.display + ' — below the 0.80 legal threshold.' });
    if (spdResult.severity !== 'pass') flags.push({ metric: 'Statistical Parity', severity: spdResult.severity, message: 'Outcome gap of ' + spdResult.display + ' between groups.' });
    if (eoResult && eoResult.severity !== 'pass') flags.push({ metric: 'Equal Opportunity', severity: eoResult.severity, message: 'Among qualified candidates, gap is ' + eoResult.display + '.' });
    if (dpResult.severity !== 'pass') flags.push({ metric: 'Demographic Parity', severity: dpResult.severity, message: 'Max group deviation from average: ' + dpResult.display + '.' });
    var highCorr = Object.keys(correlations).filter(function (c) { return Math.abs(correlations[c]) > 0.3; });
    if (highCorr.length > 0) flags.push({ metric: 'Proxy Features', severity: 'warning', message: 'Features correlated with protected attribute: ' + highCorr.join(', ') + '.' });

    return {
      groups: groups,
      groupNames: groupNames,
      rates: rates,
      majorityGroup: majorityGroup,
      minorityGroup: minorityGroup,
      biasScore: biasScore,
      disparateImpact: diResult,
      statisticalParity: spdResult,
      equalOpportunity: eoResult,
      demographicParity: dpResult,
      correlations: correlations,
      representation: representation,
      flags: flags,
      totalRows: data.length,
      protectedAttr: protectedAttr,
      targetAttr: targetAttr,
      positiveValue: positiveValue
    };
  }

  return { computeAllMetrics: computeAllMetrics, selectionRate: selectionRate };
})();
