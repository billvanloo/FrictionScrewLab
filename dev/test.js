// Friction and Screw Lab: every test case in spec 03 §7 (FS-1 to FS-12), run
// through the tool core in display units exactly as the interface uses it, plus
// the prediction records for the predict-first targets (spec 07).
// Run: node dev/test.js
'use strict';
const Lab = require('./core.js');
const Shell = require('./vendor/shell.js');
const PL = require('./vendor/prediction-log.js');

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? ': ' + detail : '')); }
}
// 00 §10: 0.5% relative, or 0.01 in the displayed unit for values under 1.
function near(name, got, exp) {
  const good = typeof got === 'number' && isFinite(got) &&
    (Math.abs(exp) < 1 ? Math.abs(got - exp) <= 0.01 : Math.abs(got - exp) / Math.abs(exp) <= 0.005);
  ok(name, good, 'got ' + got + ', expected ' + exp);
}
const st = o => Object.assign(Lab.defaultState(), o);
const scr = o => Lab.screw(st(o));
const DEG = Math.PI / 180;
const f = v => Shell.util.fmtSig(v, 3), fu = (v, u) => f(v) + (u ? ' ' + u : '');
const MPa = v => v / 1e6, mm = v => v * 1000, deg = v => v / DEG;
const FS4 = { W: 2000, d: 20, p: 4, n: 1, form: 'square', mu: 0.15, muC: 0, dC: 0, R: 300 };

console.log('FS-1: slip angle');
{
  const r = Lab.ramp(st({ muS: 0.36 }));
  near('FS-1 slips above 19.8°', r.slipDeg, 19.8);
  ok('FS-1 holds at 19.7°', !Lab.ramp(st({ muS: 0.36, theta: 19.7 })).slides);
  ok('FS-1 slides at 19.9°', Lab.ramp(st({ muS: 0.36, theta: 19.9 })).slides);
  ok('a block exactly at tan θ = μs holds (slides only when tan θ > μs)', !Lab.ramp(st({ muS: Math.tan(20 * DEG), theta: 20 })).slides);
}

console.log('FS-2: sliding acceleration');
{
  const r = Lab.ramp(st({ theta: 30, muK: 0.30 }));
  near('FS-2 a = 2.36 m/s²', r.aSliding, 2.36);
  ok('FS-2 the block is sliding at 30° (tan 30° > 0.36)', r.slides && r.a === r.aSliding);
  near('weight components: along', r.along, 1 * 9.81 * 0.5);
  near('weight components: normal force', r.N, 1 * 9.81 * Math.cos(30 * DEG));
  const slow = Lab.ramp(st({ theta: 20, muS: 0.3, muK: 0.4 }));
  ok('μk above tan θ: once started the block slows and stops (a ≤ 0, shown as 0)', slow.slides && slow.aSliding < 0 && slow.a === 0 && slow.stopsAgain);
  const hold = Lab.ramp(st({ theta: 10 }));
  near('a resting block: friction just balances the slope', hold.friction, hold.along);
}

console.log('FS-3: measured angles');
{
  const m = Lab.measured('20, 21, 19');
  near('FS-3 μ at 20°', m.mus[0], 0.364); near('FS-3 μ at 21°', m.mus[1], 0.384); near('FS-3 μ at 19°', m.mus[2], 0.344);
  near('FS-3 mean 0.364', m.stats.mean, 0.364);
  ok('FS-3 spread: min and max', m.stats.min === m.mus[2] && m.stats.max === m.mus[1]);
  ok('FS-3 sample standard deviation is given', m.stats.sd > 0.019 && m.stats.sd < 0.021, String(m.stats.sd));
  ok('spaces and semicolons work too', Lab.parseAngles('20 21;19').values.join() === '20,21,19');
  ok('blank list: no values and no error', Lab.parseAngles('  ').values.length === 0 && Lab.parseAngles('').error === null);
  ok('not a number is named', Lab.parseAngles('20, x').error === 'Trial 2 ("x") is not a number.');
  ok('out of range', /at most 60°/.test(Lab.parseAngles('20, 75').error));
  ok('more than 20 trials', Lab.parseAngles(Array(21).fill(20).join(',')).error === 'Enter up to 20 trials.');
  ok('a single trial has no standard deviation, and no NaN', Lab.measured('20').stats.sd === null);
}

