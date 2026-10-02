const { chromium } = require(process.argv[2]);
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-proxy-server'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1.5 });
    const errors = [], observations = [];
    page.on('pageerror', e => { errors.push(String(e)); console.error(String(e)); }); page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.error(m.text()); } });
    // Expose this isolated test page's real match objects, without adding a runtime cheat API.
    await page.route('**/src/main.ts*', async route => {
      const response = await route.fetch(), source = await response.text();
      assert.ok(source.includes('function qaState()'));
      await route.fulfill({ response, body: source.replace('function qaState()', 'window.__rinkTest = { sim, match, view, qaState, pause, resume };\nfunction qaState()') });
    });
    await page.goto('http://127.0.0.1:5173/?seed=1024', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__rinkTest);
    const state = () => page.evaluate(() => window.__rinkTest.qaState());
    const play = async () => {
      // A screenshot can trigger the app's next-frame protective stall pause.
      await page.waitForTimeout(250);
      const qa = await state();
      if (!qa.started || qa.phase === 'finished') await page.locator('#start').click();
      else if (qa.paused) { await page.keyboard.press('Escape'); await page.waitForTimeout(650); }
      await page.waitForFunction(() => { const q = window.__rinkTest.qaState(); return q.phase === 'playing' && !q.paused; });
    };
    await play();
    const geometry = await page.evaluate(async () => {
      const { view, sim } = window.__rinkTest, T = await import('/node_modules/three/build/three.module.js');
      return view.offensePaddles.map((group, i) => {
        const clone = group.clone(); clone.position.set(0, 0, 0); clone.rotation.set(0, 0, 0);
        const bounds = new T.Box3().setFromObject(clone), face = new T.Box3().setFromObject(view.offenseRestFaces[i]);
        return { min: bounds.min.toArray(), max: bounds.max.toArray(), faceMin: face.min.toArray(), faceMax: face.max.toArray(), pivot: [sim.offensePaddles[i].translation().x, sim.offensePaddles[i].translation().z] };
      });
    });
    for (const shape of geometry) {
      assert.ok(Math.abs(shape.max[0] - 2.035) < .002, 'visible paddle tip follows the 10% extension');
      assert.ok(shape.faceMin[2] < -5.65 && shape.faceMax[2] > -3.67, 'visible board recess covers longer blade');
      assert.ok(Math.abs(Math.abs(shape.pivot[0]) - 5.4) < 1e-6); assert.ok(Math.abs(shape.pivot[1] + 5.65) < 1e-6);
    }
    observations.push({ geometry, idle: (await state()).settings.presentation });
    await page.screenshot({ path: 'evidence/crowd-rink-idle.png' });
    await play();
    await page.keyboard.down('a'); await page.keyboard.down('l'); await page.waitForTimeout(280);
    const held = await state(); assert.deepEqual(held.offense.phases, ['held', 'held']);
    await page.screenshot({ path: 'evidence/crowd-paddles-held.png' });
    await page.keyboard.up('a'); await page.keyboard.up('l'); await play();
    const goal = await page.evaluate(async () => {
      const { sim, view, match, qaState } = window.__rinkTest;
      const heads = view.crowd.group.getObjectByName('spectator-faces');
      const hands = view.crowd.group.getObjectByName('spectator-hands');
      const meanY = mesh => { let sum = 0; for (let i = 0; i < mesh.count; i++) sum += mesh.instanceMatrix.array[i * 16 + 13]; return sum / mesh.count; };
      const before = { score: match.score.you, heads: meanY(heads), hands: meanY(hands) };
      // A real puck crosses the real goal plane. The normal match event drives the crowd.
      sim.place({ x: .9, y: .11, z: -7.55 }, { x: 0, y: 0, z: -10 });
      const start = performance.now(), samples = [];
      await new Promise(resolve => {
        function sample() {
          const elapsed = (performance.now() - start) / 1000;
          if (elapsed > .2) samples.push({ elapsed, score: match.score.you, phase: match.phase, crowd: view.presentation.crowdDetail, heads: meanY(heads), hands: meanY(hands), paused: qaState().paused });
          if (elapsed < 3.15) requestAnimationFrame(sample); else resolve();
        }
        requestAnimationFrame(sample);
      });
      return { before, first: samples[0], last: samples.at(-1), phases: [...new Set(samples.map(s => s.phase))], paused: samples.some(s => s.paused), maxHands: Math.max(...samples.map(s => s.hands)), maxHeads: Math.max(...samples.map(s => s.heads)) };
    });
    assert.equal(goal.first.score, goal.before.score + 1); assert.equal(goal.paused, false);
    assert.ok(goal.maxHands > goal.before.hands + .28); assert.ok(goal.maxHeads > goal.before.heads + .12);
    assert.ok(goal.phases.includes('countdown') && goal.phases.includes('playing'));
    assert.equal(goal.last.crowd.cheering, true, 'reaction continues through the next puck drop');
    observations.push({ goal });
    await page.screenshot({ path: 'evidence/crowd-human-goal.png' });
    const hitTargets = await page.evaluate(() => [...document.querySelectorAll('.flipper-control, header button')].map(button => {
      const rect = button.getBoundingClientRect(), target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { id: button.id, reachable: button.contains(target), width: rect.width, height: rect.height };
    }));
    assert.ok(hitTargets.every(t => t.reachable)); observations.push({ hitTargets });
    await page.locator('#settings').click(); await page.locator('#motion').check(); await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await play();
    const frozen = await page.evaluate(async () => {
      const { view } = window.__rinkTest, mesh = view.crowd.group.getObjectByName('spectator-hands');
      const before = [...mesh.instanceMatrix.array]; await new Promise(r => setTimeout(r, 400));
      return before.every((v, i) => v === mesh.instanceMatrix.array[i]);
    });
    assert.equal(frozen, true); observations.push({ reducedMotionFrozen: frozen });
    for (const [width, height] of [[1280, 800], [430, 932], [844, 390]]) {
      if (!(await state()).paused) await page.keyboard.press('Escape');
      await page.setViewportSize({ width, height }); await page.waitForTimeout(600); await play();
      const layout = await page.evaluate(() => {
        const qa = window.__rinkTest.qaState(), controls = [...document.querySelectorAll('.flipper-control')].map(el => {
          const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, reachable:el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) };
        });
        return { qa: qa.settings.presentation, controls, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.overflow, false); assert.ok(layout.controls.every(c => c.reachable && c.x >= 0 && c.y + c.height <= height));
      observations.push({ viewport: { width, height }, ...layout });
      await page.screenshot({ path: `evidence/crowd-layout-${width}x${height}.png` });
    }
    assert.equal(errors.length, 0);
    fs.writeFileSync('evidence/paddles-crowd-browser.json', JSON.stringify({ date: new Date().toISOString(), browser: await browser.version(), errors, observations }, null, 2));
    console.log(JSON.stringify({ errors, goals: goal, hitTargets }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
