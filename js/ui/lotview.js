/* =========================================================
   LotView – draws the parking lot grid and animates searches
   (used on the Dashboard and twice on the Smart Navigator)
   ========================================================= */
PS.LotView = function (container, opts = {}) {
  const lot = PS.lot, { h, icons } = PS.ui;
  const els = [];
  let target = null;
  let token = 0;                      // bump to cancel a running animation

  container.classList.add('lot');
  container.style.setProperty('--cols', lot.grid.cols);
  container.innerHTML = '';
  lot.cells.forEach((row, r) => {
    els.push([]);
    row.forEach((cell, c) => {
      const el = h('div', { class: 'cell', 'data-r': r, 'data-c': c });
      container.appendChild(el);
      els[r].push(el);
    });
  });

  container.addEventListener('click', e => {
    const el = e.target.closest('.cell');
    if (el && opts.onCellClick) opts.onCellClick(lot.cellAt(+el.dataset.r, +el.dataset.c));
  });

  function paint() {
    token++;
    lot.cells.forEach((row, r) => row.forEach((cell, c) => {
      const el = els[r][c];
      const occ = lot.isBay(cell) ? lot.occupied[cell.id] : null;
      const blocked = lot.isBlocked(r, c);
      let cls = 'cell ' + cell.type;
      if (occ) cls += ' occupied';
      if (blocked) cls += ' blocked';
      if (target && target.r === r && target.c === c) cls += ' target';
      el.className = cls;

      let html = '', title = '';
      if (lot.isBay(cell)) {
        if (occ) {
          html = PS.ui.carSvg(PS.ui.carColor(occ.plate));
          title = `Bay ${cell.id} · ${PS.fmt.plate(occ.plate)}`;
        } else {
          html = cell.type === 'ev' ? icons.bolt : `<span class="lbl">${cell.id}</span>`;
          title = `Bay ${cell.id} · free${cell.type === 'ev' ? ' EV charging bay' : ''}`;
        }
      } else if (cell.type === 'entrance') { html = icons.in; title = 'Entrance gate'; }
      else if (cell.type === 'lift') { html = icons.lift; title = 'Lift lobby (mall entrance)'; }
      else if (blocked) { html = icons.cone; title = 'Driveway closed (cones)'; }
      else if (cell.type === 'road') title = 'Driveway';
      else title = 'Pillar';
      el.innerHTML = html;
      el.title = title;
    }));
  }

  function clearOverlay() {
    els.forEach(row => row.forEach(el => el.classList.remove('explored', 'path')));
  }

  /** Show the cells a search explored (in order), then the final route. */
  async function animate(result, { delay = 20, explored = true } = {}) {
    const my = ++token;
    clearOverlay();
    if (explored) {
      for (const n of result.explored) {
        if (my !== token) return false;
        els[n.r][n.c].classList.add('explored');
        if (delay) await PS.ui.sleep(delay);
      }
    }
    for (const n of result.path) {
      if (my !== token) return false;
      els[n.r][n.c].classList.add('path');
      if (delay) await PS.ui.sleep(delay * 1.5);
    }
    return true;
  }

  function setTarget(cell) { target = cell; paint(); }

  paint();
  return { paint, animate, clearOverlay, setTarget };
};
