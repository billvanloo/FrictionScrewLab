// Confirms the code inlined in index.html is exactly the tested code, then runs
// spec cases on the inline copy. Run: node dev/verify-html.js   (--fix copies dev/core.js in)
'use strict';
const path = require('path');
const vb = require('./vendor/verify-blocks.js');
const root = path.join(__dirname, '..');
if (process.argv.includes('--fix') && vb.syncCore(root)) console.log('Copied dev/core.js into index.html.');
let passed = 0, failed = 0;
const ok = (n, c, d) => { if (c) { passed++; console.log('  PASS ' + n); } else { failed++; console.log('  FAIL ' + n + (d ? ': ' + d : '')); } };
const near = (n, g, e) => ok(n, typeof g === 'number' && (Math.abs(e) < 1 ? Math.abs(g - e) <= 0.01 : Math.abs(g - e) / Math.abs(e) <= 0.005), 'got ' + g + ', expected ' + e);

console.log('Inline blocks match dev/core.js and dev/vendor/');
const problems = vb.verify(root);
problems.forEach(p => ok(p, false));
ok('every inline block matches its tested copy', problems.length === 0);

console.log('Inline copy runs the spec cases');
const Stats = vb.loadInline(root, 'vendor:stats.js');
const Lab = vb.loadInline(root, 'core', { Stats });
const s = Lab.screw(Lab.defaultState());
near('FS-4 T_R (inline, default state)', s.TR, 4.02);
near('FS-4 e (inline)', s.e * 100, 31.7);
near('FS-1 slip angle (inline, default state)', Lab.ramp(Lab.defaultState()).slipDeg, 19.8);
ok('FS-12 rampMu (inline)', Lab.rampMu(Object.assign(Lab.defaultState(), { anglesK: '20, 21, 19' })) === 0.364);
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
