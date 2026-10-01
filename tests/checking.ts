import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { C, MATCH_CHECK_TUNING, MATCH_FLIPPER_RUBBER, MATCH_PLAY_TUNING } from '../src/config';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import type { CheckEvent, Difficulty } from '../src/opponents';

await initPhysics();
const checks: object[] = [], observations: object[] = [];
function check(name: string, fn: () => void) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (e) { checks.push({ name, passed: false, error: String(e) }); }
}
function fixture(side: number, mode = 'full', enabled = true, z = 4.9) {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true, MATCH_PLAY_TUNING, MATCH_FLIPPER_RUBBER, enabled ? MATCH_CHECK_TUNING : null);
  m.start('normal', 42); while (m.phase !== 'playing') m.step();
  m.team.skaters.forEach(a => a.body.setEnabled(false)); m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
  s.downhill = 0; s.place({ x: 4.8, y: .11, z: 0 }, { x: 0, y: 0, z: 0 });
  if (['short', 'held', 'return'].includes(mode)) {
    s.held[side] = true; for (let i = 0; i < 20; i++) s.step();
    if (mode === 'short') { s.held[side] = false; s.step(); }
  }
  const a = m.team.skaters[side]; a.body.setEnabled(true); a.z = a.previousZ = z;
  a.angle = a.previousAngle = mode === 'stick' ? Math.PI / 2 : -Math.PI / 2;
  a.stage = 'windup'; a.timer = 10; a.meetAt = 100; m.team.active = side; m.team.receiver = 2;
  const p = { x: m.team.lanes[side].x, y: 0, z };
  const q = { x: 0, y: Math.sin(-a.angle / 2), z: 0, w: Math.cos(a.angle / 2) };
  a.body.setTranslation(p, true); a.body.setNextKinematicTranslation(p); a.body.setRotation(q, true); a.body.setNextKinematicRotation(q);
  const events: CheckEvent[] = []; m.team.onCheck = e => events.push({ ...e });
  s.held[side] = mode !== 'return';
  for (let i = 0; i < 20 && !events.length; i++) { s.step(); m.team.postStep(); }
  return { s, m, a, events };
}
function finishShove(f: ReturnType<typeof fixture>) {
  const { s, m, a } = f, start = a.z;
  while (a.checkTime < a.checkDuration) {
    const z = a.z; m.team.preStep(); s.step(); m.team.postStep();
    assert.ok(a.z <= z + 1e-7); assert.ok(z - a.z <= 6 * C.dt + 1e-6);
    assert.ok(a.z >= m.team.lanes[a.index].min && a.z <= m.team.lanes[a.index].max);
    assert.equal(a.body.translation().x, Math.fround(m.team.lanes[a.index].x));
    assert.equal(a.body.translation().y, 0); assert.ok(Math.abs(a.body.translation().z - a.z) < 1e-6);
    assert.ok(Math.abs(s.current.actors[a.index].z - a.z) < 1e-6);
  }
  assert.ok(start - a.z <= MATCH_CHECK_TUNING.maxDistance + 1e-6);
  return start - a.z;
}
for (const side of [0, 1]) {
  check(`side ${side}: a powered body check follows real contact, interrupts a play and eases up its rail`, () => {
    const f = fixture(side), { s, m, a, events } = f;
    assert.equal(events.length, 1); assert.equal(events[0].part, 'body');
    assert.ok(s.flipperColliders[side].some(c => !!c.contactCollider(a.torso, 0)));
    assert.equal(a.stage, 'checked'); assert.equal(a.struck, false); assert.equal(m.team.active, -1); assert.equal(m.team.receiver, -1);
    const moved = finishShove(f); assert.ok(moved > .75 && moved < .96);
    assert.ok(Math.abs(moved - events[0].distance) < 1e-6); assert.equal(m.team.stats.checks, 1);
    for (let i = 0; i < 80; i++) m.step(); assert.notEqual(a.stage, 'checked'); assert.ok(a.cooldown <= 0);
    observations.push({ kind: 'body', side, ...events[0], moved }); s.dispose();
  });
  check(`side ${side}: a short finishing stroke makes a smaller shove than a full stroke`, () => {
    const full = fixture(side), tap = fixture(side, 'short');
    assert.equal(full.events.length, 1); assert.equal(tap.events.length, 1);
    const big = finishShove(full), small = finishShove(tap);
    assert.ok(small > .1 && small < big * .7);
    assert.ok(tap.events[0].impact < full.events[0].impact * .65);
    observations.push({ kind: 'full-versus-short', side, full: full.events[0], short: tap.events[0], big, small }); full.s.dispose(); tap.s.dispose();
  });
  check(`side ${side}: a stick-only hit gives a gentler shove`, () => {
    const f = fixture(side, 'stick'); assert.equal(f.events.length, 1); assert.equal(f.events[0].part, 'stick');
    const moved = finishShove(f); assert.ok(moved > .15 && moved < .6); observations.push({ kind: 'stick', side, ...f.events[0], moved }); f.s.dispose();
  });
  for (const mode of ['held', 'return']) check(`side ${side}: a ${mode} paddle never repeatedly pumps or flings a skater`, () => {
    const f = fixture(side, mode), z = f.a.z;
    for (let i = 0; i < 240; i++) { f.s.step(); f.m.team.postStep(); }
    assert.equal(f.events.length, 0); assert.equal(f.a.z, z); f.s.dispose();
  });
  check(`side ${side}: a swing cannot check a player outside its actual reach`, () => {
    const f = fixture(side, 'full', true, 3.2); assert.equal(f.events.length, 0); assert.equal(f.a.z, 3.2); f.s.dispose();
  });
  check(`side ${side}: disabled checking leaves rod movement and paddle/puck settings untouched`, () => {
    const f = fixture(side, 'full', false); assert.equal(f.events.length, 0); assert.equal(f.a.z, 4.9);
    assert.deepEqual(f.s.flipperRubber, MATCH_FLIPPER_RUBBER); assert.equal(C.swingSpeed, 10.5); assert.equal(C.returnSpeed, 5.8); f.s.dispose();
  });
  check(`side ${side}: checking never adds a direct kick to a remote puck`, () => {
    const enabled = fixture(side), disabled = fixture(side, 'full', false);
    assert.ok(enabled.events.length); assert.equal(enabled.s.puck.linvel().x, 0); assert.equal(enabled.s.puck.linvel().z, 0);
    assert.deepEqual(enabled.s.puck.translation(), disabled.s.puck.translation());
    enabled.s.dispose(); disabled.s.dispose();
  });
  check(`side ${side}: resetting after a check clears all pending shove and contact state`, () => {
    const f = fixture(side); assert.equal(f.events.length, 1); f.m.start('easy', 72);
    assert.equal(f.m.team.stats.checks, 0); assert.equal(f.m.team.lastCheck, null);
    for (const a of f.m.team.skaters) { assert.equal(a.checkDuration, 0); assert.equal(a.checkDistance, 0); assert.deepEqual(a.paddleContact, [false, false]); assert.equal(a.z, f.m.team.lanes[a.index].home); }
    assert.equal(f.m.phase, 'countdown'); f.s.dispose();
  });
  check(`side ${side}: the shove stops at the end of a restricted rail`, () => {
    const f = fixture(side); f.m.team.lanes[side].min = 4.6;
    finishShove(f); assert.equal(f.a.z, 4.6); assert.equal(f.a.body.translation().x, Math.fround(f.m.team.lanes[side].x)); f.s.dispose();
  });
  check(`side ${side}: one contact produces one check, even while the paddle remains held`, () => {
    const f = fixture(side); finishShove(f);
    for (let i = 0; i < 480; i++) { f.m.team.preStep(); f.s.step(); f.m.team.postStep(); }
    assert.equal(f.events.length, 1); assert.equal(f.m.team.stats.checks, 1); f.s.dispose();
  });
}
check('mirrored full strokes have matching impact and rail distance', () => {
  const left = fixture(0), right = fixture(1); assert.ok(Math.abs(left.events[0].distance - right.events[0].distance) < 1e-6);
  left.s.dispose(); right.s.dispose();
});
check('the same inputs and initial conditions give the same check', () => {
  const a = fixture(0), b = fixture(0); assert.deepEqual(a.events, b.events); assert.equal(finishShove(a), finishShove(b)); a.s.dispose(); b.s.dispose();
});
for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) for (const hops of [false, true]) check(`${difficulty}, hops ${hops}: two minutes of scrambling stays bounded with live opponents`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); s.setHops(hops); m.start(difficulty, 1024);
  let total = 0, maxDistance = 0, last = new Map<number, number>();
  m.team.onCheck = e => {
    assert.ok(e.distance > 0 && e.distance <= .95); assert.ok(e.strength >= 0 && e.strength <= 1);
    assert.ok(e.tick - (last.get(e.index) ?? -1000) >= MATCH_CHECK_TUNING.cooldown / C.dt);
    last.set(e.index, e.tick); maxDistance = Math.max(maxDistance, e.distance); total++;
  };
  for (let i = 0; i < 14400; i++) {
    if (m.winner) { m.start(difficulty, 1024 + i); last.clear(); }
    s.held = [i % 97 < 14, i % 119 < 16]; m.step();
    for (const a of m.team.skaters) {
      const lane = m.team.lanes[a.index]; assert.ok(a.z >= lane.min && a.z <= lane.max);
      assert.equal(a.body.translation().x, Math.fround(lane.x)); assert.equal(a.body.translation().y, 0);
    }
    assert.equal(s.scores.fault, 0); assert.ok(Math.hypot(s.puck.linvel().x, s.puck.linvel().z) <= C.maxSpeed + .0001);
  }
  assert.ok(total > 0); observations.push({ kind: 'scramble', difficulty, hops, seconds: 120, totalChecks: total, maxDistance, score: m.score, restarts: m.recoveries }); s.dispose();
});
writeFileSync('evidence/checking-results.json', JSON.stringify({ checks, observations }, null, 2));
const failed = checks.filter((c: any) => !c.passed);
console.log(JSON.stringify({ passed: checks.length - failed.length, failed, observations }, null, 2));
if (failed.length) process.exitCode = 1;
