import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { C, OFFENSE, MATCH_MOTION } from '../src/config';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';

await initPhysics();
const checks: { name: string; passed: boolean; error?: string }[] = [], observations: object[] = [];
function check(name: string, fn: () => void) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: String(error) }); }
}
function rink(enabled = true) {
  const sim = new RinkPhysics(); sim.setMotion(MATCH_MOTION); if (enabled) sim.addOffensePaddles(); return sim;
}
function advance(sim: RinkPhysics, ticks: number) { for (let i = 0; i < ticks; i++) sim.step(); }
check('one stroke drives both paddles together, then fully retracts without a release', () => {
  const sim = rink(); sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 });
  assert.ok(sim.shootOffense()); assert.equal(sim.shootOffense(), false); sim.step();
  assert.ok(sim.offenseAngle < OFFENSE.restAngle);
  const left = sim.offensePaddles[0].rotation(), right = sim.offensePaddles[1].rotation();
  assert.ok(Math.abs((1 - 2 * left.y ** 2) + (1 - 2 * right.y ** 2)) < 1e-6);
  assert.ok(Math.abs(left.y * left.w - right.y * right.w) < 1e-6);
  advance(sim, 50); assert.equal(sim.offenseAngle, OFFENSE.restAngle); assert.equal(sim.offensePhase, 'rest');
  assert.ok(sim.shootOffense()); sim.cancelOffense(); assert.equal(sim.offenseAngle, OFFENSE.restAngle); sim.dispose();
});
check('inactive and practice rinks cannot fire upper paddles', () => {
  const sim = rink(); assert.equal(sim.shootOffense(), false); sim.dispose();
  const practice = rink(false); practice.feed('center'); assert.equal(practice.shootOffense(), false); practice.dispose();
});
for (const side of [-1, 1]) for (const hops of [false, true]) for (const speed of [4, 15, 35]) {
  check(`recessed ${side < 0 ? 'left' : 'right'} paddle leaves the board glide unchanged, hops ${hops}, speed ${speed}`, () => {
    const results = [false, true].map(enabled => {
      const sim = rink(enabled); sim.setHops(hops); sim.downhill = 0;
      sim.place({ x: side * 4.93, y: .11, z: -2.9 }, { x: 0, y: 0, z: -speed });
      advance(sim, Math.ceil(2.8 / speed / C.dt));
      assert.ok(!sim.contacts.some(c => c.label.includes('offensive')));
      const result = { p: { ...sim.current.puck }, v: { ...sim.puck.linvel() } }; sim.dispose(); return result;
    });
    assert.deepEqual(results[0], results[1]);
  });
}
function shot(side: number, x: number, z: number, hops = false, vx = 0, vz = 0) {
  const sim = rink(); sim.setHops(hops); sim.place({ x: side * x, y: .11, z }, { x: side * vx, y: 0, z: vz });
  sim.shootOffense(); let impact: { x: number; z: number } | null = null;
  sim.onContact = c => { if (c.label.includes('offensive') && !impact) impact = { ...sim.puck.linvel() }; };
  advance(sim, 50); const returned = sim.offenseAngle === OFFENSE.restAngle;
  advance(sim, 600);
  const row = { side, x, z, hops, vx, vz, impact, returned, result: sim.result, faults: sim.scores.fault, position: { ...sim.current.puck } };
  sim.dispose(); return row;
}
for (const side of [-1, 1]) for (const hops of [false, true]) {
  check(`a physical ${side < 0 ? 'left' : 'right'} stroke can score at the far net, hops ${hops}`, () => {
    const shots = [4.65, 4.8, 4.95].flatMap(x => [-4.1, -4.3, -4.5, -4.7, -4.9].map(z => shot(side, x, z, hops)));
    const scored = shots.find(s => s.result === 'goal'); observations.push({ kind: 'shots', side, hops, shots });
    assert.ok(scored, 'At least one timed position should produce a real goal'); assert.ok(scored.impact);
    assert.ok(scored.impact.x * side < -1 && scored.impact.z < -1); assert.ok(scored.returned);
    assert.ok(shots.every(s => s.faults === 0));
  });
}
check('the stroke cannot remotely steer a puck in the center of the rink', () => {
  const rows = [false, true].map(fire => {
    const sim = rink(); sim.place({ x: .3, y: .11, z: -2 }, { x: 0, y: 0, z: 1 });
    if (fire) sim.shootOffense(); advance(sim, 50);
    const row = { p: sim.current.puck, v: { ...sim.puck.linvel() } }; sim.dispose(); return row;
  });
  assert.deepEqual(rows[0], rows[1]);
});
for (const side of [-1, 1]) for (const hops of [false, true]) for (const speed of [-35, -12, 0, 12, 35]) {
  check(`firing beside a traveling puck stays bounded: side ${side}, hops ${hops}, speed ${speed}`, () => {
    const row = shot(side, 4.93, -4.55, hops, .5, speed);
    assert.equal(row.faults, 0); assert.ok(row.returned); assert.ok(Number.isFinite(row.position.x));
  });
}
check('goal and match resets retract a pending stroke', () => {
  const sim = rink(); sim.place({ x: 0, y: .11, z: -7.2 }, { x: 0, y: 0, z: -20 }); sim.shootOffense();
  advance(sim, 10); assert.equal(sim.result, 'goal'); assert.equal(sim.offensePhase, 'rest');
  sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 }); sim.shootOffense(); sim.step(); sim.reset();
  assert.equal(sim.offenseAngle, OFFENSE.restAngle); assert.equal(sim.offensePhase, 'rest'); sim.dispose();
});
for (const difficulty of ['easy', 'normal', 'hard'] as const) check(`upper paddles remain bounded during a full-team ${difficulty} rally`, () => {
  const sim = new RinkPhysics(), match = new HockeyMatch(sim, 3, true); match.start(difficulty, 1024);
  let strokes = 0;
  for (let tick = 0; tick < 60 * 120 && !match.winner; tick++) {
    const p = sim.puck.translation(), v = sim.puck.linvel();
    sim.held = [v.z > 0 && p.z > 5 && p.z < 6.5 && p.x < .9, v.z > 0 && p.z > 5 && p.z < 6.5 && p.x > -.9];
    if (match.phase === 'playing' && Math.abs(p.x) > 4.4 && p.z > -5.5 && p.z < -3.6 && sim.shootOffense()) strokes++;
    match.step(); assert.equal(sim.scores.fault, 0);
  }
  assert.ok(strokes > 0, 'The full-team check must actually fire upper paddles');
  observations.push({ kind: 'full-team', difficulty, strokes, scores: match.score, recoveries: match.recoveries }); sim.dispose();
});
const failed = checks.filter(c => !c.passed);
writeFileSync('evidence/offense-results.json', JSON.stringify({ date: new Date().toISOString(), tuning: OFFENSE, passed: checks.length - failed.length, failed: failed.length, checks, observations }, null, 2));
console.log(JSON.stringify({ passed: checks.length - failed.length, failed }, null, 2));
assert.equal(failed.length, 0, 'Offensive paddle checks failed; see evidence/offense-results.json');
