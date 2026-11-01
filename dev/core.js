// Friction and Screw Lab core (spec 03). Takes the interface state in display
// units (degrees, kg, N, mm), converts to SI, and returns plain results in SI:
// the ramp (weight components, slip, sliding acceleration), measured friction
// statistics, the power screw (geometry, raising and lowering torque, collar
// friction, efficiency, self-locking, root stress) and the back-calculation of
// friction from a measured handle force. It also builds the show-the-working
// steps, the predict-first targets and the drawing description.
// Pure functions; tested in dev/test.js.
const ScrewLab = (function () {
  'use strict';
  const St = typeof Stats !== 'undefined' ? Stats : require('./vendor/stats.js');
  const G = 9.81;                                     // m/s², spec 00 §3
  const isNum = v => typeof v === 'number' && isFinite(v);
  const DEG = Math.PI / 180;
  const MAX_TRIALS = 20;

  // Thread half-angles α (spec 03 §3.2; MechanixCalc, citing ASME B1.5 and ISO 2901).
  const FORMS = {
    square: { label: 'Square', alpha: 0 },
    acme: { label: 'Acme (29° thread)', alpha: 14.5 },
    trap: { label: 'Metric trapezoidal (30° thread)', alpha: 15 },
  };

  const SOURCES = {
    fric: 'OpenStax College Physics 2e, 5.1',
    stress: 'OpenStax College Physics 2e, 5.3',
    shig: "Shigley's Mechanical Engineering Design, ch. 8",
    roy: 'RoyMech, power screws',
    ee: 'Engineers Edge, power screws',
    ms: 'MechSimulator, power screw',
    mx: 'MechanixCalc, power screw notes',
    sd: 'ScienceDirect Topics, power screw',
  };

  function defaultState() {
    return {
      mode: 'sandbox',
      // Ramp (§4)
      rampMode: 'simulate', theta: 15, m: 1, muS: 0.36, muK: 0.30,
      anglesS: '', anglesK: '',
      // Screw (§4)
      W: 2000, d: 20, p: 4, n: 1, form: 'square', mu: 0.15, muFrom: null, linkRamp: false,
      muC: 0, dC: 0, R: 300,
      useOverride: false, dm: 18, dr: 16,
      useFmeas: false, Fmeas: 20,
      zoom: 1,
    };
  }

  // Field rules (spec 03 §4, 00 §8). Units are the display units.
  const FIELDS = {
    theta: { name: 'Angle', unit: '°', min: 0, max: 60 },
    m: { name: 'Mass', unit: 'kg', min: 0.01, max: 50 },
    muS: { name: 'Static friction μs', min: 0, max: 1.5 },
    muK: { name: 'Kinetic friction μk', min: 0, max: 1.5 },
    W: { name: 'Load', unit: 'N', min: 1, max: 100000 },
    d: { name: 'Major diameter', unit: 'mm', min: 2, max: 200 },
    p: { name: 'Pitch', unit: 'mm', min: 0.25, max: 25 },
    n: { name: 'Starts', min: 1, max: 8, integer: true },
    mu: { name: 'Thread friction μ', min: 0.01, max: 1 },        // §4 says 0.5; FS-10 needs 0.6 (ERRATA)
    muC: { name: 'Collar friction μc', min: 0, max: 0.5 },
    dC: { name: 'Collar diameter', unit: 'mm', min: 0, max: 400 },
    R: { name: 'Handle radius', unit: 'mm', min: 10, max: 2000 },
    dm: { name: 'Mean diameter', unit: 'mm', gt: 0, max: 200 },
    dr: { name: 'Root diameter', unit: 'mm', gt: 0, max: 200 },
    Fmeas: { name: 'Measured handle force', unit: 'N', gt: 0, max: 100000 },
  };
  // FS-11 and the measured-diameter rules. Each returns a message or null.
  const pitchCheck = (p, d) => p >= d ? 'Pitch must be smaller than the diameter.' : null;
  function dmCheck(s) {
    if (!s.useOverride) return null;
    if (!(s.dm < s.d)) return 'Mean diameter must be smaller than the major diameter (' + s.d + ' mm).';
    if (!(s.dm > s.dr)) return 'Mean diameter must be larger than the root diameter (' + s.dr + ' mm).';
    return null;
  }
  const drCheck = s => (s.useOverride && !(s.dr < s.dm)) ? 'Root diameter must be smaller than the mean diameter (' + s.dm + ' mm).' : null;

  /* ------------------------------------------------------------ ramp (§3.1) */
  function ramp(s) {
    const th = s.theta * DEG, W = s.m * G;
    const along = W * Math.sin(th), N = W * Math.cos(th);
    const slides = Math.tan(th) > s.muS;
    const slipDeg = Math.atan(s.muS) / DEG;
    // Once sliding (or if pushed to start), kinetic friction acts.
    const aSliding = G * (Math.sin(th) - s.muK * Math.cos(th));
    const fStaticMax = s.muS * N, fKinetic = s.muK * N;
    return {
      th, W, along, N, slides, slipDeg, aSliding, fStaticMax, fKinetic,
      friction: slides ? fKinetic : along,              // a resting block needs only enough to balance
      a: slides ? Math.max(0, aSliding) : 0,
      muAtTheta: Math.tan(th),
      stopsAgain: slides && aSliding <= 0,
    };
  }

  // A list of measured angles in degrees, typed as "20, 21, 19" (commas, spaces or semicolons).
  function parseAngles(text) {
    const raw = String(text == null ? '' : text).replace(/[−–]/g, '-').trim();
    if (raw === '') return { values: [], error: null };
    const parts = raw.split(/[\s,;]+/).filter(x => x !== '');
    if (parts.length > MAX_TRIALS) return { values: [], error: 'Enter up to ' + MAX_TRIALS + ' trials.' };
    const values = [];
    for (let i = 0; i < parts.length; i++) {
      const v = /^[-+]?(\d+\.?\d*|\.\d+)$/.test(parts[i]) ? Number(parts[i]) : NaN;
      if (!isNum(v)) return { values: [], error: 'Trial ' + (i + 1) + ' ("' + parts[i] + '") is not a number.' };
      if (!(v > 0 && v <= 60)) return { values: [], error: 'Trial ' + (i + 1) + ': angles must be more than 0° and at most 60°.' };
      values.push(v);
    }
    return { values, error: null };
  }
  // μ = tan θ for each trial, with the summary (sample standard deviation, QUESTIONS Q12).
  function measured(text) {
    const pa = parseAngles(text);
    const mus = pa.values.map(d => Math.tan(d * DEG));
    return { angles: pa.values, mus, error: pa.error, stats: St.summary(mus) };
  }
  // The value "Send μ to Screw" copies: the kinetic mean, to 3 significant figures (FS-12).
  function rampMu(s) {
    const k = measured(s.anglesK);
    if (k.error || !k.mus.length) return null;
    return Number(k.stats.mean.toPrecision(3));
  }

  /* ------------------------------------------------------------ screw (§3.2–3.4) */
  function geometry(s) {
    const d = s.d / 1000, p = s.p / 1000, l = s.n * p;
    const dm = s.useOverride ? s.dm / 1000 : d - p / 2;
    const dr = s.useOverride ? s.dr / 1000 : d - p;
    const alphaDeg = FORMS[s.form].alpha, alpha = alphaDeg * DEG;
    return { d, p, l, dm, dr, alphaDeg, alpha, lambda: Math.atan(l / (Math.PI * dm)) };
  }

  // Raising torque of the thread alone for a friction value (null when it cannot be turned).
  function raiseTorque(W, dm, l, muPrime) {
    const den = Math.PI * dm - muPrime * l;
    if (!(den > 0)) return null;
    return (W * dm / 2) * (l + Math.PI * muPrime * dm) / den;
  }

  function screw(s) {
    const g = geometry(s), W = s.W, R = s.R / 1000, dC = s.dC / 1000;
    const muPrime = s.mu / Math.cos(g.alpha);                  // μ′ = μ / cos α
    const phi = Math.atan(muPrime);
    const denR = Math.PI * g.dm - muPrime * g.l;
    const TRs = raiseTorque(W, g.dm, g.l, muPrime);
    const TLs = (W * g.dm / 2) * (Math.PI * muPrime * g.dm - g.l) / (Math.PI * g.dm + muPrime * g.l);
    const Tc = W * s.muC * dC / 2;
    const TR = TRs === null ? null : TRs + Tc;
    const TL = TLs + Tc;
    const out = Object.assign({}, g, {
      W, R, dC, muPrime, phi, denR,
      raiseDefined: TRs !== null,
      TRs, TLs, Tc, TR, TL,
      F: TR === null ? null : TR / R,
      Fideal: W * g.l / (2 * Math.PI * R),
      e: TR === null ? null : W * g.l / (2 * Math.PI * TR),
      selfLockThread: Math.PI * muPrime * g.dm > g.l,           // μ′ > tan λ
      overhaulsThread: TLs < 0,
      holdsWithCollar: TL >= 0,                                 // what the release animation follows
      sigma: 4 * W / (Math.PI * g.dr * g.dr),
      tau: TRs === null ? null : 16 * TRs / (Math.PI * Math.pow(g.dr, 3)),   // QUESTIONS Q32: thread torque
      tanSum: (W * g.dm / 2) * Math.tan(phi + g.lambda),        // square thread check line
    });
    if (s.useFmeas) out.back = backCalc(s, out);
    return out;
  }

  // §3.5: find μ so that T_R,total(μ) = F_meas·R, by bisection, with the collar held (QUESTIONS Q14).
  function backCalc(s, sc) {
    const target = s.Fmeas * sc.R;
    const cosA = Math.cos(sc.alpha);
    const total = mu => { const t = raiseTorque(sc.W, sc.dm, sc.l, mu / cosA); return t === null ? null : t + sc.W * s.muC * sc.dC / 2; };
    const eMeas = sc.W * sc.l / (2 * Math.PI * target);
    const T0 = total(0);
    if (target < T0) return { mu: null, eMeas, target, reason: 'The measured force is less than the force with no thread friction at all (' + fmt3(T0 / sc.R) + ' N). Check the measurement.' };
    // Raising torque grows without limit as π d_m − μ′ l falls to 0, so stop just short of that μ.
    const muSing = cosA * Math.PI * sc.dm / sc.l;
    const hi = Math.min(1, muSing * (1 - 1e-9));
    if (target > total(hi)) return { mu: null, eMeas, target, reason: 'No friction value from 0 to 1 gives a force this large.' };
    let lo = 0, up = hi;
    for (let i = 0; i < 200 && up - lo > 1e-13; i++) { const mid = (lo + up) / 2; if (total(mid) < target) lo = mid; else up = mid; }
    return { mu: (lo + up) / 2, eMeas, target, reason: null };
  }
  const fmt3 = v => String(Number(v.toPrecision(3)));

  function solve(s) {
    return { ramp: ramp(s), measS: measured(s.anglesS), measK: measured(s.anglesK), screw: screw(s), rampMu: rampMu(s) };
  }

  /* ------------------------------------------------------------ predict-first targets (§6) */
  // Quantity names are fixed in ecosystem/schemas.md. `hiddenMu` is true in a challenge that
  // hides the surface: the student finds the slip angle and predicts the surface's μs.
  function targets(sol, s, hiddenMu) {
    const sc = sol.screw;
    const cant = 'the screw cannot be turned to lift the load';
    return [
      hiddenMu
        ? { key: 'mu', quantity: 'friction coefficient mu', label: 'μ<sub>s</sub> of this surface', unit: '', model: s.muS }
        : { key: 'mu', quantity: 'friction coefficient mu', label: 'μ if the block slips at θ = ' + fmt3(s.theta) + '°', unit: '', model: sol.ramp.muAtTheta },
      { key: 'TR', quantity: 'torque to raise T_R', label: 'Torque to raise T<sub>R</sub>', unit: 'N·m', model: sc.TR, reason: cant },
      { key: 'F', quantity: 'handle force F', label: 'Handle force F', unit: 'N', model: sc.F, reason: cant },
      { key: 'e', quantity: 'efficiency e', label: 'Efficiency e', unit: '%', model: sc.e === null ? null : sc.e * 100, reason: cant },
      { key: 'lock', quantity: 'self-locking', label: 'Self-locking (thread)?', kind: 'yesno', model: sc.selfLockThread ? 1 : 0 },
    ];
  }

  /* ------------------------------------------------------------ show the working (00 §5) */
  // f(v) formats a number, fu(v, unit) adds a unit. Grouped: Ramp, then Screw.
  function working(sol, s, f, fu, hiddenMu) {
    const r = sol.ramp, sc = sol.screw;
    const ramp = [];
    ramp.push({ title: 'Weight', formula: 'W = m g', sub: f(s.m) + ' kg × 9.81 m/s²', result: fu(r.W, 'N'), source: SOURCES.fric });
    ramp.push({ title: 'Component along the ramp', formula: 'W∥ = m g sin θ', sub: f(r.W) + ' N × sin ' + f(s.theta) + '°', result: fu(r.along, 'N'), source: SOURCES.fric });
    ramp.push({ title: 'Normal force', formula: 'N = m g cos θ', sub: f(r.W) + ' N × cos ' + f(s.theta) + '°', result: fu(r.N, 'N'), source: SOURCES.fric });
    if (hiddenMu) {
      ramp.push({ title: 'Slip test', formula: 'slides when tan θ > μs', sub: 'tan ' + f(s.theta) + '° = ' + f(r.muAtTheta), result: r.slides ? 'the block slides' : 'the block holds', note: 'μs is hidden in this challenge. Tilt until the block just slides; then μs ≈ tan θ.', source: SOURCES.fric });
    } else {
      ramp.push({ title: 'Slip test', formula: 'slides when tan θ > μs', sub: 'tan ' + f(s.theta) + '° = ' + f(r.muAtTheta) + (r.slides ? ' > ' : ' ≤ ') + f(s.muS), result: r.slides ? 'the block slides' : 'the block holds', source: SOURCES.fric });
      ramp.push({ title: 'Slip angle', formula: 'θslip = arctan μs', sub: 'arctan ' + f(s.muS), result: f(r.slipDeg) + '°', source: SOURCES.fric });
      ramp.push({ title: 'Acceleration while sliding', formula: 'a = g (sin θ − μk cos θ)', sub: '9.81 × (sin ' + f(s.theta) + '° − ' + f(s.muK) + ' × cos ' + f(s.theta) + '°)', result: fu(r.aSliding, 'm/s²'), note: r.aSliding <= 0 ? 'Zero or negative: a sliding block slows down and stops.' : '', source: SOURCES.fric });
    }
    const mk = sol.measK;
    if (mk.mus.length) {
      ramp.push({ title: 'Measured kinetic μ', formula: 'μ = tan θ for each trial; mean', sub: mk.angles.map(a => 'tan ' + f(a) + '°').join(', ') + ' = ' + mk.mus.map(f).join(', '), result: 'mean ' + f(mk.stats.mean), note: 'Slip-angle measurements are only good to one or two digits.', source: SOURCES.fric });
    }

    const scr = [];
    const mm = v => fu(v * 1000, 'mm');
    scr.push({ title: 'Lead', formula: 'l = n p', sub: s.n + ' × ' + fu(s.p, 'mm'), result: mm(sc.l), source: SOURCES.roy });
    if (s.useOverride) scr.push({ title: 'Mean and root diameter', formula: 'measured', sub: 'd_m = ' + fu(s.dm, 'mm') + ', d_r = ' + fu(s.dr, 'mm'), result: mm(sc.dm) + ', ' + mm(sc.dr), source: SOURCES.shig });
    else scr.push({ title: 'Mean and root diameter', formula: 'd_m = d − p/2,  d_r = d − p', sub: fu(s.d, 'mm') + ' − ' + fu(s.p / 2, 'mm') + ',  ' + fu(s.d, 'mm') + ' − ' + fu(s.p, 'mm'), result: mm(sc.dm) + ', ' + mm(sc.dr), source: SOURCES.shig });
    scr.push({ title: 'Lead angle', formula: 'λ = arctan(l / (π d_m))', sub: 'arctan(' + mm(sc.l) + ' / (π × ' + mm(sc.dm) + '))', result: f(sc.lambda / DEG) + '°', source: SOURCES.shig });
    scr.push({ title: 'Effective friction', formula: 'μ′ = μ / cos α', sub: f(s.mu) + ' / cos ' + f(sc.alphaDeg) + '°', result: f(sc.muPrime) + ',  φ = arctan μ′ = ' + f(sc.phi / DEG) + '°', source: SOURCES.mx });
    const Wdm2 = f(s.W) + ' N × ' + mm(sc.dm) + ' / 2';
    if (sc.raiseDefined) {
      scr.push({ title: 'Torque to raise (thread)', formula: 'T_R = (W d_m / 2) (l + π μ′ d_m) / (π d_m − μ′ l)', sub: Wdm2 + ' × (' + mm(sc.l) + ' + π × ' + f(sc.muPrime) + ' × ' + mm(sc.dm) + ') / (π × ' + mm(sc.dm) + ' − ' + f(sc.muPrime) + ' × ' + mm(sc.l) + ')', result: fu(sc.TRs, 'N·m'), source: SOURCES.shig + ' (eq. 8-1); ' + SOURCES.ms });
      if (s.form === 'square') scr.push({ title: 'Same torque, tangent form', formula: 'T_R = (W d_m / 2) tan(φ + λ)', sub: Wdm2 + ' × tan(' + f(sc.phi / DEG) + '° + ' + f(sc.lambda / DEG) + '°)', result: fu(sc.tanSum, 'N·m'), note: 'The thread is a ramp wrapped around the screw: friction angle plus lead angle.', source: SOURCES.shig });
    } else {
      scr.push({ title: 'Torque to raise (thread)', formula: 'π d_m − μ′ l > 0 is needed', sub: 'π × ' + mm(sc.dm) + ' − ' + f(sc.muPrime) + ' × ' + mm(sc.l) + ' = ' + mm(sc.denR), result: 'not defined', note: 'With this much friction on this steep a thread, the screw cannot be turned to lift the load.', source: SOURCES.shig });
    }
    scr.push({ title: 'Torque to lower (thread)', formula: 'T_L = (W d_m / 2) (π μ′ d_m − l) / (π d_m + μ′ l)', sub: Wdm2 + ' × (π × ' + f(sc.muPrime) + ' × ' + mm(sc.dm) + ' − ' + mm(sc.l) + ') / (π × ' + mm(sc.dm) + ' + ' + f(sc.muPrime) + ' × ' + mm(sc.l) + ')', result: fu(sc.TLs, 'N·m'), note: sc.TLs < 0 ? 'Negative: the load drives the screw down by itself (it overhauls).' : '', source: SOURCES.shig });
    if (s.muC > 0 && s.dC > 0) {
      scr.push({ title: 'Collar friction torque', formula: 'T_c = W μ_c d_c / 2', sub: f(s.W) + ' N × ' + f(s.muC) + ' × ' + fu(s.dC, 'mm') + ' / 2', result: fu(sc.Tc, 'N·m'), source: SOURCES.roy });
      if (sc.raiseDefined) scr.push({ title: 'Total torque to raise', formula: 'T_R,total = T_R + T_c', sub: fu(sc.TRs, 'N·m') + ' + ' + fu(sc.Tc, 'N·m'), result: fu(sc.TR, 'N·m'), source: SOURCES.roy });
      scr.push({ title: 'Total torque to lower', formula: 'T_L,total = T_L + T_c', sub: fu(sc.TLs, 'N·m') + ' + ' + fu(sc.Tc, 'N·m'), result: fu(sc.TL, 'N·m'), source: SOURCES.roy });
    }
    scr.push({ title: 'Self-locking (thread)', formula: 'π μ′ d_m > l', sub: 'π × ' + f(sc.muPrime) + ' × ' + mm(sc.dm) + ' = ' + mm(Math.PI * sc.muPrime * sc.dm) + (sc.selfLockThread ? ' > ' : ' ≤ ') + mm(sc.l), result: sc.selfLockThread ? 'yes' : 'no', source: SOURCES.shig });
    scr.push({ title: 'Holds when let go', formula: 'T_L,total ≥ 0', sub: fu(sc.TL, 'N·m'), result: sc.holdsWithCollar ? 'yes, it holds' : 'no, the load drops', note: !sc.selfLockThread && sc.holdsWithCollar ? 'The thread alone would overhaul, but collar friction holds the load.' : '', source: SOURCES.roy });
    if (sc.raiseDefined) {
      scr.push({ title: 'Handle force', formula: 'F = T_R,total / R', sub: fu(sc.TR, 'N·m') + ' / ' + fu(s.R, 'mm'), result: fu(sc.F, 'N'), source: SOURCES.roy });
      scr.push({ title: 'Efficiency', formula: 'e = W l / (2π T_R,total)', sub: f(s.W) + ' N × ' + mm(sc.l) + ' / (2π × ' + fu(sc.TR, 'N·m') + ')', result: fu(sc.e * 100, '%'), source: SOURCES.ee + '; ' + SOURCES.ms });
    }
    scr.push({ title: 'Handle force with no friction', formula: 'F_ideal = W l / (2π R)', sub: f(s.W) + ' N × ' + mm(sc.l) + ' / (2π × ' + fu(s.R, 'mm') + ')', result: fu(sc.Fideal, 'N'), note: 'Work in equals work out.', source: SOURCES.ee });
    scr.push({ title: 'Compressive stress at the root', formula: 'σ = 4W / (π d_r²)', sub: '4 × ' + f(s.W) + ' N / (π × (' + mm(sc.dr) + ')²)', result: fu(sc.sigma / 1e6, 'MPa'), source: SOURCES.stress });
    if (sc.raiseDefined) scr.push({ title: 'Torsional shear stress at the root', formula: 'τ = 16 T_R / (π d_r³)', sub: '16 × ' + fu(sc.TRs, 'N·m') + ' / (π × (' + mm(sc.dr) + ')³)', result: fu(sc.tau / 1e6, 'MPa'), note: 'A long screw is also a column, which designers check for buckling.', source: SOURCES.shig + '; ' + SOURCES.sd });
    if (sc.back) {
      const b = sc.back;
      scr.push({ title: 'Friction from the measured force', formula: 'find μ so that T_R,total(μ) = F_meas R', sub: fu(s.Fmeas, 'N') + ' × ' + fu(s.R, 'mm') + ' = ' + fu(b.target, 'N·m'), result: b.mu === null ? 'no fit' : 'μ = ' + f(b.mu), note: b.reason || 'Found by halving the interval from μ = 0 to 1 until the torques agree.', source: SOURCES.shig });
      scr.push({ title: 'Measured efficiency', formula: 'e_meas = W l / (2π F_meas R)', sub: f(s.W) + ' N × ' + mm(sc.l) + ' / (2π × ' + fu(b.target, 'N·m') + ')', result: fu(b.eMeas * 100, '%'), source: SOURCES.ee });
    }
    return [{ heading: 'Ramp', steps: ramp }, { heading: 'Screw', steps: scr }];
  }

  /* ------------------------------------------------------------ description for screen readers */
  function describe(sol, s, fu, masked, hiddenMu) {
    const r = sol.ramp, sc = sol.screw;
    let t = 'Ramp at ' + fu(s.theta, 'degrees') + ' with a ' + fu(s.m, 'kilogram') + ' block. ';
    if (!masked) t += r.slides ? 'The block slides' + (r.a > 0 ? ' at ' + fu(r.a, 'm/s²') : ' but slows to a stop') + '. ' : 'The block holds. ';
    t += 'Screw jack with a ' + FORMS[s.form].label.toLowerCase() + ' thread, ' + fu(s.d, 'mm') + ' diameter, ' + fu(s.p, 'mm') + ' pitch, ' + s.n + (s.n === 1 ? ' start' : ' starts') + ', lifting ' + fu(s.W, 'N') + '. ';
    t += 'Lead angle ' + fu(sc.lambda / DEG, 'degrees') + '. ';
    if (!masked) t += sc.raiseDefined ? 'Torque to raise ' + fu(sc.TR, 'N·m') + '. ' : 'The screw cannot be turned to lift the load. ';
    if (!masked) t += sc.holdsWithCollar ? 'Let go and the load holds.' : 'Let go and the load drops.';
    return t;
  }

  /* ------------------------------------------------------------ inputs snapshot (SI) for the log */
  function snapshot(s) {
    const g = geometry(s);
    return {
      values: { theta: s.theta * DEG, m: s.m, muS: s.muS, muK: s.muK, W: s.W, d: g.d, p: g.p, n: s.n, alpha: g.alpha, mu: s.mu, muC: s.muC, dC: s.dC / 1000, R: s.R / 1000, dm: g.dm, dr: g.dr, Fmeas: s.useFmeas ? s.Fmeas : null },
      units: { theta: 'rad', m: 'kg', muS: '', muK: '', W: 'N', d: 'm', p: 'm', n: '', alpha: 'rad', mu: '', muC: '', dC: 'm', R: 'm', dm: 'm', dr: 'm', Fmeas: 'N' },
    };
  }

  return { G, FORMS, SOURCES, MAX_TRIALS, defaultState, FIELDS, pitchCheck, dmCheck, drCheck, ramp, parseAngles, measured, rampMu, geometry, raiseTorque, screw, backCalc, solve, targets, working, describe, snapshot };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ScrewLab;
