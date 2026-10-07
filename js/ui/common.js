/* =========================================================
   ParkSmart · UI helpers shared by every page
   ========================================================= */
PS.ui = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Tiny DOM builder:  h('div', { class: 'x', onclick: fn }, 'text', childNode) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [p, val] of Object.entries(v)) {
          if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val;
        }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    children.flat().forEach(ch => {
      if (ch == null || ch === false) return;
      el.appendChild(ch instanceof Node ? ch : document.createTextNode(String(ch)));
    });
    return el;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const CAR_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#a855f7', '#e2e8f0', '#f97316', '#06b6d4', '#eab308', '#94a3b8', '#ec4899'];
  function carColor(plate) {
    let x = 0;
    for (const ch of String(plate)) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
    return CAR_COLORS[x % CAR_COLORS.length];
  }
  const carSvg = color =>
    `<svg class="car" viewBox="0 0 20 34" aria-hidden="true"><rect x="2" y="1" width="16" height="32" rx="6" fill="${color}"/>` +
    `<rect x="4" y="8" width="12" height="6.5" rx="2" fill="#0b1220" opacity=".6"/><rect x="4" y="23" width="12" height="4.5" rx="1.5" fill="#0b1220" opacity=".5"/></svg>`;

  const icons = {
    bolt: '<svg class="cico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="currentColor"/></svg>',
    in: '<svg class="cico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5M5 12l7-7 7 7"/></svg>',
    lift: '<svg class="cico" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6 10.5 12 3l6 7.5zM6 13.5 12 21l6-7.5z"/></svg>',
    cone: '<svg class="cico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4l5 16H5z" fill="#f97316"/><path d="M8.2 9.5h7.6M6.8 14.5h10.4" stroke="#fff" stroke-width="2"/><rect x="3" y="19" width="18" height="2.6" rx="1" fill="#f97316"/></svg>'
  };

  function toast(message, type = 'info') {
    const el = h('div', { class: 'toast ' + type, role: 'status' }, message);
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3000);
  }

  function modal({ title, body, actions = [] }) {
    $('#modalTitle').textContent = title;
    const b = $('#modalBody');
    b.innerHTML = '';
    if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
    const f = $('#modalActions');
    f.innerHTML = '';
    actions.forEach(a => f.appendChild(h('button', {
      class: 'btn ' + (a.kind || ''),
      onclick: () => { closeModal(); if (a.onClick) a.onClick(); }
    }, a.label)));
    $('#modal').classList.add('open');
    const last = f.lastElementChild;
    if (last) last.focus();
  }
  function closeModal() { $('#modal').classList.remove('open'); }

  return { $, $$, h, esc, sleep, carColor, carSvg, icons, toast, modal, closeModal };
})();
