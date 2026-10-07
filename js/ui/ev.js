/* =========================================================
   EV Charging page – greedy Activity Selection for one charger
   ========================================================= */
PS.pages.ev = (function () {
  const { $, h } = PS.ui;
  const SAMPLE = [
    { plate: 'MH12AB1234', start: 540, end: 630 },
    { plate: 'KA05MN4521', start: 570, end: 600 },
    { plate: 'DL08CX9081', start: 600, end: 690 },
    { plate: 'TN10BZ7788', start: 630, end: 720 },
    { plate: 'GJ01KP3344', start: 660, end: 690 },
    { plate: 'UP16AQ1122', start: 720, end: 810 },
    { plate: 'KL07CD5566', start: 750, end: 780 },
    { plate: 'RJ14EV9090', start: 780, end: 900 },
    { plate: 'HR26DK2468', start: 840, end: 870 },
    { plate: 'PB10GH1357', start: 870, end: 960 }
  ];
  let reqs = [], result = null, revealed = 0, token = 0;

  const sample = () => SAMPLE.map((r, i) => ({ id: i + 1, ...r }));

  function init() {
    reqs = PS.store.load('ev', null) || sample();
    const fill = (sel, def) => {
      for (let t = 480; t <= 1320; t += 30) sel.appendChild(h('option', { value: t }, PS.fmt.hm(t)));
      sel.value = def;
    };
    fill($('#evStart'), 600);
    fill($('#evEnd'), 660);
    $('#evForm').addEventListener('submit', e => { e.preventDefault(); add(); });
    $('#evSample').addEventListener('click', () => { reqs = sample(); changed(); });
    $('#evClear').addEventListener('click', () => { reqs = []; changed(); });
    $('#evRunBtn').addEventListener('click', runGreedy);
    render();
  }

  function changed() {
    result = null;
    token++;
    PS.store.save('ev', reqs);
    render();
  }

  function add() {
    const plate = PS.flat.normalize($('#evPlate').value);
    const start = Number($('#evStart').value), end = Number($('#evEnd').value);
    if (!PS.flat.run(plate).accepted) { PS.ui.toast('Invalid plate — rejected by the DFA', 'error'); return; }
    if (end <= start) { PS.ui.toast('End time must be after the start time', 'warn'); return; }
    reqs.push({ id: Date.now(), plate, start, end });
    $('#evPlate').value = '';
    changed();
    PS.ui.toast(`Booking request added for ${PS.fmt.plate(plate)}`, 'success');
  }

  function remove(id) { reqs = reqs.filter(r => r.id !== id); changed(); }

  function render() { renderTable(); renderTimeline(); renderStats(); renderLog(); }

  function renderTable() {
    const tb = $('#evTable tbody');
    tb.innerHTML = '';
    $('#evCount').textContent = `${reqs.length} request${reqs.length === 1 ? '' : 's'}`;
    if (!reqs.length) { tb.innerHTML = '<tr><td colspan="4" class="muted center">No requests yet</td></tr>'; return; }
    reqs.forEach(r => tb.appendChild(h('tr', null,
      h('td', { class: 'mono' }, PS.fmt.plate(r.plate)),
      h('td', { class: 'mono' }, PS.fmt.hm(r.start)),
      h('td', { class: 'mono' }, PS.fmt.hm(r.end)),
      h('td', { class: 'right' }, h('button', { class: 'icon-btn sm', type: 'button', title: 'Remove', 'aria-label': 'Remove request', onclick: () => remove(r.id) }, '×')))));
  }

  function renderTimeline() {
    const box = $('#evTimeline');
    box.innerHTML = '';
    if (!reqs.length) { box.appendChild(h('p', { class: 'muted center' }, 'Add booking requests to see the charger timeline.')); return; }
    const lo = Math.floor(Math.min(...reqs.map(r => r.start)) / 60) * 60;
    const hi = Math.max(lo + 60, Math.ceil(Math.max(...reqs.map(r => r.end)) / 60) * 60);
    const pct = t => (t - lo) / (hi - lo) * 100;

    const axis = h('div', { class: 'tl-axis' });
    for (let t = lo; t <= hi; t += 60) axis.appendChild(h('span', { style: { left: pct(t) + '%' } }, PS.fmt.hm(t)));
    box.appendChild(h('div', { class: 'tl-row tl-head' }, h('div', { class: 'tl-label' }), axis));

    // before the run: input order; after: finish-time order (the greedy order)
    const rows = result ? result.decisions.map(d => ({ r: d.req, d })) : reqs.map(r => ({ r }));
    rows.forEach(({ r, d }, i) => {
      const state = !d || i >= revealed ? 'pending' : d.accepted ? 'ok' : 'no';
      const bar = h('div', {
        class: 'tl-bar ' + state,
        title: `${PS.fmt.plate(r.plate)} · ${PS.fmt.hm(r.start)}–${PS.fmt.hm(r.end)}`,
        style: { left: pct(r.start) + '%', width: (pct(r.end) - pct(r.start)) + '%' }
      }, r.end - r.start >= 60 ? `${PS.fmt.hm(r.start)}–${PS.fmt.hm(r.end)}` : '');   // short bars: time shown on hover
      box.appendChild(h('div', { class: 'tl-row ' + state },
        h('div', { class: 'tl-label' }, PS.fmt.plate(r.plate)),
        h('div', { class: 'tl-track', style: { '--hours': (hi - lo) / 60 } }, bar)));
    });
  }

  function renderStats() {
    const acc = result ? result.decisions.slice(0, revealed).filter(d => d.accepted) : [];
    const used = acc.reduce((s, d) => s + d.req.end - d.req.start, 0);
    $('#evStats').innerHTML = [
      ['Requests', reqs.length],
      ['Accepted', result ? acc.length : '—'],
      ['Charging time', result ? (used / 60).toFixed(1) + ' h' : '—'],
      ['Chargers for all', PS.daa.maxOverlap(reqs)]
    ].map(([k, v]) => `<div class="mini"><span>${k}</span><b>${v}</b></div>`).join('');
  }

  function renderLog() {
    const ol = $('#evLog');
    ol.innerHTML = '';
    if (!result) {
      ol.appendChild(h('li', { class: 'muted' }, 'Press “Run greedy” to watch each decision. Requests are first merge-sorted by finish time.'));
      return;
    }
    result.decisions.slice(0, revealed).forEach(d => {
      const r = d.req;
      const why = d.accepted
        ? (d.prevEnd === -Infinity ? 'finishes first, so it is always safe to take' : `starts ${PS.fmt.hm(r.start)} ≥ last finish ${PS.fmt.hm(d.prevEnd)}`)
        : `overlaps ${PS.fmt.plate(d.conflict.plate)} (charging until ${PS.fmt.hm(d.conflict.end)})`;
      ol.appendChild(h('li', { class: d.accepted ? 'ok' : 'no' },
        h('b', null, `${d.accepted ? '✓ Accept' : '✕ Reject'} ${PS.fmt.plate(r.plate)}`),
        ` ${PS.fmt.hm(r.start)}–${PS.fmt.hm(r.end)} · ${why}`));
    });
    ol.scrollTop = ol.scrollHeight;
  }

  async function runGreedy() {
    if (!reqs.length) { PS.ui.toast('Add some booking requests first', 'warn'); return; }
    result = PS.daa.activitySelection(reqs);
    const my = ++token;
    revealed = 0;
    render();
    for (let i = 1; i <= result.decisions.length; i++) {
      await PS.ui.sleep(380);
      if (my !== token) return;
      revealed = i;
      renderTimeline();
      renderLog();
      renderStats();
    }
    PS.ui.toast(`${result.selected.length} of ${reqs.length} cars get a charging slot`, 'success');
  }

  return { init };
})();
