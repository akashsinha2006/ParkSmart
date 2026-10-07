/* =========================================================
   ParkSmart · app bootstrap – routing, theme, clock, menu
   ========================================================= */
(function () {
  const { $, $$ } = PS.ui;
  const TITLES = {
    dashboard: 'Dashboard', plate: 'Plate Validator', navigator: 'Smart Navigator', forecast: 'Demand Forecast',
    ev: 'EV Charging', records: 'Vehicle Records', hardware: 'Gate Hardware', syllabus: 'Syllabus Map'
  };
  const MOON = '<svg class="ico" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const SUN = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function show() {
    let id = location.hash.slice(1) || 'dashboard';
    if (!TITLES[id]) id = 'dashboard';
    $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.page === id));
    $('#pageTitle').textContent = TITLES[id];
    document.title = TITLES[id] + ' · ParkSmart';
    const page = PS.pages[id];
    if (page && page.onShow) page.onShow();
    document.body.classList.remove('nav-open');
    window.scrollTo(0, 0);
  }

  function effectiveTheme() {
    const t = document.documentElement.dataset.theme;
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paintThemeButton() { $('#themeBtn').innerHTML = effectiveTheme() === 'dark' ? SUN : MOON; }

  function tick() {
    $('#clock').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  document.addEventListener('DOMContentLoaded', () => {
    PS.lot.load();
    Object.values(PS.pages).forEach(p => p.init && p.init());

    window.addEventListener('hashchange', show);
    show();

    paintThemeButton();
    $('#themeBtn').addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      PS.store.save('theme', next);
      paintThemeButton();
    });

    tick();
    setInterval(tick, 15000);

    $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));

    $('#resetDemo').addEventListener('click', () => {
      PS.ui.modal({
        title: 'Reset demo data?',
        body: '<p>This restores the sample parking lot, records, EV bookings and forecast data.</p>',
        actions: [
          { label: 'Cancel', kind: 'ghost' },
          { label: 'Reset', kind: 'primary', onClick: () => { PS.store.clear(); location.reload(); } }
        ]
      });
    });

    $$('#modal [data-close]').forEach(el => el.addEventListener('click', PS.ui.closeModal));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') PS.ui.closeModal(); });
  });
})();
