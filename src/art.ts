import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const surface = (color: number, extra: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: .34, ...extra });
export const paint = {
  red: surface(0xad0925, { roughness: .42 }), rubber: surface(0x96051b, { roughness: .6 }),
  helmet: new T.MeshPhysicalMaterial({ color: 0xbe0b2d, roughness: .22, clearcoat: .85, clearcoatRoughness: .15 }),
  navy: surface(0x061a33, { metalness: .5, roughness: .26 }), white: surface(0xf2f5ec, { roughness: .28 }),
  cream: new T.MeshPhysicalMaterial({ color: 0xfff0db, roughness: .21, clearcoat: .7, clearcoatRoughness: .17 }), chrome: surface(0xb1cad8, { metalness: .92, roughness: .16 }),
  black: surface(0x101722, { roughness: .52 }), skin: surface(0xe8b18d, { roughness: .65 }),
  wood: surface(0xc7a77a, { roughness: .45 }), pad: surface(0xa58656, { roughness: .58 }),
  stitch: surface(0x5e482b, { roughness: .9 }), tape: surface(0xd4d4cb, { roughness: .8 }),
};
export function rounded(parent: T.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: T.Material, radius = .04) {
  const m = new T.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}
export function sphere(parent: T.Object3D, x: number, y: number, z: number, r: number, mat: T.Material, scale = [1, 1, 1]) {
  const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, z); m.scale.set(...scale as [number, number, number]); parent.add(m); return m;
}
export function rod(parent: T.Object3D, a: number[], b: number[], radius: number, mat: T.Material) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, delta.length(), 10), mat);
  mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh); return mesh;
}

function limb(parent: T.Object3D, a: number[], b: number[], radius: number, mat: T.Material) {
  rod(parent, a, b, radius, mat); sphere(parent, ...a as [number, number, number], radius, mat); sphere(parent, ...b as [number, number, number], radius, mat);
}
function bar(parent: T.Object3D, a: number[], b: number[], width: number, depth: number, mat: T.Material) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
  const mesh = rounded(parent, 0, 0, 0, width, delta.length(), depth, mat, .007);
  mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return mesh;
}

// Merge only rigid, opaque decoration. Moving figures, glass and ground shadows stay separate.
export function batchStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>(), originals: T.Mesh[] = [];
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || Array.isArray(node.material) || node.material.transparent) return;
    const g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    for (const attribute of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(attribute)) g.deleteAttribute(attribute);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.applyMatrix4(node.matrixWorld);
    const list = batches.get(node.material) ?? []; list.push(g); batches.set(node.material, list); originals.push(node);
  });
  originals.forEach(m => { m.removeFromParent(); m.geometry.dispose(); });
  for (const [mat, list] of batches) {
    const geometry = mergeGeometries(list); if (geometry) root.add(new T.Mesh(geometry, mat)); list.forEach(g => g.dispose());
  }
}

