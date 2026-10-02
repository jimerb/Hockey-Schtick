// Offline shape inspection only: SVGRenderer does not reproduce WebGL/PBR, textures or shadows.
// Pass paths to an existing @napi-rs/canvas package and sharp package; no app dependency changes.
import { createRequire } from 'node:module';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as T from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { hockeyFigure, iceTextures } from '../src/art';
import { hockeyGoal } from '../src/goal-art';
import { ArenaCrowd } from '../src/crowd';
const require = createRequire(import.meta.url);
const { createCanvas } = require(process.argv[2]), sharp = require(process.argv[3]);
class SvgElement {
  childNodes: SvgElement[] = []; attributes: Record<string, string> = {}; style: Record<string, string> = {};
  constructor(readonly name: string) {}
  setAttribute(key: string, value: unknown) { this.attributes[key] = String(value); }
  appendChild(node: SvgElement) { this.childNodes.push(node); }
  removeChild(node: SvgElement) { this.childNodes.splice(this.childNodes.indexOf(node), 1); }
  get outerHTML(): string { return `<${this.name} ${Object.entries(this.attributes).map(([k, v]) => `${k}="${v}"`).join(' ')}>${this.childNodes.map(n => n.outerHTML).join('')}</${this.name}>`; }
}
Object.assign(globalThis, { document: { createElement: () => createCanvas(128, 128), createElementNS: (_ns: string, name: string) => new SvgElement(name) } });
const beforePath = new URL('../evidence/.visual-preview-before.ts', import.meta.url);
if (existsSync(beforePath)) throw new Error('Preview temporary source already exists; preserve it and choose a fresh path.');
writeFileSync(beforePath, execFileSync('git', ['show', 'e30ef958:src/art.ts'], { encoding: 'utf8' }));
let before: typeof import('../src/art');
try { before = await import('../evidence/.visual-preview-before.ts'); } finally { unlinkSync(beforePath); }
const scene = new T.Scene();
scene.add(new T.AmbientLight(0xd5e5ff, .65));
const key = new T.DirectionalLight(0xfff5df, 1.1); key.position.set(-2, 4, 6); scene.add(key);
const fill = new T.DirectionalLight(0x78baff, .3); fill.position.set(3, 2, -3); scene.add(fill);
const models = [[before.hockeyFigure(false, 17).group, false, -1.7], [hockeyFigure(false, 17).group, false, 1.5], [before.hockeyFigure(true, 1).group, true, -1.7], [hockeyFigure(true, 1).group, true, 1.5]] as const;
const renderer = new SVGRenderer(); renderer.setSize(560, 480); renderer.setPrecision(2);
const camera = new T.PerspectiveCamera(32, 560 / 480, .1, 100), tiles: Buffer[] = [];
for (const [group, goalie] of models) {
  scene.add(group); camera.position.set(goalie ? 1.5 : 2.0, 2.0, goalie ? 3.4 : 2.7); camera.lookAt(goalie ? 0 : .45, .65, 0);
  renderer.render(scene, camera);
  const node = renderer.domElement as unknown as SvgElement;
  node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svg = node.outerHTML.replace('>', '><rect x="-280" y="-240" width="560" height="480" fill="#0a1728"/>');
  tiles.push(await sharp(Buffer.from(svg)).png().toBuffer()); scene.remove(group);
}
const labels = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="1070"><rect width="1120" height="1070" fill="#0a1728"/><g fill="#e2eff8" font-family="sans-serif" font-size="24"><text x="30" y="37">Previous models</text><text x="590" y="37">Refined models</text><text x="30" y="1042" font-size="18">Offline geometry view — game lighting, textures and shadows are not shown.</text></g></svg>`;
await sharp(Buffer.from(labels)).composite(tiles.map((input: Buffer, i: number) => ({ input, left: i % 2 * 560, top: 55 + Math.floor(i / 2) * 480 }))).png().toFile('evidence/visual-upgrade-model-comparison.png');
// Expand instances only for this offline inspector; production uses the seven instanced meshes.
const crowd = new ArenaCrowd(); crowd.update(.04, true, true);
const crowdScene = new T.Scene(); crowdScene.add(new T.AmbientLight(0xd5e5ff, .7), key.clone());
const inspect = new T.Group();
crowd.group.traverse(node => {
  if (!(node instanceof T.Mesh) || !(node.material instanceof T.MeshStandardMaterial)) return;
  if (node instanceof T.InstancedMesh) {
    for (let i = 0; i < node.count; i++) {
      const matrix = new T.Matrix4(); node.getMatrixAt(i, matrix); const position = new T.Vector3().setFromMatrixPosition(matrix);
      if (position.x < 0 || position.z < -3 || position.z > 0) continue;
      const material = node.material.clone(); node.getColorAt(i, material.color);
      const mesh = new T.Mesh(node.geometry, material); mesh.applyMatrix4(matrix); inspect.add(mesh);
    }
  }
});
crowdScene.add(inspect); renderer.setSize(1120, 500); camera.aspect = 1120 / 500; camera.position.set(3.3, 4.5, 4); camera.lookAt(7.4, .65, -1.5); camera.updateProjectionMatrix(); renderer.render(crowdScene, camera);
const crowdNode = renderer.domElement as unknown as SvgElement; crowdNode.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
const crowdSvg = crowdNode.outerHTML.replace('>', '><rect x="-560" y="-250" width="1120" height="500" fill="#0a1728"/>');
writeFileSync('evidence/visual-upgrade-crowd-geometry.svg', crowdSvg);
await sharp(Buffer.from(crowdSvg)).png().toFile('evidence/visual-upgrade-crowd-geometry.png');
const ice = iceTextures();
await sharp(ice.map.image.toBuffer('image/png')).resize(512, 1024).png().toFile('evidence/visual-upgrade-ice-texture.png');
const goal = hockeyGoal(), net = goal.getObjectByName('woven-net-back-and-sides') as T.Mesh;
const tile = (net.material as T.MeshStandardMaterial).map!.image;
await sharp(tile.toBuffer('image/png')).resize(512, 512).png().toFile('evidence/visual-upgrade-net-weave.png');
console.log('Wrote offline model/crowd geometry and actual procedural ice/net textures.');
