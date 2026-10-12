/* Accounts grid (Excel format, editable) and Contact Directory. Loaded by index.html.
   Uses the globals from index.html: recs, cols, esc, ld, rebuild, Auth. All saving goes through /api,
   which re-checks the user's permission on every change. */
function pager(el, total, page, size, go) {
  const n = Math.max(1, Math.ceil(total / size));
  el.innerHTML = total > size ? `<button class="btn" data-p="${page - 1}" ${page <= 0 ? 'disabled' : ''}>\u2039 Prev</button><span>Page ${page + 1} of ${n}</span><button class="btn" data-p="${page + 1}" ${page >= n - 1 ? 'disabled' : ''}>Next \u203A</button>` : '';
  el.onclick = e => { const b = e.target.closest('button'); if (b && !b.disabled) go(+b.dataset.p); };
}
function flash(el, text, bad) {
  el.textContent = text; el.className = 'font-semibold ' + (bad ? 'text-red-600' : 'text-emerald-700');
  clearTimeout(el._t); if (!bad && text !== 'Saving\u2026') el._t = setTimeout(() => { el.textContent = ''; }, 3000);
}
/* A second scrollbar above a wide table, kept in sync with the one below, so sideways scrolling is easy to find. */
function dualScroll(w) {
  if (w._ds) return; w._ds = 1;
  const bar = document.createElement('div'), inner = document.createElement('div'); bar.className = 'tws'; bar.append(inner); w.parentNode.insertBefore(bar, w);
  const upd = () => { inner.style.width = w.scrollWidth + 'px'; bar.style.display = w.scrollWidth > w.clientWidth + 1 ? 'block' : 'none'; };
  bar.addEventListener('scroll', () => { if (w.scrollLeft !== bar.scrollLeft) w.scrollLeft = bar.scrollLeft; });
  w.addEventListener('scroll', () => { if (bar.scrollLeft !== w.scrollLeft) bar.scrollLeft = w.scrollLeft; });
  const ro = new ResizeObserver(upd); ro.observe(w); const t = w.querySelector('table'); if (t) ro.observe(t); upd();
}
/* Click-to-edit for a table cell. opts: {value, type, save(value) -> Promise<bool>, next(dir)} */
function editCell(td, o) {
  const old = td.innerHTML, inp = document.createElement('input');
  inp.className = 'cell'; inp.type = o.type === 'd' ? 'date' : 'text';
  if (o.type === 'n') inp.inputMode = 'decimal';
  inp.value = o.value ?? ''; td.classList.add('cell-ed'); td.textContent = ''; td.append(inp); inp.focus(); inp.select && inp.select();
  let done = false;
  const finish = async (save, dir) => {
    if (done) return; done = true; td.classList.remove('cell-ed');
    const v = inp.value.trim();
    if (!save || v === String(o.value ?? '')) { td.innerHTML = old; if (dir) o.next(dir); return; }
    td.textContent = '\u2026';
    const ok = await o.save(v);
    if (!ok && td.isConnected) td.innerHTML = old;
    if (dir) o.next(dir);
  };
  inp.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
    else if (e.key === 'Escape') finish(false);
    else if (e.key === 'Tab') { e.preventDefault(); finish(true, e.shiftKey ? -1 : 1); }
  };
  inp.onblur = () => finish(true);
}

