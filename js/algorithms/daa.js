/* =========================================================
   DAA · 2.8  Merge Sort            O(n log n), stable
   DAA · 2.3  Binary Search         O(log n)
   DAA · 3.3  Activity Selection    Greedy – earliest finish time
   ========================================================= */
PS.daa = (function () {
  /** Merge Sort – split in half, sort each half recursively, merge. */
  function mergeSort(items, compare) {
    let comparisons = 0;

    function merge(left, right) {
      const out = [];
      let i = 0, j = 0;
      while (i < left.length && j < right.length) {
        comparisons++;
        if (compare(left[i], right[j]) <= 0) out.push(left[i++]);
        else out.push(right[j++]);
      }
      while (i < left.length) out.push(left[i++]);
      while (j < right.length) out.push(right[j++]);
      return out;
    }

    function sort(arr) {
      if (arr.length <= 1) return arr;
      const mid = Math.floor(arr.length / 2);
      return merge(sort(arr.slice(0, mid)), sort(arr.slice(mid)));
    }

    return { sorted: sort(items.slice()), comparisons };
  }

  /** Binary Search on a sorted array – halves the search range every step. */
  function binarySearch(sorted, target, keyOf) {
    let lo = 0, hi = sorted.length - 1;
    const steps = [];
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const k = keyOf(sorted[mid]);
      const cmp = k === target ? 0 : (k < target ? -1 : 1);
      steps.push({ lo, hi, mid, key: k, cmp });
      if (cmp === 0) return { index: mid, steps };
      if (cmp < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    return { index: -1, steps };
  }

  // How many comparisons a plain linear scan would need (for comparison)
  function linearSearchCost(arr, target, keyOf) {
    const i = arr.findIndex(x => keyOf(x) === target);
    return i === -1 ? arr.length : i + 1;
  }

  /**
   * Activity Selection – one EV charger, many booking requests.
   * Greedy choice: sort by finish time, take every request that starts
   * at or after the finish of the last accepted one. Gives the maximum
   * number of non-overlapping bookings.
   */
  function activitySelection(requests) {
    const { sorted } = mergeSort(requests, (a, b) => a.end - b.end || a.start - b.start);
    const selected = [], decisions = [];
    let lastEnd = -Infinity, lastPicked = null;
    for (const r of sorted) {
      if (r.start >= lastEnd) {
        selected.push(r);
        decisions.push({ req: r, accepted: true, prevEnd: lastEnd });
        lastEnd = r.end;
        lastPicked = r;
      } else {
        decisions.push({ req: r, accepted: false, conflict: lastPicked });
      }
    }
    return { sorted, selected, decisions };
  }

  /** Chargers needed to serve every request = max overlap (sweep line). */
  function maxOverlap(requests) {
    const events = [];
    requests.forEach(r => { events.push([r.start, 1]); events.push([r.end, -1]); });
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);   // an end frees the charger before a start at the same time
    let cur = 0, best = 0;
    events.forEach(e => { cur += e[1]; best = Math.max(best, cur); });
    return best;
  }

  return { mergeSort, binarySearch, linearSearchCost, activitySelection, maxOverlap };
})();
