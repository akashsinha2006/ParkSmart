/* =========================================================
   Demand Forecast page – linear regression from scratch
   x = mall footfall (visitors/day), y = peak cars parked
   ========================================================= */
PS.pages.forecast = (function () {
  const { $, h } = PS.ui;
  const CAPACITY = 72;
  const SAMPLE = [
    { label: 'W1 Mon', x: 1450, y: 24 }, { label: 'W1 Tue', x: 1320, y: 22 }, { label: 'W1 Wed', x: 1680, y: 27 },
    { label: 'W1 Thu', x: 1900, y: 31 }, { label: 'W1 Fri', x: 2850, y: 41 }, { label: 'W1 Sat', x: 4600, y: 63 },
    { label: 'W1 Sun', x: 5100, y: 68 }, { label: 'W2 Mon', x: 1500, y: 25 }, { label: 'W2 Tue', x: 1250, y: 20 },
    { label: 'W2 Wed', x: 1750, y: 29 }, { label: 'W2 Thu', x: 2100, y: 33 }, { label: 'W2 Fri', x: 3050, y: 45 },
    { label: 'W2 Sat', x: 4300, y: 58 }, { label: 'W2 Sun', x: 4900, y: 66 }
  ];
  let data = [], model = null;

  function init() {
    data = PS.store.load('forecast', null) || SAMPLE.map(p => ({ ...p }));
    $('#fcSlider').addEventListener('input', () => { drawChart(); renderPrediction(); });
    $('#fcResid').addEventListener('change', drawChart);
    $('#fcAddForm').addEventListener('submit', e => { e.preventDefault(); addPoint(); });
    $('#fcReset').addEventListener('click', () => {
      data = SAMPLE.map(p => ({ ...p }));
      changed();
      PS.ui.toast('Sample data restored', 'info');
    });
    changed(false);
  }

  function changed(save = true) {
    if (save) PS.store.save('forecast', data);
    model = PS.ai.linearRegression(data);   // re-train on every change
    drawChart();
    renderModel();
    renderPrediction();
    renderTable();
  }

  function addPoint() {
    const x = Number($('#fcAddX').value), y = Number($('#fcAddY').value);
    if (!(x >= 100 && x <= 10000)) { PS.ui.toast('Footfall should be between 100 and 10,000', 'warn'); return; }
    if (!(y >= 0 && y <= CAPACITY)) { PS.ui.toast(`Cars must be between 0 and ${CAPACITY}`, 'warn'); return; }
    data.push({ label: 'Day ' + (data.length + 1), x, y });
    $('#fcAddX').value = '';
    $('#fcAddY').value = '';
    changed();
    PS.ui.toast('Data point added — model retrained', 'success');
  }

  function removePoint(i) {
    if (data.length <= 2) { PS.ui.toast('At least 2 points are needed to fit a line', 'warn'); return; }
    data.splice(i, 1);
    changed();
  }

  function drawChart() {
    const W = 640, H = 340, m = { l: 48, r: 18, t: 18, b: 46 };
    const XMAX = 7000, YMAX = 80;
    const sx = x => m.l + x / XMAX * (W - m.l - m.r);
    const sy = y => H - m.b - y / YMAX * (H - m.t - m.b);
    let s = `<defs><clipPath id="fcClip"><rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}"/></clipPath></defs>`;

    for (let y = 0; y <= YMAX; y += 10) {
      s += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${sy(y)}" y2="${sy(y)}"/>`;
      s += `<text class="tick" x="${m.l - 8}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`;
    }
    for (let x = 0; x <= XMAX; x += 1000) {
      s += `<text class="tick" x="${sx(x)}" y="${H - m.b + 18}" text-anchor="middle">${x ? x / 1000 + 'k' : '0'}</text>`;
    }
    s += `<text class="axis-lbl" x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle">Mall footfall (visitors per day)</text>`;
    s += `<text class="axis-lbl" transform="translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)" text-anchor="middle">Peak cars parked</text>`;
    s += `<line class="cap-line" x1="${m.l}" x2="${W - m.r}" y1="${sy(CAPACITY)}" y2="${sy(CAPACITY)}"/>`;
    s += `<text class="cap-lbl" x="${m.l + 8}" y="${sy(CAPACITY) - 6}">Capacity · ${CAPACITY} bays</text>`;

    if (model) {
      s += `<g clip-path="url(#fcClip)"><line class="fit-line" x1="${sx(0)}" y1="${sy(model.predict(0))}" x2="${sx(XMAX)}" y2="${sy(model.predict(XMAX))}"/>`;
      if ($('#fcResid').checked) {
        data.forEach(p => { s += `<line class="resid" x1="${sx(p.x)}" x2="${sx(p.x)}" y1="${sy(p.y)}" y2="${sy(model.predict(p.x))}"/>`; });
      }
      s += '</g>';
    }
    data.forEach(p => {
      s += `<circle class="pt" cx="${sx(p.x)}" cy="${sy(p.y)}" r="5.5"><title>${p.label}: ${PS.fmt.num(p.x)} visitors → ${p.y} cars</title></circle>`;
    });
    if (model) {
      const x = Number($('#fcSlider').value);
      const yRaw = model.predict(x), y = Math.min(YMAX, Math.max(0, yRaw));
      s += `<line class="pred-guide" x1="${sx(x)}" x2="${sx(x)}" y1="${sy(0)}" y2="${sy(y)}"/>`;
      s += `<line class="pred-guide" x1="${m.l}" x2="${sx(x)}" y1="${sy(y)}" y2="${sy(y)}"/>`;
      s += `<circle class="pred-dot" cx="${sx(x)}" cy="${sy(y)}" r="7"/>`;
      const right = sx(x) > W - 170;
      s += `<text class="pred-lbl" x="${sx(x) + (right ? -12 : 12)}" y="${Math.max(14, sy(y) - 12)}" text-anchor="${right ? 'end' : 'start'}">Forecast ≈ ${Math.round(yRaw)} cars</text>`;
    }
    $('#fcChart').innerHTML = s;
  }

  function renderModel() {
    if (!model) {
      $('#fcEq').textContent = 'Need 2+ distinct points';
      $('#fcInterp').textContent = '';
      $('#fcMetrics').innerHTML = '';
      return;
    }
    const sign = model.intercept < 0 ? '−' : '+';
    $('#fcEq').textContent = `ŷ = ${model.slope.toFixed(4)}·x ${sign} ${Math.abs(model.intercept).toFixed(2)}`;
    $('#fcInterp').innerHTML = `<b>Slope m:</b> every extra 1,000 visitors brings about <b>${(model.slope * 1000).toFixed(1)} more cars</b>. ` +
      `<b>Intercept c:</b> ${model.intercept.toFixed(1)} cars at zero footfall. The least-squares line is the one with the smallest mean squared error.`;
    $('#fcMetrics').innerHTML = [['MSE', model.mse.toFixed(2)], ['RMSE', model.rmse.toFixed(2)], ['R²', model.r2.toFixed(3)], ['n', model.n]]
      .map(([k, v]) => `<div class="metric"><span>${k}</span><b>${v}</b></div>`).join('');
  }

  function renderPrediction() {
    const x = Number($('#fcSlider').value);
    $('#fcX').textContent = PS.fmt.num(x) + ' visitors';
    if (!model) return;
    const raw = model.predict(x);
    const cars = Math.max(0, Math.round(raw));
    const pct = Math.round(cars / CAPACITY * 100);
    $('#fcY').textContent = (cars > CAPACITY ? CAPACITY + '+' : cars) + ' cars';
    $('#fcPct').textContent = `${pct}% of ${CAPACITY} bays`;
    let level, msg, color;
    if (pct >= 90) { level = 'bad'; color = 'var(--danger)'; msg = '<b>Overflow risk.</b> Open the overflow lot, switch on dynamic pricing and guide drivers to the emptiest zone.'; }
    else if (pct >= 60) { level = 'warn'; color = 'var(--accent)'; msg = '<b>Busy day.</b> Keep every zone open and add one gate attendant for the peak hour.'; }
    else { level = 'ok'; color = 'var(--success)'; msg = '<b>Normal day.</b> Standard staffing is enough.'; }
    const bar = $('#fcBar');
    bar.style.width = Math.min(100, pct) + '%';
    bar.style.background = color;
    $('#fcAdvice').className = 'alert ' + level;
    $('#fcAdvice').innerHTML = msg;
  }

  function renderTable() {
    const tb = $('#fcTable tbody');
    tb.innerHTML = '';
    data.forEach((p, i) => {
      const yhat = model ? model.predict(p.x) : NaN;
      const res = p.y - yhat;
      tb.appendChild(h('tr', null,
        h('td', null, p.label),
        h('td', { class: 'mono' }, PS.fmt.num(p.x)),
        h('td', { class: 'mono' }, p.y),
        h('td', { class: 'mono' }, isNaN(yhat) ? '—' : yhat.toFixed(1)),
        h('td', { class: 'mono ' + (res >= 0 ? 'pos' : 'neg') }, isNaN(res) ? '—' : (res >= 0 ? '+' : '') + res.toFixed(1)),
        h('td', { class: 'right' }, h('button', { class: 'icon-btn sm', type: 'button', title: 'Remove', 'aria-label': 'Remove point', onclick: () => removePoint(i) }, '×'))));
    });
    $('#fcCount').textContent = `${data.length} days`;
  }

  return { init, onShow: drawChart };
})();
