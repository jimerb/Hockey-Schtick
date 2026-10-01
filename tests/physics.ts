import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { C } from '../src/config';
import { initPhysics, RinkPhysics } from '../src/physics';

await initPhysics();
const sim = new RinkPhysics();
const rows: object[] = [], failures: object[] = [];
let highSpeedCases = 0;
function check(name: string, fn: () => void) {
  try { fn(); rows.push({ name, passed: true }); }
  catch (e) { const error = { name, passed: false, error: String(e), position: sim.current.puck, velocity: sim.puck.linvel(), result: sim.result }; failures.push(error); rows.push(error); }
}
function advance(ticks: number) { for (let i = 0; i < ticks; i++) sim.step(); }
function reset(hops = false) { sim.reset(); sim.setStick(false); sim.setHops(hops); sim.downhill = C.downhill; }
check('Flippers respond on the next tick, hold at their limits, and release independently', () => {
  reset(); sim.held = [true, true]; sim.step();
  assert.ok(sim.angles.every(a => a < C.restAngle));
  advance(30); assert.ok(sim.angles.every(a => Math.abs(a - C.raisedAngle) < 1e-8));
  sim.held[0] = false; advance(30); assert.equal(sim.angles[0], C.restAngle); assert.equal(sim.angles[1], C.raisedAngle);
  sim.held[1] = false; advance(30); assert.equal(sim.angles[1], C.restAngle);
});
check('Gentle downhill pull returns a slow puck from an open side strip', () => {
  reset(); sim.place({ x: 4.7, y: 0.11, z: 0 }, { x: 0, y: 0, z: 0 }); advance(480);
  assert.ok(sim.current.puck.z > 4); assert.notEqual(sim.result, 'fault');
});
check('An aimed strong shot reaches the far net, scores once, and is removed before a rear rebound', () => {
  reset(); const goals = sim.scores.goal; sim.place({ x: 0.2, y: 0.11, z: -5.5 }, { x: 0, y: 0, z: -30 });
  advance(40); assert.equal(sim.scores.goal, goals + 1); assert.equal(sim.result, 'goal'); assert.equal(sim.active, false);
  advance(200); assert.equal(sim.scores.goal, goals + 1);
});
check('A puck grazing a post does not score through the side of the net', () => {
  reset(); const goals = sim.scores.goal;
  sim.place({ x: 1.4, y: 0.11, z: -5.5 }, { x: 0, y: 0, z: -35 }); advance(35);
  assert.equal(sim.scores.goal, goals); assert.notEqual(sim.result, 'fault');
});
check('A puck through the center gap concedes once', () => {
  reset(); const conceded = sim.scores.conceded;
  sim.place({ x: 0, y: 0.11, z: 8 }, { x: 0, y: 0, z: 30 }); advance(40);
  assert.equal(sim.scores.conceded, conceded + 1); assert.equal(sim.result, 'conceded');
});
check('Repeatable feed and input timing produce the same aimed return', () => {
  const results = [];
  for (let n = 0; n < 3; n++) {
    // Fresh worlds avoid residual solver caches from earlier test scenarios.
    const s = new RinkPhysics(); s.feed('right');
    for (let tick = 0; tick < 190; tick++) { s.held[1] = tick >= 83 && tick < 108; s.step(); }
    results.push({ p: s.current.puck, score: s.result }); s.dispose();
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
});

for (const [name, side] of [['center shot', 2], ['right bank from left flipper', 0], ['left bank from right flipper', 1]] as const) {
  check(`A deliberate ${name} can score from the same center feed`, () => {
    const s = new RinkPhysics(); s.feed('center'); let firstBoardX: number | null = null;
    s.onContact = c => { if (c.label === 'board' && firstBoardX === null) firstBoardX = s.puck.translation().x; };
    try {
      for (let tick = 0; tick < 360; tick++) {
        const pressed = tick >= 124 && tick < 134;
        s.held = [pressed && side !== 1, pressed && side !== 0]; s.step();
      }
      assert.equal(s.result, 'goal');
      if (side === 2) assert.equal(firstBoardX, null, 'Center shot should reach the net directly');
      else { assert.ok(firstBoardX !== null); assert.ok(firstBoardX! * (side === 0 ? 1 : -1) > 4.5); }
    } finally { s.dispose(); }
  });
}
check('An untouched center feed can pass through the drain; saving needs a timed stroke', () => {
  reset(); sim.feed('center'); advance(240); assert.equal(sim.result, 'conceded');
});

for (const hops of [false, true]) {
  for (let i = 0; i < 25; i++) {
    for (const side of [0, 1]) check(`${hops ? 'hop' : 'flat'} moving flipper ${side} impact ${i}`, () => {
      reset(hops); highSpeedCases++;
      const sign = side === 0 ? -1 : 1, hits: string[] = [];
      sim.onContact = c => hits.push(c.label);
      sim.place({ x: sign * (2.0 + i * 0.035), y: hops ? 0.22 : 0.11, z: 4.7 + (i % 3) * 0.03 }, { x: sign * ((i % 5) - 2) * 0.7, y: 0, z: 32 + (i % 9) });
      sim.held[side] = true; if (i % 5 === 0) sim.held[1 - side] = true;
      advance(25); assert.ok(hits.includes(side === 0 ? 'left flipper' : 'right flipper'), `Expected flipper contact, got ${hits}`);
      assert.ok(sim.puck.linvel().z < 0, 'Flipper must send the puck back up the rink'); assert.notEqual(sim.result, 'fault');
      assert.ok(sim.current.puck.y < 0.48, 'Low hop must stay within blocking height');
    });
    check(`${hops ? 'hop' : 'flat'} moving stick impact ${i}`, () => {
      reset(hops); highSpeedCases++; sim.setStick(true); const hits: string[] = []; sim.onContact = c => hits.push(c.label);
      sim.place({ x: (i - 12) * 0.025, y: hops ? 0.22 : 0.11, z: -4.5 }, { x: (i % 3 - 1) * 1.4, y: 0, z: 32 + i % 9 });
      advance(22); assert.ok(hits.includes('stick'), `Expected blade contact, got ${hits}`); assert.notEqual(sim.result, 'fault');
      assert.ok(Math.abs(sim.puck.linvel().z - (32 + i % 9)) > 5, 'Blade must alter the incoming velocity');
    });
    check(`${hops ? 'hop' : 'flat'} grazing side board impact ${i}`, () => {
      reset(hops); highSpeedCases++; const sign = i % 2 ? -1 : 1, hits: string[] = []; sim.onContact = c => hits.push(c.label);
      sim.place({ x: sign * 4.3, y: hops ? 0.24 : 0.11, z: -4 + i * 0.29 }, { x: sign * (30 + i % 11), y: 0, z: (i % 5 - 2) * 4 });
      advance(20); assert.ok(hits.includes('board'), `Expected board contact, got ${hits}`); assert.ok(sim.puck.linvel().x * sign < 0); assert.notEqual(sim.result, 'fault');
    });
    check(`${hops ? 'hop' : 'flat'} rear base angle impact ${i}`, () => {
      reset(hops); highSpeedCases++; const sign = i % 2 ? -1 : 1, hits: string[] = []; sim.onContact = c => hits.push(c.label);
      sim.place({ x: sign * 2.65, y: hops ? 0.24 : 0.11, z: -8.05 - (i % 6) * 0.09 }, { x: -sign * (30 + i % 11), y: 0, z: (i % 3 - 1) * 2 });
      advance(15); assert.ok(hits.includes('base'), `Expected rounded rear base contact, got ${hits}`); assert.notEqual(sim.result, 'fault');
      assert.ok(sim.current.puck.x * sign > 1.3, 'Puck must rebound out of the rear shoulder, never enter its dead space');
    });
  }
}
check('Rear bumper changes direction with surface angle, without random steering', () => {
  const velocities = [];
  // Geometry probe inside the opening: normal play removes an already-scored puck before this contact.
  for (const x of [0.25, 1.0]) {
    reset(); sim.place({ x, y: 0.11, z: -8.0 }, { x: 0, y: 0, z: -28 }); advance(12); velocities.push(sim.puck.linvel().x);
  }
  assert.ok(Math.abs(velocities[0] - velocities[1]) > 1);
});

for (const hops of [false, true]) {
  for (let i = 0; i < 12; i++) check(`${hops ? 'hop' : 'flat'} shallow board graze ${i}`, () => {
    reset(hops); highSpeedCases++; const sign = i % 2 ? 1 : -1, hits: string[] = []; sim.onContact = c => hits.push(c.label);
    sim.place({ x: sign * 4.7, y: hops ? 0.24 : 0.11, z: -3.5 + i * 0.25 }, { x: sign * 8, y: 0, z: 35 });
    advance(20); assert.ok(hits.includes('board')); assert.ok(sim.puck.linvel().x * sign < 0); assert.notEqual(sim.result, 'fault');
  });
  for (let i = 0; i < 5; i++) check(`${hops ? 'hop' : 'flat'} simultaneous flipper contact ${i}`, () => {
    reset(hops); highSpeedCases++; const hits: string[] = []; sim.onContact = c => hits.push(c.label);
    sim.place({ x: (i - 2) * 0.01, y: hops ? 0.22 : 0.11, z: 4.8 }, { x: 0, y: 0, z: 35 + i }); sim.held = [true, true];
    advance(24); assert.ok(hits.includes('left flipper') && hits.includes('right flipper'), `Both moving flippers should contact: ${hits}`); assert.notEqual(sim.result, 'fault'); assert.ok(sim.puck.linvel().z < 0);
  });
}

const report = { date: new Date().toISOString(), engine: 'Rapier 3D 0.21.0', physicsHz: 120, highSpeedCases, totalChecks: rows.length, passed: rows.length - failures.length, failed: failures.length, maxConfiguredSpeed: C.maxSpeed, rows };
mkdirSync('evidence', { recursive: true }); writeFileSync('evidence/physics-results.json', JSON.stringify(report, null, 2));
sim.dispose();
console.log(JSON.stringify({ ...report, rows: undefined, failures: failures.slice(0, 12) }, null, 2));
assert.equal(failures.length, 0, `${failures.length} physics checks failed; see evidence/physics-results.json`);