console.log('FS-4: square thread');
const s4 = scr(FS4);
{
  near('FS-4 l = 4 mm', mm(s4.l), 4); near('FS-4 d_m = 18 mm', mm(s4.dm), 18); near('FS-4 d_r = 16 mm', mm(s4.dr), 16);
  near('FS-4 λ = 4.05°', deg(s4.lambda), 4.05); near('FS-4 φ = 8.53°', deg(s4.phi), 8.53);
  near('FS-4 T_R = 4.02 N·m', s4.TR, 4.02); near('FS-4 T_L = 1.41 N·m', s4.TL, 1.41);
  near('FS-4 F = 13.4 N', s4.F, 13.4); near('FS-4 F_ideal = 4.24 N', s4.Fideal, 4.24);
  near('FS-4 e = 31.7%', s4.e * 100, 31.7);
  ok('FS-4 self-locking yes', s4.selfLockThread === true && s4.holdsWithCollar === true);
  near('FS-4 σ = 9.95 MPa', MPa(s4.sigma), 9.95); near('FS-4 τ = 4.99 MPa', MPa(s4.tau), 4.99);
  near('tangent form gives the same T_R', s4.tanSum, s4.TR);
}

console.log('FS-5: Acme thread');
{
  const s = scr(Object.assign({}, FS4, { form: 'acme' }));
  near('FS-5 μ′ = 0.155', s.muPrime, 0.155); near('FS-5 T_R = 4.11 N·m', s.TR, 4.11); near('FS-5 T_L = 1.50 N·m', s.TL, 1.50);
  near('FS-5 e = 31.0%', s.e * 100, 31.0); ok('FS-5 self-locking yes', s.selfLockThread);
  near('trapezoidal uses α = 15°', scr(Object.assign({}, FS4, { form: 'trap' })).muPrime, 0.15 / Math.cos(15 * DEG));
}

console.log('FS-6: four starts, low friction');
{
  const s = scr(Object.assign({}, FS4, { n: 4, mu: 0.05 }));
  near('FS-6 l = 16 mm', mm(s.l), 16); near('FS-6 T_R = 6.08 N·m', s.TR, 6.08); near('FS-6 T_L = −4.13 N·m', s.TL, -4.13);
  near('FS-6 e = 83.8%', s.e * 100, 83.8);
  ok('FS-6 self-locking no, and on release the load drops', !s.selfLockThread && s.overhaulsThread && !s.holdsWithCollar);
}

console.log('FS-7: double thread with a collar (Shigley-style example)');
const s7 = scr({ W: 6400, d: 32, p: 4, n: 2, form: 'square', mu: 0.08, muC: 0.08, dC: 40, R: 300 });
{
  near('FS-7 d_m = 30 mm', mm(s7.dm), 30); near('FS-7 l = 8 mm', mm(s7.l), 8);
  near('FS-7 T_R screw = 15.94 N·m', s7.TRs, 15.94); near('FS-7 collar = 10.24 N·m', s7.Tc, 10.24); near('FS-7 total = 26.18 N·m', s7.TR, 26.18);
  near('FS-7 T_L screw = −0.466 N·m', s7.TLs, -0.466); near('FS-7 T_L total = 9.77 N·m', s7.TL, 9.77);
  near('FS-7 e = 31.1%', s7.e * 100, 31.1);
}

console.log('FS-8: holds by collar friction');
{
  ok('FS-8 self-locking by thread: no', s7.selfLockThread === false);
  ok('FS-8 holds with collar: yes', s7.holdsWithCollar === true);
  const st7 = st({ W: 6400, d: 32, p: 4, n: 2, mu: 0.08, muC: 0.08, dC: 40 });
  const wk = Lab.working(Lab.solve(st7), st7, f, fu)[1].steps;
  const lock = wk.find(x => x.title === 'Self-locking (thread)'), hold = wk.find(x => x.title === 'Holds when let go');
  ok('FS-8 both statements are in the working', lock.result === 'no' && hold.result === 'yes, it holds' && /collar friction holds/.test(hold.note));
}

