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
  cloth: surface(0xffffff, { vertexColors: true, roughness: .67 }),
  pants: surface(0x111927, { roughness: .8 }),
  hockeyPants: surface(0x8c0920, { roughness: .69 }),
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

// Continuous tailored sleeves and socks, rather than separate balls at each joint.
function clothTube(parent: T.Group, points: number[][], radii: number[], colors: (t: number) => number) {
  const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)), false, 'centripetal');
  const count = 40, sides = 20, frames = curve.computeFrenetFrames(count, false);
  const pos: number[] = [], rgb: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count, center = curve.getPointAt(t), sample = t * (radii.length - 1), a = Math.min(radii.length - 2, Math.floor(sample));
    const radius = T.MathUtils.lerp(radii[a], radii[a + 1], sample - a), color = new T.Color(colors(t));
    for (let j = 0; j <= sides; j++) {
      const theta = j / sides * Math.PI * 2;
      const fold = 1 + .032 * Math.sin(theta * 5 + t * 8) + .018 * Math.sin(t * 55) * Math.sin(Math.PI * t);
      const p = center.clone().addScaledVector(frames.normals[i], Math.cos(theta) * radius * fold).addScaledVector(frames.binormals[i], Math.sin(theta) * radius * fold);
      pos.push(...p.toArray()); rgb.push(color.r, color.g, color.b); uv.push(j / sides, t);
      if (i < count && j < sides) { const k = i * (sides + 1) + j; indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1); }
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(rgb, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); parent.add(new T.Mesh(g, paint.cloth));
}

function tailoredJersey(parent: T.Group) {
  // Cross-sections follow the crouched spine; broad shoulders taper into the neck.
  const profile = [[-.12,.56,.17,.23],[-.11,.62,.18,.24],[-.07,.74,.185,.255],[0,.91,.195,.28],[.035,1.01,.17,.265],[.075,1.065,.095,.10]];
  const contour = new T.CatmullRomCurve3(profile.map(p => new T.Vector3(p[2],p[1],p[3])), false, 'centripetal');
  const pos: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [], rings = 48, sides = 40;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, section = contour.getPoint(t), y = section.y;
    let a = 0; while (a < profile.length - 2 && profile[a + 1][1] < y) a++;
    const f = (y - profile[a][1]) / (profile[a + 1][1] - profile[a][1]), p = profile[a].map((v, j) => T.MathUtils.lerp(v, profile[a + 1][j], f));
    p[2] = section.x; p[3] = section.z;
    const c = new T.Color((y > .61 && y < .636) || (y > .663 && y < .691) ? 0xf2ebdf : 0x99091f);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2, wrinkle = 1 + .028 * Math.sin(angle * 7 + y * 14) * (1 - t) + .018 * Math.sin(angle * 11 + y * 20);
      pos.push(p[0] + Math.cos(angle) * p[2] * wrinkle, y, Math.sin(angle) * p[3] * wrinkle); colors.push(c.r, c.g, c.b); uv.push(j / sides, t);
      if (i < rings && j < sides) { const k = i * (sides + 1) + j; indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2); }
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); parent.add(new T.Mesh(g, paint.cloth));
}

