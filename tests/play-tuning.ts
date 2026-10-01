import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import { C, MATCH_PLAY_TUNING } from '../src/config';
import type { Difficulty } from '../src/opponents';

await initPhysics();
const checks: string[] = [], openings: unknown[] = [], bumps: unknown[] = [];
function check(name: string, run: () => void) { run(); checks.push(name); }
function drop(m: HockeyMatch) { while (m.phase !== 'playing') m.step(); }
const yaw = (angle: number) => ({ x: 0, y: Math.sin(-angle / 2), z: 0, w: Math.cos(angle / 2) });

for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) check(`${difficulty}: 24 isolated center openings vary and can be intercepted`, () => {
  const targets: number[] = [], interceptions: number[] = [];
  for (let seed = 1; seed <= 24; seed++) {
    const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start(difficulty, seed); drop(m);
    // Isolate the center delivery; full-team rallies separately cover intervening wing deflections.
    m.team.skaters.filter(a => a.index !== 2).forEach(a => a.body.setEnabled(false));
    let delivered = false, delay = 0, target = 0, intercepted = false;
    for (let i = 0; i < 400 && m.phase === 'playing' && !intercepted; i++) {
      if (delivered) { delay += C.dt; s.held = [delay > .3 && target < 0, delay > .3 && target > 0]; }
      const before = m.team.stats.openingDeliveries; m.step();
      if (m.team.stats.openingDeliveries > before) {
        const a = m.team.skaters[2], v = s.puck.linvel(); delivered = true; target = a.target.x;
        assert.ok(Math.abs(target) >= 2.2 && Math.abs(target) <= 3.6);
        assert.ok(Math.abs(Math.hypot(v.x, v.z) - 9.5) < 1e-5); assert.ok(v.x * target > 0 && v.z > 0);
        let contact = false; s.world.contactPair(s.puckCollider, a.blade, manifold => { for (let k = 0; k < manifold.numContacts(); k++) if (manifold.contactDist(k) <= .02) contact = true; }); assert.ok(contact);
        targets.push(target);
      }
      if (delivered) {
        const flipper = s.flippers[target < 0 ? 0 : 1];
        s.world.forEachCollider(collider => {
          if (collider.parent()?.handle !== flipper.handle) return;
          s.world.contactPair(s.puckCollider, collider, manifold => { for (let k = 0; k < manifold.numContacts(); k++) if (manifold.contactDist(k) <= .02) intercepted = true; });
        });
      }
      if (!delivered) assert.ok(Math.hypot(s.puck.linvel().x, s.puck.linvel().z) < 3, 'No unassisted opening slam during preparation');
    }
    assert.ok(delivered && intercepted, `${difficulty}/${seed}: opening should reach the chosen flipper after a 300ms response`);
    assert.ok(Math.abs(s.current.puck.x) > 1.3); assert.equal(m.score.cpu, 0); assert.equal(s.scores.fault, 0); interceptions.push(1); s.dispose();
  }
  assert.ok(targets.some(x => x < 0) && targets.some(x => x > 0)); assert.ok(new Set(targets.map(x => x.toFixed(2))).size > 12);
  openings.push({ difficulty, seeds: 24, minTarget: Math.min(...targets), maxTarget: Math.max(...targets), intercepted: interceptions.length, reactionSeconds: .3 });
});
check('center opening varies again after a goal, while the neutral drop stays centered', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start('normal', 42); const targets: number[] = [];
  for (let rally = 0; rally < 4; rally++) {
    drop(m); assert.deepEqual(s.current.puck, { x: 0, y: Math.fround(.11), z: 0 });
    const previous = m.team.stats.openingDeliveries;
    for (let i = 0; i < 240 && m.team.stats.openingDeliveries === previous; i++) m.step();
    assert.equal(m.team.stats.openingDeliveries, previous + 1); targets.push(m.team.skaters[2].target.x);
    s.place({ x: 0, y: .11, z: 8.4 }, { x: 0, y: 0, z: 20 });
    for (let i = 0; i < 30 && m.phase === 'playing'; i++) m.step(); assert.equal(m.phase, 'goal');
  }
  assert.equal(new Set(targets).size, 4); assert.ok(targets.some(x => x < 0) && targets.some(x => x > 0)); s.dispose();
});

