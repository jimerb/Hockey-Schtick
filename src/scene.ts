import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { C, OFFENSE, LANES, MATCH_SKATERS, MATCH_EXTENDED_WINGS, cradleGuides, guides, outline, returnApron } from './config';
import type { State } from './physics';
import type { Vec } from './config';
import { paint, surface, rounded, rod, sphere, softTexture, groundShadow, iceTextures, hockeyFigure, batchStatic } from './art';
import { ArenaCrowd } from './crowd';
import { hockeyGoal } from './goal-art';

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
  private offenseRestFaces: T.Group[] = [];
  resolution = ''; gpu = 'Unavailable';
  private actors = new Map<string, { group: T.Group; ring: T.Mesh; blade?: T.Group }>();
  private puckHalo: T.Mesh;
  private iceReflection: Reflector;
  private host: HTMLElement; private observer: ResizeObserver; private reduced = false;
  private led = new T.MeshBasicMaterial({ color: 0x35baff, toneMapped: false });
  private glowMap = softTexture(); private glows: T.Sprite[] = [];
  private celebration: 'you' | 'cpu' | null = null; private celebrationStart = 0;
  private confetti: T.Points; private confettiSeeds: number[] = []; private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private crowd = new ArenaCrowd(); private staticArt = new T.Group(); private lastVisualTime = performance.now();
  constructor(host: HTMLElement, private match = false) {
    this.host = host;
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFShadowMap;
    host.append(this.renderer.domElement); this.renderer.domElement.setAttribute('aria-label', 'Angled tabletop hockey rink, viewed from behind your two flippers');
    const gl = this.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info'); if (debug) this.gpu = gl.getParameter(debug.UNMASKED_RENDERER_WEBGL);
    const environment = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer);
    // Broad studio strips give lacquer, chrome and ice a common reflected light source.
    for (const x of [-4.5, 4.5]) {
      const panel = new T.Mesh(new T.PlaneGeometry(1.4, 10), new T.MeshBasicMaterial({ color: 0xc4eaff }));
      panel.position.set(x, 6, -2); panel.rotation.x = Math.PI / 2; environment.add(panel);
    }
    const env = pmrem.fromScene(environment, .035); this.scene.environment = env.texture; this.scene.environmentIntensity = .48; environment.dispose(); pmrem.dispose();
    this.scene.add(new T.HemisphereLight(0xd4eaff, 0x14253a, .55));
    const key = new T.DirectionalLight(0xfff6e8, 2.6); key.position.set(-3, 12, -5);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 11; key.shadow.camera.bottom = -11; key.shadow.camera.near = .5; key.shadow.camera.far = 35;
    key.shadow.normalBias = .015; key.shadow.bias = -.00015; key.shadow.radius = 2; this.scene.add(key);
    const fill = new T.DirectionalLight(0x91caff, .6); fill.position.set(6, 8, 3); this.scene.add(fill);
    const rim = new T.DirectionalLight(0x47a8ff, .8); rim.position.set(-8, 4, -5); this.scene.add(rim);
    this.scene.add(this.staticArt, this.crowd.group);
    const { navy, chrome, white, red } = paint;
    const outer = outline.map(v => ({ ...v, x: v.x * 1.11, z: v.z * 1.06 }));
    const cabinet = polygon(outer, .62, navy); cabinet.position.y = -.68; this.staticArt.add(cabinet);
    // One physical surface: scuffs affect its relief/gloss while rink paint remains legible.
    const ice = polygon(outline, 0, new T.MeshPhysicalMaterial({ ...iceTextures(), color: 0xb2d6ed, roughness: .62, bumpScale: .022,
      metalness: 0, clearcoat: .22, clearcoatRoughness: .3, ior: 1.31, envMapIntensity: .18 }));
    const pos = ice.geometry.getAttribute('position'), uv = ice.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 5.4) / 10.8, (pos.getY(i) + 9) / 18);
    uv.needsUpdate = true; ice.position.y = .01; ice.receiveShadow = true; this.scene.add(ice);
    // A softened planar reflection grounds moving figures and LEDs in the ice.
    // A fixed-size render target bounds the cost on larger displays.
    this.iceReflection = new Reflector(ice.geometry.clone(), { textureWidth: 512, textureHeight: 768, multisample: 0, clipBias: .003,
      shader: { name: 'IceReflection', uniforms: { color: { value: new T.Color(0xffffff) }, tDiffuse: { value: null }, textureMatrix: { value: new T.Matrix4() } }, vertexShader: `
        uniform mat4 textureMatrix; varying vec4 vUv;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`, fragmentShader: `
        uniform sampler2D tDiffuse; varying vec4 vUv;
        #include <logdepthbuf_pars_fragment>
        void main() {
          #include <logdepthbuf_fragment>
          vec2 uv = vUv.xy / vUv.w;
          vec3 reflection = texture2D(tDiffuse, uv).rgb * .4;
          reflection += texture2D(tDiffuse, uv + vec2(.0015,.0015)).rgb * .15;
          reflection += texture2D(tDiffuse, uv - vec2(.0015,.0015)).rgb * .15;
          reflection += texture2D(tDiffuse, uv + vec2(-.0015,.0015)).rgb * .15;
          reflection += texture2D(tDiffuse, uv + vec2(.0015,-.0015)).rgb * .15;
          gl_FragColor = vec4(reflection * vec3(.82,.93,1.0), .10);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` } });
    this.iceReflection.rotation.x = -Math.PI / 2; this.iceReflection.position.y = .023;
    const reflectionMaterial = this.iceReflection.material as T.ShaderMaterial;
    reflectionMaterial.transparent = true; reflectionMaterial.depthWrite = false;
    const reflect = this.iceReflection.onBeforeRender.bind(this.iceReflection);
    this.iceReflection.onBeforeRender = (...args) => { const visible = this.crowd.group.visible; this.crowd.group.visible = false; try { reflect(...args); } finally { this.crowd.group.visible = visible; } };
    this.scene.add(this.iceReflection);
    const glass = new T.MeshPhysicalMaterial({ color: 0xb5dcf2, transparent: true, opacity: .12, roughness: .14, metalness: .08, clearcoat: .6, depthWrite: false, side: T.DoubleSide });
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
      // A flush board-face insert exposes the resting paddle without moving its
      // collider onto the ice. Keep the surrounding board art for this prototype.
      const face = new T.Group(), centerZ = OFFENSE.pivotZ + shaft / 2;
      rounded(this.staticArt, sign * 5.30, .23, centerZ, .014, .39, OFFENSE.length + .14, navy, .004);
      rounded(face, sign * 5.28, .23, centerZ, .014, .28, OFFENSE.length, paint.rubber, .004);
      rounded(face, sign * 5.265, .25, centerZ, .014, .13, OFFENSE.length - .12, paint.cream, .004);
      const hinge = new T.Mesh(new T.CylinderGeometry(.085, .085, .018, 20), chrome);
      hinge.rotation.z = Math.PI / 2; hinge.position.set(sign * 5.25, .23, OFFENSE.pivotZ); face.add(hinge);
      // The top rim is also readable from this elevated camera. It lies entirely
      // within the existing rail footprint rather than protruding into the ice.
      rounded(face, sign * 5.4, .985, centerZ, .15, .012, OFFENSE.length, paint.rubber, .003);
      rounded(face, sign * 5.4, .995, centerZ, .065, .01, OFFENSE.length - .12, paint.cream, .002);
      this.offenseRestFaces.push(face); this.scene.add(face);
      this.offensePaddles.push(g); this.scene.add(g);
    }
    const disk = new T.Mesh(new T.CylinderGeometry(C.puckRadius, C.puckRadius, C.puckHalfHeight * 2, 40), surface(0x09121b, { roughness: .43 })); this.puck.add(disk);
    const ring = new T.Mesh(new T.TorusGeometry(.21, .01, 6, 32), surface(0x74858b)); ring.rotation.x = -Math.PI / 2; ring.position.y = C.puckHalfHeight + .002; this.puck.add(ring); this.scene.add(this.puck);
    this.shadow = groundShadow(this.scene, .86, .86, .62, this.glowMap);
    this.puckHalo = new T.Mesh(new T.RingGeometry(.292, .315, 32), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .58, depthTest: false, depthWrite: false })); this.puckHalo.rotation.x = -Math.PI / 2; this.puckHalo.renderOrder = 10; this.scene.add(this.puckHalo);
    for (let i = 0; i < (match ? MATCH_SKATERS : 5); i++) this.makeActor(`skater-${i}`, false, [17, 9, 23, 6, 12][i]); this.makeActor('goalie', true, 1);
    rounded(this.stick, 0, .29, 0, 2.04, .52, .3, red); rod(this.stick, [0, .1, 0], [0, 1, 0], .17, chrome); this.scene.add(this.stick);
    batchStatic(this.staticArt);
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
    group.traverse(node => { if (node instanceof T.Mesh && !Array.isArray(node.material) && !node.material.transparent) { node.castShadow = true; node.receiveShadow = true; } });
    const ring = new T.Mesh(new T.RingGeometry(.46, .53, 32), new T.MeshBasicMaterial({ color: 0xffbd4a, transparent: true, opacity: .8, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .047; group.add(ring); groundShadow(group, goalie ? 1.3 : 1.1, .95, .48, this.glowMap);
    this.actors.set(id, { group, ring, blade }); this.scene.add(group);
  }
  private makeGoal() {
    // Rear/side bumper colliders stay in physics; only the actual net piping is visible.
    const net = hockeyGoal(); net.traverse(node => { if (node instanceof T.Mesh) { node.castShadow = true; node.receiveShadow = true; } }); this.scene.add(net);
    groundShadow(this.staticArt, 3.7, 2.3, .32, this.glowMap).position.set(0, .033, -8.15);
  }
  setCelebration(kind: 'you' | 'cpu' | null) { this.celebration = kind; this.celebrationStart = performance.now(); }
  setReduced(value: boolean) { this.reduced = value; this.iceReflection.visible = !value; this.renderer.shadowMap.enabled = !value; this.resize(); }
  setReducedMotion(value: boolean) { this.reducedMotion = value; if (value) this.crowd.resetMotion(); }
  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight), aspect = w / h; this.camera.aspect = aspect;
    // Fit every corner, including glass. Wider views reveal crowds without shrinking the rink.
    const elevation = 47 * Math.PI / 180, s = Math.sin(elevation), c = Math.cos(elevation), tan = Math.tan(this.camera.fov * Math.PI / 360); let distance = 0;
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
    this.camera.position.set(0, distance * s + offset * c, distance * c - offset * s); this.camera.lookAt(0, offset * c, -offset * s); this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(this.reduced ? 1 : Math.min(window.devicePixelRatio, 1.75)); this.renderer.setSize(w, h); this.crowd.group.visible = !this.reduced && aspect > .82;
    const size = this.renderer.getDrawingBufferSize(new T.Vector2()); this.resolution = `${size.x} × ${size.y}`;
  }
  get presentation() { return { camera: 'perspective', elevation: 47, crowd: this.crowd.group.visible, crowdDetail: this.crowd.presentation, ice: 'scuffed clearcoat with softened planar reflections', reflections: this.iceReflection.visible, shadows: this.renderer.shadowMap.enabled, reducedMotion: this.reducedMotion, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, celebration: this.celebration }; }
  render(prev: State, now: State, alpha: number, stickEnabled: boolean, motionActive = true) {
    const lerp = T.MathUtils.lerp; this.puck.visible = this.shadow.visible = now.active;
    this.puck.position.set(lerp(prev.puck.x, now.puck.x, alpha), lerp(prev.puck.y, now.puck.y, alpha), lerp(prev.puck.z, now.puck.z, alpha)); this.shadow.position.x = this.puck.position.x; this.shadow.position.z = this.puck.position.z;
    this.puckHalo.visible = now.active; this.puckHalo.position.copy(this.puck.position); this.puckHalo.position.y += .11;
    const hop = Math.max(0, this.puck.position.y - .11); this.shadow.scale.setScalar(1 + hop); (this.shadow.material as T.MeshBasicMaterial).opacity = Math.max(.18, .62 - hop * .45);
    this.flippers.forEach((g, side) => { const a = lerp(prev.angles[side], now.angles[side], alpha); g.rotation.y = side === 0 ? -a : -(Math.PI - a); }); this.stick.visible = stickEnabled; this.stick.position.z = lerp(prev.stickZ, now.stickZ, alpha); this.stick.rotation.y = lerp(prev.stickAngle, now.stickAngle, alpha);
    this.offensePaddles.forEach((g, side) => { const a = lerp(prev.offenseAngles[side], now.offenseAngles[side], alpha); g.rotation.y = side === 0 ? -a : -(Math.PI - a); this.offenseRestFaces[side].visible = Math.abs(a - OFFENSE.restAngle) < .035; });
    for (const [id, visual] of this.actors) {
      const pose = now.actors.find(a => a.id === id); visual.group.visible = !!pose; if (!pose) continue; const before = prev.actors.find(a => a.id === id) ?? pose;
      visual.group.position.set(lerp(before.x, pose.x, alpha), 0, lerp(before.z, pose.z, alpha)); visual.group.rotation.y = pose.kind === 'skater' ? -lerp(before.angle, pose.angle, alpha) : 0;
      visual.ring.visible = ['windup', 'swing', 'clear', 'checked'].includes(pose.stage); (visual.ring.material as T.MeshBasicMaterial).color.setHex(pose.stage === 'checked' ? 0x8eeaff : 0xffbd4a); if (visual.blade) visual.blade.position.z = .42 + lerp(before.kick, pose.kick, alpha) * .4;
    }
    const t = (performance.now() - this.celebrationStart) / 1000, celebrating = this.celebration !== null && t < 2.5, color = celebrating ? this.celebration === 'you' ? 0x83ffe5 : 0xff5774 : 0x35baff; this.led.color.setHex(color);
    const visualNow = performance.now(), delta = (visualNow - this.lastVisualTime) / 1000; this.lastVisualTime = visualNow;
    this.crowd.update(delta, celebrating, motionActive && !this.reducedMotion && this.crowd.group.visible);
    for (const glow of this.glows) { const mat = glow.material as T.SpriteMaterial; mat.color.setHex(color); mat.opacity = celebrating && !this.reducedMotion ? .45 + .15 * Math.sin(t * 4) : .45; }
    this.confetti.visible = celebrating && this.celebration === 'you' && !this.reducedMotion;
    if (this.confetti.visible) { const p = this.confetti.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { const r = this.confettiSeeds[i], side = i % 2 ? -1 : 1; p.setXYZ(i, side * (5.85 + r * 2.4 + t * .4), 1.8 + r * 2 + t * (2 + r) - t * t * 1.7, -7.8 + ((i * .381966) % 1) * 15); } p.needsUpdate = true; (this.confetti.material as T.PointsMaterial).opacity = Math.max(0, 1 - t / 2.5); }
    this.renderer.render(this.scene, this.camera);
  }
}
