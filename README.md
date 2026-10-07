# ParkSmart — Intelligent Parking Management System

A web app that solves a real-world problem using topics from four subjects:
**AI/ML**, **Design & Analysis of Algorithms**, **Computer Organization & Architecture**
and **Formal Languages & Automata Theory**.

## Problem statement

Shopping-mall car parks fill up quickly at weekends. Drivers waste time and fuel circling for a free bay,
guards check number plates by hand, the few EV chargers get double-booked, and management has no early
warning of rush days. ParkSmart automates the whole journey from the gate to the bay.

## Objectives

1. Validate number plates automatically at the gate.
2. Decide in hardware logic when the barrier may open.
3. Send each car to the nearest free bay along the shortest route.
4. Book the EV charger so the maximum number of cars get a charge.
5. Keep searchable parking records and forecast tomorrow's demand.

## Topics used

| Subject | Topic | Concept | Where it is used | Code |
|---|---|---|---|---|
| FLAT | 1.5 | Deterministic Finite Automata | Validates Indian number plates (`LL DD L(L) DDDD`) | `js/algorithms/flat.js` → `run()` |
| FLAT | 2.1 | Regular Expressions | Equivalent regex cross-checks every DFA verdict (Kleene's theorem) | `flat.js` → `regexTest()` |
| AI | 2.2 | Breadth-First Search | Finds the nearest free bay for each arriving car | `js/algorithms/ai.js` → `bfs()` |
| AI | 2.5, 2.7 | Heuristics & A* Search | Route guidance with the Manhattan heuristic, compared with BFS | `ai.js` → `astar()` |
| ML | 3.12, 3.13 | Linear Regression & MSE | Predicts peak parking demand from mall footfall | `ai.js` → `linearRegression()` |
| DAA | 2.8 | Merge Sort | Sorts parking records; sorts EV bookings by finish time | `js/algorithms/daa.js` → `mergeSort()` |
| DAA | 2.3 | Binary Search | Finds a vehicle by plate in O(log n) | `daa.js` → `binarySearch()` |
| DAA | 3.3 | Activity Selection (Greedy) | Maximises cars served by one EV charger | `daa.js` → `activitySelection()` |
| COA | 1.6 | Number Systems | Zone occupancy registers in binary / octal / decimal / hex | `js/algorithms/coa.js` → `toBase()` |
| COA | 1.9 | Logic Gates & Boolean Algebra | Barrier controller `OPEN = V·P·(S+R)` | `coa.js` → `barrier()` |
| COA | 3.1 | Pipelining | 4-stage entry lane, speedup = nk / (k + n − 1) | `coa.js` → `pipeline()` |

## How one car flows through all four subjects

```
Car arrives ─► [FLAT] DFA checks plate ─► [COA] logic gates open barrier
            ─► [AI] BFS assigns nearest bay ─► [COA] register bit set to 1
            ─► [DAA] record logged (merge sort + binary search later)
```

Try it on the **Dashboard**: type a plate (or press the shuffle button) and click **Admit vehicle**.

## Pages

| Page | What you can do |
|---|---|
| Dashboard | Live lot map, KPIs, admit a car through the full pipeline, bill and release parked cars |
| Plate Validator | Step through the DFA symbol by symbol, see the state diagram, trace table, regex and a batch checker |
| Smart Navigator | Run BFS and A* side by side, pick any destination, place cones to block driveways |
| Demand Forecast | Regression line, residuals, MSE / R², a "predict tomorrow" slider; add your own data points |
| EV Charging | Add booking requests and watch the greedy algorithm accept or reject each one |
| Vehicle Records | Merge sort by any key (with comparison counts), binary search with a step-by-step view |
| Gate Hardware | Interactive logic circuit + truth table, 12-bit slot registers, animated pipeline diagram |
| Syllabus Map | This mapping inside the app |

## How to run

No installation or internet connection is needed (fonts fall back to system fonts when offline).

- **Easiest:** double-click `index.html` to open it in Chrome, Edge or Firefox.
- **Or** serve the folder locally:
  ```bash
  python -m http.server 8000
  ```
  then open http://localhost:8000

Data is saved in the browser's localStorage. Use **Reset demo data** in the sidebar to start fresh.

## Project structure

```
ParkSmart/
├── index.html              all pages (single-page app, hash routing)
├── css/
│   ├── base.css            design tokens, layout, buttons, forms, tables, dark mode
│   └── modules.css         styles for each module
└── js/
    ├── core.js             namespace, event bus, storage, formatting
    ├── lot.js              parking-lot map and shared state (bays, log, cones)
    ├── algorithms/         ← the syllabus topics, written from scratch
    │   ├── flat.js         DFA + regex
    │   ├── ai.js           BFS, A*, linear regression
    │   ├── daa.js          merge sort, binary search, activity selection
    │   └── coa.js          number systems, logic gates, pipelining
    ├── ui/                 one file per page + shared helpers
    └── app.js              router, theme toggle, clock
```

## Complexity summary

| Algorithm | Time | Space |
|---|---|---|
| DFA run | O(n), n = plate length | O(1) |
| BFS | O(V + E) | O(V) |
| A* (linear-scan open list) | O(V²) worst case on this small grid | O(V) |
| Linear regression (OLS) | O(n) | O(1) |
| Merge sort | O(n log n) | O(n) |
| Binary search | O(log n) | O(1) |
| Activity selection | O(n log n) for the sort + O(n) scan | O(n) |

