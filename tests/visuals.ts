import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as T from 'three';
import { hockeyFigure, iceTextures, batchStatic } from '../src/art';
import { hockeyGoal } from '../src/goal-art';
import { ArenaCrowd } from '../src/crowd';

// Geometry/animation tests run without a GPU. Canvas drawing is deliberately not validated here.
const gradient = { addColorStop() {} };
const context = new Proxy({}, { get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : () => {} });
Object.assign(globalThis, { document: { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } });
const checks: { name: string; passed: boolean; error?: string }[] = [], observations: object[] = [];
function check(name: string, fn: () => void) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, error: String(error) }); }
}
function geometryBudget(root: T.Object3D) {
  let meshes = 0, triangles = 0;
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return; meshes++;
    triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3;
    for (const attribute of Object.values(node.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value), 'finite mesh attributes');
  });
  return { meshes, triangles };
}
for (const goalie of [false, true]) {
  const { group, blade } = hockeyFigure(goalie, goalie ? 1 : 17);
  check(`${goalie ? 'goalie' : 'skater'} geometry stays within the existing camera height and draw budget`, () => {
    const budget = geometryBudget(group), box = new T.Box3().setFromObject(group);
    assert.ok(box.min.y > -.01 && box.max.y < 1.6);
    assert.ok(budget.meshes <= (goalie ? 18 : 14)); assert.ok(budget.triangles < 80000);
    observations.push({ kind: goalie ? 'goalie' : 'skater', ...budget, bounds: { min: box.min.toArray(), max: box.max.toArray() } });
  });
  if (goalie) check('goalie stick remains a separately movable mesh inside its original blade footprint', () => {
    assert.ok(blade); const box = new T.Box3().setFromObject(blade!);
    assert.ok(box.min.x >= -.451 && box.max.x <= .451);
    const before = new T.Box3().setFromObject(group); blade!.position.z += .4;
    assert.ok(new T.Box3().setFromObject(group).max.z > before.max.z); blade!.position.z -= .4;
  });
  else check('skater blade stays in the accepted collision footprint instead of lengthening reach', () => {
    const p = new T.Vector3(); let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    group.updateMatrixWorld(true); group.traverse(node => {
      if (!(node instanceof T.Mesh)) return; const positions = node.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld); if (p.x < .82 || p.y > .245) continue;
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
    });
    assert.ok(minX >= .819 && maxX <= 1.301); assert.ok(minZ >= -.091 && maxZ <= .091);
  });
}
const goal = hockeyGoal();
check('batching preserves transformed roots, including the independently moving goalie stick', () => {
  const root = new T.Group(); root.position.set(2, 1, .42); root.rotation.y = .4;
  const part = new T.Mesh(new T.BoxGeometry(.4,.2,.15), new T.MeshStandardMaterial()); part.position.x = .2; root.add(part);
  const before = new T.Box3().setFromObject(root); batchStatic(root); const after = new T.Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min) < .000001 && before.max.distanceTo(after.max) < .000001);
});
check('woven goal geometry is finite and batched within a small draw budget', () => {
  const budget = geometryBudget(goal); assert.ok(budget.meshes <= 8); assert.ok(budget.triangles < 16000); observations.push({ kind: 'goal', ...budget });
});
check('net covers only the roof, rear and sides, leaving the goal mouth open', () => {
  const back = goal.getObjectByName('woven-net-back-and-sides') as T.Mesh, roof = goal.getObjectByName('woven-net-roof') as T.Mesh;
  const box = new T.Box3().setFromObject(roof);
  assert.ok(box.min.y >= 1.14 && box.min.y < 1.2); assert.ok(box.max.y <= 1.401); assert.ok(box.max.z <= -7.649);
  const p = back.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) assert.ok(p.getZ(i) <= -7.649);
  const material = back.material as T.MeshStandardMaterial;
  assert.ok(material.alphaTest > 0); assert.ok(material.map); assert.equal(material.side, T.DoubleSide);
});
check('ice scuff and roughness maps use linear data and align with the color texture', () => {
  const textures = iceTextures(); assert.equal(textures.map.colorSpace, T.SRGBColorSpace);
  assert.equal(textures.bumpMap.colorSpace, T.NoColorSpace); assert.equal(textures.roughnessMap.colorSpace, T.NoColorSpace);
  assert.equal(textures.map.image.width / textures.map.image.height, .5);
  assert.equal(textures.bumpMap.image.width / textures.bumpMap.image.height, .5);
  assert.equal(textures.roughnessMap.image.width / textures.roughnessMap.image.height, .5);
});
const crowd = new ArenaCrowd(), instances: T.InstancedMesh[] = [];
crowd.group.traverse(node => { if (node instanceof T.InstancedMesh) instances.push(node); });
const matrices = () => instances.map(mesh => [...mesh.instanceMatrix.array]);
const cabinetClearance = (x: number, z: number) => Math.hypot(Math.max(Math.abs(x) - 3.8, 0), Math.max(Math.abs(z) - 7.4, 0));
check('crowd density and geometry are bounded without one draw per person', () => {
  assert.ok(crowd.fans.length >= 300 && crowd.fans.length <= 400); assert.ok(instances.length <= 13);
  assert.ok(crowd.fans.every(f => cabinetClearance(f.x, f.z) > 2.5));
  assert.ok(crowd.fans.filter(f => f.z < -9.6).length > 60, 'far end is populated');
  assert.ok(crowd.fans.some(f => f.z > 7.5), 'near corners wrap around');
  assert.ok(new Set(crowd.fans.map(f => f.height)).size > 40);
  observations.push({ kind: 'crowd', ...crowd.presentation });
});
check('more distant tiers have less contrast', () => {
  const brightness = (row: number) => { const fans = crowd.fans.filter(f => f.row === row); return fans.reduce((sum, f) => sum + f.skin.r + f.skin.g + f.skin.b, 0) / fans.length; };
  assert.ok(brightness(3) < brightness(0) * .75);
});
check('idle crowd motion moves shared instance poses', () => {
  const before = matrices(); crowd.update(.04, false, true); assert.notDeepEqual(matrices(), before);
});
check('pause, reduced motion or a hidden crowd suppress all animation writes', () => {
  const before = matrices(), versions = instances.map(m => m.instanceMatrix.version);
  for (let i = 0; i < 180; i++) crowd.update(1 / 60, true, false);
  assert.deepEqual(matrices(), before); assert.deepEqual(instances.map(m => m.instanceMatrix.version), versions);
});
check('goal reaction changes the pose without waiting for another idle frame', () => {
  const before = matrices(); crowd.update(.001, true, true); assert.notDeepEqual(matrices(), before);
});
check('decorative updates are throttled below the game physics rate', () => {
  const versions = instances.map(m => m.instanceMatrix.version);
  crowd.update(.001, true, true); assert.deepEqual(instances.map(m => m.instanceMatrix.version), versions);
});
check('reduced-motion reset returns to the initial crowd pose', () => {
  const fresh = new ArenaCrowd(), expected: number[][] = [];
  fresh.group.traverse(node => { if (node instanceof T.InstancedMesh) expected.push([...node.instanceMatrix.array]); });
  crowd.resetMotion(); assert.deepEqual(matrices(), expected);
});
check('sustained idle/goal animation stays finite and off the ice', () => {
  const timings: number[] = [], matrix = new T.Matrix4(), point = new T.Vector3();
  for (let i = 0; i < 300; i++) { const start = performance.now(); crowd.update(1 / 30, i % 90 < 40, true); timings.push(performance.now() - start); }
  for (const mesh of instances) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); assert.ok(matrix.elements.every(Number.isFinite)); point.setFromMatrixPosition(matrix);
    assert.ok(cabinetClearance(point.x, point.z) > 2.1); assert.ok(point.y > -.35 && point.y < 2.2);
  }
  timings.sort((a, b) => a - b); observations.push({ kind: 'animation-cpu-only', samples: timings.length, medianMs: timings[150], p95Ms: timings[285], caveat: 'Node CPU only; does not measure browser GPU rendering or FPS' });
});
check('human-goal cheer survives the countdown and freezes while paused', () => {
  crowd.celebrate(); crowd.update(1 / 30, false, true);
  assert.equal(crowd.presentation.cheering, true);
  for (let i = 0; i < 90; i++) crowd.update(1 / 30, false, true);
  assert.equal(crowd.presentation.cheering, true, 'still cheering after the 2.5-second goal/countdown sequence');
  const remaining = crowd.presentation.goalSeconds, before = matrices();
  for (let i = 0; i < 300; i++) crowd.update(1 / 30, false, false);
  assert.equal(crowd.presentation.goalSeconds, remaining); assert.deepEqual(matrices(), before);
  for (let i = 0; i < 45; i++) crowd.update(1 / 30, false, true);
  assert.equal(crowd.presentation.cheering, false);
});
const failed = checks.filter(c => !c.passed);
writeFileSync('evidence/visual-upgrade-results.json', JSON.stringify({ date: new Date().toISOString(), scope: 'Geometry and animation logic; no WebGL, canvas pixels or live browser validation', passed: checks.length - failed.length, failed, checks, observations }, null, 2));
console.log(JSON.stringify({ passed: checks.length - failed.length, failed }, null, 2)); assert.equal(failed.length, 0);
