// Browser checks for the Friction and Screw Lab: the standard shell checks, then
// spec 03's test cases and acceptance criteria through the interface.
// Run: node dev/e2e.js   (needs Playwright: npm i --no-save playwright)
'use strict';
const path = require('path');
const kit = require('./vendor/e2e-kit.js');
const Lab = require('./core.js');

(async () => {
  const t = await kit.start(path.join(__dirname, '..'));
  const { page } = t;
  await kit.standard(t, {
    predictKeys: ['TR', 'F', 'e', 'lock', 'mu'],
    change: async p => { await p.fill('#fsW', '3000'); },
    mutate: async p => { await p.fill('#fsD', '24'); },
    shotDir: path.join(__dirname, '..', 'docs', 'screenshots'), shotName: 'friction-screw-lab',
  });

  const res = () => page.textContent('#shResultsBody');
  const row = async label => page.evaluate(l => { const th = [...document.querySelectorAll('#shResultsBody th')].find(x => x.textContent.trim().startsWith(l)); return th ? th.nextElementSibling.textContent.trim() : null; }, label);
  const fill = async (sel, v) => { await page.fill(sel, String(v)); };
  const setScrew = async o => { for (const [id, v] of Object.entries(o)) await fill('#' + id, v); };
  const z = () => page.evaluate(() => window.__fs.ui.jack.z);
  // The drawing is replaced on every redraw (for example when the sliding block reaches the
  // bottom), so measuring it can land between the old and new element. Measure again if so.
  const boxOf = async sel => { for (let i = 0; i < 20; i++) { const b = await page.locator(sel).first().boundingBox(); if (b) return b; await page.waitForTimeout(50); } throw new Error('no box for ' + sel); };

  console.log('FS-4: the default square thread through the interface');
  await t.fresh();
  t.ok('FS-4 l / dm / dr', (await row('l / d')) === '4.00 / 18.0 / 16.0 mm', await row('l / d'));
  t.ok('FS-4 λ / φ', (await row('Lead angle')) === '4.05° / 8.53°', await row('Lead angle'));
  t.ok('FS-4 T_R 4.02 N·m', (await row('Torque to raise')) === '4.02 N·m');
  t.ok('FS-4 T_L 1.41 N·m', (await row('Torque to lower')) === '1.41 N·m');
  t.ok('FS-4 F / ideal 13.4 / 4.24 N', (await row('Handle force')) === '13.4 / 4.24 N');
  t.ok('FS-4 e 31.7%', (await row('Efficiency')) === '31.7 %');
  t.ok('FS-4 self-locking yes', (await row('Self-locking')) === 'Yes');
  t.ok('FS-4 σ / τ 9.95 / 4.99 MPa', (await row('σ / τ')) === '9.95 / 4.99 MPa');
  await page.click('#shWorking summary');
  const wk = await page.textContent('#shWorkingBody');
  t.ok('working has the tangent form with the same 4.02 N·m', wk.includes('T_R = (W d_m / 2) tan(φ + λ)') && (wk.match(/= 4\.02 N·m/g) || []).length >= 2);

  console.log('FS-5 and FS-6: thread form and starts');
  await page.selectOption('#fsForm', 'acme');
  t.ok('FS-5 μ′ 0.155', (await row('Effective friction')) === '0.155');
  t.ok('FS-5 T_R 4.11 N·m', (await row('Torque to raise')) === '4.11 N·m');
  t.ok('FS-5 e 31.0%', (await row('Efficiency')) === '31.0 %');
  t.ok('Acme: no tangent line in the working', !(await page.textContent('#shWorkingBody')).includes('tan(φ + λ)'));
  await page.selectOption('#fsForm', 'square');
  await setScrew({ fsN: 4, fsMu: 0.05 });
  t.ok('FS-6 T_R 6.08 N·m', (await row('Torque to raise')) === '6.08 N·m');
  t.ok('FS-6 T_L −4.13 N·m, overhauls', (await row('Torque to lower')).startsWith('−4.13 N·m') && (await row('Torque to lower')).includes('overhauls'));
  t.ok('FS-6 e 83.8%', (await row('Efficiency')) === '83.8 %');
  t.ok('FS-6 self-locking no', (await row('Self-locking')) === 'No' && (await row('Holds with collar')) === 'No');

  console.log('Release behaviour matches the lowering torque (acceptance)');
  await page.evaluate(() => Anim.manual(true));
  const releaseCase = async (label, o) => {
    await t.fresh();
    await page.evaluate(() => Anim.manual(true));
    await setScrew(o);
    const st = Object.assign(Lab.defaultState(), { W: +o.fsW || 2000, d: +o.fsD || 20, p: +o.fsP || 4, n: +o.fsN || 1, mu: +o.fsMu || 0.15, muC: +o.fsMuC || 0, dC: +o.fsDC || 0 });
    const expectHold = Lab.screw(st).TL >= 0;
    await page.focus('#fsJack');
    await page.keyboard.down('ArrowUp');
    const z0 = await z();
    await page.evaluate(() => Anim.advanceAll(0.5));
    const z1 = await z();
    await page.keyboard.up('ArrowUp');
    await page.evaluate(() => Anim.advanceAll(3));
    const z2 = await z();
    const held = Math.abs(z2 - z1) < 1e-9;
    t.ok(label + ': ↑ raises the load', z1 > z0 + 0.1, z0 + ' → ' + z1);
    t.ok(label + ': on release it ' + (expectHold ? 'holds' : 'drops'), held === expectHold && (expectHold || z2 === 0), 'z ' + z1 + ' → ' + z2);
    t.ok(label + ': the status line says so', (await page.textContent('#fsDraw')).includes(expectHold ? 'Let go: the load holds.' : 'The load dropped to the bottom.'));
  };
  await releaseCase('FS-4', {});
  await releaseCase('FS-6', { fsN: 4, fsMu: 0.05 });
  await releaseCase('FS-8', { fsW: 6400, fsD: 32, fsN: 2, fsMu: 0.08, fsMuC: 0.08, fsDC: 40 });
  await releaseCase('FS-7 without its collar', { fsW: 6400, fsD: 32, fsN: 2, fsMu: 0.08 });
  await releaseCase('3 starts, μ 0.06', { fsN: 3, fsMu: 0.06 });
  await t.fresh();
  await page.evaluate(() => Anim.manual(true));
  {
    const b = await boxOf('#fsDown');
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    const z0 = await z();
    await page.mouse.down();
    await page.evaluate(() => Anim.advanceAll(0.4));
    t.ok('holding the Lower button lowers the load', (await z()) < z0, z0 + ' → ' + (await z()));
    await page.mouse.up();
  }
  await page.evaluate(() => Anim.manual(false));

  console.log('FS-7 and FS-8: double thread with a collar');
  await t.fresh();
  await setScrew({ fsW: 6400, fsD: 32, fsN: 2, fsMu: 0.08, fsMuC: 0.08, fsDC: 40 });
  t.ok('FS-7 T_R total 26.2 N·m', (await row('Torque to raise')) === '26.2 N·m');
  t.ok('FS-7 thread / collar 15.9 / 10.2 N·m', (await page.textContent('#shResultsBody')).includes('15.9 / 10.2 N·m'));
  t.ok('FS-7 T_L total 9.77 N·m', (await row('Torque to lower')) === '9.77 N·m');
  t.ok('FS-7 e 31.1%', (await row('Efficiency')) === '31.1 %');
  t.ok('FS-8 self-locking by thread: no; holds with collar: yes', (await row('Self-locking')) === 'No' && (await row('Holds with collar')) === 'Yes');
  t.ok('FS-8 both statements in the working', (await page.textContent('#shWorkingBody')).includes('collar friction holds the load'));

  console.log('FS-9: measured handle force');
  await t.fresh();
  await page.check('#fsFm');
  await fill('#fsFmeas', 20);
  t.ok('FS-9 back-calculated μ 0.257', (await row('Back-calculated μ')) === '0.257');
  t.ok('FS-9 measured efficiency 21.2%', (await row('Measured efficiency')) === '21.2 %');
  await fill('#fsFmeas', 3);
  t.ok('a force below the ideal force: no fit, with the reason', (await row('Back-calculated μ')) === 'no fit' && (await res()).includes('Check the measurement'));

  console.log('FS-10: when the screw cannot be turned');
  await t.fresh();
  await setScrew({ fsP: 8, fsD: 10, fsN: 4, fsMu: 0.5 });
  t.ok('FS-10 defined at μ = 0.5', (await row('Torque to raise')).endsWith('N·m'));
  await fill('#fsMu', 0.6);
  t.ok('FS-10 "cannot be turned" at μ = 0.6', (await row('Torque to raise')) === 'cannot be turned' && (await res()).includes('the screw cannot be turned to lift the load'));
  await kit.noBadNumbers(t, 'FS-10 at μ = 0.6');
  await page.focus('#fsJack');
  await page.keyboard.down('ArrowUp'); await page.keyboard.up('ArrowUp');
  t.ok('FS-10 Raise explains instead of turning', (await page.textContent('#shToast')).includes('cannot be turned'));

  console.log('FS-11: pitch and diameter');
  await t.fresh();
  await fill('#fsP', 5); await fill('#fsD', 4);
  t.ok('FS-11 message', (await page.textContent('#fsDErr')) === 'Pitch must be smaller than the diameter.');
  await kit.noBadNumbers(t, 'FS-11');
  await fill('#fsD', 20);
  t.ok('fixing the diameter clears the message and the results come back', (await page.textContent('#fsDErr')) === '' && (await row('Torque to raise')) !== null);
  await fill('#fsD', 4);
  await fill('#fsP', 3);
  t.ok('fixing the pitch instead also clears it', (await page.textContent('#fsDErr')) === '' && (await page.textContent('#fsPErr')) === '');

  console.log('FS-1 and FS-2: the ramp');
  await t.fresh();
  await fill('#fsTh', 19.7);
  t.ok('FS-1 holds at 19.7°', (await row('Slides or holds')) === 'holds' && (await row('Slip angle')) === '19.8°');
  await fill('#fsTh', 19.9);
  t.ok('FS-1 slides at 19.9°', (await row('Slides or holds')) === 'slides');
  await fill('#fsTh', 30);
  t.ok('FS-2 a = 2.36 m/s²', (await row('Acceleration')) === '2.36 m/s²');

  console.log('Ramp: block animation');
  await t.fresh();
  await page.evaluate(() => Anim.manual(true));
  await fill('#fsTh', 30);
  const s0 = await page.evaluate(() => window.__fs.ui.block.s);
  t.ok('the block starts to slide above the slip angle', await page.evaluate(() => window.__fs.ui.block.sliding));
  await page.evaluate(() => Anim.advanceAll(0.2));
  const s1 = await page.evaluate(() => window.__fs.ui.block.s);
  const want = 0.5 * 9.81 * (0.5 - 0.3 * Math.cos(Math.PI / 6)) * 0.2 * 0.2 * 252;
  t.ok('it moves ½ a t² down the ramp (within one frame)', Math.abs((s0 - s1) - want) / want < 0.1, (s0 - s1) + ' px vs ' + want);
  await page.evaluate(() => Anim.advanceAll(3));
  t.ok('it stops at the bottom and says so', !(await page.evaluate(() => window.__fs.ui.block.sliding)) && (await page.textContent('#fsDraw')).includes('reached the bottom'));
  await page.click('#fsReset');
  t.ok('Reset block starts it again from the top', await page.evaluate(() => window.__fs.ui.block.sliding && window.__fs.ui.block.s > 180));
  await page.evaluate(() => Anim.manual(false));

  console.log('Ramp: keyboard and drag');
  await t.fresh();
  await page.focus('#fsTheta');
  await page.keyboard.press('ArrowRight');
  t.ok('→ tilts 0.1°', await page.evaluate(() => window.__app.state.theta === 15.1));
  await page.keyboard.press('Shift+ArrowRight');
  t.ok('Shift+→ tilts 1°', await page.evaluate(() => window.__app.state.theta === 16.1));
  t.ok('focus stays on the handle after a redraw', await page.evaluate(() => document.activeElement && document.activeElement.id === 'fsTheta'));
  const zj = await z();
  await page.keyboard.down('ArrowUp'); await page.keyboard.up('ArrowUp');
  t.ok('↑ on the ramp handle tilts the ramp and does not turn the screw', await page.evaluate(() => window.__app.state.theta === 16.2) && (await z()) === zj && !(await page.evaluate(() => window.__fs.up.active())));
  await page.keyboard.press('End');
  t.ok('End goes to 60°', await page.evaluate(() => window.__app.state.theta === 60));
  t.ok('the handle reports its value', (await page.getAttribute('#fsTheta', 'aria-valuenow')) === '60.00');
  await page.keyboard.press('Home');
  await page.waitForFunction(() => window.__app.state.theta === 0);
  const svgBox = await boxOf('#fsSvg');
  // The handle sits at the top of the ramp: (36 + 252, 262) at 0°. Drag it to 45° from the pivot (36, 262).
  const k = svgBox.width / 680, tx = svgBox.x + (36 + 200 * Math.cos(Math.PI / 4)) * k, ty = svgBox.y + (262 - 200 * Math.sin(Math.PI / 4)) * k;
  await page.mouse.move(svgBox.x + 288 * k, svgBox.y + 262 * k); await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 5 }); await page.mouse.up();
  t.near('dragging the handle sets the angle', await page.evaluate(() => window.__app.state.theta), 45);

  console.log('FS-3 and FS-12: measure mode and the link to the screw');
  await t.fresh();
  await page.selectOption('#fsRM', 'measure');
  await fill('#fsAK', '20, 21, 19');
  const mk = await row('Measured μk');
  t.ok('FS-3 mean 0.364 with spread', mk.startsWith('mean 0.364') && mk.includes('0.344 to 0.384'), mk);
  t.ok('FS-3 dot plot shows the trials', await page.locator('#fsDraw svg rect[fill]').count() > 3 && (await page.textContent('#fsDraw')).includes('mean μk 0.364'));
  t.ok('FS-3 working lists each tan θ', (await page.textContent('#shWorkingBody')).includes('0.364, 0.384, 0.344'));
  await page.click('#fsSend');
  t.ok('FS-12 μ field shows 0.364', (await page.inputValue('#fsMu')) === '0.364');
  t.ok('FS-12 label "from Ramp measurements"', (await page.textContent('#fsMuFrom')) === 'from Ramp measurements' && await page.isVisible('#fsMuFrom'));
  await fill('#fsMu', 0.2);
  t.ok('typing your own μ removes the label', !(await page.isVisible('#fsMuFrom')));
  await page.check('#fsLink');
  t.ok('Use Ramp result links μ to the kinetic mean', (await page.inputValue('#fsMu')) === '0.364');
  await fill('#fsAK', '20, 21, 19, 25');
  t.ok('and follows new trials (mean of tan 20°, 21°, 19°, 25° is 0.390)', (await page.inputValue('#fsMu')) === '0.39', await page.inputValue('#fsMu'));
  await fill('#fsAK', '20, x');
  t.ok('a bad trial is explained', (await page.textContent('#fsAKErr')) === 'Trial 2 ("x") is not a number.');
  await kit.noBadNumbers(t, 'bad measured list');

  console.log('Unrolled thread: true angle and zoom (acceptance)');
  await t.fresh();
  const triAngle = () => page.evaluate(() => {
    const poly = [...document.querySelectorAll('#fsSvg g[clip-path] polygon')][0];
    const pts = poly.getAttribute('points').trim().split(/\s+/).map(q => q.split(',').map(Number));
    return Math.atan2(pts[0][1] - pts[2][1], pts[2][0] - pts[0][0]) * 180 / Math.PI;
  });
  t.ok('λ is drawn at its true angle at ×1', Math.abs((await triAngle()) - 4.0474) < 0.02, String(await triAngle()));
  await page.click('[data-zoom="5"]');
  t.ok('×5 zoom keeps the true angle', Math.abs((await triAngle()) - 4.0474) < 0.02 && (await page.getAttribute('[data-zoom="5"]', 'aria-pressed')) === 'true');
  t.ok('the drawing says it is zoomed', (await page.textContent('#fsDraw')).includes('Unrolled thread (×5)'));
  await page.focus('[data-zoom="10"]'); await page.keyboard.press('Enter');
  t.ok('zoom works from the keyboard', await page.evaluate(() => window.__app.state.zoom === 10));

  console.log('Predict first hides the answers');
  await t.fresh();
  await page.click('#shPredict');
  const dr = await page.textContent('#fsDraw');
  t.ok('φ line and the self-locking label are hidden', dr.includes('φ hidden for now') && !dr.includes('self-locking (φ'));
  t.ok('the targets are blank in the results', (await row('Torque to raise')) === '?' && (await row('Self-locking')) === '?');
  await page.focus('#fsJack'); await page.keyboard.down('ArrowUp'); await page.keyboard.up('ArrowUp');
  t.ok('the jack waits for a checked prediction', (await page.textContent('#shToast')).includes('Check your prediction first'));
  await page.selectOption('#shPf_lock', '0');
  await fill('#shPf_TR', '4');
  await page.click('#shCheck');
  const box = await page.textContent('#shPfBox');
  t.ok('yes/no message', box.includes('You predicted no. The model says yes.'));
  t.ok('T_R within 1% is a match', box.includes('Match'));
  const recs = await page.evaluate(() => window.__app.log.map(r => r.quantity + '=' + r.predicted + '/' + r.model + '/' + r.unit));
  t.ok('records use the shared quantity names', recs.includes('self-locking=0/1/yes/no') && recs.some(r => r.startsWith('torque to raise T_R=4/')), recs.join('; '));
  t.ok('after Check the φ line shows', (await page.textContent('#fsDraw')).includes('self-locking (φ > λ)'));

  console.log('Challenges');
  await t.fresh();
  await page.click('#shModes [data-mode="challenge"]');
  t.ok('three example challenges are listed', await page.locator('#shChallenge option').count() === 4);
  await page.selectOption('#shChallenge', 'FS-M1');
  t.ok('FS-M1 hides μs and μk', (await page.inputValue('#fsMuS')) === 'hidden' && (await page.inputValue('#fsMuK')) === 'hidden');
  t.ok('FS-M1 results do not give the slip angle', (await row('Slip angle')) === null && !(await res()).includes('0.42'));
  t.ok('FS-M1 working does not give μs', !(await page.textContent('#shWorkingBody')).includes('0.42'));
  t.ok('FS-M1 asks for μs of the surface', (await page.textContent('#shPfBox')).includes('of this surface'));
  await fill('#fsTh', 22.7);
  t.ok('FS-M1 holds at 22.7°', (await row('Slides or holds')) === 'holds');
  await fill('#fsTh', 22.9);
  t.ok('FS-M1 slides at 22.9°', (await row('Slides or holds')).startsWith('slides'));
  await fill('#shPf_mu', String(Math.tan(22.8 * Math.PI / 180).toFixed(3)));
  await page.click('#shCheck');
  t.ok('FS-M1 tan 22.8° matches the hidden μs within the 2% band', (await page.textContent('#shPfBox')).includes('Match'));
  t.ok('the record uses the challenge id', await page.evaluate(() => window.__app.log[window.__app.log.length - 1].problemId === 'FS-M1'));
  await kit.noBadNumbers(t, 'FS-M1');
  await page.selectOption('#shChallenge', 'FS-C1');
  t.ok('FS-C1 loads FS-6', (await page.inputValue('#fsN')) === '4' && (await page.inputValue('#fsMu')) === '0.05');
  await page.click('#shPredict').catch(() => { });
  await page.focus('#fsJack'); await page.keyboard.down('ArrowUp'); await page.keyboard.up('ArrowUp');
  t.ok('FS-C1 needs a checked prediction before turning', (await page.textContent('#shToast')).includes('Check your prediction first'));

  console.log('Reduced motion');
  {
    const ctx = await t.browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p2 = await ctx.newPage(); t.watch(p2);
    await p2.goto(t.base + '/index.html'); await p2.waitForFunction(() => !!window.__app);
    await p2.fill('#fsN', '4'); await p2.fill('#fsMu', '0.05');
    await p2.focus('#fsJack'); await p2.keyboard.down('ArrowUp');
    t.ok('raising jumps to the top without animating', await p2.evaluate(() => window.__fs.ui.jack.z === 1 && !window.__fs.jackClock.running));
    await p2.keyboard.up('ArrowUp');
    t.ok('an overhauling load drops at once on release', await p2.evaluate(() => window.__fs.ui.jack.z === 0));
    await p2.fill('#fsTh', '30');
    t.ok('the block jumps to the bottom', await p2.evaluate(() => window.__fs.ui.block.s === 22 && !window.__fs.rampClock.running));
    await ctx.close();
  }

  console.log('Report');
  await t.fresh();
  await page.selectOption('#fsRM', 'measure');
  await fill('#fsAK', '20, 21, 19');
  await page.evaluate(() => { window.print = () => { }; });
  await page.click('#shReport');
  const rep = await page.textContent('#sh-report');
  t.ok('report lists the measured trials', rep.includes('Ramp measurements') && rep.includes('Steady-sliding angles') && rep.includes('0.384'));
  t.ok('report has the screw results and both working groups', rep.includes('Torque to raise T_R (total)') && rep.includes('4.02 N·m') && rep.includes('Ramp') && rep.includes('Screw'));

  console.log('Performance');
  await t.fresh();
  const ms = await kit.timeIt(page, 'window.__app.changed()', 15);
  t.ok('a full update takes under 50 ms (' + ms.toFixed(1) + ' ms)', ms < 50);
  require('fs').writeFileSync(path.join(__dirname, '..', 'docs', 'screenshots', 'perf.txt'), 'Full update (change + render), median of 15: ' + ms.toFixed(1) + ' ms\n');

  await t.finish();
})().catch(e => { console.error(e); process.exit(1); });
