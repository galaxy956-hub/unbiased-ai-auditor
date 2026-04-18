const DataParser = {
  parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const nonEmpty = lines.filter(l => l.trim() !== '');
    if (nonEmpty.length < 2) throw new Error('CSV must have a header and at least one data row.');

    const headers = this._splitCSVLine(nonEmpty[0]).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const rows = [];

    for (let i = 1; i < nonEmpty.length; i++) {
      const values = this._splitCSVLine(nonEmpty[i]);
      if (values.length < headers.length / 2) continue; // skip malformed rows
      const row = {};
      headers.forEach((h, idx) => {
        const raw = (values[idx] || '').trim().replace(/^["']|["']$/g, '');
        row[h] = this._inferType(raw);
      });
      rows.push(row);
    }
    if (rows.length === 0) throw new Error('No valid data rows found.');
    return { headers, rows };
  },

  _splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  },

  _inferType(val) {
    if (val === '' || val === null || val === undefined) return null;
    if (val.toLowerCase() === 'true') return 1;
    if (val.toLowerCase() === 'false') return 0;
    const num = Number(val);
    if (!isNaN(num) && val !== '') return num;
    return val;
  },

  getColumnInfo(data, headers) {
    return headers.map(h => {
      const values = data.map(r => r[h]).filter(v => v !== null && v !== undefined && v !== '');
      const numeric = values.every(v => typeof v === 'number');
      const info = { name: h, type: numeric ? 'numeric' : 'categorical', count: values.length, missing: data.length - values.length };
      if (numeric) {
        info.min = Math.min(...values);
        info.max = Math.max(...values);
        info.mean = values.reduce((a, b) => a + b, 0) / values.length;
        info.mean = Math.round(info.mean * 100) / 100;
      } else {
        const freq = {};
        values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
        info.values = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        info.unique = info.values.length;
      }
      return info;
    });
  }
};
