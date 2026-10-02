import * as T from 'three';
import { C, rearArc } from './config';
import { paint, rod, batchStatic, surface } from './art';

function ropeTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // Transparent holes, shaded cord edges and tied intersections form a woven diamond mesh.
  for (const [width, color] of [[4, '#465262c0'], [2.3, '#dfddd0'], [.8, '#fff9e8']] as const) {
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
  const pipe = new T.MeshPhysicalMaterial({ color: 0xb50720, roughness: .24, metalness: .25, clearcoat: .85, clearcoatRoughness: .12 });
  // Rounded rectangular roof, sloping to a narrower rear rail. The floor bumper
  // retains exactly the original D-shaped footprint used by puck physics.
  const roofPath = new T.CatmullRomCurve3([
    new T.Vector3(-1.5, 1.25, C.goalZ), new T.Vector3(-1.43, 1.22, C.goalZ - .37),
    new T.Vector3(-1.23, 1.16, C.goalZ - .76), new T.Vector3(-.95, 1.15, C.goalZ - .8),
    new T.Vector3(0, 1.15, C.goalZ - .8), new T.Vector3(.95, 1.15, C.goalZ - .8),
    new T.Vector3(1.23, 1.16, C.goalZ - .76), new T.Vector3(1.43, 1.22, C.goalZ - .37), new T.Vector3(1.5, 1.25, C.goalZ),
  ], false, 'centripetal');
  const upper = roofPath.getSpacedPoints(24);
  const arc = (height: (i: number) => number, radius: number, material: T.Material) => {
    const points = rearArc.map((p, i) => new T.Vector3(p.x, height(i), p.z));
    const curve = new T.CatmullRomCurve3(points, false, 'centripetal');
    piping.add(new T.Mesh(new T.TubeGeometry(curve, 64, radius, 10, false), material));
  };
  arc(() => .14, .085, pipe);
  piping.add(new T.Mesh(new T.TubeGeometry(roofPath, 64, .035, 12, false), pipe));
  arc(() => .23, .012, paint.tape);
  const mouth = new T.CurvePath<T.Vector3>();
  const point = (x: number, y: number) => new T.Vector3(x, y, C.goalZ);
  mouth.add(new T.LineCurve3(point(-1.5, .05), point(-1.5, 1.22)));
  mouth.add(new T.QuadraticBezierCurve3(point(-1.5, 1.22), point(-1.5, 1.4), point(-1.32, 1.4)));
  mouth.add(new T.LineCurve3(point(-1.32, 1.4), point(1.32, 1.4)));
  mouth.add(new T.QuadraticBezierCurve3(point(1.32, 1.4), point(1.5, 1.4), point(1.5, 1.22)));
  mouth.add(new T.LineCurve3(point(1.5, 1.22), point(1.5, .05)));
  piping.add(new T.Mesh(new T.TubeGeometry(mouth, 72, .072, 16, false), pipe));
  for (const index of [6, 12, 18]) {
    const p = rearArc[index], top = upper[index];
    rod(piping, [p.x, .14, p.z], top.toArray(), .014, paint.white);
  }
  // Blend fine cord coverage at rink scale instead of clipping it away in distant mip levels.
  const material = surface(0xd0c9b4, { map: ropeTexture(), alphaTest: .07, transparent: true, opacity: .97,
    depthWrite: false, forceSinglePass: true, side: T.DoubleSide, roughness: .82 });
  const cloth = (roof: boolean) => {
    const rows = roof ? 8 : 10, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 24; i++) for (let j = 0; j <= rows; j++) {
      const p = rearArc[i], v = j / rows, top = upper[i];
      if (roof) { const x = T.MathUtils.lerp(p.x, top.x, v), z = T.MathUtils.lerp(C.goalZ, top.z, v); positions.push(x, 1.4 + (top.y - 1.4) * v, z); uvs.push((x + 1.5) * 3.2, (z - C.goalZ) * 3.2); }
      else { positions.push(T.MathUtils.lerp(p.x, top.x, v), .15 + (top.y - .15) * v, T.MathUtils.lerp(p.z, top.z, v) - .016 * Math.sin(v * Math.PI)); uvs.push(i / 24 * 12, v * 3.8); }
      if (i < 24 && j < rows) { const a = i * (rows + 1) + j, b = a + rows + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(positions, 3)).setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material); mesh.name = roof ? 'woven-net-roof' : 'woven-net-back-and-sides'; group.add(mesh);
  };
  cloth(false); cloth(true); batchStatic(piping); group.add(piping); return group;
}
