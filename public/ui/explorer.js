const ExplorerUI = {
  render(root, state) {
    root.innerHTML = `
    <div class="tab-inner">
      <div class="tab-header">
        <h2>📊 Data Explorer</h2>
        <p>Upload your own CSV dataset or select a built-in demo to inspect column distributions, quality, and group composition.</p>
      </div>

      <div class="grid-2" style="gap:1.5rem;margin-bottom:1.5rem;">
        <div>
          <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()"
               ondragover="ExplorerUI.onDragOver(event)" ondragleave="ExplorerUI.onDragLeave(event)" ondrop="ExplorerUI.onDrop(event)">
            <div class="upload-icon">📂</div>
            <h3>Drop your CSV here</h3>
            <p>or click to browse — all processing happens in-browser, your data never leaves your machine.</p>
          </div>
          <input type="file" id="file-input" accept=".csv" style="display:none" onchange="ExplorerUI.onFileInput(event)">
        </div>
        <div class="card">
          <div class="label">Built-in Demo Datasets</div>
          <div style="display:flex;flex-direction:column;gap:0.75rem;margin-top:0.75rem;">
            ${['hiring','lending','healthcare'].map(k => {
              const cfg = Datasets.configs[k];
              const isActive = state.datasetKey === k;
              return `<button class="scenario-btn ${isActive?'active':''}" onclick="AppState.loadDemo('${k}'); ExplorerUI.render(document.getElementById('explorer-root'), AppState)">
                <span>${k==='hiring'?'👔':k==='lending'?'🏦':'🏥'} ${cfg.label}</span>
                <span class="tag">${isActive?'✓ Active':''}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
      </div>

      ${state.data.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No dataset loaded yet. Upload a CSV or choose a demo above.</p>
        </div>
      ` : this._renderDataInfo(state)}
    </div>`;
  },

  _renderDataInfo(state) {
    const { data, headers, columnInfo, datasetKey } = state;
    const cfg = Datasets.configs[datasetKey] || {};

    return `
      <div class="grid-4" style="margin-bottom:1.5rem;">
        <div class="card text-center"><div class="stat-num">${data.length}</div><div class="stat-label">Total Rows</div></div>
        <div class="card text-center"><div class="stat-num">${headers.length}</div><div class="stat-label">Columns</div></div>
        <div class="card text-center"><div class="stat-num">${columnInfo.filter(c=>c.type==='categorical').length}</div><div class="stat-label">Categorical</div></div>
        <div class="card text-center"><div class="stat-num">${columnInfo.filter(c=>c.type==='numeric').length}</div><div class="stat-label">Numeric</div></div>
      </div>

      <div class="card" style="margin-bottom:1.5rem;">
        <div class="label">Column Inspector</div>
        <div class="col-stats-grid mt-1">
          ${columnInfo.map(col => this._renderColCard(col, data.length)).join('')}
        </div>
      </div>

      <div class="card" style="margin-bottom:1.5rem;">
        <div class="label">Group Composition — ${cfg.protectedAttr || headers[0]}</div>
        <div class="mt-1">${this._renderGroupComposition(data, cfg.protectedAttr || headers[0], cfg.outcomeAttr)}</div>
      </div>

      <div class="card">
        <div class="label">Data Preview (first 20 rows)</div>
        <div class="data-table-wrap mt-1">
          <table class="data-table">
            <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${data.slice(0,20).map(row=>`<tr>${headers.map(h=>`<td>${row[h]??''}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  },

  _renderColCard(col, total) {
    const missing = col.missing > 0 ? `<div style="color:var(--warning);font-size:0.7rem;">⚠ ${col.missing} missing</div>` : '';
    if (col.type === 'numeric') {
      const range = col.max - col.min;
      return `<div class="col-stat-card">
        <div class="col-stat-name">${col.name}</div>
        <div class="col-stat-type">Numeric · ${col.count} values</div>
        <div style="font-size:0.75rem;color:var(--text-dim);">Mean: <strong>${col.mean}</strong></div>
        <div style="font-size:0.7rem;color:var(--text-muted);">Min: ${col.min} · Max: ${col.max}</div>
        ${missing}
      </div>`;
    }
    return `<div class="col-stat-card">
      <div class="col-stat-name">${col.name}</div>
      <div class="col-stat-type">Categorical · ${col.unique} unique</div>
      ${(col.values||[]).slice(0,5).map(([v,n])=>`
        <div class="group-row">
          <span class="group-name" style="min-width:80px;max-width:80px;overflow:hidden;text-overflow:ellipsis;">${v}</span>
          <div class="group-bar-wrap"><div class="group-bar" style="width:${Math.round(n/total*100)}%;background:var(--accent)"></div></div>
          <span class="group-val">${Math.round(n/total*100)}%</span>
        </div>`).join('')}
      ${missing}
    </div>`;
  },

  _renderGroupComposition(data, attr, outcomeAttr) {
    const groups = [...new Set(data.map(r=>r[attr]))].filter(Boolean);
    const n = data.length;
    return groups.map(g => {
      const gData = data.filter(r=>r[attr]===g);
      const pct = Math.round(gData.length/n*100);
      const positiveRate = outcomeAttr
        ? Math.round(gData.filter(r=>Number(r[outcomeAttr])===1).length/gData.length*100)
        : null;
      return `<div class="group-row" style="margin-bottom:0.6rem;">
        <span class="group-name" style="min-width:90px;">${g}</span>
        <div class="group-bar-wrap" style="height:10px;">
          <div class="group-bar" style="width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--accent))"></div>
        </div>
        <span class="group-val" style="min-width:50px;">${pct}% (${gData.length})</span>
        ${positiveRate!==null?`<span class="badge ${positiveRate<35?'badge-critical':positiveRate<50?'badge-warning':'badge-pass'}" style="margin-left:0.5rem;">${positiveRate}% positive</span>`:''}
      </div>`;
    }).join('');
  },

  onDragOver(e) { e.preventDefault(); document.getElementById('upload-zone').classList.add('drag-over'); },
  onDragLeave(e) { document.getElementById('upload-zone').classList.remove('drag-over'); },
  onDrop(e) {
    e.preventDefault();
    document.getElementById('upload-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) this._readFile(file);
  },
  onFileInput(e) {
    const file = e.target.files[0];
    if (file) this._readFile(file);
  },
  _readFile(file) {
    if (!file.name.endsWith('.csv')) { alert('Please upload a .csv file.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { headers, rows } = DataParser.parseCSV(e.target.result);
        AppState.loadCustom(rows, headers, file.name);
        ExplorerUI.render(document.getElementById('explorer-root'), AppState);
      } catch (err) {
        alert('Error parsing CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
};

// Inject scenario button style
const _explorerStyle = document.createElement('style');
_explorerStyle.textContent = `.scenario-btn{display:flex;justify-content:space-between;align-items:center;width:100%;padding:.75rem 1rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);cursor:pointer;font-size:.85rem;font-weight:500;font-family:inherit;transition:all .2s;}.scenario-btn:hover,.scenario-btn.active{border-color:var(--primary);background:rgba(99,102,241,.15);color:var(--primary-light);}`;
document.head.appendChild(_explorerStyle);
