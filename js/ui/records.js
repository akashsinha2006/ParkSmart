/* =========================================================
   Vehicle Records page – Merge Sort + Binary Search
   ========================================================= */
PS.pages.records = (function () {
  const { $, h } = PS.ui;
  const now = () => Date.now();
  const duration = r => (r.exit || now()) - r.entry;
  const amount = r => (r.exit ? r.fee : PS.lot.fee(r.entry, now()));
  const COMPARE = {
    entry: (a, b) => a.entry - b.entry,
    plate: (a, b) => (a.plate < b.plate ? -1 : a.plate > b.plate ? 1 : 0),
    duration: (a, b) => duration(b) - duration(a),
    fee: (a, b) => amount(b) - amount(a)
  };
  let order = null, highlight = null;

  function init() {
    $('#recSortBtn').addEventListener('click', sort);
    $('#recSearchForm').addEventListener('submit', e => { e.preventDefault(); search(); });
    $('#recTry').addEventListener('click', () => { $('#recQuery').value = $('#recTry').dataset.plate; search(); });
    PS.bus.on('lot', () => { order = null; renderTable(); suggest(); });
    renderTable();
    suggest();
  }

  function onShow() { renderTable(); }

  // offer a real plate from the log so the search can be tried instantly
  function suggest() {
    const log = PS.lot.log;
    if (!log.length) return;
    const p = log[Math.floor(Math.random() * log.length)].plate;
    $('#recTry').dataset.plate = p;
    $('#recTry').textContent = PS.fmt.plate(p);
  }

  function sort() {
    const key = $('#recSort').value;
    const log = PS.lot.log;
    const r = PS.daa.mergeSort(log, COMPARE[key]);
    order = r.sorted;
    highlight = null;
    const n = log.length;
    $('#recSortStats').innerHTML = `Merge sort used <b>${r.comparisons}</b> comparisons for ${n} records. ` +
      `n·log₂n ≈ <b>${Math.round(n * Math.log2(Math.max(n, 2)))}</b>, while bubble sort's worst case is n(n−1)/2 = <b>${n * (n - 1) / 2}</b>.`;
    renderTable();
  }

  function search() {
    const target = PS.flat.normalize($('#recQuery').value);
    if (!target) { PS.ui.toast('Type a plate to search for', 'warn'); return; }
    const log = PS.lot.log;
    // binary search needs sorted data -> merge sort by plate first
    const sorted = PS.daa.mergeSort(log, COMPARE.plate);
    order = sorted.sorted;
    $('#recSort').value = 'plate';
    const res = PS.daa.binarySearch(order, target, r => r.plate);
    const linear = PS.daa.linearSearchCost(log, target, r => r.plate);
    highlight = res.index >= 0 ? order[res.index].id : null;
    renderSteps(res, order.length, target, linear);
    renderTable();
    const row = document.querySelector('#recTable tr.hl');
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function renderSteps(res, n, target, linear) {
    $('#recStepsCard').hidden = false;
    const box = $('#recSteps');
    box.innerHTML = '';
    res.steps.forEach((st, i) => {
      const bar = h('div', { class: 'bs-bar' });
      for (let j = 0; j < n; j++) {
        let cls = '';
        if (j === st.mid) cls = st.cmp === 0 ? 'mid hit' : 'mid';
        else if (j < st.lo || j > st.hi) cls = 'out';
        bar.appendChild(h('i', { class: cls }));
      }
      const verdict = st.cmp === 0 ? 'match ✓'
        : st.cmp < 0 ? `${st.key} < ${target} → search right half` : `${st.key} > ${target} → search left half`;
      box.appendChild(h('div', { class: 'bs-step' },
        h('div', { class: 'bs-head' }, h('b', null, `Step ${i + 1}`),
          h('span', { class: 'mono muted' }, `low=${st.lo}  high=${st.hi}  mid=${st.mid}`),
          h('span', { class: 'mono' }, verdict)),
        bar));
    });
    const found = res.index >= 0;
    $('#recSearchStats').innerHTML = found
      ? `<b>Found ${PS.fmt.plate(target)}</b> at index ${res.index} in <b>${res.steps.length}</b> comparisons. A linear scan of the unsorted log needs <b>${linear}</b>. Worst case is ⌈log₂(n+1)⌉ = ${Math.ceil(Math.log2(n + 1))}.`
      : `<b>${PS.fmt.plate(target) || target}</b> is not in the log. Binary search gave up after <b>${res.steps.length}</b> comparisons; a linear scan checks all <b>${linear}</b>.`;
  }

  function renderTable() {
    const rows = order || PS.lot.log;
    const tb = $('#recTable tbody');
    tb.innerHTML = '';
    const parked = PS.lot.log.filter(r => !r.exit).length;
    $('#recCount').textContent = `${rows.length} records · ${parked} parked now`;
    rows.forEach((r, i) => {
      tb.appendChild(h('tr', { class: r.id === highlight ? 'hl' : '' },
        h('td', { class: 'muted' }, i),
        h('td', { class: 'mono' }, PS.fmt.plate(r.plate)),
        h('td', null, r.slot),
        h('td', { class: 'mono' }, PS.fmt.time(r.entry)),
        h('td', { class: 'mono' }, r.exit ? PS.fmt.time(r.exit) : '—'),
        h('td', null, PS.fmt.duration(duration(r))),
        h('td', { class: 'mono' }, PS.fmt.money(amount(r)) + (r.exit ? '' : '*')),
        h('td', null, h('span', { class: 'status ' + (r.exit ? 'exited' : 'parked') }, r.exit ? 'Exited' : 'Parked'))));
    });
  }

  return { init, onShow };
})();