// Merge only rigid, opaque decoration. Moving figures, glass and ground shadows stay separate.
export function batchStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const batches = new Map<T.Material, T.BufferGeometry[]>(), originals: T.Mesh[] = [];
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || Array.isArray(node.material) || node.material.transparent) return;
    const g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    for (const attribute of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(attribute)) g.deleteAttribute(attribute);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.applyMatrix4(inverseRoot.clone().multiply(node.matrixWorld));
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
  grad.addColorStop(0, '#78aed0'); grad.addColorStop(.45, '#c1e0ed'); grad.addColorStop(1, '#91c5e4');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 2048);
  let seed = 32; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // Broad skate sweeps and fine scuffs, beneath the painted markings.
  for (let i = 0; i < 6500; i++) {
    const x = random() * 1024, y = random() * 2048;
    const ex = x + random() * 85 - 42, ey = y + random() * 100 - 50;
    ctx.strokeStyle = i % 3 ? '#ffffff52' : '#387da02b'; ctx.lineWidth = .45 + random() * .8;
    for (const context of [ctx, bump]) {
      if (context === bump) { bump.strokeStyle = i % 2 ? '#b0b0b045' : '#4c4c4c30'; bump.lineWidth = ctx.lineWidth; }
      context.beginPath(); context.moveTo(x, y); context.quadraticCurveTo(x + 14, y + 8, ex, ey); context.stroke();
    }
    rough.strokeStyle = i % 4 ? '#dddddd18' : '#4e4e4e18'; rough.lineWidth = .5;
    rough.beginPath(); rough.moveTo(x / 2, y / 2); rough.lineTo(ex / 2, ey / 2); rough.stroke();
  }
  const X = (x: number) => (x + 5.4) / 10.8 * 1024, Z = (z: number) => (z + 9) / 18 * 2048;
  const line = (z: number, color: string, width: number) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, Z(z)); ctx.lineTo(1024, Z(z)); ctx.stroke(); };
  line(-2.8, '#0059b7', 18); line(2.8, '#0059b7', 18); line(0, '#bb1234', 12);
  for (let x = 0; x < 1024; x += 38) { ctx.fillStyle = '#e1eaf688'; ctx.fillRect(x, Z(0) - 5, 16, 10); }
  line(-7.65, '#c41637', 5); line(7.55, '#c41637', 5);
  function circle(x: number, z: number, r: number, color: string) {
    ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(X(x), Z(z), X(r) - X(0), Z(r) - Z(0), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(X(x), Z(z), 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    if (x) for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(x + s * .25), Z(z - .17)); ctx.lineTo(X(x + s * .5), Z(z - .17)); ctx.lineTo(X(x + s * .5), Z(z + .17)); ctx.lineTo(X(x + s * .25), Z(z + .17)); ctx.stroke(); }
  }
  circle(0, 0, 1.6, '#0068c2'); for (const x of [-2.8, 2.8]) for (const z of [-4.8, 4.5]) circle(x, z, 1.55, '#c41637');
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
  // A small lace-up collar, leaving the broad red chest clean like the reference.
  for (let i = 0; i < 3; i++) {
    if (goalie) rod(parent, [-.025, 1.01 - i * .018, .18], [.025, .998 - i * .018, .182], .004, paint.tape);
    else rod(parent, [.169, 1.015 - i * .018, -.025], [.172, 1.003 - i * .018, .025], .004, paint.tape);
  }
}

/** A tapered, wrapped blade within the original .48 by .18 horizontal footprint. */
function stickBlade(parent: T.Object3D, centerX: number, centerZ: number, goalie = false) {
  const width = goalie ? .892 : .472, shape = new T.Shape(), half = width / 2;
  shape.moveTo(-half, .07); shape.lineTo(half - .05, .055); shape.quadraticCurveTo(half, .075, half, .11);
  shape.lineTo(half - .012, goalie ? .20 : .16); shape.quadraticCurveTo(half * .5, .135, -half, .16); shape.closePath();
  const depth = goalie ? .055 : .045;
  const mesh = new T.Mesh(new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 1, curveSegments: 6 }), paint.black);
  mesh.position.set(centerX, 0, centerZ - depth / 2); parent.add(mesh);
  for (let i = 0; i < 5; i++) {
    const x = centerX - half + .04 + i * (width - .08) / 5;
    rounded(parent, x, .119, centerZ, .007, .072, depth + .004, paint.black, .002);
  }
}

