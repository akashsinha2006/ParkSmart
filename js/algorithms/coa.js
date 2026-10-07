/* =========================================================
   COA · 1.6  Number Systems              (binary / octal / decimal / hex)
   COA · 1.9  Logic Gates & Boolean Algebra (barrier controller)
   COA · 3.1  Pipelining                  (stages, throughput, speedup)
   ========================================================= */
PS.coa = (function () {
  /* ---------- 1.6 Number systems ---------- */
  function toBase(value, base, width = 1) {
    return value.toString(base).toUpperCase().padStart(width, '0');
  }
  function popcount(v) {           // number of 1-bits = occupied bays
    let c = 0;
    while (v) { c += v & 1; v >>>= 1; }
    return c;
  }

  /* ---------- 1.9 Logic gates ---------- */
  const NOT = a => (a ? 0 : 1);
  const AND = (...xs) => (xs.every(Boolean) ? 1 : 0);
  const OR = (...xs) => (xs.some(Boolean) ? 1 : 0);

  /**
   * Inputs:  V = vehicle on sensor loop   P = plate valid (DFA)
   *          S = space available          R = has reservation
   * Outputs: OPEN  = V · P · (S + R)
   *          ALARM = V · ¬P
   *          FULL  = ¬S
   */
  function barrier({ V, P, S, R }) {
    const notP = NOT(P);
    const sOrR = OR(S, R);
    return { notP, sOrR, OPEN: AND(V, P, sOrR), ALARM: AND(V, notP), FULL: NOT(S) };
  }

  function truthTable() {
    const rows = [];
    for (let i = 0; i < 16; i++) {
      const inp = { V: (i >> 3) & 1, P: (i >> 2) & 1, S: (i >> 1) & 1, R: i & 1 };
      rows.push({ ...inp, ...barrier(inp) });
    }
    return rows;
  }

  /* ---------- 3.1 Pipelining ---------- */
  /**
   * n cars, k stages, tp seconds per stage.
   * Non-pipelined time = n · k · tp
   * Pipelined time     = (k + n − 1) · tp
   * Speedup            = n·k / (k + n − 1)   -> approaches k for large n
   */
  function pipeline(n, k, tp) {
    const cycles = k + n - 1;
    const grid = [];                    // grid[stage][cycle] = car index or null
    for (let s = 0; s < k; s++) {
      const row = [];
      for (let t = 0; t < cycles; t++) {
        const car = t - s;
        row.push(car >= 0 && car < n ? car : null);
      }
      grid.push(row);
    }
    const nonPipelined = n * k * tp;
    const pipelined = cycles * tp;
    const speedup = nonPipelined / pipelined;
    return { cycles, grid, nonPipelined, pipelined, speedup, efficiency: speedup / k, throughput: n / pipelined, maxSpeedup: k };
  }

  return { toBase, popcount, NOT, AND, OR, barrier, truthTable, pipeline };
})();
