/* =========================================================
   Gate Hardware page – logic circuit, registers, pipeline
   ========================================================= */
PS.pages.hardware = (function () {
  const { $, $$, h } = PS.ui;
  const C = PS.coa;
  const STAGES = ['Scan plate', 'Validate (DFA)', 'Allocate bay (BFS)', 'Ticket & barrier'];
  let inp = { V: 1, P: 1, S: 1, R: 0 };
  let pipeToken = 0;

  function init() {
    drawCircuit();
    buildTruthTable();
    ['V', 'P', 'S', 'R'].forEach(k => $('#sw' + k).addEventListener('change', e => { inp[k] = e.target.checked ? 1 : 0; paintLogic(); }));
    $('#circuit').addEventListener('click', e => {
      const pin = e.target.closest('[data-toggle]');
      if (pin) { const k = pin.dataset.toggle; inp[k] = inp[k] ? 0 : 1; paintLogic(); }
    });
    $('#hwSync').addEventListener('click', syncLive);
    PS.bus.on('gate', g => { inp = { ...g }; paintLogic(); });
    PS.bus.on('lot', renderRegisters);
    $('#pipeN').addEventListener('input', () => { pipeToken++; renderPipeline(); });
    $('#pipeT').addEventListener('input', () => { pipeToken++; renderPipeline(); });
    $('#pipeRun').addEventListener('click', animatePipeline);
    paintLogic();
    renderRegisters();
    renderPipeline();
  }

  /* ---------------- 1.9 Logic circuit ---------------- */
  function drawCircuit() {
    const pin = (k, y, desc) =>
      `<g class="pin" data-sig="${k}" data-toggle="${k}"><rect x="8" y="${y - 13}" width="54" height="26" rx="7"/>` +
      `<text x="35" y="${y + 4}">${k}=<tspan data-val="${k}">0</tspan></text></g>` +
      `<text class="pin-desc" x="70" y="${y - 7}">${desc}</text>`;
    const wire = (sig, d) => `<path class="wire" data-sig="${sig}" d="${d}"/>`;
    const dot = (sig, x, y) => `<circle class="jn" data-sig="${sig}" cx="${x}" cy="${y}" r="3.5"/>`;
    const led = (sig, y, label, color) =>
      `<circle class="led ${color}" data-sig="${sig}" cx="590" cy="${y}" r="12"/><text class="led-lbl" x="610" y="${y + 4}">${label}</text>`;

    let s = '';
    s += wire('V', 'M62 40 H380 V158 H420') + wire('V', 'M380 65 H420') + dot('V', 380, 65);
    s += wire('P', 'M62 100 H340 V90 H420') + wire('P', 'M160 100 V150 H200') + dot('P', 160, 100);
    s += wire('nP', 'M250 150 H360 V182 H420');
    s += wire('S', 'M62 200 H200 V210 H238') + wire('S', 'M180 200 V280 H420') + dot('S', 180, 200);
    s += wire('R', 'M62 250 H200 V240 H238');
    s += wire('SR', 'M290 225 H320 V115 H420');
    s += wire('OPEN', 'M480 90 H578') + wire('ALARM', 'M480 170 H578') + wire('FULL', 'M466 280 H578');

    s += `<path class="gate" d="M230 195 Q252 225 230 255 Q266 255 290 225 Q266 195 230 195 Z"/><text class="gate-lbl" x="258" y="229">OR</text>`;
    s += `<path class="gate" d="M200 138 L240 150 L200 162 Z"/><circle class="gate" cx="245" cy="150" r="5"/><text class="gate-lbl" x="216" y="132">NOT</text>`;
    s += `<path class="gate" d="M420 50 H440 A40 40 0 0 1 440 130 H420 Z"/><text class="gate-lbl" x="445" y="94">AND</text>`;
    s += `<path class="gate" d="M420 145 H455 A25 25 0 0 1 455 195 H420 Z"/><text class="gate-lbl" x="444" y="174">AND</text>`;
    s += `<path class="gate" d="M420 268 L456 280 L420 292 Z"/><circle class="gate" cx="461" cy="280" r="5"/><text class="gate-lbl" x="436" y="262">NOT</text>`;

    s += `<text class="expr-lbl" x="486" y="82">V·P·(S+R)</text><text class="expr-lbl" x="486" y="162">V·¬P</text><text class="expr-lbl" x="474" y="272">¬S</text>`;
    s += `<text class="expr-lbl" x="296" y="242">S+R</text><text class="expr-lbl" x="256" y="143">¬P</text>`;

    s += pin('V', 40, 'vehicle on sensor loop') + pin('P', 100, 'plate valid (DFA)') + pin('S', 200, 'space available') + pin('R', 250, 'has reservation');
    s += led('OPEN', 90, 'OPEN', 'green') + led('ALARM', 170, 'ALARM', 'red') + led('FULL', 280, 'FULL', 'amber');
    $('#circuit').innerHTML = s;
  }

  function buildTruthTable() {
    const tb = $('#ttTable tbody');
    C.truthTable().forEach((row, i) => {
      const cell = v => h('td', { class: v ? 'one' : '' }, v);
      tb.appendChild(h('tr', {
        'data-i': i,
        onclick: () => { inp = { V: row.V, P: row.P, S: row.S, R: row.R }; paintLogic(); }
      }, cell(row.V), cell(row.P), cell(row.S), cell(row.R), cell(row.OPEN), cell(row.ALARM), cell(row.FULL)));
    });
  }

  function paintLogic() {
    const o = C.barrier(inp);
    const sig = { ...inp, nP: o.notP, SR: o.sOrR, OPEN: o.OPEN, ALARM: o.ALARM, FULL: o.FULL };
    $$('#circuit [data-sig]').forEach(el => el.classList.toggle('on', !!sig[el.dataset.sig]));
    $$('#circuit [data-val]').forEach(el => { el.textContent = inp[el.dataset.val]; });
    ['V', 'P', 'S', 'R'].forEach(k => { $('#sw' + k).checked = !!inp[k]; });

    const b = v => `<span class="v${v}">${v}</span>`;
    $('#hwExpr').innerHTML =
      `OPEN&nbsp; = V·P·(S+R) = ${b(inp.V)}·${b(inp.P)}·(${b(inp.S)}+${b(inp.R)}) = ${b(o.OPEN)}<br>` +
      `ALARM = V·¬P &nbsp;&nbsp;&nbsp;&nbsp;= ${b(inp.V)}·${b(o.notP)} = ${b(o.ALARM)}<br>` +
      `FULL&nbsp; = ¬S &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= ¬${b(inp.S)} = ${b(o.FULL)}`;

    const idx = inp.V * 8 + inp.P * 4 + inp.S * 2 + inp.R;
    $$('#ttTable tbody tr').forEach(tr => tr.classList.toggle('cur', +tr.dataset.i === idx));

    const status = $('#hwStatus');
    if (o.OPEN) { status.className = 'badge ok'; status.textContent = 'Barrier OPEN'; }
    else if (o.ALARM) { status.className = 'badge bad'; status.textContent = 'ALARM'; }
    else { status.className = 'badge neutral'; status.textContent = 'Barrier closed'; }
  }

  function syncLive() {
    inp = {
      V: 1,
      P: PS.state.lastPlateOk === null ? 1 : (PS.state.lastPlateOk ? 1 : 0),
      S: PS.lot.usableSlots(false).length > PS.lot.RESERVE_HOLD ? 1 : 0,
      R: 0
    };
    paintLogic();
    PS.ui.toast('Inputs loaded from the live lot and the last plate check', 'info');
  }

  /* ---------------- 1.6 Number systems ---------------- */
  function renderRegisters() {
    const tb = $('#regTable tbody');
    tb.innerHTML = '';
    let total = 0;
    PS.lot.ZONES.forEach(z => {
      const v = PS.lot.register(z);
      const used = C.popcount(v);
      total += used;
      const bits = h('div', { class: 'bits' });
      for (let i = 1; i <= PS.lot.SLOTS_PER_ZONE; i++) {
        const bit = (v >> (PS.lot.SLOTS_PER_ZONE - i)) & 1;
        const slot = PS.lot.byId[z + i];
        bits.appendChild(h('button', {
          class: 'bit' + (bit ? ' on' : '') + (slot.type === 'ev' ? ' ev' : ''),
          type: 'button',
          title: `Bay ${slot.id} · bit b${PS.lot.SLOTS_PER_ZONE - i}${slot.type === 'ev' ? ' · EV' : ''}`,
          onclick: () => toggleBay(slot)
        }, String(bit)));
      }
      tb.appendChild(h('tr', null,
        h('td', null, h('b', null, 'Zone ' + z)),
        h('td', null, bits),
        h('td', { class: 'mono' }, C.toBase(v, 8, 4)),
        h('td', { class: 'mono' }, v),
        h('td', { class: 'mono' }, '0x' + C.toBase(v, 16, 3)),
        h('td', null, `${used}/12`)));
    });
    $('#regTotal').innerHTML = `Total occupied = <b>${total}</b>₁₀ = <b>${C.toBase(total, 2, 7)}</b>₂ = <b>${C.toBase(total, 8)}</b>₈ = <b>0x${C.toBase(total, 16)}</b>₁₆`;
  }

  function toggleBay(slot) {
    if (PS.lot.occupied[slot.id]) {
      const r = PS.lot.release(slot.id);
      PS.ui.toast(`Bit cleared: ${PS.fmt.plate(r.plate)} left bay ${slot.id}`, 'info');
    } else {
      const plate = PS.lot.randomPlate();
      PS.lot.park(slot.id, plate, slot.type === 'ev');
      PS.ui.toast(`Bit set: ${PS.fmt.plate(plate)} parked in bay ${slot.id}`, 'info');
    }
  }

  /* ---------------- 3.1 Pipelining ---------------- */
  function renderPipeline() {
    const n = Number($('#pipeN').value), tp = Number($('#pipeT').value), k = STAGES.length;
    $('#pipeNVal').textContent = n + (n === 1 ? ' car' : ' cars');
    $('#pipeTVal').textContent = tp + ' s';
    const p = C.pipeline(n, k, tp);

    const grid = $('#pipeGrid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `150px repeat(${p.cycles}, minmax(34px, 1fr))`;
    grid.appendChild(h('div', { class: 'pc head stage' }, 'Stage ╲ Cycle'));
    for (let t = 0; t < p.cycles; t++) grid.appendChild(h('div', { class: 'pc head', 'data-t': t }, 't' + (t + 1)));
    for (let s = 0; s < k; s++) {
      grid.appendChild(h('div', { class: 'pc stage' }, `S${s + 1} · ${STAGES[s]}`));
      for (let t = 0; t < p.cycles; t++) {
        const car = p.grid[s][t];
        grid.appendChild(car === null
          ? h('div', { class: 'pc', 'data-t': t })
          : h('div', { class: 'pc filled', 'data-t': t, style: { '--hue': (car * 47 + 200) % 360 } }, 'C' + (car + 1)));
      }
    }

    const max = p.nonPipelined;
    $('#pipeBars').innerHTML =
      `<div class="pbar"><span>Without pipeline</span><div class="pbar-track"><div class="pbar-fill slow" style="width:100%">${p.nonPipelined} s</div></div></div>` +
      `<div class="pbar"><span>With pipeline</span><div class="pbar-track"><div class="pbar-fill fast" style="width:${(p.pipelined / max * 100).toFixed(1)}%">${p.pipelined} s</div></div></div>`;
    $('#pipeMetrics').innerHTML = [
      ['Speedup', p.speedup.toFixed(2) + '×', `n·k / (k+n−1) = ${n * k}/${p.cycles}`],
      ['Efficiency', Math.round(p.efficiency * 100) + '%', 'speedup ÷ k'],
      ['Throughput', (p.throughput * 60).toFixed(1) + ' cars/min', `${n} cars in ${p.pipelined} s`],
      ['Max speedup', p.maxSpeedup + '×', 'as n → ∞ (= k stages)']
    ].map(([a, b, c]) => `<div class="metric"><span>${a}</span><b>${b}</b><small>${c}</small></div>`).join('');
    $('#pipeClock').textContent = `${p.cycles} clock cycles of ${tp} s`;
    return p;
  }

  async function animatePipeline() {
    const my = ++pipeToken;
    const p = renderPipeline();
    $$('#pipeGrid .pc.filled').forEach(c => c.classList.add('hidden'));
    for (let t = 0; t < p.cycles; t++) {
      if (my !== pipeToken) return;
      $$('#pipeGrid .pc.head').forEach(c => c.classList.toggle('now', c.dataset.t === String(t)));
      $$(`#pipeGrid .pc.filled[data-t="${t}"]`).forEach(c => c.classList.remove('hidden'));
      const busy = p.grid.filter(row => row[t] !== null).length;
      $('#pipeClock').textContent = `Cycle ${t + 1}/${p.cycles} · ${busy} of ${STAGES.length} stages busy`;
      await PS.ui.sleep(450);
    }
    if (my === pipeToken) $$('#pipeGrid .pc.head').forEach(c => c.classList.remove('now'));
  }

  return { init };
})();