export function hockeyFigure(goalie: boolean, number: number) {
  const group = new T.Group(), { red, white, navy, black, skin, wood, chrome, pad, helmet, stitch, tape } = paint;
  const b = (x: number, y: number, z: number, w: number, h: number, d: number, m: T.Material, r = .04) => rounded(group, x, y, z, w, h, d, m, r);
  let blade: T.Group | undefined;
  if (goalie) {
    // Stacked leather channels, knee rolls, bindings and toe straps rather than a pad wall.
    for (const sign of [-1, 1]) {
      const start = group.children.length;
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
      const leg = new T.Group(), pivot = new T.Vector3(x, .58, -.035);
      for (const child of group.children.slice(start)) { child.position.sub(pivot); leg.add(child); }
      leg.position.copy(pivot); leg.rotation.z = sign * .16; leg.rotation.x = -.1; group.add(leg);
    }
    b(0, .555, -.075, .6, .23, .35, paint.pants, .065);
    const jersey = new T.Group(); tailoredJersey(jersey); jersey.rotation.y = -Math.PI / 2; jersey.scale.set(1.1,1,1.2); jersey.position.z = -.035; group.add(jersey);
    for (const sign of [-1, 1]) {
      clothTube(group, [[sign * .14,1.015,0],[sign * .29,.965,.015],[sign * .36,.82,.07],[sign * .43,.69,.18]], [.08,.13,.115,.09], t => t > .61 && t < .68 || t > .76 && t < .83 ? 0xf2ebdf : 0x99091f);
    }
    b(-.44, .68, .245, .23, .31, .11, pad, .045);
    b(-.44, .68, .306, .17, .24, .01, wood, .015);
    for (const y of [.59, .65, .71, .77]) b(-.44, y, .318, .16, .009, .008, stitch, .002);
    sphere(group, .44, .70, .21, .19, pad, [1.0, 1.07, .68]);
    sphere(group, .46, .71, .33, .135, stitch, [1, 1, .25]);
    for (const y of [.64, .69, .74, .79]) {
      rod(group, [.36, y, .36], [.53, y + .045, .355], .006, tape);
      rod(group, [.36, y + .045, .36], [.53, y, .355], .006, tape);
    }
    rod(group, [0, 1.0, 0], [0, 1.15, .02], .077, skin);
    sphere(group, 0, 1.235, .025, .185, helmet, [1.0, 1.08, 1.03]);
    // A dark face opening inside the white mask; the cage follows its curved front.
    sphere(group, 0, 1.205, .18, .155, white, [1.0, 1.05, .56]);
    sphere(group, 0, 1.227, .253, .12, black, [1,.57,.3]);
    sphere(group, 0, 1.225, .273, .105, skin, [1,.52,.2]);
    b(0, 1.095, .259, .15, .045, .044, white, .018);
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
    bar(blade, [-.42, .76, -.18], [-.20, .15, 0], .049, .035, wood);
    bar(blade, [-.31, .45, -.09], [-.20, .15, 0], .10, .038, wood);
    jerseyBadge(group, number, true);
  } else {
    // Bent knees, forward shoulders and staggered skates give the figure a hockey stance.
    for (const sign of [-1, 1]) {
      const z = sign * .235, footX = sign * .115 - .07;
      b(footX, .085, z, .34, .13, .145, black, .06);
      sphere(group, footX + .115, .082, z, .065, black, [1.3, .8, 1]);
      b(footX, .026, z, .34, .02, .022, chrome, .005);
      for (const x of [-.11, .10]) b(footX + x, .045, z, .025, .04, .035, white, .006);
      for (let i = 0; i < 4; i++) rod(group, [footX - .045 + i * .031, .162, z - .045], [footX - .029 + i * .031, .165, z + .045], .005, tape);
      clothTube(group, [[footX - .035,.16,z],[footX + .015,.29,z],[.10 + sign * .035,.43,z * .88]], [.064,.075,.088], t => t > .43 && t < .51 || t > .60 && t < .68 ? 0xe7e5dc : t < .30 ? 0x141b25 : 0x99091f);
      limb(group, [.10 + sign * .035, .43, z * .88], [-.12, .585, z * .73], .103, paint.hockeyPants);
    }
    b(-.12, .56, 0, .31, .20, .43, paint.hockeyPants, .065);
    tailoredJersey(group);
    rod(group, [.028, 1.01, 0], [.085, 1.14, 0], .065, skin);
    const headStart = group.children.length;
    sphere(group, .105, 1.18, 0, .151, skin, [.95, 1.0, .88]);
    const shell = new T.Mesh(new T.SphereGeometry(.18, 32, 20, 0, Math.PI * 2, 0, Math.PI * .53), helmet); shell.scale.set(1.08, .77, .94); shell.position.set(.065,1.255,0); group.add(shell);
    b(.224, 1.25, 0, .061, .021, .29, helmet, .009);
    for (const sign of [-1, 1]) {
      sphere(group, .012, 1.198, sign * .144, .075, helmet, [1,.82,.28]);
      sphere(group, .253, 1.193, sign * .051, .009, black, [.35, .5, 1.3]);
      rod(group, [.20, 1.209, sign * .067], [.23, 1.209, sign * .039], .007, stitch);
      rod(group, [.013, 1.173, sign * .135], [.15, 1.084, sign * .04], .009, black);
      for (const x of [-.025, .035, .095]) {
        const top = 1.255 + .1386 * Math.sqrt(1 - ((x - .065) / .1944) ** 2 - (.075 / .1692) ** 2);
        b(x, top + .001, sign * .075, .024, .003, .012, black, .002);
      }
    }
    sphere(group, .244, 1.15, 0, .025, skin, [1, .65, .75]);
    b(.244, 1.112, 0, .018, .008, .058, stitch, .003);
    const head = new T.Group(), headPivot = new T.Vector3(.07, 1.1, 0);
    for (const part of group.children.slice(headStart)) { part.position.sub(headPivot); head.add(part); }
    head.position.copy(headPivot); head.scale.set(.86, .90, .86); group.add(head);
    for (const sign of [-1, 1]) {
      const elbow = sign < 0 ? [.25, .83, -.25] : [.3, .77, .23], hand = sign < 0 ? [.43, .72, -.025] : [.62, .535, .016];
      clothTube(group, [[.035,1.015,sign * .11],[.045,.98,sign * .245], elbow, hand], [.07,.119,.09,.061], t => t > .66 && t < .71 || t > .78 && t < .84 ? 0xf2ebdf : 0x99091f);
      b(hand[0],hand[1],hand[2],.14,.115,.14,red,.038);
      for (let i = 0; i < 4; i++) b(hand[0] + .015, hand[1] + .057, hand[2] + (i - 1.5) * .031, .095, .034, .026, red, .01);
      b(hand[0] - .05, hand[1] + .008, hand[2], .039, .13, .15, red, .015);
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