console.log('FS-9: back-calculation from a measured force');
{
  const s = Lab.screw(st(Object.assign({}, FS4, { useFmeas: true, Fmeas: 20 })));
  near('FS-9 μ = 0.257', s.back.mu, 0.257); near('FS-9 measured e = 21.2%', s.back.eMeas * 100, 21.2);
  near('the found μ reproduces the force', Lab.raiseTorque(2000, s.dm, s.l, s.back.mu) / 0.3, 20);
  const low = Lab.screw(st(Object.assign({}, FS4, { useFmeas: true, Fmeas: 3 })));
  ok('a force below the frictionless force does not fit', low.back.mu === null && /less than the force with no thread friction/.test(low.back.reason));
  const high = Lab.screw(st(Object.assign({}, FS4, { useFmeas: true, Fmeas: 5000 })));
  ok('a force beyond μ = 1 does not fit', high.back.mu === null && /No friction value from 0 to 1/.test(high.back.reason));
  const col = Lab.screw(st({ W: 6400, d: 32, p: 4, n: 2, mu: 0.08, muC: 0.08, dC: 40, R: 300, useFmeas: true, Fmeas: s7.F }));
  near('with a collar, the back-calculation finds the thread μ (Q14)', col.back.mu, 0.08);
}

console.log('FS-10: when the screw cannot be turned');
{
  const a = scr({ W: 2000, d: 10, p: 8, n: 4, mu: 0.5, R: 300 });
  near('FS-10 π d_m − μ l = 2.85 mm', mm(a.denR), 2.85);
  ok('FS-10 defined at μ = 0.5', a.raiseDefined && a.TR > 0);
  const b = scr({ W: 2000, d: 10, p: 8, n: 4, mu: 0.6, R: 300 });
  near('FS-10 π d_m − μ l = −0.35 mm at μ = 0.6', mm(b.denR), 18.85 - 19.2);
  ok('FS-10 not defined at μ = 0.6, with no NaN', !b.raiseDefined && b.TR === null && b.F === null && b.e === null && b.tau === null && isFinite(b.TL));
  const sb = st({ W: 2000, d: 10, p: 8, n: 4, mu: 0.6 });
  const step = Lab.working(Lab.solve(sb), sb, f, fu)[1].steps.find(x => x.title === 'Torque to raise (thread)');
  ok('FS-10 shows the "cannot be turned" message', step.note === 'With this much friction on this steep a thread, the screw cannot be turned to lift the load.');
  ok('FS-10 μ = 0.6 is accepted by the field (§4 range widened to 1, ERRATA)', Shell.util.validateNumber('0.6', Lab.FIELDS.mu).error === null && Shell.util.validateNumber('1.2', Lab.FIELDS.mu).error !== null);
  ok('FS-10 the targets say why the model has no value', Lab.targets(Lab.solve(sb), sb).find(t => t.key === 'TR').model === null);
}

console.log('FS-11: field checks');
{
  ok('FS-11 pitch 5 on a 4 mm screw', Lab.pitchCheck(5, 4) === 'Pitch must be smaller than the diameter.');
  ok('pitch equal to the diameter is refused too', Lab.pitchCheck(4, 4) !== null && Lab.pitchCheck(4, 20) === null);
  ok('measured mean diameter must sit between root and major', Lab.dmCheck(st({ useOverride: true, dm: 21, dr: 16 })) !== null && Lab.dmCheck(st({ useOverride: true, dm: 15, dr: 16 })) !== null && Lab.dmCheck(st({ useOverride: true })) === null);
  ok('measured root diameter must be under the mean', Lab.drCheck(st({ useOverride: true, dm: 18, dr: 18 })) !== null);
  const o = scr(Object.assign({}, FS4, { useOverride: true, dm: 17.5, dr: 15.5 }));
  near('measured diameters are used', mm(o.dm), 17.5);
}

