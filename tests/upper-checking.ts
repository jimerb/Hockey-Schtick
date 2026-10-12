import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { C, OFFENSE, MATCH_CHECK_TUNING, MATCH_PLAY_TUNING, MATCH_FLIPPER_RUBBER } from '../src/config';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import type { CheckEvent } from '../src/opponents';

await initPhysics();
const checks: { name: string; passed: boolean; error?: string }[] = [], observations: object[] = [];
function check(name: string, fn: () => void) { try { fn(); checks.push({ name, passed: true }); } catch (e) { checks.push({ name, passed: false, error: String(e) }); } }
function fixture(side: number, mode = 'full', z = -4.35, enabled = true) {
  const sim = new RinkPhysics(), match = new HockeyMatch(sim, 3, true, MATCH_PLAY_TUNING, MATCH_FLIPPER_RUBBER, enabled ? MATCH_CHECK_TUNING : null);
  match.start('normal', 42); while (match.phase !== 'playing') match.step();
  match.team.skaters.forEach(s => s.body.setEnabled(false)); match.team.goalie.setEnabled(false); match.team.goalieStick.setEnabled(false);
  sim.downhill = 0; sim.place({ x: 0, y: .11, z: 2 }, { x: 0, y: 0, z: 0 });
  if (mode === 'held' || mode === 'return') { sim.shootOffense(side); for (let i = 0; i < 25; i++) sim.step(); }
  const skater = match.team.skaters[side], lane = match.team.lanes[side];
  skater.body.setEnabled(true); skater.z = skater.previousZ = z; skater.angle = skater.previousAngle = side === 0 ? Math.PI : 0;
  skater.stage = 'windup'; skater.timer = 10; skater.meetAt = 100; match.team.active = skater.index;
  const p = { x: lane.x, y: 0, z }, q = { x: 0, y: Math.sin(-skater.angle / 2), z: 0, w: Math.cos(skater.angle / 2) };
  skater.body.setTranslation(p, true); skater.body.setNextKinematicTranslation(p); skater.body.setRotation(q, true); skater.body.setNextKinematicRotation(q);
  const events: CheckEvent[] = []; match.team.onCheck = e => events.push({ ...e });
  if (mode === 'return') sim.releaseOffense(side); else sim.shootOffense(side);
  for (let i = 0; i < 25; i++) { sim.step(); match.team.postStep(); }
  return { sim, match, skater, events };
}
for (const side of [0,1]) {
  check(`side ${side}: real upper contact pushes a skater smoothly along its rail and triggers the normal check cue`, () => {
    const f = fixture(side), { sim, match, skater, events } = f;
    try {
      assert.equal(events.length, 1); const event = events[0];
      assert.equal(event.paddle, 'upper'); assert.equal(event.side, side); assert.equal(event.part, 'stick');
      assert.ok(event.distance > .1 && event.distance <= .95); assert.equal(event.direction, -1);
      assert.equal(skater.stage, 'checked'); assert.equal(match.team.active, -1);
      const before = skater.z;
      while (skater.checkTime < skater.checkDuration) {
        const z = skater.z; match.team.preStep(); sim.step(); match.team.postStep();
        assert.ok(skater.z <= z + 1e-6); assert.ok(z - skater.z <= 6 * C.dt + 1e-6);
        assert.equal(skater.body.translation().x, Math.fround(match.team.lanes[side].x)); assert.equal(skater.body.translation().y, 0);
        assert.ok(skater.z >= match.team.lanes[side].min && skater.z <= match.team.lanes[side].max);
      }
      assert.ok(Math.abs(before - skater.z - event.distance) < 1e-6);
      for (let i = 0; i < 120; i++) { sim.step(); match.team.postStep(); }
      assert.equal(events.length, 1, 'holding the paddle cannot repeatedly shove');
      observations.push({ side, event, moved: before - skater.z });
    } finally { sim.dispose(); }
  });
  for (const mode of ['held','return']) check(`side ${side}: ${mode} upper paddle does not check repeatedly`, () => {
    const f = fixture(side,mode); try { assert.equal(f.events.length,0); } finally { f.sim.dispose(); }
  });
  check(`side ${side}: a distant skater and disabled checking receive no artificial shove`, () => {
    for (const f of [fixture(side,'full',-2),fixture(side,'full',-4.35,false)]) {
      try { assert.equal(f.events.length,0); assert.equal(f.skater.checkDuration,0); } finally { f.sim.dispose(); }
    }
  });
  check(`side ${side}: upper checking does not kick a remote puck`, () => {
    const enabled = fixture(side), disabled = fixture(side,'full',-4.35,false);
    try { assert.ok(enabled.events.length); assert.deepEqual(enabled.sim.puck.translation(),disabled.sim.puck.translation()); assert.deepEqual(enabled.sim.puck.linvel(),disabled.sim.puck.linvel()); }
    finally { enabled.sim.dispose(); disabled.sim.dispose(); }
  });
  check(`side ${side}: upper check clamps at the end of a shortened rail and resets on rematch`, () => {
    const f = fixture(side);
    try {
      f.match.team.lanes[side].min = -4.45;
      while (f.skater.checkTime < f.skater.checkDuration) { f.match.team.preStep(); f.sim.step(); f.match.team.postStep(); }
      assert.equal(f.skater.z,-4.45); f.match.start('normal',42);
      assert.equal(f.skater.checkDuration,0); assert.deepEqual(f.skater.paddleContact,[false,false,false,false]);
    } finally { f.sim.dispose(); }
  });
}
check('mirrored upper checks have the same strength and displacement', () => {
  const left = fixture(0), right = fixture(1);
  try { assert.ok(Math.abs(left.events[0].distance - right.events[0].distance) < 1e-6); assert.ok(Math.abs(left.events[0].impact-right.events[0].impact)<1e-5); }
  finally { left.sim.dispose(); right.sim.dispose(); }
});
check('upper checks stay bounded during live play with both side pairs', () => {
  const sim = new RinkPhysics(), match = new HockeyMatch(sim,3,true); match.start('normal',1024);
  let upperChecks = 0;
  match.team.onCheck = e => { if (e.paddle === 'upper') upperChecks++; assert.ok(e.distance <= MATCH_CHECK_TUNING.maxDistance); };
  try {
    for (let i = 0; i < 120 * 60; i++) {
      if (match.winner) match.start('normal',1024+i);
      sim.held = [i%97<16,i%119<16];
      sim.held.forEach((held,side) => { if (held) sim.shootOffense(side); else sim.releaseOffense(side); }); match.step();
      for (const s of match.team.skaters) { const lane = match.team.lanes[s.index]; assert.ok(s.z>=lane.min&&s.z<=lane.max); assert.equal(s.body.translation().x,Math.fround(lane.x)); }
      assert.equal(sim.scores.fault,0);
    }
    observations.push({ kind:'live-play',upperChecks,score:match.score,length:OFFENSE.length });
  } finally { sim.dispose(); }
});
const failed = checks.filter(c => !c.passed);
writeFileSync('evidence/upper-checking-playtest.json',JSON.stringify({ date:new Date().toISOString(),tuning:OFFENSE,checks,observations },null,2));
console.log(JSON.stringify({ passed:checks.length-failed.length,failed,observations },null,2)); assert.equal(failed.length,0);
