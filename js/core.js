/* =========================================================
   ParkSmart · core
   Shared namespace, event bus, local storage and formatting.
   ========================================================= */
window.PS = { pages: {}, state: { lastPlateOk: null } };

(function (PS) {
  // --- tiny publish/subscribe bus so modules stay in sync -----------------
  const listeners = {};
  PS.bus = {
    on(event, fn) { (listeners[event] = listeners[event] || []).push(fn); },
    emit(event, data) { (listeners[event] || []).forEach(fn => fn(data)); }
  };

  // --- browser storage (wrapped: private windows may block it) ------------
  const PREFIX = 'parksmart:';
  PS.store = {
    load(key, fallback) {
      try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    save(key, value) {
      try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    clear() {
      try {
        Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
      } catch (e) { /* ignore */ }
    }
  };

  // --- deterministic random numbers (same demo lot on every first load) ---
  PS.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  // --- formatting helpers --------------------------------------------------
  const pad = n => String(n).padStart(2, '0');
  PS.fmt = {
    time: ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); },
    hm: min => pad(Math.floor(min / 60)) + ':' + pad(min % 60),
    duration: ms => {
      const m = Math.max(1, Math.round(ms / 60000));
      return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm';
    },
    money: n => '₹' + Number(n).toLocaleString('en-IN'),
    plate: p => {
      const m = /^([A-Z]{2})([0-9]{2})([A-Z]{1,2})([0-9]{4})$/.exec(p || '');
      return m ? m.slice(1).join(' ') : (p || '');
    },
    num: (n, d = 0) => Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d })
  };
})(window.PS);