console.log('FS-12: Ramp to Screw link');
{
  ok('FS-12 mean μ sent is 0.364', Lab.rampMu(st({ anglesK: '20, 21, 19' })) === 0.364);
  ok('nothing to send without kinetic trials', Lab.rampMu(st({ anglesK: '', anglesS: '20' })) === null);
  ok('nothing to send while the list has an error', Lab.rampMu(st({ anglesK: '20, x' })) === null);
}

console.log('Show the working (acceptance: tangent form for square threads)');
{
  const s = st(FS4), w = Lab.working(Lab.solve(s), s, f, fu);
  ok('grouped as Ramp, then Screw', w.length === 2 && w[0].heading === 'Ramp' && w[1].heading === 'Screw');
  const tr = w[1].steps.find(x => x.title === 'Torque to raise (thread)'), tan = w[1].steps.find(x => x.title === 'Same torque, tangent form');
  ok('square: tan(φ + λ) line with matching numbers', !!tan && tan.result === tr.result && tan.result === '4.02 N·m', tan && tan.result);
  const sa = st(Object.assign({}, FS4, { form: 'acme' }));
  ok('Acme: no tangent line', !Lab.working(Lab.solve(sa), sa, f, fu)[1].steps.some(x => x.title === 'Same torque, tangent form'));
  ok('every step names a source', w.every(g => g.steps.every(x => x.source)));
  const txt = JSON.stringify(Lab.working(Lab.solve(st({ W: 2000, d: 10, p: 8, n: 4, mu: 0.6, useFmeas: true })), st({ W: 2000, d: 10, p: 8, n: 4, mu: 0.6, useFmeas: true }), f, fu));
  ok('no NaN or Infinity in the working when T_R is not defined', !/NaN|Infinity|undefined/.test(txt));
  const hid = Lab.working(Lab.solve(st()), st(), f, fu, true)[0].steps;
  ok('a hidden-μ challenge keeps μs out of the working', !JSON.stringify(hid).includes('0.36') && !hid.some(x => x.title === 'Slip angle'));
}

console.log('Predict-first targets and log records (spec 07)');
{
  const s = st(FS4), sol = Lab.solve(s), t = Lab.targets(sol, s);
  ok('five targets with the shared quantity names', t.map(x => x.quantity).join('|') === 'friction coefficient mu|torque to raise T_R|handle force F|efficiency e|self-locking');
  near('e target is in percent', t.find(x => x.key === 'e').model, 31.7);
  ok('self-locking is a yes/no target, model 1', t.find(x => x.key === 'lock').kind === 'yesno' && t.find(x => x.key === 'lock').model === 1);
  near('μ target from the ramp angle (θ = 15°)', t[0].model, Math.tan(15 * DEG));
  ok('hidden-μ challenge: μ target is the surface μs', Lab.targets(sol, s, true)[0].model === 0.36);
  const rec = PL.makeRecord({ tool: 'Friction and Screw Lab', toolVersion: '1.0.0', student: 'A', problemId: 'FS-4', quantity: t[2].quantity, unit: 'N', predicted: 12, model: t[2].model, attempt: 1, inputs: Lab.snapshot(s) });
  near('record percent difference for F (12 vs 13.4)', rec.pctPredVsModel, (12 - s4.F) / s4.F * 100);
  ok('record holds the inputs in SI', rec.inputs.values.d === 0.02 && rec.inputs.units.d === 'm');
}

console.log('Description');
{
  const s = st(FS4), d = Lab.describe(Lab.solve(s), s, fu, false);
  ok('names the thread, the torque and what happens on release', /square thread/.test(d) && /4.02 N·m/.test(d) && /holds/.test(d));
  ok('masked description does not give the answer', !/4.02/.test(Lab.describe(Lab.solve(s), s, fu, true)));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
