import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C, OFFENSE, LANES, MATCH_SKATERS, MATCH_EXTENDED_WINGS, cradleGuides, guides, outline, rearArc, returnApron } from './config';
import type { State } from './physics';
import type { Vec } from './config';
import { paint, surface, rounded, rod, sphere, softTexture, groundShadow, iceTexture, hockeyFigure, batchStatic } from './art';

function polygon(p: Vec[], height: number, mat: T.Material) {
  const shape = new T.Shape(p.map(v => new T.Vector2(v.x, -v.z)));
  const geometry = height ? new T.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }) : new T.ShapeGeometry(shape);
  const m = new T.Mesh(geometry, mat); m.rotation.x = -Math.PI / 2; return m;
}
function capsuleShape(length: number, width: number) {
  const r = width / 2, s = new T.Shape(); s.moveTo(r, -r); s.lineTo(length - r, -r);
  s.absarc(length - r, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(r, r); s.absarc(r, 0, r, Math.PI / 2, Math.PI * 1.5, false); return s;
}

export class RinkView {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(32, 1, .1, 150);
  puck = new T.Group(); flippers: T.Group[] = []; stick = new T.Group(); shadow: T.Mesh;
  private offensePaddles: T.Group[] = [];
  resolution = ''; gpu = 'Unavailable';
  private actors = new Map<string, { group: T.Group; ring: T.Mesh; blade?: T.Group }>();
  private puckHalo: T.Mesh;
  private host: HTMLElement; private observer: ResizeObserver; private reduced = false;
  private led = new T.MeshBasicMaterial({ color: 0x35baff, toneMapped: false });
  private glowMap = softTexture(); private glows: T.Sprite[] = [];
  private celebration: 'you' | 'cpu' | null = null; private celebrationStart = 0;
  private confetti: T.Points; private confettiSeeds: number[] = []; private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private crowd = new T.Group(); private staticArt = new T.Group();
  constructor(host: HTMLElement, private match = false) {
    this.host = host;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = .96;
    host.append(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', 'Angled tabletop hockey rink, viewed from behind your two flippers');
    const gl = this.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info'); if (debug) this.gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    const environment = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(environment, .04); this.scene.environment = env.texture; this.scene.environmentIntensity = .6; environment.dispose(); pmrem.dispose();
    this.scene.add(new T.HemisphereLight(0xd4eaff, 0x20344d, 1.25));
    const key = new T.DirectionalLight(0xfff8ed, 1.9); key.position.set(-4, 12, 4); this.scene.add(key);
    const fill = new T.DirectionalLight(0x4faaff, .8); fill.position.set(6, 8, -9); this.scene.add(fill);
    this.scene.add(this.staticArt, this.crowd);
    const { navy, chrome, white, red } = paint;
    const outer = outline.map(v => ({ ...v, x: v.x * 1.11, z: v.z * 1.06 }));
    const cabinet = polygon(outer, .62, navy); cabinet.position.y = -.68; this.staticArt.add(cabinet);
    // Baked light reflections keep the painted lines and skate scuffs legible on small screens.
    const ice = polygon(outline, 0, new T.MeshBasicMaterial({ map: iceTexture(), toneMapped: false }));
    const pos = ice.geometry.getAttribute('position'), uv = ice.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 5.4) / 10.8, (pos.getY(i) + 9) / 18);
    uv.needsUpdate = true; ice.position.y = .01; this.staticArt.add(ice);
    const glass = new T.MeshPhysicalMaterial({ color: 0xaccbdf, transparent: true, opacity: .13, roughness: .1, metalness: .05, depthWrite: false, side: T.DoubleSide });
    const glassEdges = surface(0x99cbe8, { metalness: .75, roughness: .2 });
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      const segments = a.z > 8.99 && b.z > 8.99
        ? [[{ x: -3.8, y: 0, z: 9 }, { x: -C.drainHalfWidth, y: 0, z: 9 }], [{ x: C.drainHalfWidth, y: 0, z: 9 }, { x: 3.8, y: 0, z: 9 }]] : [[a, b]];
      for (const [v, w] of segments) {
        const length = Math.hypot(w.x - v.x, w.z - v.z), angle = -Math.atan2(w.z - v.z, w.x - v.x);
        const board = rounded(this.staticArt, (v.x + w.x) / 2, .43, (v.z + w.z) / 2, length + .09, .86, .17, white, .018); board.rotation.y = angle;
        const rail = rounded(this.staticArt, (v.x + w.x) / 2, .9, (v.z + w.z) / 2, length + .1, .16, .29, navy, .025); rail.rotation.y = angle;
        for (const [y, r, mat] of [[.095, .035, this.led], [.84, .025, red], [1.0, .04, this.led]] as const) rod(this.staticArt, [v.x, y, v.z], [w.x, y, w.z], r, mat);
        if (Math.min(v.z, w.z) < 6) {
          const vz = Math.min(5.65, v.z), wz = Math.min(5.65, w.z), glassLength = Math.hypot(w.x - v.x, wz - vz);
          const panel = new T.Mesh(new T.BoxGeometry(glassLength, .93, .018), glass); panel.position.set(board.position.x, 1.46, (vz + wz) / 2); panel.rotation.y = angle; this.staticArt.add(panel);
          rod(this.staticArt, [v.x, 1.94, vz], [w.x, 1.94, wz], .013, glassEdges);
          if (i % 3 === 0) rod(this.staticArt, [v.x, .95, vz], [v.x, 1.93, vz], .018, glassEdges);
          for (let j = 1; j < glassLength / 2.6; j++) {
            const f = j * 2.6 / glassLength, x = T.MathUtils.lerp(v.x, w.x, f), z = T.MathUtils.lerp(vz, wz, f);
            rod(this.staticArt, [x, .95, z], [x, 1.93, z], .015, glassEdges); this.lamp(x, 1.04, z);
          }
        }
      }
      if (i % 4 === 0) this.lamp(a.x, 1.04, a.z);
      const oa = outer[i], ob = outer[(i + 1) % outer.length]; rod(this.staticArt, [oa.x, -.02, oa.z], [ob.x, -.02, ob.z], .028, this.led);
    }
    for (const p of guides) { this.staticArt.add(polygon(p, .6, navy)); rod(this.staticArt, [p[0].x, .63, p[0].z], [p[1].x, .63, p[1].z], .035, this.led); }
    if (match) for (const p of returnApron) { this.staticArt.add(polygon(p, .55, navy)); rod(this.staticArt, [p[0].x, .57, p[0].z], [p[1].x, .57, p[1].z], .028, this.led); }
    if (match) for (const p of cradleGuides) { this.staticArt.add(polygon(p, .6, navy)); rod(this.staticArt, [p[1].x, .62, p[1].z], [p[2].x, .62, p[2].z], .027, this.led); }
    const lanes = LANES.slice(0, match ? MATCH_SKATERS : 5).map((lane, i) => ({ ...lane, max: match && MATCH_SKATERS === 3 && MATCH_EXTENDED_WINGS && i < 2 ? LANES[i + 3].max : lane.max }));
    for (const lane of lanes) {
      rounded(this.staticArt, lane.x, .023, (lane.min + lane.max) / 2, .135, .02, lane.max - lane.min + .12, chrome, .006);
      rounded(this.staticArt, lane.x, .035, (lane.min + lane.max) / 2, .095, .018, lane.max - lane.min + .04, paint.black, .008);
    }
    this.makeGoal();
    for (let side = 0; side < 2; side++) {
      const g = new T.Group(); g.position.set(side === 0 ? -C.pivotX : C.pivotX, .02, C.pivotZ); const radius = C.flipperWidth / 2;
      // Outer rubber envelope is unchanged; beveled caps stay inside it.
      const base = new T.Mesh(new T.ExtrudeGeometry(capsuleShape(C.flipperLength + radius, C.flipperWidth), { depth: .6, bevelEnabled: false, curveSegments: 20 }), paint.rubber); base.rotation.x = -Math.PI / 2; base.position.x = -radius; g.add(base);
      const cap = new T.Mesh(new T.ExtrudeGeometry(capsuleShape(C.flipperLength + radius - .09, C.flipperWidth - .1), { depth: .025, bevelEnabled: true, bevelSize: .026, bevelThickness: .026, bevelSegments: 3, curveSegments: 20 }), paint.cream); cap.rotation.x = -Math.PI / 2; cap.position.set(.045 - radius, .62, 0); g.add(cap);
      const pin = new T.Mesh(new T.CylinderGeometry(.225, .24, .07, 32), navy); pin.position.set(0, .71, 0); g.add(pin); sphere(g, 0, .735, 0, .195, chrome, [1, .3, 1]); rod(g, [-.09, .796, 0], [.09, .796, 0], .008, navy);
      this.flippers.push(g); this.scene.add(g);
    }
    if (match) for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1, radius = OFFENSE.width / 2, shaft = OFFENSE.length - radius;
      // Mechanics prototype: board artwork stays intact while these recess into it.
      const g = new T.Group(); g.position.set(sign * OFFENSE.pivotX, .015, OFFENSE.pivotZ);
      rounded(g, shaft / 2, .16, 0, shaft, .3, OFFENSE.width, paint.rubber, .02);
      for (const x of [0, shaft]) { const end = new T.Mesh(new T.CylinderGeometry(radius, radius, .3, 16), paint.rubber); end.position.set(x, .16, 0); g.add(end); }
      rod(g, [0, .32, 0], [shaft, .32, 0], .035, paint.cream);
      sphere(g, 0, .35, 0, .09, chrome, [1, .35, 1]);
      // Small visible seams mark the resting stroke; they do not enter the ice.
      rod(this.staticArt, [sign * 5.31, .35, OFFENSE.pivotZ], [sign * 5.31, .35, OFFENSE.pivotZ + OFFENSE.length], .012, this.led);
      this.offensePaddles.push(g); this.scene.add(g);
    }
    const disk = new T.Mesh(new T.CylinderGeometry(C.puckRadius, C.puckRadius, C.puckHalfHeight * 2, 40), surface(0x09121b, { roughness: .43 })); this.puck.add(disk);
    const ring = new T.Mesh(new T.TorusGeometry(.21, .01, 6, 32), surface(0x74858b)); ring.rotation.x = -Math.PI / 2; ring.position.y = C.puckHalfHeight + .002; this.puck.add(ring); this.scene.add(this.puck);
    this.shadow = groundShadow(this.scene, .86, .86, .62, this.glowMap);
    this.puckHalo = new T.Mesh(new T.RingGeometry(.292, .315, 32), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .58, depthTest: false, depthWrite: false })); this.puckHalo.rotation.x = -Math.PI / 2; this.puckHalo.renderOrder = 10; this.scene.add(this.puckHalo);
    for (let i = 0; i < (match ? MATCH_SKATERS : 5); i++) this.makeActor(`skater-${i}`, false, [17, 9, 23, 6, 12][i]); this.makeActor('goalie', true, 1);
    rounded(this.stick, 0, .29, 0, 2.04, .52, .3, red); rod(this.stick, [0, .1, 0], [0, 1, 0], .17, chrome); this.scene.add(this.stick);
    this.makeCrowd(); batchStatic(this.staticArt);
    const particles = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(new Float32Array(72 * 3), 3)); for (let i = 0; i < 72; i++) this.confettiSeeds.push((i * .61803398875) % 1);
    this.confetti = new T.Points(particles, new T.PointsMaterial({ color: 0x82ddff, size: .095, transparent: true, opacity: .9, depthWrite: false })); this.confetti.visible = false; this.scene.add(this.confetti);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resize();
  }
  private lamp(x: number, y: number, z: number) {
    const socket = new T.Mesh(new T.CylinderGeometry(.115, .13, .055, 16), paint.chrome); socket.position.set(x, y, z); this.staticArt.add(socket); sphere(this.staticArt, x, y + .025, z, .084, this.led, [1, .5, 1]);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: this.glowMap, color: 0x189fff, transparent: true, opacity: .6, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })); glow.position.set(x, y + .06, z); glow.scale.setScalar(.7); this.glows.push(glow); this.scene.add(glow);
  }
  private makeActor(id: string, goalie: boolean, number: number) {
    const { group, blade } = hockeyFigure(goalie, number); group.visible = false;
    const ring = new T.Mesh(new T.RingGeometry(.46, .53, 32), new T.MeshBasicMaterial({ color: 0xffbd4a, transparent: true, opacity: .8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .047; group.add(ring); groundShadow(group, goalie ? 1.3 : 1.1, .95, .48, this.glowMap);
    this.actors.set(id, { group, ring, blade }); this.scene.add(group);
  }
  private makeGoal() {
    // Rear/side bumper colliders stay in physics; only the actual net piping is visible.
    for (let i = 0; i < rearArc.length - 1; i++) { const a = rearArc[i], b = rearArc[i + 1]; rod(this.staticArt, [a.x, .14, a.z], [b.x, .14, b.z], .11, paint.red); }
    for (const x of [-1.5, 1.5]) rod(this.staticArt, [x, .03, C.goalZ], [x, 1.4, C.goalZ], .085, paint.red); rod(this.staticArt, [-1.5, 1.4, C.goalZ], [1.5, 1.4, C.goalZ], .085, paint.red);
    const net: number[] = [], add = (a: number[], b: number[]) => net.push(...a, ...b);
    for (let j = 0; j < 24; j++) {
      const a = rearArc[j], b = rearArc[j + 1]; for (let row = 0; row < 10; row++) { const y = .15 + row * .123; add([a.x, y, a.z], [b.x, y + .123, b.z]); add([b.x, y, b.z], [a.x, y + .123, a.z]); }
      add([a.x, 1.38, a.z], [b.x, 1.38, b.z]); add([a.x, 1.38, a.z], [a.x, 1.4, C.goalZ]);
    }
    for (let i = 1; i < 10; i++) { const z = C.goalZ - i * .12, x = 1.5 * Math.sqrt(1 - Math.pow((C.goalZ - z) / 1.3, 2)); add([-x, 1.39, z], [x, 1.39, z]); }
    this.staticArt.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(net, 3)), new T.LineBasicMaterial({ color: 0xd0d9d8, transparent: true, opacity: .62 })));
    groundShadow(this.staticArt, 3.4, 1.9, .18, this.glowMap).position.set(0, .033, -8.15);
  }
  private makeCrowd() {
    const colors = [0x123d62, 0x267898, 0x872540, 0x4f6177, 0xc4c8c5].map(c => surface(c, { roughness: .85 }));
    for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
      rounded(this.crowd, side * (6.7 + row * .65), -.12 + row * .36, -.6, .7, .28, 16.8, paint.navy);
      for (let i = 0; i < 23; i++) {
        const x = side * (6.65 + row * .65), y = .13 + row * .36, z = -8.4 + i * .7;
        rounded(this.crowd, x, y + .18, z, .31, .4, .33, colors[(i * 3 + row * 2 + side + 1) % colors.length], .07); sphere(this.crowd, x, y + .51, z, .13, i % 4 ? paint.skin : paint.pad);
        for (const arm of [-1, 1]) rod(this.crowd, [x, y + .29, z + arm * .18], [x - side * .16, y + (i % 7 === 0 ? .58 : .1), z + arm * .22], .055, colors[(i * 3 + row * 2 + side + 1) % colors.length]);
      }
    }
    batchStatic(this.crowd);
  }
  setCelebration(kind: 'you' | 'cpu' | null) { this.celebration = kind; this.celebrationStart = performance.now(); }
  setReduced(value: boolean) { this.reduced = value; this.resize(); }
  setReducedMotion(value: boolean) { this.reducedMotion = value; }
  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight), aspect = w / h; this.camera.aspect = aspect;
    // Fit every corner, including glass. Wider views reveal crowds without shrinking the rink.
    const elevation = 57 * Math.PI / 180, s = Math.sin(elevation), c = Math.cos(elevation), tan = Math.tan(this.camera.fov * Math.PI / 360); let distance = 0;
    for (const x of [-6.02, 6.02]) for (const y of [-.7, 1.96]) for (const z of [-9.62, 9.7]) { const depth = y * s + z * c, up = y * c - z * s; distance = Math.max(distance, depth + Math.abs(x) / (tan * aspect * .965), depth + Math.abs(up) / (tan * .965)); }
    let offset = 0;
    if (this.match) {
      // Center the projected cabinet, not the world origin. Fit the entire glass
      // and near apron with equal top/bottom breathing room at the same angle.
      const limit = tan * .975; let upper = -Infinity, lower = Infinity, horizontal = 0;
      for (const x of [-6.02, 6.02]) for (const y of [-.7, 1.96]) for (const z of [-9.62, 9.7]) {
        const depth = y * s + z * c, up = y * c - z * s;
        upper = Math.max(upper, up + limit * depth); lower = Math.min(lower, up - limit * depth);
        horizontal = Math.max(horizontal, depth + Math.abs(x) / (limit * aspect));
      }
      distance = Math.max(horizontal, (upper - lower) / (2 * limit)); offset = (upper + lower) / 2;
    }
    this.camera.position.set(0, distance * s + offset * c, distance * c - offset * s); this.camera.lookAt(0, offset * c, -offset * s); this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(this.reduced ? 1 : Math.min(window.devicePixelRatio, 1.75)); this.renderer.setSize(w, h); this.crowd.visible = !this.reduced && aspect > .82;
    const size = this.renderer.getDrawingBufferSize(new T.Vector2()); this.resolution = `${size.x} × ${size.y}`;
  }
  get presentation() { return { camera: 'perspective', elevation: 57, crowd: this.crowd.visible, reducedMotion: this.reducedMotion, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, celebration: this.celebration }; }
  render(prev: State, now: State, alpha: number, stickEnabled: boolean) {
    const lerp = T.MathUtils.lerp; this.puck.visible = this.shadow.visible = now.active;
    this.puck.position.set(lerp(prev.puck.x, now.puck.x, alpha), lerp(prev.puck.y, now.puck.y, alpha), lerp(prev.puck.z, now.puck.z, alpha)); this.shadow.position.x = this.puck.position.x; this.shadow.position.z = this.puck.position.z;
    this.puckHalo.visible = now.active; this.puckHalo.position.copy(this.puck.position); this.puckHalo.position.y += .11;
    const hop = Math.max(0, this.puck.position.y - .11); this.shadow.scale.setScalar(1 + hop); (this.shadow.material as T.MeshBasicMaterial).opacity = Math.max(.18, .62 - hop * .45);
    this.flippers.forEach((g, side) => { const a = lerp(prev.angles[side], now.angles[side], alpha); g.rotation.y = side === 0 ? -a : -(Math.PI - a); }); this.stick.visible = stickEnabled; this.stick.position.z = lerp(prev.stickZ, now.stickZ, alpha); this.stick.rotation.y = lerp(prev.stickAngle, now.stickAngle, alpha);
    this.offensePaddles.forEach((g, side) => { const a = lerp(prev.offenseAngle, now.offenseAngle, alpha); g.rotation.y = side === 0 ? -a : -(Math.PI - a); });
    for (const [id, visual] of this.actors) {
      const pose = now.actors.find(a => a.id === id); visual.group.visible = !!pose; if (!pose) continue; const before = prev.actors.find(a => a.id === id) ?? pose;
      visual.group.position.set(lerp(before.x, pose.x, alpha), 0, lerp(before.z, pose.z, alpha)); visual.group.rotation.y = pose.kind === 'skater' ? -lerp(before.angle, pose.angle, alpha) : 0;
      visual.ring.visible = ['windup', 'swing', 'clear', 'checked'].includes(pose.stage); (visual.ring.material as T.MeshBasicMaterial).color.setHex(pose.stage === 'checked' ? 0x8eeaff : 0xffbd4a); if (visual.blade) visual.blade.position.z = .42 + lerp(before.kick, pose.kick, alpha) * .4;
    }
    const t = (performance.now() - this.celebrationStart) / 1000, celebrating = this.celebration !== null && t < 2.5, color = celebrating ? this.celebration === 'you' ? 0x83ffe5 : 0xff5774 : 0x35baff; this.led.color.setHex(color);
    for (const glow of this.glows) { const mat = glow.material as T.SpriteMaterial; mat.color.setHex(color); mat.opacity = celebrating && !this.reducedMotion ? .45 + .15 * Math.sin(t * 4) : .45; }
    this.confetti.visible = celebrating && this.celebration === 'you' && !this.reducedMotion;
    if (this.confetti.visible) { const p = this.confetti.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { const r = this.confettiSeeds[i], side = i % 2 ? -1 : 1; p.setXYZ(i, side * (5.85 + r * 2.4 + t * .4), 1.8 + r * 2 + t * (2 + r) - t * t * 1.7, -7.8 + ((i * .381966) % 1) * 15); } p.needsUpdate = true; (this.confetti.material as T.PointsMaterial).opacity = Math.max(0, 1 - t / 2.5); }
    this.renderer.render(this.scene, this.camera);
  }
}
