/* =========================================================
   Plate Validator page – animated DFA + regex cross-check
   ========================================================= */
PS.pages.plate = (function () {
  const { $, h, esc } = PS.ui;
  const F = PS.flat;
  const SAMPLES = ['MH12AB1234', 'KA05M7890', 'DL3CAB1234', 'MH12AB123', '12MHAB1234', 'TN10BZ77880'];
  const EDGES = [['q0', 'q1', 'L'], ['q1', 'q2', 'L'], ['q2', 'q3', 'D'], ['q3', 'q4', 'D'], ['q4', 'q5', 'L'],
    ['q5', 'q6', 'L'], ['q6', 'q7', 'D'], ['q7', 'q8', 'D'], ['q8', 'q9', 'D'], ['q9', 'q10', 'D']];
  const X = i => 70 + i * 84, Y = 100, R = 22;

  let run = null, pos = 0, finished = false, timer = null;

  function init() {
    drawDiagram();
    drawFormal();
    $('#dfaInput').addEventListener('input', load);
    $('#dfaInput').addEventListener('keydown', e => { if (e.key === 'Enter') play(); });
    $('#dfaRun').addEventListener('click', play);
    $('#dfaStep').addEventListener('click', step);
    $('#dfaReset').addEventListener('click', load);
    const box = $('#dfaSamples');
    SAMPLES.forEach(p => box.appendChild(h('button', { class: 'pill', type: 'button', onclick: () => { $('#dfaInput').value = p; play(); } }, p)));
    $('#batchRun').addEventListener('click', runBatch);
    load();
    runBatch();
  }

  // ---------- diagram ----------
  function drawDiagram() {
    const idx = q => F.dfa.states.indexOf(q);
    let s = `<defs>
      <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="ah"/></marker>
      <marker id="ahOn" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="ah on"/></marker></defs>`;
    s += `<text class="edge-lbl start-lbl" x="14" y="${Y - 10}">start</text>`;
    s += `<line class="edge" id="e-start" x1="12" y1="${Y}" x2="${X(0) - R - 3}" y2="${Y}" marker-end="url(#ah)"/>`;
    EDGES.forEach(([a, b, sym]) => {
      const x1 = X(idx(a)) + R, x2 = X(idx(b)) - R - 3;
      s += `<line class="edge" id="e-${a}-${b}" x1="${x1}" y1="${Y}" x2="${x2}" y2="${Y}" marker-end="url(#ah)"/>`;
      s += `<text class="edge-lbl" x="${(x1 + x2) / 2}" y="${Y - 8}">${sym}</text>`;
    });
    // skip edge q5 -> q7 (series with a single letter)
    s += `<path class="edge" id="e-q5-q7" d="M${X(5)} ${Y - R} C ${X(5) + 24} ${Y - 84}, ${X(7) - 24} ${Y - 84}, ${X(7)} ${Y - R - 3}" marker-end="url(#ah)"/>`;
    s += `<text class="edge-lbl" x="${X(6)}" y="${Y - 70}">D</text>`;

    F.dfa.states.forEach((q, i) => {
      const acc = F.dfa.accepting.includes(q);
      s += `<g class="state${acc ? ' accepting' : ''}" id="s-${q}"><circle cx="${X(i)}" cy="${Y}" r="${R}"/>` +
        (acc ? `<circle class="inner" cx="${X(i)}" cy="${Y}" r="${R - 4}"/>` : '') +
        `<text x="${X(i)}" y="${Y + 4}">${q}</text></g>`;
    });

    [[0, 2, 'State code', 'LL'], [2, 4, 'District', 'DD'], [4, 6, 'Series', 'L | LL'], [6, 10, 'Number', 'DDDD']].forEach(([a, b, label, pat]) => {
      const x1 = X(a) + 4, x2 = X(b) - 4, y = Y + 40;
      s += `<path class="seg" d="M${x1} ${y - 6} V${y} H${x2} V${y - 6}"/>`;
      s += `<text class="seg-lbl" x="${(x1 + x2) / 2}" y="${y + 17}">${label} · ${pat}</text>`;
    });

    const dx = X(5), dy = Y + 112;
    s += `<path class="edge loop" d="M${dx - R + 3} ${dy - 9} C ${dx - R - 34} ${dy - 34}, ${dx - R - 34} ${dy + 34}, ${dx - R + 3} ${dy + 9}" marker-end="url(#ah)"/>`;
    s += `<text class="edge-lbl" x="${dx - R - 34}" y="${dy + 4}">Σ</text>`;
    s += `<g class="state dead" id="s-qx"><circle cx="${dx}" cy="${dy}" r="${R}"/><text x="${dx}" y="${dy + 4}">q∅</text></g>`;
    s += `<text class="dead-note" x="${dx + 34}" y="${dy - 3}">Dead (trap) state: every missing transition</text>`;
    s += `<text class="dead-note" x="${dx + 34}" y="${dy + 13}">leads here and it never leaves → reject</text>`;
    $('#dfaSvg').innerHTML = s;
  }

  function drawFormal() {
    const tb = $('#dfaTable tbody');
    tb.innerHTML = '';
    [...F.dfa.states, F.dfa.dead].forEach(q => {
      const d = F.dfa.delta[q] || {};
      let label = F.name(q);
      if (q === F.dfa.start) label = '→ ' + label;
      if (F.dfa.accepting.includes(q)) label = '* ' + label;
      tb.appendChild(h('tr', null, h('td', { class: 'mono' }, label), h('td', { class: 'mono' }, F.name(d.L || F.dfa.dead)), h('td', { class: 'mono' }, F.name(d.D || F.dfa.dead))));
    });
  }

  // ---------- run / step ----------
  function stop() { clearInterval(timer); timer = null; }

  function load() {
    stop();
    run = F.run($('#dfaInput').value);
    pos = 0;
    finished = false;
    paint();
  }

  function advance() {
    if (pos < run.steps.length) pos++;
    if (pos >= run.steps.length) { finished = true; stop(); }
    paint();
  }

  function step() {
    if (finished) load();
    advance();
  }

  function play() {
    load();
    if (!run.steps.length) { finished = true; paint(); return; }
    timer = setInterval(advance, 300);
  }

  const current = () => (pos === 0 ? F.dfa.start : run.steps[pos - 1].to);

  function paint() { paintTape(); paintDiagram(); paintVerdict(); paintTrace(); }

  function paintTape() {
    const tape = $('#dfaTape');
    tape.innerHTML = '';
    if (!run.input.length) { tape.appendChild(h('div', { class: 'tape-empty' }, 'Type a number plate above to begin')); return; }
    [...run.input].forEach((ch, i) => {
      const cls = F.symbolClass(ch);
      let st = '';
      if (i < pos) st = run.steps[i].to === F.dfa.dead ? 'bad' : 'done';
      else if (i === pos && !finished) st = 'head';
      tape.appendChild(h('div', { class: 'sq ' + st }, h('b', null, ch), h('small', null, cls === '?' ? '✕' : cls)));
    });
  }

  function paintDiagram() {
    const svg = $('#dfaSvg');
    svg.querySelectorAll('.state').forEach(g => g.classList.remove('active', 'visited', 'ok', 'bad'));
    svg.querySelectorAll('.edge').forEach(e => {
      e.classList.remove('taken', 'current');
      if (!e.classList.contains('loop')) e.setAttribute('marker-end', 'url(#ah)');
    });
    const on = e => { e.classList.add('taken'); e.setAttribute('marker-end', 'url(#ahOn)'); };
    on($('#e-start'));
    for (let i = 0; i < pos; i++) {
      const st = run.steps[i];
      const g = svg.querySelector('#s-' + st.from);
      if (g) g.classList.add('visited');
      const e = svg.querySelector(`#e-${st.from}-${st.to}`);
      if (e) { on(e); if (i === pos - 1) e.classList.add('current'); }
    }
    const g = svg.querySelector('#s-' + current());
    g.classList.add('active');
    if (finished) g.classList.add(run.accepted ? 'ok' : 'bad');
  }

  function paintVerdict() {
    const v = $('#dfaVerdict');
    const q = current();
    if (!finished) {
      v.className = 'verdict';
      v.innerHTML = `Current state <b class="mono">${F.name(q)}</b> — ${F.dfa.meaning[q]}. Read <b>${pos}</b> of <b>${run.input.length}</b> symbols.`;
      return;
    }
    const rx = F.regexTest(run.input);
    v.className = 'verdict ' + (run.accepted ? 'ok' : 'bad');
    v.innerHTML = `<div class="verdict-main">${run.accepted ? '✓ ACCEPTED' : '✕ REJECTED'} <span class="mono">${esc(PS.fmt.plate(run.input)) || '""'}</span></div>
      <div>${esc(run.reason)}</div>
      <div class="verdict-rx">Regex <span class="mono">${esc(F.regexSource)}</span> → ${rx ? 'match' : 'no match'} · ${rx === run.accepted ? 'agrees with the DFA ✓' : 'disagrees ✕'}</div>`;
  }

  function paintTrace() {
    const tb = $('#dfaTrace tbody');
    tb.innerHTML = '';
    if (!pos) { tb.innerHTML = '<tr><td colspan="5" class="muted center">Press Run or Step to trace the transitions</td></tr>'; return; }
    run.steps.slice(0, pos).forEach((st, i) => {
      tb.appendChild(h('tr', { class: st.to === F.dfa.dead ? 'bad' : '' },
        h('td', null, i + 1), h('td', { class: 'mono' }, `'${st.ch}'`), h('td', { class: 'mono' }, st.cls),
        h('td', { class: 'mono' }, `δ(${F.name(st.from)}, ${st.cls}) = ${F.name(st.to)}`),
        h('td', { class: 'wrap' }, F.dfa.meaning[st.to])));
    });
  }

  // ---------- batch ----------
  function runBatch() {
    const lines = $('#batchInput').value.split('\n').map(s => s.trim()).filter(Boolean);
    const tb = $('#batchTable tbody');
    tb.innerHTML = '';
    let valid = 0, agree = 0;
    lines.forEach(line => {
      const r = F.run(line), rx = F.regexTest(line);
      if (r.accepted) valid++;
      if (rx === r.accepted) agree++;
      tb.appendChild(h('tr', null,
        h('td', { class: 'mono' }, line),
        h('td', null, h('span', { class: 'badge ' + (r.accepted ? 'ok' : 'bad') }, r.accepted ? 'Accept' : 'Reject')),
        h('td', null, h('span', { class: 'badge ' + (rx ? 'ok' : 'bad') }, rx ? 'Match' : 'No match')),
        h('td', { class: 'wrap muted' }, r.reason)));
    });
    $('#batchSummary').textContent = `${valid} of ${lines.length} plates valid · DFA and regex agree on ${agree}/${lines.length}`;
  }

  return { init };
})();
