import * as T from 'three';
import { paint, rounded, surface, batchStatic } from './art';

type Fan = { x: number; y: number; z: number; yaw: number; height: number; phase: number; row: number; waves: boolean; hat: boolean; shirt: T.Color; skin: T.Color; hair: T.Color };

/** Seated silhouettes use seven shared meshes, rather than a draw call for every fan. */
export class ArenaCrowd {
  group = new T.Group();
  readonly fans: Fan[] = [];
  private torso: T.InstancedMesh; private heads: T.InstancedMesh; private hair: T.InstancedMesh;
  private arms: T.InstancedMesh; private hands: T.InstancedMesh; private legs: T.InstancedMesh; private hats: T.InstancedMesh;
  private dummy = new T.Object3D(); private yaw = new T.Quaternion(); private localRotation = new T.Quaternion();
  private start = new T.Vector3(); private end = new T.Vector3(); private up = new T.Vector3(0, 1, 0);
  private elapsed = 0; private accumulator = 0; private cheer = false;
  constructor() {
    const stands = new T.Group(), seatRail = surface(0x172a40, { roughness: .8 }), shirts = [0x183f63, 0x267b96, 0x93233e, 0x485569, 0xc5c8c4, 0x9c7750, 0x254842];
    const skins = [0xe8bf9c, 0xc3926f, 0x8f6047, 0x603e30], hairs = [0x29201c, 0x65482f, 0xba9762, 0x777b7a];
    let seed = 4107; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
      const x = side * (6.58 + row * .56), y = -.12 + row * .31;
      rounded(stands, x, y, -.5, .59, .28, 16.8, paint.navy);
      rounded(stands, x + side * .20, y + .33, -.5, .055, .24, 16.6, seatRail, .016);
      for (let i = 0; i < 28; i++) {
        // Staggered seating, varied heights and coat colors avoid regimented toy rows.
        const fade = row * .14 + .025, faded = (hex: number) => new T.Color(hex).lerp(new T.Color(0x081322), fade);
        this.fans.push({ x: x + (random() - .5) * .065, y: y + .145, z: -8.45 + i * .587 + (row % 2) * .15 + (random() - .5) * .1,
          yaw: -side * Math.PI / 2, height: .88 + random() * .23, phase: random() * Math.PI * 2, row,
          waves: random() > .84, hat: random() > .72, shirt: faded(shirts[Math.floor(random() * shirts.length)]),
          skin: faded(skins[Math.floor(random() * skins.length)]), hair: faded(hairs[Math.floor(random() * hairs.length)]) });
      }
    }
    batchStatic(stands); this.group.add(stands);
    const material = surface(0xffffff, { roughness: .88 });
    const mesh = (geometry: T.BufferGeometry, count: number, dynamic = true) => {
      const m = new T.InstancedMesh(geometry, material, count); m.frustumCulled = false;
      if (dynamic) m.instanceMatrix.setUsage(T.DynamicDrawUsage); this.group.add(m); return m;
    };
    const n = this.fans.length;
    this.torso = mesh(new T.CapsuleGeometry(1, 1, 3, 8), n);
    this.heads = mesh(new T.SphereGeometry(1, 10, 8), n);
    this.hair = mesh(new T.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * .58), n);
    this.arms = mesh(new T.CylinderGeometry(1, 1, 1, 6), n * 4);
    this.hands = mesh(new T.SphereGeometry(1, 8, 6), n * 2);
    this.legs = mesh(new T.CylinderGeometry(1, 1, 1, 6), n * 2, false);
    this.hats = mesh(new T.BoxGeometry(1, 1, 1), n);
    this.fans.forEach((fan, i) => {
      this.torso.setColorAt(i, fan.shirt); this.heads.setColorAt(i, fan.skin); this.hair.setColorAt(i, fan.hat ? fan.shirt : fan.hair); this.hats.setColorAt(i, fan.shirt);
      for (let arm = 0; arm < 4; arm++) this.arms.setColorAt(i * 4 + arm, fan.shirt);
      for (let side = 0; side < 2; side++) { this.hands.setColorAt(i * 2 + side, fan.skin); this.legs.setColorAt(i * 2 + side, new T.Color(0x172333).lerp(new T.Color(0x081322), fan.row * .14)); }
    });
    this.pose(false);
    // A transparent off-ice veil reduces contrast toward the upper tiers and edges.
    for (const side of [-1, 1]) {
      const w = 64, h = 128, data = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const outer = side > 0 ? x / (w - 1) : 1 - x / (w - 1), end = Math.pow(Math.abs(y / (h - 1) * 2 - 1), 8), i = (y * w + x) * 4;
        data[i] = 4; data[i + 1] = 12; data[i + 2] = 24; data[i + 3] = Math.round(255 * Math.min(.82, outer ** 2 * .54 + end * .4));
      }
      const texture = new T.DataTexture(data, w, h); texture.colorSpace = T.SRGBColorSpace;
      texture.minFilter = texture.magFilter = T.LinearFilter; texture.needsUpdate = true;
      const veil = new T.Mesh(new T.PlaneGeometry(3.1, 18.6), new T.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide }));
      veil.rotation.x = -Math.PI / 2; veil.position.set(side * 7.55, 2.0, -.5); veil.renderOrder = 3; this.group.add(veil);
    }
  }
  private part(mesh: T.InstancedMesh, index: number, fan: Fan, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotation?: T.Quaternion) {
    this.yaw.setFromAxisAngle(this.up, fan.yaw);
    this.dummy.position.set(x, y * fan.height, z).applyQuaternion(this.yaw);
    this.dummy.position.x += fan.x; this.dummy.position.y += fan.y; this.dummy.position.z += fan.z;
    this.dummy.quaternion.copy(this.yaw); if (rotation) this.dummy.quaternion.multiply(rotation);
    this.dummy.scale.set(sx, sy * fan.height, sz); this.dummy.updateMatrix(); mesh.setMatrixAt(index, this.dummy.matrix);
  }
  private segment(mesh: T.InstancedMesh, index: number, fan: Fan, a: number[], b: number[], radius: number) {
    this.start.fromArray(a); this.end.fromArray(b); this.localRotation.setFromUnitVectors(this.up, this.end.clone().sub(this.start).normalize());
    const length = this.start.distanceTo(this.end), center = this.start.add(this.end).multiplyScalar(.5);
    this.part(mesh, index, fan, center.x, center.y, center.z, radius, length, radius, this.localRotation);
  }
  private pose(animate: boolean) {
    this.fans.forEach((fan, i) => {
      const phase = this.elapsed * .85 + fan.phase, sway = animate ? Math.sin(phase) * .014 : 0;
      const lift = animate ? this.cheer ? .73 + .18 * Math.sin(phase * 3) : fan.waves ? Math.max(0, Math.sin(phase)) ** 6 * .38 : 0 : 0;
      this.part(this.torso, i, fan, sway, .26, .005, .137, .125, .105);
      this.part(this.heads, i, fan, sway, .51, .024, .089, .098, .087);
      this.part(this.hair, i, fan, sway, .536, .023, .095, .088, .093);
      this.part(this.hats, i, fan, sway, .565, .088, fan.hat ? .185 : .0001, fan.hat ? .022 : .0001, fan.hat ? .15 : .0001);
      for (const sign of [-1, 1]) {
        const side = sign < 0 ? 0 : 1, shoulder = [sway + sign * .12, .36, .016], elbow = [sign * .19, .22 + lift * .28, .105], hand = [sign * .205, .145 + lift * .62, .17 - lift * .12];
        this.segment(this.arms, i * 4 + side * 2, fan, shoulder, elbow, .042);
        this.segment(this.arms, i * 4 + side * 2 + 1, fan, elbow, hand, .035);
        this.part(this.hands, i * 2 + side, fan, hand[0], hand[1], hand[2], .040, .045, .034);
        if (!animate) this.segment(this.legs, i * 2 + side, fan, [sign * .085, .12, .035], [sign * .09, .075, .22], .055);
      }
    });
    for (const mesh of [this.torso, this.heads, this.hair, this.hats, this.arms, this.hands, this.legs]) mesh.instanceMatrix.needsUpdate = true;
  }
  update(delta: number, cheering: boolean, enabled: boolean) {
    if (!enabled) return;
    this.elapsed += Math.min(delta, .05); this.accumulator += delta;
    if (this.accumulator < 1 / 30 && this.cheer === cheering) return;
    this.accumulator = 0; this.cheer = cheering; this.pose(true);
  }
  resetMotion() { this.cheer = false; this.pose(false); }
  get presentation() { return { spectators: this.fans.length, instancedMeshes: 7, animationHz: 30, fadedTiers: 4 }; }
}
