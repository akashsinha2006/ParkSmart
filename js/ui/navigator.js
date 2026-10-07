/* =========================================================
   Smart Navigator page – BFS vs A* side by side
   ========================================================= */
PS.pages.navigator = (function () {
  const { $, $$ } = PS.ui;
  const SPEED = { slow: 70, normal: 28, fast: 8, instant: 0 };
  let bfsView, aView, target, mode = 'pick', dirty = true;

  function init() {
    target = PS.lot.lift;
    bfsView = PS.LotView($('#navLotBfs'), { onCellClick: click });
    aView = PS.LotView($('#navLotAstar'), { onCellClick: click });
    bfsView.setTarget(target);
    aView.setTarget(target);
    $$('[data-navmode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.navmode)));
    $('#navRun').addEventListener('click', run);
    $('#navClearCones').addEventListener('click', () => { PS.lot.clearBlocked(); run(); });
    PS.bus.on('lot', () => { dirty = true; bfsView.paint(); aView.paint(); });
    renderTargetLabel();
  }

  function onShow() { if (dirty) run(); }

  function setMode(m) {
    mode = m;
    $$('[data-navmode]').forEach(b => b.classList.toggle('active', b.dataset.navmode === m));
    $('#navModeHint').textContent = m === 'cones'
      ? 'Click a driveway cell to close or reopen it — both searches re-route.'
      : 'Click any bay or the lift lobby to set the destination.';
  }

  function click(cell) {
    if (mode === 'cones') {
      if (cell.type !== 'road') { PS.ui.toast('Cones can only be placed on driveways', 'warn'); return; }
      PS.lot.toggleBlocked(cell.r, cell.c);
      run();
      return;
    }
    if (PS.lot.isBay(cell) || cell.type === 'lift') { setTarget(cell); run(); }
    else PS.ui.toast('Pick a parking bay or the lift lobby as the destination', 'info');
  }

  function setTarget(cell) {
    target = cell;
    bfsView.setTarget(cell);
    aView.setTarget(cell);
    dirty = true;
    renderTargetLabel();
  }

  function targetName() {
    if (target.type === 'lift') return 'the lift lobby';
    return `bay ${target.id}` + (PS.lot.occupied[target.id] ? ' (occupied)' : '');
  }
  function renderTargetLabel() {
    const n = targetName();
    $('#navTarget').textContent = n.charAt(0).toUpperCase() + n.slice(1);
  }

  function run() {
    dirty = false;
    const start = PS.lot.entrance;
    const goal = { r: target.r, c: target.c };
    const isGoal = n => n.r === goal.r && n.c === goal.c;
    const canEnter = PS.lot.canEnter(isGoal);

    const b = PS.ai.bfs(PS.lot.grid, start, isGoal, canEnter);
    const a = PS.ai.astar(PS.lot.grid, start, goal, canEnter);

    renderStats('#navStatsBfs', b);
    renderStats('#navStatsAstar', a);
    renderSummary(b, a);
    renderTargetLabel();

    const delay = SPEED[$('#navSpeed').value];
    bfsView.paint();
    aView.paint();
    bfsView.animate(b, { delay });
    aView.animate(a, { delay });
  }

  function renderStats(sel, res) {
    $(sel).innerHTML =
      `<div class="stat"><span>Nodes expanded</span><b>${res.explored.length}</b></div>` +
      `<div class="stat"><span>Route length</span><b>${res.found ? res.path.length - 1 + ' moves' : '—'}</b></div>` +
      `<div class="stat"><span>Run time</span><b>${res.ms.toFixed(2)} ms</b></div>`;
  }

  function renderSummary(b, a) {
    const el = $('#navSummary');
    if (!b.found) {
      el.className = 'card insight bad';
      el.innerHTML = `<div class="insight-num">✕</div><div><b>No route.</b> ${targetName()} cannot be reached — remove some cones or pick another destination.</div>`;
      return;
    }
    const pct = Math.round((b.explored.length - a.explored.length) / b.explored.length * 100);
    el.className = 'card insight';
    el.innerHTML = `<div class="insight-num">${Math.max(pct, 0)}%</div><div>` +
      (pct > 0 ? `<b>A* did ${pct}% less work.</b> ` : '<b>A* matched BFS here.</b> ') +
      `To reach ${targetName()} it expanded <b>${a.explored.length}</b> cells, BFS expanded <b>${b.explored.length}</b>. ` +
      `Both found a route of <b>${a.path.length - 1} moves</b>: the Manhattan heuristic never overestimates on a 4-direction grid, so A* is still optimal.</div>`;
  }

  return { init, onShow, setTarget };
})();