const AE = (() => {
  const $a = s => document.querySelector(s), MONEY = new Set(['ARREARS', 'LATEST BILL AMOUNT', 'TOTAL BALANCE AMOUNT', 'PAID AMOUNT', 'REMAINING BALANCE']);
  const st = { page: 0, size: 100, sk: null, dir: 1 }, FK = [['AREA', 'Area'], ['RATE SCHED', 'Rate schedule'], ['CUSTOMER TYPE', 'Customer type']], sel = { 'AREA': new Set(), 'RATE SCHED': new Set(), 'CUSTOMER TYPE': new Set() }, vs = v => String(v ?? '').trim(), can = a => Auth.can('accounts', a), isEd = () => ['create', 'update', 'delete'].some(can);
  const typeOf = k => (cols.find(c => c[0] === k) || [])[1];
  // calculated like the Excel formulas: REMAINING always, TOTAL when ARREARS is filled
  const locked = (r, k) => k === 'REMAINING BALANCE' || (k === 'TOTAL BALANCE AMOUNT' && r['ARREARS'] != null);
  const fmt = (r, k) => {
    const v = r[k]; if (v == null || v === '') return '';
    if (typeOf(k) === 'd') return ld(v).toLocaleDateString('en-PH');
    if (MONEY.has(k)) return Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(v);
  };
  const msg = (t, bad) => flash($a('#amsg'), t, bad);
  let sync, sig = '';
  const later = () => { clearTimeout(sync); sync = setTimeout(() => rebuild(false), 400); };

  function list() {
    const q = $a('#aq').value.trim().toLowerCase(), bl = $a('#abl').value;
    let l = recs.filter(r => FK.every(([k]) => !sel[k].size || sel[k].has(vs(r[k]))) && (!bl || r['BILLING'] === bl) && (!q || [r['CUSTOMER NAME'], r['CONTRACT NO.'], r['CLN']].join(' ').toLowerCase().includes(q)));
    if (st.sk) {
      const k = st.sk;
      l = [...l].sort((a, b) => {
        const A = a[k], B = b[k]; if (A == null && B == null) return 0; if (A == null) return 1; if (B == null) return -1;
        return (typeof A === 'number' && typeof B === 'number' ? A - B : String(A).localeCompare(String(B), undefined, { numeric: true, sensitivity: 'base' })) * st.dir;
      });
    }
    return l;
  }
  function rowHtml(r) {
    const u = can('update');
    return `<tr data-id="${esc(r._id)}">` + (can('delete') ? '<td><button class="xb" data-del="1" title="Delete this account">\u2715</button></td>' : '') +
      cols.map(([k], i) => `<td data-i="${i}" class="${k === 'CUSTOMER NAME' ? 'fz ' : ''}${MONEY.has(k) ? 'n ' : ''}${locked(r, k) ? 'cal' : u ? 'ed' : ''}"${locked(r, k) ? ' title="Calculated automatically"' : ''}>${esc(fmt(r, k))}</td>`).join('') + '</tr>';
  }
  // Excel-style: columns of numbers (and dates) sort highest / newest first, text sorts A to Z
  const isNum = k => { const t = typeOf(k); return t === 'd' || (t !== 's' && recs.every(r => r[k] == null || typeof r[k] === 'number')); };
  const arrow = k => { if (st.sk !== k) return ''; const t = typeOf(k); return t === 'd' ? (st.dir < 0 ? ' \u25BC newest' : ' \u25B2 oldest') : isNum(k) ? (st.dir < 0 ? ' \u25BC 9\u21921' : ' \u25B2 1\u21929') : (st.dir > 0 ? ' \u25B2 A\u2192Z' : ' \u25BC Z\u2192A'); };
  function fillFilters() {
    const bl = $a('#abl'), cur = bl.value, bs = [...new Set(recs.map(r => r['BILLING']).filter(Boolean))].sort();
    bl.innerHTML = '<option value="">All billing</option>' + bs.map(v => `<option>${esc(v)}</option>`).join(''); if (bs.includes(cur)) bl.value = cur;
    const opts = FK.map(([k]) => [...new Set(recs.map(r => vs(r[k])))].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))), s = JSON.stringify(opts);
    if (s === sig) return; sig = s;                      // rebuild the dropdowns only when the available values change, so they stay open while ticking
    FK.forEach(([k]) => [...sel[k]].forEach(v => { if (!opts[FK.findIndex(f => f[0] === k)].includes(v)) sel[k].delete(v); }));
    $a('#aflt').innerHTML = '<span class="text-sm font-semibold text-slate-700">Filter</span>' + FK.map(([k, l], i) =>
      `<details class="fd" data-k="${esc(k)}"><summary>${l}${sel[k].size ? ' (' + sel[k].size + ')' : ''}</summary><div class="fp">${opts[i].map(v => `<label><input type="checkbox" value="${esc(v)}" ${sel[k].has(v) ? 'checked' : ''}> ${v ? esc(v) : '(blank)'}</label>`).join('')}</div></details>`).join('') +
      '<button type="button" class="btn" id="aclr">Clear filters</button>';
  }
  function syncFilterLabels() { FK.forEach(([k, l]) => { const d = $a('#aflt details[data-k="' + k + '"]'); if (d) { d.querySelector('summary').textContent = l + (sel[k].size ? ' (' + sel[k].size + ')' : ''); d.classList.toggle('on', sel[k].size > 0); } }); }
  function render() {
    if (!isEd() || !cols.length) return;
    fillFilters();
    const l = list(), last = Math.max(0, Math.ceil(l.length / st.size) - 1); if (st.page > last) st.page = last;
    $a('#acnt').textContent = l.length + ' of ' + recs.length + ' accounts';
    $a('#agrid').innerHTML = '<thead><tr>' + (can('delete') ? '<th></th>' : '') +
      cols.map(([k]) => `<th data-sort="${esc(k)}"${k === 'CUSTOMER NAME' ? ' class="fz"' : ''} title="Click to sort">${esc(k)}${arrow(k)}</th>`).join('') + '</tr></thead><tbody>' +
      l.slice(st.page * st.size, (st.page + 1) * st.size).map(rowHtml).join('') + '</tbody>';
    pager($a('#apg'), l.length, st.page, st.size, p => { st.page = p; render(); $a('#agrid').parentNode.scrollTop = 0; });
  }
  async function patch(id, p) {
    msg('Saving\u2026');
    const j = await Auth.call('acc_upd', { id, patch: p});
    if (!j.ok) { msg(j.e || 'Not saved', 1); return false; }
    const i = recs.findIndex(x => x._id === id); if (i >= 0) recs[i] = j.rec;
    const tr = $a('#agrid tr[data-id="' + id + '"]'); if (tr) tr.outerHTML = rowHtml(j.rec);
    msg('Saved \u2713'); later(); return true;
  }
  function edit(td) {
    const tr = td.parentNode, id = tr.dataset.id, i = +td.dataset.i, k = cols[i][0], r = recs.find(x => x._id === id); if (!r) return;
    editCell(td, {
      value: r[k], type: typeOf(k),
      save: v => patch(id, { [k]: v }),
      next: dir => { const row = $a('#agrid tr[data-id="' + id + '"]'); if (!row) return; for (let j = i + dir; j >= 0 && j < cols.length; j += dir) { const n = row.querySelector('td[data-i="' + j + '"].ed'); if (n) return edit(n); } }
    });
  }
  async function del(id) {
    const r = recs.find(x => x._id === id); if (!r) return;
    if (!confirm('Delete "' + (r['CUSTOMER NAME'] || '') + '" (contract ' + (r['CONTRACT NO.'] ?? '-') + ')?\n\nThis cannot be undone.')) return;
    msg('Deleting\u2026'); const j = await Auth.call('acc_del', { id });
    if (!j.ok) return msg(j.e || 'Not deleted', 1);
    recs = recs.filter(x => x._id !== id); render(); rebuild(true); msg('Account deleted');
  }
  function openAdd() {
    $a('#afl').innerHTML = cols.map(([k, t]) => {
      const auto = k === 'REMAINING BALANCE' ? ' disabled placeholder="Auto"' : k === 'TOTAL BALANCE AMOUNT' ? ' placeholder="Auto if Arrears filled"' : '';
      return `<label class="block text-xs font-semibold text-slate-600">${esc(k)}${k === 'CUSTOMER NAME' ? ' *' : ''}<input class="fi" data-k="${esc(k)}" type="${t === 'd' ? 'date' : 'text'}"${t === 'n' ? ' inputmode="decimal"' : ''}${auto}></label>`;
    }).join('');
    $a('#aer').textContent = ''; $a('#am').hidden = false; $a('#afl input[data-k="CUSTOMER NAME"]').focus();
  }
  async function add(e) {
    e.preventDefault(); const rec = {}; $a('#afl').querySelectorAll('input').forEach(i => { if (!i.disabled && i.value.trim()) rec[i.dataset.k] = i.value.trim(); });
    if (!rec['CUSTOMER NAME']) { $a('#aer').textContent = 'Customer name is required.'; return; }
    const j = await Auth.call('acc_add', { rec }); if (!j.ok) { $a('#aer').textContent = j.e || 'Not saved'; return; }
    recs.push(j.rec); $a('#am').hidden = true; $a('#aq').value = ''; $a('#abl').value = ''; FK.forEach(([k]) => sel[k].clear()); sig = ''; st.sk = null;
    st.page = Math.ceil(recs.length / st.size) - 1; render(); rebuild(true); msg('Account added');
    const tr = $a('#agrid tr[data-id="' + j.rec._id + '"]'); if (tr) tr.scrollIntoView({ block: 'center' });
  }
  function exportXlsx() {
    const rows = Auth.excelRows({ r: recs, cols }), ws = XLSX.utils.json_to_sheet(rows, { header: cols.map(c => c[0]) });
    cols.forEach(([, t], c) => { if (t === 'd') for (let r = 1; r <= rows.length; r++) { const a = ws[XLSX.utils.encode_cell({ r, c })]; if (a && typeof a.v === 'number') a.z = 'm/d/yyyy'; } });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'MONITORING FOR CODE');
    XLSX.writeFile(wb, 'ACCOUNTS_MASTERLIST_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  }
  function init() {
    const ed = isEd(); $a('#accEdit').hidden = !ed; $a('#accView').hidden = ed; if (!ed) return;
    $a('#aadd').hidden = !can('create');
    $a('#ahint').textContent = can('update') ? 'Click a cell to edit it (Enter or Tab saves, Esc cancels, grey cells are calculated). Click a column heading to sort: A\u2192Z for text, highest first for numbers; click again to reverse, a third time to clear. Slide sideways with the scrollbar above the table, Shift + mouse wheel, or by swiping; the customer name stays in view.' : 'You can view this grid but not edit it.';
    $a('#aq').oninput = $a('#abl').onchange = () => { st.page = 0; render(); };
    $a('#aflt').onchange = e => { const t = e.target, k = t.closest('details') && t.closest('details').dataset.k; if (!k) return; t.checked ? sel[k].add(t.value) : sel[k].delete(t.value); st.page = 0; syncFilterLabels(); render(); };
    $a('#aflt').onclick = e => { if (e.target.id !== 'aclr') return; FK.forEach(([k]) => sel[k].clear()); $a('#aflt').querySelectorAll('input').forEach(i => i.checked = false); syncFilterLabels(); st.page = 0; render(); };
    document.addEventListener('click', e => document.querySelectorAll('#aflt details[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }));
    $a('#agrid').onclick = e => {
      const th = e.target.closest('th[data-sort]');
      if (th) { const k = th.dataset.sort; const first = isNum(k) ? -1 : 1; if (st.sk !== k) { st.sk = k; st.dir = first; } else if (st.dir === first) st.dir = -first; else st.sk = null; st.page = 0; render(); return; }
      if (e.target.closest('button[data-del]')) return del(e.target.closest('tr').dataset.id);
      const td = e.target.closest('td.ed'); if (td && !td.querySelector('input')) edit(td);
    };
    $a('#aadd').onclick = openAdd; $a('#af').onsubmit = add; $a('#acancel').onclick = () => { $a('#am').hidden = true; };
    $a('#aexp').onclick = exportXlsx;
  }
  return { init, render };
})();

const CT = (() => {
  const $c = s => document.querySelector(s), size = 100;
  let r = [], pg = 0, loaded = false;
  const can = a => Auth.can('contacts', a), msg = (t, bad) => flash($c('#cmsg'), t, bad);
  const hasMail = v => !!v && /@/.test(v), okMail = v => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(v);
  const mail = v => !v ? '<span class="text-slate-400">\u2014</span>' : hasMail(v)
    ? v.split(/\s*[;,]\s*/).filter(Boolean).map(x => `<a class="text-blue-700 underline" href="mailto:${esc(x)}">${esc(x)}</a>`).join(', ')
    : '<span class="text-slate-400 italic">' + (/^no email$/i.test(v.trim()) ? 'No email' : 'Has email, address not recorded') + '</span>';
  const phone = v => v ? esc(v) : '<span class="text-slate-400">\u2014</span>';
  const person = v => v ? esc(v) : '<span class="text-slate-400">\u2014</span>';
  function list() {
    const q = $c('#cq').value.trim().toLowerCase(), f = $c('#cf').value;
    return r.filter(x => (!q || [x.name, x.cn, x.phone, x.email, x.person].join(' ').toLowerCase().includes(q)) &&
      (!f || (f === 'nm' ? !hasMail(x.email) : f === 'np' ? !x.person : hasMail(x.email) && !!x.person)));
  }
  function rowHtml(x) {
    const u = can('update');
    return `<tr data-id="${esc(x.id)}"><td>${esc(x.name)}</td><td>${esc(x.cn ?? '')}</td><td data-f="phone" class="${u ? 'ed' : ''}">${phone(x.phone)}</td><td data-f="email" class="${u ? 'ed' : ''}">${mail(x.email)}</td><td data-f="person" class="${u ? 'ed' : ''}">${person(x.person)}</td></tr>`;
  }
  function render() {
    const l = list(), last = Math.max(0, Math.ceil(l.length / size) - 1); if (pg > last) pg = last;
    $c('#ccnt').textContent = l.length + ' of ' + r.length + ' accounts';
    $c('#chint').textContent = (can('update') ? 'Click an email or contact person to edit it. ' : '') + r.filter(x => hasMail(x.email)).length + ' have an email address recorded, ' + r.filter(x => x.person).length + ' have a contact person, ' + r.filter(x => x.phone).length + ' have a phone number.';
    $c('#ctb').innerHTML = l.slice(pg * size, (pg + 1) * size).map(rowHtml).join('') || '<tr><td colspan="5" class="text-slate-500">No matching accounts.</td></tr>';
    pager($c('#cpg'), l.length, pg, size, p => { pg = p; render(); });
  }
  async function save(id, f, v) {
    const key = f === 'email' ? 'EMAIL ADDRESS' : f === 'phone' ? 'PHONE NO.' : 'Contact Person';
    if (f === 'phone' && v && !/^[0-9+()\-\s,;\/]{5,}$/.test(v)) { msg('Phone number can only have digits, spaces, + - ( ) and , / ; between several numbers.', 1); return false; }
    if (f === 'email' && v && !v.split(/\s*[;,]\s*/).filter(Boolean).every(okMail)) { msg('That is not a valid email address (separate several with a comma).', 1); return false; }
    msg('Saving\u2026'); const j = await Auth.call('con_upd', { id, patch: { [key]: v } });
    if (!j.ok) { msg(j.e || 'Not saved', 1); return false; }
    const i = r.findIndex(x => x.id === id); if (i >= 0) r[i] = j.rec;
    const a = recs.find(x => x._id === id); if (a) { a['EMAIL ADDRESS'] = j.rec.email; a['Contact Person'] = j.rec.person; a['PHONE NO.'] = j.rec.phone; }
    const tr = $c('#ctb tr[data-id="' + id + '"]'); if (tr) tr.outerHTML = rowHtml(j.rec);
    msg('Saved \u2713'); return true;
  }
  function edit(td) {
    const id = td.parentNode.dataset.id, f = td.dataset.f, x = r.find(y => y.id === id); if (!x) return;
    editCell(td, {
      value: f === 'email' ? (hasMail(x.email) ? x.email : '') : f === 'phone' ? x.phone : x.person, type: 's',
      save: v => save(id, f, v),
      next: dir => { const o = ['phone', 'email', 'person'], row = $c('#ctb tr[data-id="' + id + '"]'), n = row && row.querySelector('td[data-f="' + o[o.indexOf(f) + dir] + '"].ed'); if (n) edit(n); }
    });
  }
  async function open() {
    if (!Auth.can('contacts')) return;
    const j = await Auth.call('getcontacts'); if (j.e) return msg(j.e, 1);
    r = (j.r || []).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true })); loaded = true; render();
  }
  function init() {
    $c('#cq').oninput = () => { pg = 0; render(); }; $c('#cf').onchange = () => { pg = 0; render(); };
    $c('#ctb').onclick = e => { const td = e.target.closest('td.ed'); if (td && !td.querySelector('input') && !e.target.closest('a')) edit(td); };
  }
  return { init, open };
})();
