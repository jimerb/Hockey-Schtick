import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { C, MATCH_FLIPPER_RUBBER, MATCH_MOTION } from '../src/config';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import { FlipperDemo } from '../src/flipper-demo';

await initPhysics();
const checks: object[] = [], observations: object[] = [];
function check(name: string, fn: () => void) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (e) { checks.push({ name, passed: false, error: String(e) }); }
}
function rink(soft = true) {
  const s = new RinkPhysics(); s.setMotion(MATCH_MOTION); s.addReturnApron(); s.addCradleGuides();
  s.setFlipperRubber(soft ? MATCH_FLIPPER_RUBBER : null); return s;
}
function advance(s: RinkPhysics, ticks: number) { for (let t = 0; t < ticks; t++) s.step(); }
function catchPuck(side: number, x = 3, hops = false) {
  const s = rink(); s.setHops(hops); s.held[side] = true; advance(s, 20);
  s.place({ x: (side === 0 ? -1 : 1) * x, y: .11, z: 0 }, { x: 0, y: 0, z: 5 }); advance(s, 1200); return s;
}
for (const side of [0, 1]) for (const hops of [false, true]) check(`a stationary ${side ? 'right' : 'left'} flipper cushions a real impact, hops ${hops}`, () => {
  const impact = (soft: boolean) => {
    const s = rink(soft); s.downhill = 0; s.setHops(hops); s.held[side] = true; advance(s, 20);
    s.place({ x: side === 0 ? -3 : 3, y: .11, z: 3 }, { x: 0, y: 0, z: 6 }); let v: { x: number; z: number } | null = null;
    s.onContact = c => { if (!v && c.label.includes('flipper')) v = { ...s.puck.linvel() }; };
    for (let i = 0; i < 100 && !v; i++) s.step(); assert.ok(v); s.dispose(); return v as { x: number; z: number };
  };
  const hard = impact(false), soft = impact(true);
  assert.ok(Math.hypot(soft.x, soft.z) < Math.hypot(hard.x, hard.z) * .65);
  assert.ok(Math.hypot(soft.x, soft.z) > .5, 'A cushion must retain physical motion, not lock the puck');
  observations.push({ kind: 'cushion', side, hops, hard, soft });
});
for (const side of [0, 1]) for (const x of [2, 3, 4]) for (const hops of [false, true]) check(`a gentle feed reaches a physical cradle: side ${side}, x ${x}, hops ${hops}`, () => {
  const s = catchPuck(side, x, hops);
  assert.equal(s.result, null); assert.equal(s.cradledSide(), side); assert.ok(Math.hypot(s.puck.linvel().x, s.puck.linvel().z) < .1);
  assert.ok(Math.abs(s.current.puck.x) > 3.8 && Math.abs(s.current.puck.x) < 4.5);
  const p = { ...s.current.puck }; advance(s, 600);
  assert.ok(Math.hypot(s.current.puck.x - p.x, s.current.puck.z - p.z) < .05); assert.equal(s.cradledSide(), side); s.dispose();
});
for (const side of [0, 1]) check(`releasing the ${side ? 'right' : 'left'} cradle opens a feed toward the tip; waiting too long can drain`, () => {
  const s = catchPuck(side), start = Math.abs(s.current.puck.x); s.held[side] = false;
  assert.equal(s.cradledSide(), null); advance(s, 120);
  assert.ok(Math.abs(s.current.puck.x) < start - .6); assert.ok(s.puck.linvel().z > 0);
  advance(s, 1000); assert.equal(s.result, 'conceded'); assert.equal(s.scores.fault, 0); s.dispose();
});
function shot(side: number, releaseTicks: number, hops = false) {
  const s = catchPuck(side, 3, hops); assert.equal(s.cradledSide(), side);
  s.held[side] = false; advance(s, releaseTicks); const released = { ...s.current.puck };
  s.held[side] = true; let contact = false;
  for (let t = 0; t < 15; t++) {
    if (s.flipperColliders[side].some(c => !!s.puckCollider.contactCollider(c, .015))) contact = true;
    s.step();
    s.flipperColliders[side].forEach(c => s.world.contactPair(s.puckCollider, c, manifold => { if (manifold.numSolverContacts() > 0) contact = true; }));
  }
  const velocity = { ...s.puck.linvel() }; assert.ok(contact, 'The shot must come from a physical contact');
  s.held[side] = false; advance(s, 800);
  const row = { side, releaseSeconds: releaseTicks * C.dt, hops, released, velocity, result: s.result, goals: s.scores.goal, faults: s.scores.fault }; s.dispose(); return row;
}
for (const side of [0, 1]) for (const hops of [false, true]) check(`release timing changes the real shot direction: side ${side}, hops ${hops}`, () => {
  const early = shot(side, 60, hops), later = shot(side, 90, hops);
  assert.ok(early.velocity.z < -8 && later.velocity.z < -8);
  const difference = Math.abs(Math.atan2(early.velocity.x, -early.velocity.z) - Math.atan2(later.velocity.x, -later.velocity.z));
  assert.ok(difference > .18, 'Contact location/timing must give meaningfully different aim');
  assert.ok(early.velocity.x * later.velocity.x < 0); assert.equal(early.faults + later.faults, 0);
  observations.push({ kind: 'aim', early, later, differenceDegrees: difference * 180 / Math.PI });
});
for (const side of [0, 1]) check(`a deliberate release-and-shot can physically score from the ${side ? 'right' : 'left'} cradle`, () => {
  const row = shot(side, 120); assert.equal(row.result, 'goal'); assert.equal(row.goals, 1); assert.equal(row.faults, 0); observations.push(row);
});
check('the same feed and catch/release inputs give the same shot', () => { assert.deepEqual(shot(0, 120), shot(0, 120)); });
check('pressing at a distant puck does not attach or steer it', () => {
  const s = rink(); s.place({ x: .4, y: .11, z: -3 }, { x: 0, y: 0, z: 0 }); s.held = [true, true]; advance(s, 30);
  assert.equal(s.cradledSide(), null); assert.equal(s.puck.linvel().x, 0); assert.ok(s.puck.linvel().z > .6 && s.puck.linvel().z < .9); s.dispose();
});
for (const side of [0, 1]) check(`a deliberate held cradle does not trigger the match's stuck-puck whistle: side ${side}`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start('normal', 42); while (m.phase !== 'playing') m.step();
  m.team.skaters.forEach(a => a.body.setEnabled(false)); m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
  s.held[side] = true; s.place({ x: side === 0 ? -3 : 3, y: .11, z: 0 }, { x: 0, y: 0, z: 5 });
  for (let t = 0; t < 1800; t++) m.step();
  assert.equal(s.cradledSide(), side); assert.equal(m.recoveries, 0); assert.deepEqual(m.score, { you: 0, cpu: 0 });
  s.held[side] = false; for (let t = 0; t < 1200 && m.phase === 'playing'; t++) m.step(); assert.equal(m.score.cpu, 1); s.dispose();
});
check('holding a flipper does not exempt an unrelated stationary wedge', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start('normal', 42); while (m.phase !== 'playing') m.step();
  m.team.skaters.forEach(a => a.body.setEnabled(false)); s.downhill = 0; s.held = [true, true];
  s.place({ x: 4.8, y: .11, z: -1 }, { x: 0, y: 0, z: 0 }); for (let t = 0; t < 440; t++) m.step(); assert.equal(m.recoveries, 1); s.dispose();
});
for (const side of [0, 1]) check(`a moving opponent's physical blade can dislodge the ${side ? 'right' : 'left'} cradle`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start('normal', 42); while (m.phase !== 'playing') m.step();
  m.team.skaters.forEach(a => a.body.setEnabled(false)); m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
  s.held[side] = true; advance(s, 20); s.place({ x: side === 0 ? -3 : 3, y: .11, z: 0 }, { x: 0, y: 0, z: 5 }); advance(s, 1200); assert.equal(s.cradledSide(), side);
  const a = m.team.skaters[side], p = { ...s.current.puck }, sign = side === 0 ? -1 : 1;
  a.body.setEnabled(true); a.body.setTranslation({ x: sign * 2.8, y: 0, z: 4.9 }, true);
  const yaw = (angle: number) => ({ x: 0, y: Math.sin(-angle / 2), z: 0, w: Math.cos(angle / 2) });
  const base = side === 0 ? Math.PI : 0; a.body.setRotation(yaw(base + (side === 0 ? -.9 : .9)), true);
  let contact = false, displaced = false;
  for (let t = 0; t < 100; t++) {
    a.body.setNextKinematicTranslation({ x: sign * 2.8, y: 0, z: 4.9 });
    a.body.setNextKinematicRotation(yaw(base + (side === 0 ? -1 : 1) * (.9 - Math.min(t, 36) * .025))); s.step();
    if (s.contacts.some(c => c.label === `skater-${side}-blade`)) contact = true;
    if (Math.hypot(s.current.puck.x - p.x, s.current.puck.z - p.z) > .25) displaced = true;
  }
  assert.ok(contact && displaced, 'The puck must remain available to physical opponent contact'); assert.equal(s.scores.fault, 0); s.dispose();
});
let fastCases = 0;
for (const side of [0, 1]) check(`the actual wing logic can contest the ${side ? 'right' : 'left'} cradle without a near-goal shot assist`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start('normal', 42); while (m.phase !== 'playing') m.step();
  m.team.skaters.forEach(a => a.body.setEnabled(false)); m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
  s.held[side] = true; advance(s, 20); s.place({ x: side === 0 ? -3 : 3, y: .11, z: 0 }, { x: 0, y: 0, z: 5 }); advance(s, 1200); assert.equal(s.cradledSide(), side);
  m.team.skaters[side].body.setEnabled(true); const p = { ...s.current.puck }; let poked = false, contact = false, displaced = false;
  for (let t = 0; t < 1200 && m.phase === 'playing'; t++) {
    m.step(); if (m.team.skaters[side].stage === 'poke') poked = true;
    if (s.contacts.some(c => c.label === `skater-${side}-blade`)) contact = true;
    if (Math.hypot(s.current.puck.x - p.x, s.current.puck.z - p.z) > .25) displaced = true;
    if (poked && contact && displaced) break;
  }
  assert.ok(poked && contact && displaced); assert.equal(m.team.stats.strikes, 0); assert.equal(s.scores.fault, 0); s.dispose();
});
for (const side of [0, 1]) for (const raised of [false, true]) for (const hops of [false, true]) for (const speed of [8, 20, 35]) for (const along of [1.5, 2, 2.5]) check(`rubber fast impact: side ${side}, raised ${raised}, hops ${hops}, speed ${speed}, shaft ${along}`, () => {
  const s = rink(); s.downhill = 0; s.setHops(hops); s.held[side] = raised; advance(s, 20);
  const sign = side === 0 ? 1 : -1, a = s.angles[side], nx = sign * Math.sin(a), nz = -Math.cos(a), distance = C.flipperWidth / 2 + C.puckRadius + 1;
  s.place({ x: -sign * C.pivotX + sign * Math.cos(a) * along + nx * distance, y: .11, z: C.pivotZ + Math.sin(a) * along + nz * distance }, { x: -nx * speed, y: 0, z: -nz * speed });
  for (let t = 0; t < 90 && s.active; t++) s.step();
  assert.ok(s.contacts.some(c => c.label === (side === 0 ? 'left flipper' : 'right flipper'))); assert.equal(s.scores.fault, 0); assert.ok(Number.isFinite(s.current.puck.x)); fastCases++; s.dispose();
});
for (const difficulty of ['easy', 'normal', 'hard'] as const) for (const hops of [false, true]) check(`catch-and-shoot demo uses real flippers against the full team: ${difficulty}, hops ${hops}`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true), demo = new FlipperDemo(); s.setHops(hops); m.start(difficulty, 1024);
  for (let t = 0; t < 120 * 120 && !m.winner; t++) { s.held = demo.step(s); m.step(); assert.equal(s.scores.fault, 0); }
  assert.ok(demo.catches > 0 && demo.shots > 0); assert.equal(m.recoveries, 0);
  observations.push({ kind: 'full-team-control-demo', difficulty, hops, catches: demo.catches, releaseAttempts: demo.shots, score: m.score, recoveries: m.recoveries }); s.dispose();
});
const failed = checks.filter((c: any) => !c.passed), report = { date: new Date().toISOString(), passed: checks.length - failed.length, failed: failed.length, fastCases, tuning: MATCH_FLIPPER_RUBBER, observations, checks };
writeFileSync('evidence/flipper-control-results.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, failed, fastCases, fullTeam: observations.filter((o: any) => o.kind === 'full-team-control-demo') }, null, 2));
assert.equal(failed.length, 0, 'Flipper control checks failed; see evidence/flipper-control-results.json');
