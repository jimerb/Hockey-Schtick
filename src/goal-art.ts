import * as T from 'three';
import { C, rearArc } from './config';
import { paint, rod, sphere, batchStatic, surface } from './art';

function ropeTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // Transparent holes, shaded cord edges and tied intersections form a woven diamond mesh.
  for (const [width, color] of [[5, '#53616b9a'], [3, '#dfddd0'], [1, '#fff9e8']] as const) {
    ctx.lineWidth = width; ctx.strokeStyle = color;
    for (let offset = -128; offset <= 256; offset += 64) for (const sign of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(offset, 0); ctx.lineTo(offset + sign * 128, 128); ctx.stroke();
    }
  }
  for (let y = 0; y <= 128; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x <= 128; x += 64) {
    ctx.fillStyle = '#c5c2b4'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 4; return texture;
}

export function hockeyGoal() {
  const group = new T.Group(), piping = new T.Group();
  const arc = (height: (i: number) => number, radius: number, material: T.Material) => {
    const points = rearArc.map((p, i) => new T.Vector3(p.x, height(i), p.z));
    const curve = new T.CatmullRomCurve3(points, false, 'centripetal');
    piping.add(new T.Mesh(new T.TubeGeometry(curve, 64, radius, 10, false), material));
  };
  arc(() => .14, .11, paint.red);
  arc(i => 1.4 - .12 * Math.sin(i / 24 * Math.PI), .045, paint.red);
  arc(() => .23, .012, paint.tape);
  for (const x of [-1.5, 1.5]) {
    rod(piping, [x, .03, C.goalZ], [x, 1.4, C.goalZ], .085, paint.helmet);
    sphere(piping, x, 1.4, C.goalZ, .085, paint.helmet);
    for (const y of [.23, 1.32]) sphere(piping, x, y, C.goalZ + .082, .018, paint.chrome, [1, 1, .28]);
  }
  rod(piping, [-1.5, 1.4, C.goalZ], [1.5, 1.4, C.goalZ], .085, paint.helmet);
  for (const index of [6, 12, 18]) {
    const p = rearArc[index], top = 1.4 - .12 * Math.sin(index / 24 * Math.PI);
    rod(piping, [p.x, .14, p.z], [p.x, top, p.z], .018, paint.white);
  }
  // Blend fine cord coverage at rink scale instead of clipping it away in distant mip levels.
  const material = surface(0xf4f0df, { map: ropeTexture(), alphaTest: .015, transparent: true, opacity: .9,
    depthWrite: false, forceSinglePass: true, side: T.DoubleSide, roughness: .82 });
  const cloth = (roof: boolean) => {
    const rows = roof ? 8 : 10, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 24; i++) for (let j = 0; j <= rows; j++) {
      const p = rearArc[i], v = j / rows, top = 1.4 - .12 * Math.sin(i / 24 * Math.PI);
      if (roof) { positions.push(p.x, 1.4 + (top - 1.4) * v, C.goalZ + (p.z - C.goalZ) * v); uvs.push((p.x + 1.5) * 2.8, (p.z - C.goalZ) * v * 2.8); }
      else { positions.push(p.x * (1 + .012 * Math.sin(v * Math.PI)), .15 + (top - .15) * v, p.z - .016 * Math.sin(v * Math.PI)); uvs.push(i / 24 * 12, v * 3.8); }
      if (i < 24 && j < rows) { const a = i * (rows + 1) + j, b = a + rows + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(positions, 3)).setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material); mesh.name = roof ? 'woven-net-roof' : 'woven-net-back-and-sides'; group.add(mesh);
  };
  cloth(false); cloth(true); batchStatic(piping); group.add(piping); return group;
}
