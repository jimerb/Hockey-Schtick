import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { writeFileSync } from 'node:fs';
import { C, OFFENSE, MATCH_FLIPPER_RUBBER } from '../src/config';
import { initPhysics, RinkPhysics } from '../src/physics';

await initPhysics();
const legacyHeight = process.argv.includes('--legacy-height');
const checks: { name: string; passed: boolean; error?: string }[] = [];
function check(name: string, run: () => void) { try { run(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: String(error) }); } }
function setup(upper: boolean, side: number, hops: boolean) {
  const s = new RinkPhysics(); s.downhill = 0; s.setHops(hops); s.setFlipperRubber(MATCH_FLIPPER_RUBBER); s.addOffensePaddles();
  // Isolate paddle contacts; separate integration tests retain the boards, team and goal.
  const target = upper ? s.offensePaddles[side] : s.flippers[side];
  if (legacyHeight) {
    // Restore only the old collider height to demonstrate the original failure.
    for (let i = 0; i < target.numColliders(); i++) {
      const collider = target.collider(i), offset = collider.translationWrtParent()!;
      const shape = collider.shape as RAPIER.Cuboid | RAPIER.Cylinder;
      collider.setShape('halfExtents' in shape ? new RAPIER.Cuboid(shape.halfExtents.x, upper ? .22 : .29, shape.halfExtents.z) : new RAPIER.Cylinder(upper ? .22 : .29, shape.radius));
      collider.setTranslationWrtParent({ x: offset.x, y: 0, z: offset.z });
    }
  }
  s.world.forEachCollider(c => {
    const ice = !c.parent() && Math.abs(c.translation().y + .25) < .001;
    if (!ice && c.parent()?.handle !== target.handle && c.handle !== s.puckCollider.handle) c.setEnabled(false);
  });
  s.place({ x: 0, y: .11, z: 0 }, { x: 0, y: 0, z: 0 });
  if (upper) s.shootOffense(side); else s.held[side] = true;
  for (let i = 0; i < 25; i++) s.step();
  return s;
}
function frame(upper: boolean, side: number, angle: number, along: number, front: number) {
  const direction = side === 0 ? 1 : -1, x = upper ? OFFENSE.pivotX : C.pivotX, z = upper ? OFFENSE.pivotZ : C.pivotZ;
  return { x: -direction * x + direction * (Math.cos(angle) * along + Math.sin(angle) * front), y: .11, z: z + Math.sin(angle) * along - Math.cos(angle) * front };
}
function local(s: RinkPhysics, upper: boolean, side: number) {
  const p = s.puck.translation(), a = upper ? s.offenseAngles[side] : s.angles[side], sign = side === 0 ? 1 : -1;
  const dx = (p.x + sign * (upper ? OFFENSE.pivotX : C.pivotX)) * sign, dz = p.z - (upper ? OFFENSE.pivotZ : C.pivotZ);
  return { along: dx * Math.cos(a) + dz * Math.sin(a), front: dx * Math.sin(a) - dz * Math.cos(a), y: p.y };
}
for (const upper of [false,true]) for (const side of [0,1]) for (const hops of [false,true]) for (const fraction of [.02,.25,.5,.75,.98]) for (const front of [.02,.12]) {
  check(`deep overlap separates across ice: upper ${upper}, side ${side}, hops ${hops}, along ${fraction}, front ${front}`, () => {
    const s = setup(upper,side,hops), width = upper ? OFFENSE.width : C.flipperWidth, length = upper ? OFFENSE.length : C.flipperLength;
    try {
      const angle = upper ? s.offenseAngles[side] : s.angles[side];
      s.place(frame(upper,side,angle,(length - width / 2) * fraction,front), { x: 0, y: 0, z: 0 });
      let freed = false;
      for (let i = 0; i < 100 && s.active; i++) {
        s.step(); const p = local(s,upper,side);
        assert.ok(p.y > .095 && p.y < .35, `vertical escape at ${p.y}`);
        const endDistance = Math.max(-p.along, p.along - (length - width / 2), 0);
        assert.ok(p.front >= -.025 || endDistance > width / 2, `puck crossed to back through paddle: ${p.front}`);
        if (Math.hypot(endDistance, p.front) >= width / 2 + C.puckRadius - .025) { freed = true; break; }
      }
      assert.ok(freed, 'puck remained inside the paddle'); assert.equal(s.scores.fault,0);
    } finally { s.dispose(); }
  });
}
// Starting just clear of the face, follow strikes, holds and returns at maximum speed.
for (const upper of [false,true]) for (const side of [0,1]) for (const hops of [false,true]) for (const motion of ['held','release','restrike']) for (const speed of [0,8,25,40]) for (const fraction of [.1,.4,.7,.92]) {
  check(`face cannot be crossed: upper ${upper}, side ${side}, hops ${hops}, ${motion}, speed ${speed}, along ${fraction}`, () => {
    const s = setup(upper,side,hops), width = upper ? OFFENSE.width : C.flipperWidth, shaft = (upper ? OFFENSE.length : C.flipperLength) - width / 2;
    try {
      const angle = upper ? s.offenseAngles[side] : s.angles[side], p = frame(upper,side,angle,shaft * fraction,width / 2 + C.puckRadius + .015), sign = side === 0 ? 1 : -1;
      s.place(p, { x: -sign * Math.sin(angle) * speed, y: 0, z: Math.cos(angle) * speed });
      for (let i = 0; i < 30 && s.active; i++) {
        const held = motion === 'held' || motion === 'restrike' && i >= 5;
        if (upper) { if (held) s.shootOffense(side); else s.releaseOffense(side); } else s.held[side] = held;
        s.step(); const q = local(s,upper,side);
        // Leaving around either rounded end is legal. Crossing the shaft is not.
        if (q.along < -.05 || q.along > shaft + .05) break;
        assert.ok(q.front >= -.035, `crossed shaft at ${JSON.stringify(q)}`);
        assert.ok(q.y > .095 && q.y < .48, `vertical escape at ${q.y}`);
        // Stop after a clean rebound; this isolated fixture has no side boards.
        if (q.front > width / 2 + C.puckRadius + .4) break;
      }
      assert.equal(s.scores.fault,0);
    } finally { s.dispose(); }
  });
}
const failed = checks.filter(c => !c.passed);
writeFileSync(legacyHeight ? 'evidence/paddle-integrity-before.json' : 'evidence/paddle-integrity-results.json',JSON.stringify({ date:new Date().toISOString(),legacyHeight,passed:checks.length-failed.length,failed:failed.length,checks },null,2));
console.log(JSON.stringify({ passed:checks.length-failed.length,failed:failed.length,examples:failed.slice(0,8) },null,2));
if (legacyHeight) assert.ok(failed.length > 0, 'Legacy geometry must reproduce the bug');
else assert.equal(failed.length,0);