export function softTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.25, '#ffffffbb'); gradient.addColorStop(1, '#ffffff00');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); return new T.CanvasTexture(canvas);
}
export function groundShadow(parent: T.Object3D, width: number, depth: number, opacity: number, texture: T.Texture) {
  const mesh = new T.Mesh(new T.PlaneGeometry(width, depth), new T.MeshBasicMaterial({ map: texture, color: 0x051526, transparent: true, opacity, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.y = .037; parent.add(mesh); return mesh;
}

export function iceTextures() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;
  const relief = document.createElement('canvas'); relief.width = 1024; relief.height = 2048;
  const bump = relief.getContext('2d')!; bump.fillStyle = '#808080'; bump.fillRect(0, 0, 1024, 2048);
  const grain = document.createElement('canvas'); grain.width = 512; grain.height = 1024;
  const rough = grain.getContext('2d')!; rough.fillStyle = '#a4a4a4'; rough.fillRect(0, 0, 512, 1024);
  const grad = ctx.createLinearGradient(0, 0, 1024, 2048);
  grad.addColorStop(0, '#cde7f5'); grad.addColorStop(.45, '#e5f0f5'); grad.addColorStop(1, '#b7dff3');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 2048);
  let seed = 32; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // Broad skate sweeps and fine scuffs, beneath the painted markings.
  for (let i = 0; i < 6500; i++) {
    const x = random() * 1024, y = random() * 2048;
    const ex = x + random() * 85 - 42, ey = y + random() * 100 - 50;
    ctx.strokeStyle = i % 3 ? '#ffffff24' : '#6f9ebb15'; ctx.lineWidth = .45 + random() * .8;
    for (const context of [ctx, bump]) {
      if (context === bump) { bump.strokeStyle = i % 2 ? '#b0b0b045' : '#4c4c4c30'; bump.lineWidth = ctx.lineWidth; }
      context.beginPath(); context.moveTo(x, y); context.quadraticCurveTo(x + 14, y + 8, ex, ey); context.stroke();
    }
    rough.strokeStyle = i % 4 ? '#dddddd18' : '#4e4e4e18'; rough.lineWidth = .5;
    rough.beginPath(); rough.moveTo(x / 2, y / 2); rough.lineTo(ex / 2, ey / 2); rough.stroke();
  }
  const X = (x: number) => (x + 5.4) / 10.8 * 1024, Z = (z: number) => (z + 9) / 18 * 2048;
  const line = (z: number, color: string, width: number) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, Z(z)); ctx.lineTo(1024, Z(z)); ctx.stroke(); };
  line(-2.8, '#1676cbbb', 14); line(2.8, '#1676cbbb', 14); line(0, '#ce2249bb', 10);
  for (let x = 0; x < 1024; x += 38) { ctx.fillStyle = '#e1eaf688'; ctx.fillRect(x, Z(0) - 5, 16, 10); }
  line(-7.65, '#cd2947', 3); line(7.55, '#cd2947', 3);
  function circle(x: number, z: number, r: number, color: string) {
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(X(x), Z(z), X(r) - X(0), Z(r) - Z(0), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(X(x), Z(z), 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    if (x) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(x + s * .25), Z(z - .17)); ctx.lineTo(X(x + s * .5), Z(z - .17)); ctx.lineTo(X(x + s * .5), Z(z + .17)); ctx.lineTo(X(x + s * .25), Z(z + .17)); ctx.stroke(); }
  }
  circle(0, 0, 1.6, '#147cca'); for (const x of [-2.8, 2.8]) for (const z of [-4.8, 4.5]) circle(x, z, 1.55, '#c63151bb');
  for (const z of [-7.65, 7.55]) { ctx.fillStyle = '#198dec28'; ctx.strokeStyle = '#cd2947'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(X(0), Z(z), X(1.55) - X(0), Z(1.1) - Z(0), 0, z < 0 ? 0 : Math.PI, z < 0 ? Math.PI : Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  // Soft LED spill complements the camera-dependent specular surface reflection.
  for (const x of [45, 979]) for (let y = 170; y < 1930; y += 350) {
    ctx.save(); ctx.translate(x, y); ctx.scale(.8, 3.2); const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 62); glow.addColorStop(0, '#ffffffdd'); glow.addColorStop(.2, '#e5f7ff88'); glow.addColorStop(.55, '#c3eeff22'); glow.addColorStop(1, '#74beff00'); ctx.fillStyle = glow; ctx.fillRect(-65, -65, 130, 130); ctx.restore();
  }
  const map = new T.CanvasTexture(canvas), bumpMap = new T.CanvasTexture(relief), roughnessMap = new T.CanvasTexture(grain);
  map.colorSpace = T.SRGBColorSpace; for (const texture of [map, bumpMap, roughnessMap]) texture.anisotropy = 4;
  return { map, bumpMap, roughnessMap };
}

// Retain the earlier export so an in-flight editor refresh cannot break the old scene module.
export function iceTexture() { return iceTextures().map; }

function jerseyBadge(parent: T.Object3D, number: number, goalie: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff5df'; ctx.textAlign = 'center'; ctx.font = 'bold 82px sans-serif'; ctx.fillText(String(number), 64, 99);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const material = surface(0xffffff, { map: texture, transparent: true, alphaTest: .4, roughness: .7, depthWrite: false });
  const back = new T.Mesh(new T.PlaneGeometry(.25, .28), material);
  if (goalie) { back.position.set(0, .85, -.278); back.rotation.y = Math.PI; }
  else { back.position.set(-.256, .87, 0); back.rotation.y = -Math.PI / 2; }
  parent.add(back);
  const crest = new T.Mesh(new T.CircleGeometry(.08, 6), paint.cream);
  if (goalie) crest.position.set(0, .9, .254);
  else { crest.position.set(.247, .91, 0); crest.rotation.y = Math.PI / 2; }
  parent.add(crest);
}

/** A tapered, wrapped blade within the original .48 by .18 horizontal footprint. */
function stickBlade(parent: T.Object3D, centerX: number, centerZ: number, goalie = false) {
  const width = goalie ? .892 : .472, shape = new T.Shape(), half = width / 2;
  shape.moveTo(-half, .07); shape.lineTo(half - .05, .055); shape.quadraticCurveTo(half, .075, half, .13);
  shape.lineTo(half - .012, goalie ? .25 : .225); shape.quadraticCurveTo(half * .5, .19, -half, .205); shape.closePath();
  const depth = goalie ? .132 : .172;
  const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 1, curveSegments: 6 }), paint.black);
  mesh.position.set(centerX, 0, centerZ - depth / 2); parent.add(mesh);
  for (let i = 0; i < 5; i++) {
    const x = centerX - half + .04 + i * (width - .08) / 5;
    rounded(parent, x, .134, centerZ, .012, .112, goalie ? .14 : .18, paint.tape, .002);
  }
}

