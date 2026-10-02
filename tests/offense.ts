import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { C, OFFENSE, MATCH_MOTION } from '../src/config';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import { PairedPaddleInput } from '../src/flipper-input';

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
for (const side of [0, 1]) check(`${side === 0 ? 'left' : 'right'} input drives its upper and lower paddles without moving the other side`, () => {
  const sim = rink(), input = new PairedPaddleInput(), other = 1 - side;
  sim.downhill = 0; sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 });
  const key = side === 0 ? 'ShiftLeft' : 'ShiftRight';
  const step = () => {
    sim.held = input.at(sim.tick);
    input.upperAt(sim.tick).forEach((held, i) => { if (held) sim.shootOffense(i); else sim.releaseOffense(i); });
    sim.step();
  };
  assert.ok(input.press(key, side, sim.tick)); step();
  assert.ok(sim.angles[side] < C.restAngle); assert.ok(sim.offenseAngles[side] < OFFENSE.restAngle);
  assert.equal(sim.angles[other], C.restAngle); assert.equal(sim.offenseAngles[other], OFFENSE.restAngle);
  for (let i = 0; i < 600; i++) step();
  assert.equal(sim.angles[side], C.raisedAngle); assert.equal(sim.offenseAngles[side], OFFENSE.shotAngle);
  assert.equal(sim.offensePhases[side], 'held'); assert.equal(sim.offenseStrokes, 1);
  assert.equal(sim.offenseHeld[other], false);
  input.release(key); step();
  assert.ok(sim.angles[side] > C.raisedAngle); assert.ok(sim.offenseAngles[side] > OFFENSE.shotAngle);
  for (let i = 0; i < 50; i++) step();
  assert.deepEqual(sim.offenseAngles, [OFFENSE.restAngle, OFFENSE.restAngle]);
  assert.deepEqual(sim.offensePhases, ['rest', 'rest']); sim.dispose();
});
check('both upper paddles mirror their swing, but releasing one leaves the other extended', () => {
  const sim = rink(); sim.downhill = 0; sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 });
  assert.ok(sim.shootOffense(0)); assert.ok(sim.shootOffense(1)); assert.equal(sim.shootOffense(0), false); sim.step();
  assert.ok(sim.offenseAngles.every(a => a < OFFENSE.restAngle));
  const left = sim.offensePaddles[0].rotation(), right = sim.offensePaddles[1].rotation();
  assert.ok(Math.abs((1 - 2 * left.y ** 2) + (1 - 2 * right.y ** 2)) < 1e-6);
  assert.ok(Math.abs(left.y * left.w - right.y * right.w) < 1e-6);
  advance(sim, 600); assert.deepEqual(sim.offenseAngles, [OFFENSE.shotAngle, OFFENSE.shotAngle]);
  assert.deepEqual(sim.offensePhases, ['held', 'held']); assert.equal(sim.offenseStrokes, 2);
  const heldSnapshot = sim.snapshot(); sim.releaseOffense(0); sim.step();
  assert.ok(sim.offenseAngles[0] > OFFENSE.shotAngle); assert.equal(sim.offenseAngles[1], OFFENSE.shotAngle);
  assert.deepEqual(heldSnapshot.offenseAngles, [OFFENSE.shotAngle, OFFENSE.shotAngle], 'render snapshots must not share the live angle array');
  advance(sim, 50); assert.deepEqual(sim.offensePhases, ['rest', 'held']);
  assert.ok(sim.shootOffense(0)); sim.cancelOffense();
  assert.deepEqual(sim.offenseAngles, [OFFENSE.restAngle, OFFENSE.restAngle]);
  assert.deepEqual(sim.offenseHeld, [false, false]); sim.dispose();
});
for (const side of [0, 1]) check(`a quick side ${side} tap completes the upper minimum stroke and then retracts`, () => {
  const sim = rink(), input = new PairedPaddleInput(); sim.downhill = 0;
  sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 }); input.press('tap', side, sim.tick); input.release('tap');
  let reached = false;
  for (let tick = 0; tick < 50; tick++) {
    sim.held = input.at(sim.tick);
    if (input.upperAt(sim.tick)[side]) sim.shootOffense(side); else sim.releaseOffense(side); sim.step();
    reached ||= sim.offenseAngles[side] === OFFENSE.shotAngle;
  }
  assert.ok(reached); assert.deepEqual(sim.offenseAngles, [OFFENSE.restAngle, OFFENSE.restAngle]);
  assert.equal(sim.offenseStrokes, 1); sim.dispose();
});
for (const side of [0, 1]) check(`repressing side ${side} while returning starts another stroke immediately`, () => {
  const sim = rink(); sim.downhill = 0; sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 });
  sim.shootOffense(side); advance(sim, 20); sim.releaseOffense(side); advance(sim, 4); const returning = sim.offenseAngles[side];
  assert.ok(sim.shootOffense(side)); sim.step(); assert.ok(sim.offenseAngles[side] < returning);
  advance(sim, 20); assert.equal(sim.offensePhases[side], 'held'); assert.equal(sim.offenseStrokes, 2);
  assert.equal(sim.offenseAngles[1 - side], OFFENSE.restAngle);
  sim.cancelOffense(); assert.deepEqual(sim.offenseHeld, [false, false]); assert.deepEqual(sim.offensePhases, ['rest', 'rest']); sim.dispose();
});
check('inactive and practice rinks cannot fire upper paddles', () => {
  const sim = rink(); for (const side of [0, 1]) assert.equal(sim.shootOffense(side), false); sim.dispose();
  const practice = rink(false); practice.feed('center'); for (const side of [0, 1]) assert.equal(practice.shootOffense(side), false); practice.dispose();
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
function shot(side: number, x: number, z: number, hops = false, vx = 0, vz = 0, holdTicks = 12) {
  const sim = rink(); sim.setHops(hops); sim.place({ x: side * x, y: .11, z }, { x: side * vx, y: 0, z: vz });
  const index = side < 0 ? 0 : 1; sim.shootOffense(index); let impact: { x: number; z: number } | null = null;
  sim.onContact = c => { if (c.label.includes('offensive') && !impact) impact = { ...sim.puck.linvel() }; };
  advance(sim, holdTicks); sim.releaseOffense(index); advance(sim, 38); const returned = sim.offenseAngles.every(a => a === OFFENSE.restAngle);
  advance(sim, 600);
  const row = { side, x, z, hops, vx, vz, impact, returned, result: sim.result, faults: sim.scores.fault, position: { ...sim.current.puck } };
  sim.dispose(); return row;
}
for (const side of [-1, 1]) for (const hops of [false, true]) for (const speed of [-30, 0, 30]) {
  check(`a sustained upper hold remains bounded under puck contact: side ${side}, hops ${hops}, speed ${speed}`, () => {
    const row = shot(side, 4.93, -4.55, hops, .5, speed, 120);
    assert.equal(row.faults, 0); assert.ok(row.returned); assert.ok(Number.isFinite(row.position.x));
  });
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
    if (fire) { sim.shootOffense(0); sim.shootOffense(1); } advance(sim, 50);
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
check('goal and match resets retract both sides and clear their holds', () => {
  const sim = rink(); sim.place({ x: 0, y: .11, z: -7.2 }, { x: 0, y: 0, z: -20 }); sim.shootOffense(0); sim.shootOffense(1);
  advance(sim, 10); assert.equal(sim.result, 'goal'); assert.deepEqual(sim.offensePhases, ['rest', 'rest']);
  assert.deepEqual(sim.offenseHeld, [false, false]);
  sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 }); sim.shootOffense(0); sim.shootOffense(1); sim.step(); sim.reset();
  assert.deepEqual(sim.offenseAngles, [OFFENSE.restAngle, OFFENSE.restAngle]);
  assert.deepEqual(sim.offensePhases, ['rest', 'rest']); assert.deepEqual(sim.offenseHeld, [false, false]); sim.dispose();
});
for (const difficulty of ['easy', 'normal', 'hard'] as const) check(`upper paddles remain bounded during a full-team ${difficulty} rally`, () => {
  const sim = new RinkPhysics(), match = new HockeyMatch(sim, 3, true); match.start(difficulty, 1024);
  let strokes = 0;
  for (let tick = 0; tick < 60 * 120 && !match.winner; tick++) {
    const p = sim.puck.translation(), v = sim.puck.linvel();
    const low = v.z > 0 && p.z > 5 && p.z < 6.5, high = p.z > -5.5 && p.z < -3.6;
    sim.held = [low && p.x < .9 || high && p.x < -4.4, low && p.x > -.9 || high && p.x > 4.4];
    sim.held.forEach((held, side) => { if (held && match.phase === 'playing') { if (sim.shootOffense(side)) strokes++; } else sim.releaseOffense(side); });
    match.step(); assert.equal(sim.scores.fault, 0);
  }
  assert.ok(strokes > 0, 'The full-team check must actually fire upper paddles');
  observations.push({ kind: 'full-team', difficulty, strokes, scores: match.score, recoveries: match.recoveries }); sim.dispose();
});
const failed = checks.filter(c => !c.passed);
writeFileSync('evidence/offense-results.json', JSON.stringify({ date: new Date().toISOString(), tuning: OFFENSE, passed: checks.length - failed.length, failed: failed.length, checks, observations }, null, 2));
console.log(JSON.stringify({ passed: checks.length - failed.length, failed }, null, 2));
assert.equal(failed.length, 0, 'Offensive paddle checks failed; see evidence/offense-results.json');
