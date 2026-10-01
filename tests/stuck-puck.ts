import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import { C } from '../src/config';

await initPhysics();
const checks: { name: string; passed: boolean; error?: string }[] = [], observations: object[] = [];
function check(name: string, run: () => void) {
  try { run(); checks.push({ name, passed: true }); }
  catch (e) { checks.push({ name, passed: false, error: String(e) }); }
}
function game(hops = false, difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true);
  s.setHops(hops); m.start(difficulty, 42);
  while (m.phase !== 'playing') m.step();
  s.world.propagateModifiedBodyPositionsToColliders();
  return { s, m };
}

// Deliberately start in a deep contact: CCD/kinematic motion must never leave the
// solver choosing the ice-facing underside as the shortest way out of a figure.
for (const hops of [false, true]) for (const target of ['left-body', 'right-body', 'center-body', 'left-blade', 'right-blade', 'center-blade', 'goalie-pad', 'goalie-blade']) {
  check(`${target}: deep overlap escapes horizontally, hops ${hops}`, () => {
    const { s, m } = game(hops);
    const index = target.startsWith('left') ? 0 : target.startsWith('right') ? 1 : 2;
    const collider = target === 'goalie-pad' ? m.team.goaliePad : target === 'goalie-blade' ? m.team.goalieBlade : target.endsWith('body') ? m.team.skaters[index].torso : m.team.skaters[index].blade;
    // Isolate the shape. Combined moving figures are exercised below; a fixed
    // goalie pad plus a fixed blade can legitimately sandwich a seeded overlap.
    for (const body of [...m.team.skaters.map(a => a.body), m.team.goalie, m.team.goalieStick]) {
      for (let i = 0; i < body.numColliders(); i++) {
        const c = body.collider(i); c.setEnabled(c.handle === collider.handle);
      }
    }
    const center = collider.translation();
    s.place({ x: center.x + .05, y: .11, z: center.z }, { x: 0, y: 0, z: 0 });
    s.world.propagateModifiedBodyPositionsToColliders();
    assert.ok(s.puckCollider.contactCollider(collider, 0));
    let escapedAt = 0;
    for (let i = 0; i < 120 && s.active; i++) {
      s.step();
      const contact = s.puckCollider.contactCollider(collider, .01);
      if (!contact || contact.distance > -.015) { escapedAt = (i + 1) * C.dt; break; }
    }
    assert.ok(escapedAt > 0 && escapedAt <= 1, `${target} failed to separate`);
    assert.ok(s.puck.translation().y > .095, 'Escape must be across the ice, not through it');
    assert.equal(s.scores.fault, 0);
    observations.push({ target, hops, escapedAt }); s.dispose();
  });
}

for (const difficulty of ['easy', 'normal', 'hard'] as const) for (const hops of [false, true]) for (const index of [0, 1, 2]) {
  check(`moving skater ${index} frees a puck at his feet: ${difficulty}, hops ${hops}`, () => {
    const { s, m } = game(hops, difficulty), actor = m.team.skaters[index];
    const x = m.team.lanes[index].x;
    s.place({ x: x + .05, y: .11, z: actor.z }, { x: 0, y: 0, z: 0 });
    let escaped = false;
    for (let i = 0; i < 240 && m.phase === 'playing'; i++) {
      m.step();
      const p = s.puck.translation();
      if (Math.hypot(p.x - x, p.z - actor.z) > .9) { escaped = true; break; }
    }
    assert.ok(escaped); assert.equal(m.recoveries, 0); assert.equal(s.scores.fault, 0); s.dispose();
  });
}

// Reintroduce the original faulty underside ONLY in this fixture. The real
// solver then traps and carries a hopping puck; the match must still recover.
for (const difficulty of ['easy', 'normal', 'hard'] as const) for (const index of [0, 1, 2]) {
  check(`safety whistle bounds a carried/jittering trap: ${difficulty}, skater ${index}`, () => {
    const { s, m } = game(true, difficulty), actor = m.team.skaters[index];
    let reason = '';
    m.onEvent = event => { if (event.kind === 'recovery') reason = event.reason ?? ''; };
    actor.torso.setShape(new RAPIER.Cylinder(.56, .27));
    actor.torso.setTranslationWrtParent({ x: 0, y: .58, z: 0 });
    const start = { x: m.team.lanes[index].x + .05, y: .11, z: actor.z };
    s.place(start, { x: 0, y: 0, z: 0 });
    let ticks = 0, travel = 0, peakSpeed = 0;
    for (; ticks < 300 && m.recoveries === 0; ticks++) {
      m.step();
      if (m.recoveries) break;
      const p = s.puck.translation(), v = s.puck.linvel();
      travel = Math.max(travel, Math.hypot(p.x - start.x, p.z - start.z));
      peakSpeed = Math.max(peakSpeed, Math.hypot(v.x, v.z));
    }
    assert.equal(m.recoveries, 1); assert.ok(ticks * C.dt <= 2.2);
    assert.equal(reason, 'actor-pin');
    assert.equal(m.phase, 'countdown'); assert.deepEqual(m.score, { you: 0, cpu: 0 });
    assert.equal(s.active, false); assert.equal(s.scores.fault, 0);
    assert.ok(peakSpeed > .28, 'The old speed-based watchdog would reset during this trap');
    observations.push({ kind: 'safety', difficulty, index, seconds: ticks * C.dt, travel, peakSpeed });
    // Rematch clears tracking and starts a genuinely fresh rally.
    m.start(difficulty, 9); while (m.phase !== 'playing') m.step();
    for (let i = 0; i < 80; i++) m.step();
    assert.equal(m.recoveries, 0); s.dispose();
  });
}

check('a vibrating stationary wedge cannot keep resetting the no-progress timer', () => {
  const { s, m } = game();
  m.team.skaters.forEach(a => a.body.setEnabled(false)); m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
  s.downhill = 0; s.place({ x: 4.8, y: .11, z: 0 }, { x: 0, y: 0, z: 0 });
  let reason = '', ticks = 0;
  m.onEvent = event => { if (event.kind === 'recovery') reason = event.reason ?? ''; };
  // Simulate solver jitter at the reported failure's scale. Instantaneous speed
  // stays above the old .28 threshold, yet the puck makes no positional progress.
  for (; ticks < 480 && m.phase === 'playing'; ticks++) {
    s.puck.setLinvel({ x: ticks % 2 ? -.4 : .4, y: 0, z: 0 }, true); m.step();
  }
  assert.equal(reason, 'stationary'); assert.ok(ticks * C.dt < 3.7);
  assert.deepEqual(m.score, { you: 0, cpu: 0 }); s.dispose();
});

for (const side of [-1, 1]) check(`an unreachable apron wedge restarts promptly: side ${side}`, () => {
  const { s, m } = game();
  // Positions found in the long-rally regression, below the playable paddle face.
  s.place({ x: side * 1.32, y: .11, z: 8.085 }, { x: 0, y: 0, z: 0 });
  let ticks = 0;
  for (; ticks < 240 && m.phase === 'playing'; ticks++) m.step();
  assert.equal(m.recoveries, 1); assert.ok(ticks * C.dt < 1.5);
  assert.deepEqual(m.score, { you: 0, cpu: 0 }); s.dispose();
});

const failures = checks.filter(c => !c.passed);
writeFileSync('evidence/stuck-puck-results.json', JSON.stringify({ date: new Date().toISOString(), passed: checks.length - failures.length, failed: failures.length, observations, checks }, null, 2));
console.log(JSON.stringify({ passed: checks.length - failures.length, failures }, null, 2));
assert.equal(failures.length, 0);