export function hockeyFigure(goalie: boolean, number: number) {
  const group = new T.Group(), { red, white, navy, black, skin, wood, chrome, pad, helmet, stitch, tape } = paint;
  const b = (x: number, y: number, z: number, w: number, h: number, d: number, m: T.Material, r = .04) => rounded(group, x, y, z, w, h, d, m, r);
  let blade: T.Group | undefined;
  if (goalie) {
    // Stacked leather channels, knee rolls, bindings and toe straps rather than a pad wall.
    for (const sign of [-1, 1]) {
      const x = sign * .245;
      b(x, .31, .005, .42, .61, .3, pad, .08);
      b(x, .315, .165, .345, .55, .025, wood, .018);
      for (const offset of [-.16, .16]) b(x + offset, .31, .173, .027, .57, .023, stitch, .009);
      for (const y of [.15, .25, .36, .47]) {
        b(x, y, .188, .34, .07, .038, pad, .025);
        b(x, y + .027, .214, .29, .009, .006, tape, .002);
      }
      b(x, .59, .04, .36, .13, .34, pad, .04);
      b(x, .07, .08, .39, .1, .41, black, .035);
      b(x, .12, .235, .34, .11, .065, pad, .02);
      b(x, .13, .273, .24, .015, .009, stitch, .003);
      rod(group, [x - .13, .025, -.12], [x + .13, .025, -.12], .012, chrome);
    }
    b(0, .67, -.055, .6, .28, .4, navy, .085);
    sphere(group, 0, .85, -.015, .3, red, [1.12, .89, .84]);
    b(0, .652, .035, .57, .062, .41, white, .025);
    for (const sign of [-1, 1]) {
      sphere(group, sign * .25, .99, 0, .16, red, [1.08, .8, 1]);
      limb(group, [sign * .24, .97, .01], [sign * .36, .82, .07], .12, red);
      limb(group, [sign * .36, .82, .07], [sign * .43, .69, .18], .105, red);
      b(sign * .40, .755, .155, .20, .047, .2, white, .014);
    }
    b(-.44, .68, .245, .23, .31, .11, pad, .045);
    b(-.44, .68, .306, .17, .24, .01, wood, .015);
    for (const y of [.59, .65, .71, .77]) b(-.44, y, .318, .16, .009, .008, stitch, .002);
    sphere(group, .44, .70, .21, .19, pad, [1.0, 1.07, .68]);
    sphere(group, .46, .71, .33, .135, stitch, [1, 1, .25]);
    for (const y of [.64, .70, .76]) rod(group, [.355, y, .365], [.555, y, .365], .007, tape);
    rod(group, [0, 1.0, 0], [0, 1.15, .02], .077, skin);
    sphere(group, 0, 1.235, .025, .21, helmet, [1.0, 1.08, 1.03]);
    // A dark face opening inside the white mask; the cage follows its curved front.
    sphere(group, 0, 1.205, .195, .174, white, [1.0, 1.05, .56]);
    b(0, 1.232, .291, .275, .13, .018, black, .028);
    b(0, 1.095, .273, .19, .07, .044, white, .02);
    for (const x of [-.12, -.06, 0, .06, .12]) {
      const front = .318 - Math.abs(x) * .17;
      rod(group, [x, 1.105, .278], [x, 1.2, front], .006, chrome);
      rod(group, [x, 1.2, front], [x, 1.295, .271], .006, chrome);
    }
    for (const y of [1.13, 1.19, 1.25, 1.29]) {
      rod(group, [-.135, y, .279], [0, y, .319], .006, chrome);
      rod(group, [0, y, .319], [.135, y, .279], .006, chrome);
    }
    for (const sign of [-1, 1]) for (const y of [1.12, 1.18]) sphere(group, sign * .164, y, .225, .013, black, [1, 1, .3]);
    blade = new T.Group(); blade.position.z = .42; group.add(blade);
    stickBlade(blade, 0, 0, true);
    bar(blade, [.32, .83, -.25], [.32, .15, 0], .062, .043, wood);
    rounded(blade, .32, .37, -.08, .095, .31, .052, tape, .008);
    jerseyBadge(group, number, true);
  } else {
    // Bent knees, forward shoulders and staggered skates give the figure a hockey stance.
    for (const sign of [-1, 1]) {
      const z = sign * .16, footX = sign * .04 - .04;
      b(footX, .085, z, .37, .14, .16, black, .05);
      sphere(group, footX + .115, .082, z, .065, black, [1.3, .8, 1]);
      b(footX, .026, z, .34, .02, .022, chrome, .005);
      for (const x of [-.11, .10]) b(footX + x, .045, z, .025, .04, .035, white, .006);
      for (let i = 0; i < 4; i++) rod(group, [footX - .045 + i * .031, .162, z - .045], [footX - .029 + i * .031, .165, z + .045], .005, tape);
      limb(group, [footX - .01, .20, z], [.075, .40, z], .076, white);
      limb(group, [.075, .40, z], [-.085, .585, z * .84], .101, navy);
      sphere(group, .07, .405, z, .079, red, [1, .48, 1.12]);
      limb(group, [footX + .028, .277, z], [footX + .045, .306, z], .078, red);
      limb(group, [footX + .065, .345, z], [.065, .365, z], .079, red);
    }
    b(-.065, .56, 0, .32, .24, .36, navy, .07);
    const torso = new T.Mesh(new T.LatheGeometry([new T.Vector2(.19, 0), new T.Vector2(.245, .04), new T.Vector2(.25, .13), new T.Vector2(.275, .31), new T.Vector2(.23, .43), new T.Vector2(.12, .48)], 20), red);
    torso.position.set(-.055, .58, 0); torso.scale.set(.83, 1, .91); torso.rotation.z = -.18; group.add(torso);
    const stripe = new T.Mesh(new T.LatheGeometry([new T.Vector2(.247, .065), new T.Vector2(.255, .125)], 20), white);
    stripe.position.copy(torso.position); stripe.scale.copy(torso.scale); stripe.rotation.copy(torso.rotation); group.add(stripe);
    rod(group, [.028, 1.01, 0], [.085, 1.14, 0], .065, skin);
    const headStart = group.children.length;
    sphere(group, .105, 1.18, 0, .151, skin, [.95, 1.0, .88]);
    sphere(group, .065, 1.275, 0, .198, helmet, [1.04, .77, .98]);
    b(.217, 1.243, 0, .058, .035, .30, helmet, .012);
    for (const sign of [-1, 1]) {
      b(.02, 1.18, sign * .151, .14, .095, .032, helmet, .024);
      sphere(group, .253, 1.193, sign * .051, .009, black, [.35, 1, 1]);
      rod(group, [.20, 1.209, sign * .067], [.23, 1.209, sign * .039], .007, stitch);
      rod(group, [.013, 1.173, sign * .135], [.15, 1.084, sign * .04], .009, black);
      for (const x of [-.055, .005, .065]) b(x, 1.402, sign * .075, .034, .006, .014, black, .003);
    }
    sphere(group, .244, 1.15, 0, .025, skin, [1, .65, .75]);
    b(.244, 1.112, 0, .018, .008, .058, stitch, .003);
    const head = new T.Group(), headPivot = new T.Vector3(.07, 1.1, 0);
    for (const part of group.children.slice(headStart)) { part.position.sub(headPivot); head.add(part); }
    head.position.copy(headPivot); head.scale.set(.86, .90, .86); group.add(head);
    for (const sign of [-1, 1]) {
      const elbow = sign < 0 ? [.25, .83, -.25] : [.3, .77, .23], hand = sign < 0 ? [.43, .72, -.025] : [.62, .535, .016];
      sphere(group, .033, .995, sign * .20, .128, red, [1.08, .85, 1]);
      limb(group, [.065, .975, sign * .22], elbow, .093, red);
      limb(group, elbow, hand, .074, red);
      const sleeve = new T.Vector3(...elbow).lerp(new T.Vector3(...hand), .62), end = new T.Vector3(...elbow).lerp(new T.Vector3(...hand), .77);
      limb(group, sleeve.toArray(), end.toArray(), .077, white);
      sphere(group, ...hand as [number, number, number], .091, black, [1.1, .82, 1]);
      for (let i = 0; i < 3; i++) b(hand[0] + .02, hand[1] + .05, hand[2] + (i - 1) * .039, .095, .014, .027, navy, .006);
      b(hand[0] - .035, hand[1] + .008, hand[2], .025, .1, .15, white, .008);
    }
    bar(group, [.30, .86, 0], [1.01, .165, 0], .045, .029, wood);
    bar(group, [.31, .863, .017], [1.01, .168, .017], .012, .007, black);
    for (let i = 0; i < 4; i++) {
      const a = new T.Vector3(.30, .86, 0).lerp(new T.Vector3(1.01, .165, 0), .12 + i * .031);
      const e = a.clone().add(new T.Vector3(.014, -.014, 0)); bar(group, a.toArray(), e.toArray(), .052, .035, tape);
    }
    stickBlade(group, 1.06, 0);
    jerseyBadge(group, number, false);
  }
  // Each figure is one draw per material. Keep the goalie's moving stick independent.
  if (blade) blade.removeFromParent(); batchStatic(group); if (blade) { batchStatic(blade); group.add(blade); }
  return { group, blade };
}
