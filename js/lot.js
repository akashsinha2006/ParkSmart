/* =========================================================
   Parking-lot model – the shared state every module uses
   ========================================================= */
PS.lot = (function () {
  // Legend:  # pillar   . driveway   S parking bay   V EV-charging bay   E entrance   L lift lobby
  const MAP = [
    '#SSSSSS#SSSSSS#',
    '...............',
    '.SSSSSS#SSSSSS.',
    '.SSSSSS#SSSSSS.',
    '...............',
    '.SSSSSS#SSSSSS.',
    '.SSSSSS#SSSSSS.',
    '...............',
    'EVVVVSS#SSSSSSL'
  ];
  const TYPES = { '#': 'pillar', '.': 'road', S: 'slot', V: 'ev', E: 'entrance', L: 'lift' };
  const ZONE_OF_ROW = { 0: 'A', 2: 'B', 3: 'C', 5: 'D', 6: 'E', 8: 'F' };
  const ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];
  const SLOTS_PER_ZONE = 12;
  const RESERVE_HOLD = 3;          // bays kept aside for reservation holders

  const grid = { rows: MAP.length, cols: MAP[0].length };
  const cells = [], slots = [], byId = {};
  let entrance = null, lift = null;

  MAP.forEach((line, r) => {
    const row = [];
    let n = 0;
    [...line].forEach((ch, c) => {
      const cell = { r, c, type: TYPES[ch] };
      if (cell.type === 'slot' || cell.type === 'ev') {
        n++;
        cell.zone = ZONE_OF_ROW[r];
        cell.num = n;
        cell.id = cell.zone + n;           // e.g. "B4"
        slots.push(cell);
        byId[cell.id] = cell;
      }
      if (cell.type === 'entrance') entrance = cell;
      if (cell.type === 'lift') lift = cell;
      row.push(cell);
    });
    cells.push(row);
  });

  // ---- state ----------------------------------------------------------
  let occupied = {};          // slotId -> { plate, since, ev }
  let blocked = new Set();    // "r,c" of driveway cells closed with cones
  let log = [];               // parking records { id, plate, slot, entry, exit, fee, ev }

  const key = (r, c) => r + ',' + c;
  const cellAt = (r, c) => (cells[r] ? cells[r][c] : undefined);
  const isBay = cell => !!cell && (cell.type === 'slot' || cell.type === 'ev');
  const isFree = cell => isBay(cell) && !occupied[cell.id];
  const isBlocked = (r, c) => blocked.has(key(r, c));
  const isDrivable = cell => !!cell && (cell.type === 'road' || cell.type === 'entrance') && !blocked.has(key(cell.r, cell.c));

  /** Movement rule used by both search algorithms. */
  function canEnter(isGoal) {
    return (to, from) => {
      const cell = cellAt(to.r, to.c);
      if (isGoal(to)) return isBay(cell) ? from.c === to.c : true;   // bays are entered head-on from the aisle
      return isDrivable(cell);
    };
  }

  const usableSlots = ev => slots.filter(s => isFree(s) && (ev || s.type === 'slot'));
  const findPlate = plate => Object.keys(occupied).find(id => occupied[id].plate === plate);

  function stats() {
    const occ = Object.keys(occupied).length;
    const evSlots = slots.filter(s => s.type === 'ev');
    return {
      total: slots.length,
      occupied: occ,
      free: slots.length - occ,
      evTotal: evSlots.length,
      evFree: evSlots.filter(isFree).length,
      revenue: log.filter(e => e.exit).reduce((s, e) => s + e.fee, 0),
      visits: log.length
    };
  }

  /** AI · BFS from the entrance to the nearest free bay of the right type. */
  function allocate(ev) {
    const start = { r: entrance.r, c: entrance.c };
    const search = type => {
      const isGoal = n => { const cell = cellAt(n.r, n.c); return isFree(cell) && cell.type === type; };
      return PS.ai.bfs(grid, start, isGoal, canEnter(isGoal));
    };
    let res = search(ev ? 'ev' : 'slot');
    if (!res.found && ev) { res = search('slot'); res.fallback = res.found; }
    if (res.found) res.slot = cellAt(res.goal.r, res.goal.c);
    return res;
  }

  // Tariff: ₹30 for the first hour, ₹20 for every extra (started) hour
  function fee(entry, exit) {
    const hours = Math.max(1, Math.ceil((exit - entry) / 3600000));
    return 30 + (hours - 1) * 20;
  }

  const nextId = () => log.reduce((m, e) => Math.max(m, e.id), 0) + 1;

  function park(slotId, plate, ev, since) {
    const t = since || Date.now();
    occupied[slotId] = { plate, since: t, ev: !!ev };
    log.push({ id: nextId(), plate, slot: slotId, entry: t, exit: null, fee: 0, ev: !!ev });
    persist();
  }

  function release(slotId) {
    const o = occupied[slotId];
    if (!o) return null;
    const now = Date.now();
    const rec = [...log].reverse().find(e => e.slot === slotId && e.plate === o.plate && !e.exit);
    if (rec) { rec.exit = now; rec.fee = fee(rec.entry, now); }
    delete occupied[slotId];
    persist();
    return { plate: o.plate, fee: rec ? rec.fee : fee(o.since, now) };
  }

  /** COA · 12-bit occupancy register of a zone (bay 1 = most significant bit). */
  function register(zone) {
    let value = 0;
    slots.forEach(s => {
      if (s.zone === zone && occupied[s.id]) value |= 1 << (SLOTS_PER_ZONE - s.num);
    });
    return value;
  }

  function toggleBlocked(r, c) {
    const k = key(r, c);
    if (blocked.has(k)) blocked.delete(k); else blocked.add(k);
    persist();
  }
  function clearBlocked() { blocked = new Set(); persist(); }

  // ---- demo data --------------------------------------------------------
  const STATES = ['MH', 'KA', 'DL', 'TN', 'GJ', 'UP', 'RJ', 'KL', 'TS', 'WB', 'HR', 'PB', 'MP', 'AP'];
  const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  function randomPlate(rand = Math.random) {
    const pick = s => s[Math.floor(rand() * s.length)];
    const district = String(1 + Math.floor(rand() * 40)).padStart(2, '0');
    const series = rand() < 0.8 ? pick(LETTERS) + pick(LETTERS) : pick(LETTERS);
    const number = String(1 + Math.floor(rand() * 9999)).padStart(4, '0');
    return pick(STATES) + district + series + number;
  }

  function seed() {
    occupied = {}; blocked = new Set(); log = [];
    const rand = PS.rng(2024);
    const now = Date.now(), MIN = 60000;
    const used = new Set();
    const plateOnce = () => { let p; do { p = randomPlate(rand); } while (used.has(p)); used.add(p); return p; };

    // cars that already came and left earlier today
    for (let i = 0; i < 12; i++) {
      const entry = now - Math.round((420 - i * 22 + rand() * 15) * MIN);
      const exit = Math.min(entry + Math.round((25 + rand() * 120) * MIN), now - 10 * MIN);
      const slot = slots[Math.floor(rand() * slots.length)];
      log.push({ id: 0, plate: plateOnce(), slot: slot.id, entry, exit, fee: fee(entry, exit), ev: slot.type === 'ev' });
    }
    // cars parked right now
    slots.forEach(s => {
      if (rand() < (s.type === 'ev' ? 0.35 : 0.45)) {
        const since = now - Math.round((8 + rand() * 260) * MIN);
        const plate = plateOnce();
        occupied[s.id] = { plate, since, ev: s.type === 'ev' };
        log.push({ id: 0, plate, slot: s.id, entry: since, exit: null, fee: 0, ev: s.type === 'ev' });
      }
    });
    log.sort((a, b) => a.entry - b.entry).forEach((e, i) => { e.id = i + 1; });
  }

  function persist() {
    PS.store.save('lot', { occupied, blocked: [...blocked], log });
    PS.bus.emit('lot');
  }

  function load() {
    const saved = PS.store.load('lot', null);
    if (saved && saved.occupied && Array.isArray(saved.log)) {
      occupied = saved.occupied;
      blocked = new Set(saved.blocked || []);
      log = saved.log;
    } else {
      seed();
      PS.store.save('lot', { occupied, blocked: [...blocked], log });
    }
  }

  return {
    grid, cells, slots, byId, ZONES, SLOTS_PER_ZONE, RESERVE_HOLD, entrance, lift,
    get occupied() { return occupied; },
    get log() { return log; },
    cellAt, isBay, isFree, isBlocked, isDrivable, canEnter, usableSlots, findPlate, stats,
    allocate, fee, park, release, register, toggleBlocked, clearBlocked, randomPlate, load
  };
})();
