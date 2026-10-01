import * as THREE from 'three';
import { C, LANES, cradleGuides, guides, outline, rearArc, returnApron } from './config';
import type { State } from './physics';
import type { Vec } from './config';

const material = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
const red = material(0xda2448), navy = material(0x091d38, { metalness: 0.35 }), white = material(0xe4edee);
const chrome = material(0x9eafbb, { metalness: 0.8, roughness: 0.25 });
const led = new THREE.MeshBasicMaterial({ color: 0x29baff, toneMapped: false });
function polygon(p: Vec[], height: number, mat: THREE.Material) {
  const shape = new THREE.Shape(p.map(v => new THREE.Vector2(v.x, -v.z)));
  const geometry = height ? new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }) : new THREE.ShapeGeometry(shape);
  const m = new THREE.Mesh(geometry, mat); m.rotation.x = -Math.PI / 2; return m;
}
function capsuleShape(length: number, width: number) {
  const r = width / 2, s = new THREE.Shape();
  s.moveTo(r, -r); s.lineTo(length - r, -r);
  s.absarc(length - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(r, r); s.absarc(r, 0, r, Math.PI / 2, Math.PI * 1.5, false); return s;
}
function bar(a: Vec, b: Vec, radius: number, mat: THREE.Material, y: number) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.hypot(dx, dz), 8), mat);
  m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, 0, dz).normalize()); return m;
}

function iceTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1536;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 768, 1536);
  grad.addColorStop(0, '#e3f3f7'); grad.addColorStop(0.5, '#f0f6f6'); grad.addColorStop(1, '#bcddec');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 768, 1536);
  let seed = 32;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 0.7;
  for (let i = 0; i < 2600; i++) {
    const x = random() * 768, y = random() * 1536;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 36 - 18, y + random() * 60 - 30); ctx.stroke();
  }
  const X = (x: number) => (x + 5.4) / 10.8 * 768, Z = (z: number) => (z + 9) / 18 * 1536;
  const line = (z: number, color: string, width: number) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(0, Z(z)); ctx.lineTo(768, Z(z)); ctx.stroke(); };
  line(-2.8, '#168bdd', 9); line(2.8, '#168bdd', 9); line(0, '#dd4160', 7);
  line(C.goalZ, '#d83355', 2); line(7.55, '#d83355', 2);
  function circle(x: number, z: number, radius: number, color: string) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(X(x), Z(z), radius / 10.8 * 768, radius / 18 * 1536, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(X(x), Z(z), 7, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  circle(0, 0, 1.6, '#118de0');
  for (const x of [-2.8, 2.8]) for (const z of [-4.8, 4.5]) circle(x, z, 1.55, '#d83355');
  for (const z of [C.goalZ, 7.55]) {
    ctx.fillStyle = '#49b4ee35'; ctx.strokeStyle = '#dd4160'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(X(0), Z(z), 1.55 / 10.8 * 768, 1.1 / 18 * 1536, 0, z < 0 ? 0 : Math.PI, z < 0 ? Math.PI : Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}

export class RinkView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-7, 7, 10.5, -10.5, 0.1, 100);
  puck = new THREE.Group();
  flippers: THREE.Group[] = [];
  stick = new THREE.Group();
  shadow: THREE.Mesh;
  resolution = '';
  gpu = 'Unavailable';
  private actors = new Map<string, { group: THREE.Group; ring: THREE.Mesh; blade?: THREE.Group }>();
  private puckHalo: THREE.Mesh;
  private observer: ResizeObserver;
  private host: HTMLElement;
  private reduced = false;
  constructor(host: HTMLElement, match = false) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1;
    host.append(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', 'Hockey rink viewed from behind your two flippers');
    const gl = this.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    if (debug) this.gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    this.camera.position.set(0, 26, 19); this.camera.lookAt(0, 0, 0.2);
    this.scene.add(new THREE.HemisphereLight(0xd7f4ff, 0x283347, 2.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-5, 16, 4); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x59b9ff, 1.1); fill.position.set(6, 10, -10); this.scene.add(fill);

    const rim = new THREE.Mesh(new THREE.BoxGeometry(12, 0.65, 19.2), navy); rim.position.y = -0.35; this.scene.add(rim);
    const ice = polygon(outline, 0, new THREE.MeshBasicMaterial({ map: iceTexture(), toneMapped: false }));
    const pos = ice.geometry.getAttribute('position'), uv = ice.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 5.4) / 10.8, (pos.getY(i) + 9) / 18);
    uv.needsUpdate = true; ice.position.y = 0.01; this.scene.add(ice);
    const glass = new THREE.MeshStandardMaterial({ color: 0x76bfee, transparent: true, opacity: 0.18, roughness: 0.2, depthWrite: false });
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const segments = a.z > 8.99 && b.z > 8.99
        ? [[{ x: -3.8, y: 0, z: 9 }, { x: -C.drainHalfWidth, y: 0, z: 9 }], [{ x: C.drainHalfWidth, y: 0, z: 9 }, { x: 3.8, y: 0, z: 9 }]] : [[a, b]];
      for (const [v, w] of segments) {
        const length = Math.hypot(w.x - v.x, w.z - v.z), angle = -Math.atan2(w.z - v.z, w.x - v.x);
        const block = new THREE.Mesh(new THREE.BoxGeometry(length + 0.12, 1, 0.22), white);
        block.position.set((v.x + w.x) / 2, 0.5, (v.z + w.z) / 2); block.rotation.y = angle; this.scene.add(block);
        this.scene.add(bar(v, w, 0.045, red, 0.95), bar(v, w, 0.035, led, 0.12), bar(v, w, 0.035, led, 1.02));
        // Foreground remains open and readable. Glass is only on sides and the far end.
        if (v.z < 6 && w.z < 6) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(length, 0.55, 0.025), glass);
          panel.position.copy(block.position); panel.position.y = 1.3; panel.rotation.y = angle; this.scene.add(panel);
        }
      }
      if (i % 3 === 0) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 6), led); bulb.position.set(a.x, 1.06, a.z); this.scene.add(bulb);
      }
    }
    for (const p of guides) { const m = polygon(p, 0.6, navy); this.scene.add(m); this.scene.add(bar(p[0], p[1], 0.045, led, 0.63), bar(p[1], p[2], 0.045, led, 0.63)); }
    if (match) for (const p of returnApron) {
      this.scene.add(polygon(p, .55, navy), bar(p[0], p[1], .035, led, .57), bar(p[1], p[2], .035, led, .57));
    }
    if (match) for (const p of cradleGuides) {
      this.scene.add(polygon(p, .6, navy), bar(p[1], p[2], .035, led, .62));
    }

    for (const lane of LANES) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.016, lane.max - lane.min), material(0x172b3b)); slot.position.set(lane.x, 0.025, (lane.min + lane.max) / 2); this.scene.add(slot);
    }
    this.makeGoal();
    for (let side = 0; side < 2; side++) {
      const g = new THREE.Group(); g.position.set(side === 0 ? -C.pivotX : C.pivotX, 0.02, C.pivotZ);
      const radius = C.flipperWidth / 2;
      const shape = capsuleShape(C.flipperLength + radius, C.flipperWidth);
      const base = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.48, bevelEnabled: false, curveSegments: 12 }), red);
      base.rotation.x = -Math.PI / 2; base.position.x = -radius; g.add(base);
      const top = new THREE.Mesh(new THREE.ExtrudeGeometry(capsuleShape(C.flipperLength + radius - 0.05, C.flipperWidth - 0.06), { depth: 0.07, bevelEnabled: false, curveSegments: 12 }), material(0xfff1c8, { roughness: 0.3 }));
      top.rotation.x = -Math.PI / 2; top.position.set(0.025 - radius, 0.48, 0); g.add(top);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 24), chrome); pin.position.set(0, 0.59, 0); g.add(pin);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24), new THREE.MeshBasicMaterial({ color: 0x1199ff, transparent: true, opacity: 0.18 })); glow.rotation.x = -Math.PI / 2; glow.position.set(0, -0.003, 0); g.add(glow);
      this.flippers.push(g); this.scene.add(g);
    }
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(C.puckRadius, C.puckRadius, C.puckHalfHeight * 2, 32), material(0x121820, { roughness: 0.65 })); this.puck.add(disk);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 6, 24), material(0xb8d8e3)); ring.rotation.x = -Math.PI / 2; ring.position.y = C.puckHalfHeight + 0.002; this.puck.add(ring); this.scene.add(this.puck);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), new THREE.MeshBasicMaterial({ color: 0x051b29, transparent: true, opacity: 0.27, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.04; this.scene.add(this.shadow);
    this.puckHalo = new THREE.Mesh(new THREE.RingGeometry(.3, .335, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .65, depthTest: false, depthWrite: false }));
    this.puckHalo.rotation.x = -Math.PI / 2; this.puckHalo.renderOrder = 10; this.scene.add(this.puckHalo);
    for (let i = 0; i < 5; i++) this.makeActor(`skater-${i}`, false, i + 1);
    this.makeActor('goalie', true, 0);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.52, 0.3), red); blade.position.y = 0.29; this.stick.add(blade);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.9, 12), chrome); peg.position.y = 0.55; this.stick.add(peg); this.scene.add(this.stick);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
  }
  private makeActor(id: string, goalie: boolean, number: number) {
    const group = new THREE.Group(); group.visible = false;
    const black = material(0x141b25), skin = material(0xf0b88d), wood = material(0xc8aa7e);
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); mesh.position.set(x, y, z); group.add(mesh); return mesh;
    };
    const sphere = (x: number, y: number, z: number, radius: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), mat); mesh.position.set(x, y, z); group.add(mesh); return mesh;
    };
    const shaft = (a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material, parent = group) => {
      const delta = b.clone().sub(a), mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), mat);
      mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh);
    };
    const ring = new THREE.Mesh(new THREE.RingGeometry(.48, .56, 24), new THREE.MeshBasicMaterial({ color: 0xffbd4a, transparent: true, opacity: .8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .045; group.add(ring);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.45, 16), new THREE.MeshBasicMaterial({ color: 0x16252e, transparent: true, opacity: .15, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .033; group.add(shadow);
    if (goalie) {
      // Lower pad and blade dimensions match the actual collision footprint.
      box(-.24, .28, 0, .46, .56, .34, white); box(.24, .28, 0, .46, .56, .34, white);
      for (const y of [.12, .3, .45]) box(0, y, .176, .86, .025, .01, navy);
      box(0, .72, 0, .53, .47, .34, red); box(0, .59, 0, .54, .07, .35, white);
      sphere(-.38, .74, .03, .14, red); sphere(.38, .68, .06, .14, white);
      sphere(0, 1.08, 0, .23, red); box(0, 1.05, .205, .3, .18, .04, white);
      const blade = new THREE.Group(); blade.position.z = .42;
      const face = new THREE.Mesh(new THREE.BoxGeometry(.9, .22, .14), black); face.position.y = .16; blade.add(face);
      shaft(new THREE.Vector3(.32, .76, -.25), new THREE.Vector3(.32, .16, 0), .045, wood, blade); group.add(blade);
      this.actors.set(id, { group, ring, blade });
    } else {
      for (const z of [-.16, .16]) {
        box(0, .1, z, .42, .16, .13, black); box(0, .29, z, .14, .3, .14, white); box(0, .39, z, .15, .065, .15, red);
      }
      box(0, .49, 0, .4, .24, .38, navy);
      box(0, .76, 0, .49, .4, .46, red); box(0, .62, 0, .5, .065, .47, white);
      sphere(0, 1.08, 0, .19, skin); sphere(-.035, 1.16, 0, .22, red);
      box(.178, 1.08, 0, .025, .12, .26, black);
      shaft(new THREE.Vector3(.15, .89, -.22), new THREE.Vector3(.43, .62, -.04), .095, red);
      shaft(new THREE.Vector3(.12, .83, .22), new THREE.Vector3(.55, .51, .03), .095, red);
      sphere(.43, .62, -.04, .095, black); sphere(.55, .51, .03, .095, black);
      shaft(new THREE.Vector3(.3, .76, 0), new THREE.Vector3(1.06, .18, 0), .035, wood);
      box(1.06, .18, 0, .48, .32, .18, black);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d')!; context.fillStyle = '#db2447'; context.fillRect(0, 0, 64, 64); context.fillStyle = 'white'; context.font = 'bold 48px Arial'; context.textAlign = 'center'; context.fillText(String(number), 32, 50);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(.27, .29), new THREE.MeshBasicMaterial({ map: texture })); patch.rotation.y = -Math.PI / 2; patch.position.set(-.251, .79, 0); group.add(patch);
      this.actors.set(id, { group, ring });
    }
    this.scene.add(group);
  }
  setCelebration(kind: 'you' | 'cpu' | null) { led.color.setHex(kind === 'you' ? 0x83ffcf : kind === 'cpu' ? 0xff6c86 : 0x29baff); }
  private makeGoal() {
    // The shoulder is visible, so the closed dead space is not an invisible wall.
    for (let i = 0; i < rearArc.length - 1; i++) {
      const a = rearArc[i], b = rearArc[i + 1];
      this.scene.add(polygon([a, b, { ...b, z: -9.1 }, { ...a, z: -9.1 }], 0.58, navy));
      this.scene.add(bar(a, b, 0.11, red, 0.14));
    }
    for (const x of [-C.goalHalfWidth, C.goalHalfWidth]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 1.4, 12), red); post.position.set(x, 0.7, C.goalZ); this.scene.add(post);
    }
    this.scene.add(bar({ x: -1.5, y: 0, z: C.goalZ }, { x: 1.5, y: 0, z: C.goalZ }, 0.085, red, 1.4));
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const y = i * 0.2 + 0.14;
      for (let j = 0; j < rearArc.length - 1; j++) points.push(new THREE.Vector3(rearArc[j].x, y, rearArc[j].z), new THREE.Vector3(rearArc[j + 1].x, y, rearArc[j + 1].z));
    }
    for (const a of rearArc) points.push(new THREE.Vector3(a.x, 0.14, a.z), new THREE.Vector3(a.x, 1.34, a.z));
    this.scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xf4ffff, transparent: true, opacity: 0.65 })));
  }
  setReduced(value: boolean) { this.reduced = value; this.resize(); }
  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    const aspect = w / h, halfH = Math.max(8.6, 6.3 / aspect);
    this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect; this.camera.top = halfH; this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(this.reduced ? 1 : Math.min(window.devicePixelRatio, 1.5)); this.renderer.setSize(w, h);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.resolution = `${size.x} × ${size.y}`;
  }
  render(prev: State, now: State, alpha: number, stickEnabled: boolean) {
    const lerp = THREE.MathUtils.lerp;
    this.puck.visible = this.shadow.visible = now.active;
    this.puck.position.set(lerp(prev.puck.x, now.puck.x, alpha), lerp(prev.puck.y, now.puck.y, alpha), lerp(prev.puck.z, now.puck.z, alpha));
    this.shadow.position.x = this.puck.position.x; this.shadow.position.z = this.puck.position.z;
    this.puckHalo.visible = now.active; this.puckHalo.position.copy(this.puck.position); this.puckHalo.position.y += .11;
    const hop = Math.max(0, this.puck.position.y - 0.11); this.shadow.scale.setScalar(1 + hop); (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.27 - hop * 0.25;
    this.flippers.forEach((g, side) => { const a = lerp(prev.angles[side], now.angles[side], alpha); g.rotation.y = side === 0 ? -a : -(Math.PI - a); });
    this.stick.visible = stickEnabled; this.stick.position.z = lerp(prev.stickZ, now.stickZ, alpha); this.stick.rotation.y = lerp(prev.stickAngle, now.stickAngle, alpha);
    for (const [id, visual] of this.actors) {
      const pose = now.actors.find(a => a.id === id); visual.group.visible = !!pose;
      if (!pose) continue;
      const before = prev.actors.find(a => a.id === id) ?? pose;
      visual.group.position.set(lerp(before.x, pose.x, alpha), 0, lerp(before.z, pose.z, alpha));
      visual.group.rotation.y = pose.kind === 'skater' ? -lerp(before.angle, pose.angle, alpha) : 0;
      visual.ring.visible = ['windup', 'swing', 'clear', 'checked'].includes(pose.stage);
      (visual.ring.material as THREE.MeshBasicMaterial).color.setHex(pose.stage === 'checked' ? 0x8eeaff : 0xffbd4a);
      if (visual.blade) visual.blade.position.z = .42 + lerp(before.kick, pose.kick, alpha) * .4;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
