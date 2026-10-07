/* =========================================================
   AI · 2.2        Breadth-First Search (uninformed)
   AI · 2.5 / 2.7  Heuristics & A* Search (informed)
   ML · 3.12/3.13  Linear Regression + Mean Squared Error
   ========================================================= */
PS.ai = (function () {
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];   // up, down, left, right
  const key = p => p.r + ',' + p.c;

  function neighbours(grid, node) {
    const out = [];
    for (const [dr, dc] of DIRS) {
      const r = node.r + dr, c = node.c + dc;
      if (r >= 0 && r < grid.rows && c >= 0 && c < grid.cols) out.push({ r, c });
    }
    return out;
  }

  // Walk back through the parent links to rebuild the route
  function buildPath(parent, endKey) {
    const path = [];
    let k = endKey;
    while (k) {
      const [r, c] = k.split(',').map(Number);
      path.unshift({ r, c });
      k = parent.get(k);
    }
    return path;
  }

  /**
   * Breadth-First Search – FIFO queue, explores the lot ring by ring.
   * isGoal(node)          -> goal test
   * canEnter(to, from)    -> may the car move from `from` into `to`?
   * Every move costs 1, so BFS always returns a shortest route.
   */
  function bfs(grid, start, isGoal, canEnter) {
    const t0 = performance.now();
    const queue = [{ r: start.r, c: start.c }];
    let head = 0;
    const parent = new Map([[key(start), null]]);
    const explored = [];

    while (head < queue.length) {
      const node = queue[head++];
      explored.push(node);
      if (isGoal(node)) {
        return { found: true, goal: node, path: buildPath(parent, key(node)), explored, ms: performance.now() - t0 };
      }
      for (const nb of neighbours(grid, node)) {
        const k = key(nb);
        if (!parent.has(k) && canEnter(nb, node)) {
          parent.set(k, key(node));
          queue.push(nb);
        }
      }
    }
    return { found: false, path: [], explored, ms: performance.now() - t0 };
  }

  // Heuristic h(n): Manhattan distance. It never overestimates on a
  // 4-direction grid, so it is admissible and A* stays optimal.
  const manhattan = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);

  /** A* Search – always expands the node with the lowest f(n) = g(n) + h(n). */
  function astar(grid, start, goal, canEnter, h = manhattan) {
    const t0 = performance.now();
    const goalKey = key(goal);
    const open = [{ node: { r: start.r, c: start.c }, g: 0, h: h(start, goal) }];
    const gScore = new Map([[key(start), 0]]);
    const parent = new Map([[key(start), null]]);
    const closed = new Set();
    const explored = [];

    while (open.length) {
      // pick lowest f (ties -> lower h). A linear scan is enough for a 135-cell lot.
      let best = 0;
      for (let i = 1; i < open.length; i++) {
        const a = open[i], b = open[best];
        const fa = a.g + a.h, fb = b.g + b.h;
        if (fa < fb || (fa === fb && a.h < b.h)) best = i;
      }
      const cur = open.splice(best, 1)[0];
      const ck = key(cur.node);
      if (closed.has(ck)) continue;
      closed.add(ck);
      explored.push(cur.node);

      if (ck === goalKey) {
        return { found: true, goal: cur.node, path: buildPath(parent, ck), explored, cost: cur.g, ms: performance.now() - t0 };
      }
      for (const nb of neighbours(grid, cur.node)) {
        const nk = key(nb);
        if (closed.has(nk) || !canEnter(nb, cur.node)) continue;
        const g = cur.g + 1;
        if (g < (gScore.has(nk) ? gScore.get(nk) : Infinity)) {
          gScore.set(nk, g);
          parent.set(nk, ck);
          open.push({ node: nb, g, h: h(nb, goal) });
        }
      }
    }
    return { found: false, path: [], explored, ms: performance.now() - t0 };
  }

  /**
   * Simple linear regression  ŷ = m·x + c  (ordinary least squares)
   *   m = Σ(x − x̄)(y − ȳ) / Σ(x − x̄)²      c = ȳ − m·x̄
   * Cost function: MSE = (1/n) Σ (y − ŷ)²
   */
  function linearRegression(points) {
    const n = points.length;
    if (n < 2) return null;
    const meanX = points.reduce((s, p) => s + p.x, 0) / n;
    const meanY = points.reduce((s, p) => s + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    points.forEach(p => { sxy += (p.x - meanX) * (p.y - meanY); sxx += (p.x - meanX) ** 2; });
    if (sxx === 0) return null;

    const slope = sxy / sxx;
    const intercept = meanY - slope * meanX;
    const predict = x => slope * x + intercept;

    let ssRes = 0, ssTot = 0;
    points.forEach(p => { ssRes += (p.y - predict(p.x)) ** 2; ssTot += (p.y - meanY) ** 2; });
    const mse = ssRes / n;
    return { slope, intercept, predict, mse, rmse: Math.sqrt(mse), r2: ssTot ? 1 - ssRes / ssTot : 1, n, meanX, meanY };
  }

  return { bfs, astar, manhattan, linearRegression, key };
})();