function bodyImpact(angle: number, offset: number, speed: number, hops: boolean, rearBoost: number, kind: 'rear' | 'side' | 'front', continueToGoal = false) {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true, { ...MATCH_PLAY_TUNING, rearBoost }); s.setHops(hops); m.start('normal', 42); drop(m);
  const a = m.team.skaters[2]; m.team.skaters.forEach(skater => skater.body.setEnabled(skater === a));
  m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false); a.blade.setEnabled(false);
  a.angle = angle; a.body.setRotation(yaw(angle), true); a.body.setNextKinematicRotation(yaw(angle));
  const theta = angle + (kind === 'rear' ? Math.PI : kind === 'side' ? Math.PI / 2 : 0) + offset, nx = Math.cos(theta), nz = Math.sin(theta), home = a.z;
  s.downhill = continueToGoal ? 3.2 : 0;
  s.place({ x: nx * 1.2, y: .11, z: home + nz * 1.2 }, { x: -nx * speed, y: 0, z: -nz * speed });
  let hit = false, response = { x: 0, y: 0, z: 0 }, ordinary = { ...response }, touches = false;
  for (let i = 0; i < (continueToGoal ? 360 : Math.max(120, Math.ceil(.9 / speed / C.dt))) && s.active; i++) {
    m.team.preStep(); a.angle = angle; a.z = home; a.body.setNextKinematicTranslation({ x: 0, y: 0, z: home }); a.body.setNextKinematicRotation(yaw(angle));
    s.step(); const before = { ...s.puck.linvel() }, count = m.team.stats.rearBumps; m.team.postStep();
    if (m.team.stats.rearBumps > count) {
      touches = !!s.puckCollider.contactCollider(a.torso, .005); assert.ok(touches);
    }
    const actualBodyContact = !!s.puckCollider.contactCollider(a.torso, .005);
    if (!hit && actualBodyContact) { hit = true; ordinary = before; response = { ...s.puck.linvel() }; if (!continueToGoal) break; }
  }
  assert.ok(hit); const result = { response, ordinary, rearBumps: m.team.stats.rearBumps, touches, score: { ...m.score }, fault: s.scores.fault, result: s.result };
  s.dispose(); return result;
}
for (const angle of [0, Math.PI / 2, .7]) for (const speed of [3, 8]) for (const hops of [false, true]) check(`rear bumper: heading ${angle}, incoming ${speed}, hops ${hops}`, () => {
  const ordinary = bodyImpact(angle, 0, speed, hops, 0, 'rear'), tuned = bodyImpact(angle, 0, speed, hops, 2.4, 'rear');
  assert.equal(tuned.rearBumps, 1, JSON.stringify({ angle, speed, hops, ordinary, tuned })); assert.ok(tuned.touches); assert.equal(tuned.fault, 0);
  const delta = Math.hypot(tuned.response.x - ordinary.response.x, tuned.response.z - ordinary.response.z);
  assert.ok(delta > .2 && delta <= 2.40001); assert.equal(tuned.response.y, ordinary.response.y);
  assert.ok(Math.hypot(tuned.response.x, tuned.response.z) <= 12.01);
  assert.ok(tuned.response.x * -Math.cos(angle) + tuned.response.z * -Math.sin(angle) > 0, 'Rebound must move away from the jersey back');
  bumps.push({ kind: 'rear', angle, speed, hops, ordinary: ordinary.response, tuned: tuned.response, extraSpeed: delta });
});
for (const kind of ['side', 'front'] as const) for (const angle of [0, .7]) for (const hops of [false, true]) check(`${kind} body contact stays identical: heading ${angle}, hops ${hops}`, () => {
  const ordinary = bodyImpact(angle, 0, 8, hops, 0, kind), tuned = bodyImpact(angle, 0, 8, hops, 2.4, kind);
  assert.deepEqual(tuned.response, ordinary.response); assert.equal(tuned.rearBumps, 0); assert.equal(tuned.fault, 0);
});
for (const offset of [-.35, .35]) check(`an angled rear impact follows the contact surface: offset ${offset}`, () => {
  const tuned = bodyImpact(0, offset, 8, false, 2.4, 'rear'); assert.equal(tuned.rearBumps, 1);
  assert.ok(tuned.response.x < 0); assert.ok(tuned.response.z * -offset > 0 && Math.abs(tuned.response.z) > 1); assert.equal(tuned.fault, 0);
});
check('fast rear rebounds are not accelerated beyond the moderate bumper limit', () => {
  const ordinary = bodyImpact(0, 0, 35, false, 0, 'rear'), tuned = bodyImpact(0, 0, 35, false, 2.4, 'rear');
  assert.ok(Math.hypot(tuned.response.x - ordinary.response.x, tuned.response.z - ordinary.response.z) <= 2.40001);
  assert.ok(Math.hypot(tuned.response.x, tuned.response.z) <= Math.max(24, Math.hypot(ordinary.response.x, ordinary.response.z)) + 1e-5);
  assert.ok(tuned.rearBumps <= 1); assert.ok(Math.hypot(tuned.response.x, tuned.response.z) <= C.maxSpeed);
});
check('a slow touch does not repeatedly pump energy into the puck', () => {
  const ordinary = bodyImpact(0, 0, .3, false, 0, 'rear'), tuned = bodyImpact(0, 0, .3, false, 2.4, 'rear');
  assert.deepEqual(tuned.response, ordinary.response); assert.equal(tuned.rearBumps, 0);
});
check('enabling rear bumpers preserves the first actual blade strike exactly', () => {
  const strike = (rearBoost: number) => {
    const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true, { ...MATCH_PLAY_TUNING, rearBoost }); m.start('normal', 1024); drop(m);
    for (let i = 0; i < 240 && m.team.stats.strikes === 0; i++) m.step();
    assert.equal(m.team.stats.strikes, 1); assert.equal(m.team.stats.rearBumps, 0);
    const result = { velocity: { ...s.puck.linvel() }, target: m.team.skaters[2].target, bladeRestitution: m.team.skaters[2].blade.restitution(), bodyRestitution: m.team.skaters[2].torso.restitution() }; s.dispose(); return result;
  };
  assert.deepEqual(strike(2.4), strike(0));
});
check('a rear deflection can travel into the opponents own net and counts as your goal', () => {
  const tuned = bodyImpact(Math.PI / 2, 0, 8, false, 2.4, 'rear', true);
  assert.equal(tuned.rearBumps, 1); assert.equal(tuned.result, 'goal'); assert.deepEqual(tuned.score, { you: 1, cpu: 0 }); assert.equal(tuned.fault, 0);
});
const report = { date: new Date().toISOString(), passed: checks.length, failed: 0, openings, bumps, checks };
writeFileSync('evidence/play-tuning-results.json', JSON.stringify(report, null, 2)); console.log(`${checks.length} opening and rear-bumper tuning checks passed.`);
