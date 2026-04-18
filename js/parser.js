// CSV Parser & Data Utilities
var Parser = (function () {

  function parseCSV(text) {
    var lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var headers = splitCSVLine(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      var vals = splitCSVLine(lines[i]);
      var row = {};
      headers.forEach(function (h, idx) {
        var v = vals[idx] !== undefined ? vals[idx].trim() : '';
        var num = parseFloat(v);
        row[h.trim()] = (!isNaN(num) && v !== '') ? num : v;
      });
      rows.push(row);
    }
    return rows;
  }

  function splitCSVLine(line) {
    var result = [], cur = '', inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
      else { cur += c; }
    }
    result.push(cur);
    return result;
  }

  function profileColumns(data) {
    if (!data || !data.length) return {};
    var cols = {};
    var keys = Object.keys(data[0]);
    keys.forEach(function (k) {
      var values = data.map(function (r) { return r[k]; });
      var nonNull = values.filter(function (v) { return v !== '' && v !== null && v !== undefined; });
      var numeric = nonNull.filter(function (v) { return typeof v === 'number'; });
      var isNum = numeric.length > nonNull.length * 0.8;
      var unique = Array.from(new Set(nonNull.map(String)));
      cols[k] = {
        name: k,
        type: isNum ? 'numeric' : (unique.length <= 10 ? 'categorical' : 'text'),
        unique: unique,
        uniqueCount: unique.length,
        nullCount: values.length - nonNull.length,
        min: isNum ? Math.min.apply(null, numeric) : null,
        max: isNum ? Math.max.apply(null, numeric) : null,
        mean: isNum ? numeric.reduce(function (a, b) { return a + b; }, 0) / numeric.length : null
      };
    });
    return cols;
  }

  function groupBy(data, attr) {
    var groups = {};
    data.forEach(function (row) {
      var key = String(row[attr]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }

  function getUniqueValues(data, col) {
    return Array.from(new Set(data.map(function (r) { return String(r[col]); })));
  }

  return { parseCSV: parseCSV, profileColumns: profileColumns, groupBy: groupBy, getUniqueValues: getUniqueValues };
})();
