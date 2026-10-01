import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const surface = (color: number, extra: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: .34, ...extra });
export const paint = {
  red: surface(0xb80a28, { roughness: .23 }), rubber: surface(0x96051b, { roughness: .6 }),
  navy: surface(0x061a33, { metalness: .5, roughness: .26 }), white: surface(0xf2f5ec, { roughness: .28 }),
  cream: surface(0xfff0cf, { roughness: .2 }), chrome: surface(0xb1cad8, { metalness: .92, roughness: .16 }),
  black: surface(0x101722, { roughness: .52 }), skin: surface(0xe8b18d, { roughness: .65 }),
  wood: surface(0xd3b183, { roughness: .45 }), pad: surface(0x98774a, { roughness: .68 }),
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

export function iceTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 1024, 2048);
  grad.addColorStop(0, '#c3e2f4'); grad.addColorStop(.45, '#e0eff6'); grad.addColorStop(1, '#a6d4ee');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 2048);
  let seed = 32; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // Broad skate sweeps and fine scuffs, beneath the painted markings.
  for (let i = 0; i < 8000; i++) {
    const x = random() * 1024, y = random() * 2048;
    ctx.strokeStyle = i % 3 ? '#ffffff38' : '#6f9ebb12'; ctx.lineWidth = .45 + random() * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y + 8, x + random() * 85 - 42, y + random() * 100 - 50); ctx.stroke();
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
  // Soft reflected rink lights, baked into the ice instead of a costly mirror pass.
  for (const x of [45, 979]) for (let y = 170; y < 1930; y += 350) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1, 2.1); const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 62); glow.addColorStop(0, '#ffffffaa'); glow.addColorStop(.22, '#e5f7ff55'); glow.addColorStop(1, '#74beff00'); ctx.fillStyle = glow; ctx.fillRect(-65, -65, 130, 130); ctx.restore();
  }
  const tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; return tex;
}

export function hockeyFigure(goalie: boolean, number: number) {
  const group = new T.Group(), { red, white, navy, black, skin, wood, chrome, pad } = paint;
  const b = (x: number, y: number, z: number, w: number, h: number, d: number, m: T.Material, r = .04) => rounded(group, x, y, z, w, h, d, m, r);
  let blade: T.Group | undefined;
  if (goalie) {
    for (const x of [-.235, .235]) {
      b(x, .31, .015, .45, .6, .34, pad, .07);
      for (const y of [.12, .24, .36, .48]) b(x, y, .19, .37, .035, .025, wood, .008);
      b(x, .11, -.19, .32, .13, .24, black);
    }
    b(0, .79, -.04, .57, .48, .39, red, .09); b(0, .61, -.04, .55, .08, .4, white);
    rod(group, [-.22, .95, 0], [-.4, .65, .05], .13, red); rod(group, [.22, .95, 0], [.39, .71, .1], .13, red);
    b(-.41, .65, .13, .23, .32, .14, pad); sphere(group, .41, .72, .12, .19, pad, [1, 1.15, .6]);
    sphere(group, 0, 1.22, .015, .225, red, [1, 1.1, 1]);
    b(0, 1.17, .213, .31, .25, .047, white, .035);
    for (const x of [-.095, 0, .095]) rod(group, [x, 1.08, .246], [x, 1.29, .246], .009, black);
    for (const y of [1.13, 1.2, 1.27]) rod(group, [-.13, y, .251], [.13, y, .251], .009, black);
    blade = new T.Group(); blade.position.z = .42; group.add(blade);
    rounded(blade, 0, .16, 0, .9, .22, .14, black, .03); rod(blade, [.32, .83, -.25], [.32, .16, 0], .038, wood);
  } else {
    for (const z of [-.17, .17]) {
      b(.005, .085, z, .42, .05, .1, chrome, .012);
      b(-.02, .16, z, .4, .17, .17, black, .05);
      rod(group, [-.055, .23, z], [.045, .49, z], .086, white);
      b(.01, .34, z, .18, .055, .18, red, .012); b(.038, .44, z, .18, .055, .18, red, .012);
      b(-.035, .56, z * .8, .29, .3, .24, navy, .07);
      for (const x of [-.04, .025, .09]) b(x, .241, z, .02, .014, .09, white, .005);
    }
    b(-.025, .86, 0, .45, .5, .49, red, .1); b(-.025, .675, 0, .46, .075, .49, white, .025);
    sphere(group, .025, 1.21, 0, .177, skin, [1, 1.13, .93]);
    sphere(group, -.017, 1.31, 0, .217, red, [1.04, .77, 1.05]);
    b(.182, 1.255, 0, .11, .035, .36, red, .014); b(.182, 1.17, 0, .02, .032, .3, black, .01);
    for (const z of [-.2, .2]) {
      const hand = z < 0 ? [.42, .78, -.055] : [.59, .56, .03];
      sphere(group, -.015, 1.025, z, .14, red);
      rod(group, [0, 1.0, z], [hand[0] * .6, .82, z], .104, red);
      rod(group, [hand[0] * .6, .82, z], hand, .088, red);
      sphere(group, ...hand as [number, number, number], .102, black);
      rod(group, [hand[0] * .69, .77, z * .73], [hand[0] * .81, .71, z * .45], .094, white);
    }
    rod(group, [.3, .87, 0], [1.06, .18, 0], .035, wood);
    b(1.06, .18, 0, .48, .32, .18, black, .028);
    for (const x of [.95, 1.02, 1.09]) b(x, .345, 0, .014, .005, .175, navy, .001);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#b80a28'; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = '#fff4d6'; ctx.textAlign = 'center'; ctx.font = 'bold 83px sans-serif'; ctx.fillText(String(number), 64, 103);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const patch = new T.Mesh(new T.PlaneGeometry(.28, .32), surface(0xffffff, { map: texture })); patch.rotation.y = -Math.PI / 2; patch.position.set(-.254, .88, 0); group.add(patch);
  }
  // Each figure is one draw per material. Keep the goalie's moving stick independent.
  if (blade) blade.removeFromParent(); batchStatic(group); if (blade) group.add(blade);
  return { group, blade };
}
