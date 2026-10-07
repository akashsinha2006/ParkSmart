/* =========================================================
   FLAT · 1.5  Deterministic Finite Automata
   FLAT · 2.1  Regular Expressions
   ---------------------------------------------------------
   Indian number-plate format:   LL DD (L | LL) DDDD
       MH 12 AB 1234     KA 05 M 7890
   L = letter A–Z, D = digit 0–9
   ========================================================= */
PS.flat = (function () {
  // The input alphabet is grouped into two symbol classes.
  function symbolClass(ch) {
    if (ch >= 'A' && ch <= 'Z') return 'L';
    if (ch >= '0' && ch <= '9') return 'D';
    return '?';
  }

  // M = (Q, Σ, δ, q0, F)
  const dfa = {
    states: ['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'],
    dead: 'qx',                     // trap state (shown as q∅ in the UI)
    start: 'q0',
    accepting: ['q10'],
    delta: {
      q0: { L: 'q1' },
      q1: { L: 'q2' },
      q2: { D: 'q3' },
      q3: { D: 'q4' },
      q4: { L: 'q5' },
      q5: { L: 'q6', D: 'q7' },     // series can be one letter (go straight to digits) or two
      q6: { D: 'q7' },
      q7: { D: 'q8' },
      q8: { D: 'q9' },
      q9: { D: 'q10' },
      q10: {}
    },
    meaning: {
      q0: 'start – nothing read yet',
      q1: '1st letter of state code read',
      q2: 'state code complete (e.g. MH)',
      q3: '1st district digit read',
      q4: 'district code complete (e.g. 12)',
      q5: '1 series letter read',
      q6: '2 series letters read',
      q7: '1st digit of number read',
      q8: '2nd digit of number read',
      q9: '3rd digit of number read',
      q10: 'complete plate (accepting)',
      qx: 'dead / trap state'
    }
  };

  const name = q => (q === dfa.dead ? 'q∅' : q);

  // Remove spaces, hyphens and dots and use capitals: "mh-12 ab 1234" -> "MH12AB1234"
  function normalize(raw) {
    return String(raw || '').toUpperCase().replace(/[\s\-.]/g, '');
  }

  // δ(q, a) – any missing transition goes to the dead state, which loops on itself
  function transition(state, ch) {
    if (state === dfa.dead) return dfa.dead;
    return dfa.delta[state][symbolClass(ch)] || dfa.dead;
  }

  function expectedAt(state) {
    const keys = Object.keys(dfa.delta[state] || {});
    if (!keys.length) return 'end of input';
    return keys.map(k => (k === 'L' ? 'a letter (A–Z)' : 'a digit (0–9)')).join(' or ');
  }

  function explain(input, steps, final) {
    if (!input.length) return 'Empty input – nothing to validate';
    if (final === dfa.dead) {
      const bad = steps.find(s => s.to === dfa.dead);
      return `Position ${bad.index + 1}: expected ${expectedAt(bad.from)} but found '${bad.ch}'`;
    }
    return `Input ended in ${final} (${dfa.meaning[final]}) – still expecting ${expectedAt(final)}`;
  }

  // Run the automaton on a string and record every transition
  function run(raw) {
    const input = normalize(raw);
    let state = dfa.start;
    const steps = [];
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      const next = transition(state, ch);
      steps.push({ index: i, ch, cls: symbolClass(ch), from: state, to: next });
      state = next;
    }
    const accepted = dfa.accepting.includes(state);
    return {
      input, steps, final: state, accepted,
      reason: accepted ? 'Valid Indian number plate' : explain(input, steps, state)
    };
  }

  // Equivalent regular expression (Kleene's theorem: every DFA has an equivalent regex)
  const regexSource = '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$';
  const regex = new RegExp(regexSource);
  const regexTest = raw => regex.test(normalize(raw));

  return { dfa, name, symbolClass, normalize, transition, run, expectedAt, regexSource, regexTest };
})();
