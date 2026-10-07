/* =========================================================
   Dashboard – live lot + the full gate pipeline for one car
   FLAT (DFA) -> COA (logic gates) -> AI (BFS) -> COA (register) -> DAA (log)
   ========================================================= */
PS.pages.dashboard = (function () {
  const { $, h } = PS.ui;
  let view;

  const SUBJ = { flat: 'FLAT', ai: 'AI', daa: 'DAA', coa: 'COA' };
  const STEP_DEFS = [
    { s: 'flat', t: 'Plate check · DFA', idle: 'Validates the LL DD L(L) DDDD format' },
    { s: 'coa', t: 'Barrier logic · gates', idle: 'OPEN = V · P · (S + R)' },
    { s: 'ai', t: 'Nearest bay · BFS', idle: 'Searches outward from the entrance' },
    { s: 'coa', t: 'Occupancy register', idle: "Sets the bay's bit to 1" },
    { s: 'daa', t: 'Record logged', idle: 'Searchable later with binary search' }
  ];

  function init() {
    view = PS.LotView($('#dashLot'), { onCellClick });
    $('#arrivalForm').addEventListener('submit', e => { e.preventDefault(); admit(); });
    $('#arrRandom').addEventListener('click', () => {
      $('#arrPlate').value = PS.lot.randomPlate();
      livePlateHint();
      $('#arrPlate').focus();
    });
    $('#arrPlate').addEventListener('input', livePlateHint);
    PS.bus.on('lot', refresh);
    refresh();
    renderSteps(null);
  }

  function refresh() {
    view.paint();
    const s = PS.lot.stats();
    const pct = Math.round(s.occupied / s.total * 100);
    $('#kpiOcc').textContent = `${s.occupied}/${s.total}`;
    const bar = $('#kpiOccBar');
    bar.style.width = pct + '%';
    bar.style.background = pct >= 90 ? 'var(--danger)' : pct >= 60 ? 'var(--accent)' : 'var(--success)';
    $('#kpiOccSub').textContent = pct + '% occupancy';
    $('#kpiFree').textContent = s.free;
    $('#kpiEv').textContent = `${s.evFree}/${s.evTotal}`;
    $('#kpiRev').textContent = PS.fmt.money(s.revenue);
    $('#kpiRevSub').textContent = `${s.visits} visits logged today`;
    renderFeed();
  }

  function renderFeed() {
    const events = [];
    PS.lot.log.forEach(e => {
      events.push({ t: e.entry, type: 'in', e });
      if (e.exit) events.push({ t: e.exit, type: 'out', e });
    });
    events.sort((a, b) => b.t - a.t);
    const ul = $('#feed');
    ul.innerHTML = '';
    events.slice(0, 6).forEach(ev => {
      ul.appendChild(h('li', { class: 'feed-item ' + ev.type },
        h('span', { class: 'feed-ico', html: ev.type === 'in' ? '&#8600;' : '&#8599;' }),
        h('div', { class: 'feed-main' },
          h('b', null, PS.fmt.plate(ev.e.plate)),
          h('span', null, ev.type === 'in' ? ` parked at ${ev.e.slot}` : ` left ${ev.e.slot} · ${PS.fmt.money(ev.e.fee)}`)),
        h('time', null, PS.fmt.time(ev.t))));
    });
  }

  function livePlateHint() {
    const v = $('#arrPlate').value;
    const hint = $('#arrHint');
    if (!v.trim()) {
      hint.className = 'field-hint';
      hint.textContent = 'Format: LL DD L(L) DDDD — e.g. MH 12 AB 1234';
      return;
    }
    const r = PS.flat.run(v);
    if (r.accepted) { hint.className = 'field-hint ok'; hint.textContent = '✓ DFA accepts this plate'; }
    else if (r.final === PS.flat.dfa.dead) { hint.className = 'field-hint bad'; hint.textContent = '✕ ' + r.reason; }
    else { hint.className = 'field-hint'; hint.textContent = `… in state ${r.final}: expecting ${PS.flat.expectedAt(r.final)}`; }
  }

  function renderSteps(done) {
    const ol = $('#arrSteps');
    ol.innerHTML = '';
    STEP_DEFS.forEach((def, i) => {
      const st = done && done[i];
      const state = st ? (st.ok ? 'ok' : 'bad') : (done ? 'skip' : 'idle');
      ol.appendChild(h('li', { class: 'step ' + state },
        h('span', { class: 'step-ico' }, st ? (st.ok ? '✓' : '✕') : String(i + 1)),
        h('div', { class: 'step-body' },
          h('div', { class: 'step-title' }, h('span', { class: 'tag ' + def.s }, SUBJ[def.s]), def.t),
          h('div', { class: 'step-detail' }, st ? st.detail : (done ? 'Skipped' : def.idle)))));
    });
  }

  /** One car arrives: run every module in order. */
  function admit() {
    const raw = $('#arrPlate').value;
    if (!raw.trim()) { PS.ui.toast('Type a number plate or press the shuffle button', 'warn'); $('#arrPlate').focus(); return; }
    const ev = $('#arrEv').checked;
    const R = $('#arrRes').checked ? 1 : 0;
    const steps = [];

    // ① FLAT – the DFA validates the plate
    const dfa = PS.flat.run(raw);
    const plate = dfa.input;
    const dupSlot = dfa.accepted ? PS.lot.findPlate(plate) : null;
    const P = dfa.accepted && !dupSlot ? 1 : 0;
    PS.state.lastPlateOk = !!P;
    steps.push({
      ok: !!P,
      detail: !dfa.accepted ? dfa.reason
        : dupSlot ? `Valid format, but ${PS.fmt.plate(plate)} is already parked at ${dupSlot}`
          : `${PS.fmt.plate(plate)} reached accepting state q10 in ${dfa.steps.length} transitions`
    });

    // ② COA – combinational logic decides whether the barrier lifts
    const S = PS.lot.usableSlots(ev).length > PS.lot.RESERVE_HOLD ? 1 : 0;
    const gate = { V: 1, P, S, R };
    const out = PS.coa.barrier(gate);
    PS.bus.emit('gate', gate);
    steps.push({
      ok: !!out.OPEN,
      detail: `V=1 P=${P} S=${S} R=${R} → OPEN = ${out.OPEN}` + (out.ALARM ? ' · ALARM raised' : '') + (out.FULL ? ' · FULL sign lit' : '')
    });
    if (!out.OPEN) {
      renderSteps(steps);
      PS.ui.toast(out.ALARM ? 'Barrier stays closed — alarm sent to the security desk' : 'Lot full — only reservation holders may enter', 'error');
      return;
    }

    // ③ AI – BFS finds the nearest free bay from the entrance
    const res = PS.lot.allocate(ev);
    steps.push({
      ok: res.found,
      detail: res.found
        ? `Bay ${res.slot.id} · ${res.path.length - 1} moves · ${res.explored.length} cells explored${res.fallback ? ' (EV bays full, standard bay)' : ''}`
        : 'No reachable free bay — check the cones on the driveway'
    });
    if (!res.found) { renderSteps(steps); PS.ui.toast('No reachable bay found', 'error'); return; }

    // ④ COA – the zone's occupancy register gets a new 1-bit
    const zone = res.slot.zone;
    const before = PS.lot.register(zone);
    PS.lot.park(res.slot.id, plate, ev);
    const after = PS.lot.register(zone);
    const hex = v => '0x' + PS.coa.toBase(v, 16, 3);
    steps.push({ ok: true, detail: `Zone ${zone}: ${hex(before)} → ${hex(after)} (${PS.coa.toBase(after, 2, 12)}₂)` });

    // ⑤ DAA – record appended to the log
    steps.push({ ok: true, detail: `Entry #${PS.lot.log.length} at ${PS.fmt.time(Date.now())} — find it with binary search` });

    renderSteps(steps);
    view.animate(res, { delay: 35, explored: false });
    PS.ui.toast(`${PS.fmt.plate(plate)} → Bay ${res.slot.id} (${res.path.length - 1} moves)`, 'success');
    $('#arrPlate').value = '';
    $('#arrRes').checked = false;
    livePlateHint();
  }

  function onCellClick(cell) {
    if (!PS.lot.isBay(cell)) return;
    const occ = PS.lot.occupied[cell.id];
    if (occ) {
      const now = Date.now();
      PS.ui.modal({
        title: `Bay ${cell.id}`,
        body: `<div class="plate-badge"><span>${PS.fmt.plate(occ.plate)}</span></div>
          <dl class="kv"><dt>Parked since</dt><dd>${PS.fmt.time(occ.since)}</dd>
          <dt>Duration</dt><dd>${PS.fmt.duration(now - occ.since)}</dd>
          <dt>Bay type</dt><dd>${cell.type === 'ev' ? 'EV charging' : 'Standard'}</dd>
          <dt>Amount due</dt><dd><b>${PS.fmt.money(PS.lot.fee(occ.since, now))}</b></dd></dl>
          <p class="muted small" style="margin-top:12px">Tariff: ₹30 for the first hour, ₹20 for each extra hour.</p>`,
        actions: [
          { label: 'Cancel', kind: 'ghost' },
          { label: 'Collect & release', kind: 'primary', onClick: () => {
            const r = PS.lot.release(cell.id);
            PS.ui.toast(`${PS.fmt.plate(r.plate)} left · ${PS.fmt.money(r.fee)} collected`, 'success');
          } }
        ]
      });
    } else {
      PS.ui.modal({
        title: `Bay ${cell.id} is free`,
        body: `<p>${cell.type === 'ev' ? 'EV charging bay in Zone F.' : `Standard bay in Zone ${cell.zone}.`} Open the Smart Navigator to compare how BFS and A* plan the route from the entrance to this bay.</p>`,
        actions: [
          { label: 'Close', kind: 'ghost' },
          { label: 'Show route', kind: 'primary', onClick: () => { PS.pages.navigator.setTarget(cell); location.hash = '#navigator'; } }
        ]
      });
    }
  }

  return { init };
})();
