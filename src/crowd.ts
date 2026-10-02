import * as T from 'three';
import { surface } from './art';

type Fan = { x: number; y: number; z: number; yaw: number; height: number; breadth: number; phase: number; row: number; gesture: number; hat: boolean; scarf: boolean; shirt: T.Color; skin: T.Color; hair: T.Color };

/** Shared meshes keep a moving, seated crowd inexpensive even around the end stands. */
export class ArenaCrowd {
  group = new T.Group();
  readonly fans: Fan[] = [];
  private torso: T.InstancedMesh; private heads: T.InstancedMesh; private hair: T.InstancedMesh;
  private arms: T.InstancedMesh; private hands: T.InstancedMesh; private legs: T.InstancedMesh; private hats: T.InstancedMesh;
  private noses: T.InstancedMesh; private eyes: T.InstancedMesh; private scarves: T.InstancedMesh; private shoes: T.InstancedMesh;
  private dynamic: T.InstancedMesh[] = [];
  private dummy = new T.Object3D(); private yaw = new T.Quaternion(); private localRotation = new T.Quaternion();
  private start = new T.Vector3(); private end = new T.Vector3(); private direction = new T.Vector3(); private up = new T.Vector3(0, 1, 0);
  private elapsed = 0; private accumulator = 0; private cheer = false; private goalRemaining = 0;
  private viewport = { value: new T.Vector2(1, 1) };
  private uiBoxes = { value: Array.from({ length: 6 }, () => new T.Vector4(-10, -10, -9, -9)) };
  private uiCount = { value: 0 };
  constructor() {
    const shirts = [0x153959, 0x21687e, 0x872b42, 0x4d5a6b, 0xbdbdb2, 0x81664c, 0x2e4942];
    const skins = [0xe8bf9c, 0xc3926f, 0x8f6047, 0x603e30], hairs = [0x201b18, 0x65482f, 0xba9762, 0x777b7a];
    let seed = 4107; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const seat = (x: number, z: number, yaw: number, row: number) => {
      const fade = row * .16 + .04, faded = (hex: number) => new T.Color(hex).lerp(new T.Color(0x040c18), fade);
      this.fans.push({ x: x + (random() - .5) * .045, y: .025 + row * .29, z: z + (random() - .5) * .04,
        yaw, height: .86 + random() * .28, breadth: .86 + random() * .28, phase: random() * Math.PI * 2, row,
        gesture: Math.floor(random() * 4), hat: random() > .68, scarf: random() > .65,
        shirt: faded(shirts[Math.floor(random() * shirts.length)]), skin: faded(skins[Math.floor(random() * skins.length)]), hair: faded(hairs[Math.floor(random() * hairs.length)]) });
    };
    for (let row = 0; row < 4; row++) {
      const radius = 2.78 + row * .53;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 26; i++) seat(side * (3.8 + radius), -7.02 + i * .554, -side * Math.PI / 2, row);
        // Rounded end stands join the side rows behind the far goal.
        const count = Math.ceil(Math.PI * radius / 1.12);
        for (let i = 0; i < count; i++) {
          const a = (i + .5) / count * Math.PI / 2;
          seat(side * (3.8 + radius * Math.cos(a)), -7.4 - radius * Math.sin(a), -side * (Math.PI / 2 - a), row);
        }
        // Short near-corner wings leave the flippers, drain and thumb controls open.
        for (let i = 0; i < 3; i++) {
          const a = (i + .5) * .13;
          seat(side * (3.8 + radius * Math.cos(a)), 7.4 + radius * Math.sin(a), -side * (Math.PI / 2 + a), row);
        }
      }
      for (let i = 0; i < 13; i++) seat(-3.36 + i * .56, -7.4 - radius, 0, row);
    }
    const material = surface(0xffffff, { roughness: .92 });
    // Fade just the crowd around actual HUD/control rectangles, never the puck or rink.
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { crowdViewport: this.viewport, crowdUiBoxes: this.uiBoxes, crowdUiCount: this.uiCount });
      shader.fragmentShader = `uniform vec2 crowdViewport; uniform vec4 crowdUiBoxes[6]; uniform int crowdUiCount;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <colorspace_fragment>', `#include <colorspace_fragment>
        vec2 crowdUV = vec2(gl_FragCoord.x / crowdViewport.x, 1.0 - gl_FragCoord.y / crowdViewport.y);
        float crowdVisibility = smoothstep(0.0, .075, crowdUV.y) * smoothstep(0.0, .11, 1.0 - crowdUV.y);
        for (int boxIndex = 0; boxIndex < 6; boxIndex++) {
          if (boxIndex >= crowdUiCount) break;
          vec4 box = crowdUiBoxes[boxIndex];
          vec2 outside = max(max(box.xy - crowdUV, crowdUV - box.zw), vec2(0.0));
          float distanceToUi = length(outside * vec2(crowdViewport.x / crowdViewport.y, 1.0));
          crowdVisibility *= mix(.025, 1.0, smoothstep(.005, .095, distanceToUi));
        }
        gl_FragColor.rgb = mix(vec3(.016, .047, .094), gl_FragColor.rgb, crowdVisibility);
      `);
    };
    material.customProgramCacheKey = () => 'crowd-ui-vignette-v1';
    const mesh = (geometry: T.BufferGeometry, count: number, name: string, dynamic = true) => {
      const m = new T.InstancedMesh(geometry, material, count); m.name = name; m.frustumCulled = false;
      if (dynamic) { m.instanceMatrix.setUsage(T.DynamicDrawUsage); this.dynamic.push(m); } this.group.add(m); return m;
    };
    const n = this.fans.length;
    this.torso = mesh(new T.LatheGeometry([new T.Vector2(0,-.19),new T.Vector2(.11,-.19),new T.Vector2(.14,-.05),new T.Vector2(.17,.12),new T.Vector2(.13,.2),new T.Vector2(0,.2)], 12), n, 'spectator-coats');
    this.heads = mesh(new T.SphereGeometry(1, 10, 8), n, 'spectator-faces');
    this.hair = mesh(new T.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * .62), n, 'spectator-hair');
    this.arms = mesh(new T.CylinderGeometry(.88, 1, 1, 7), n * 4, 'spectator-sleeves');
    this.hands = mesh(new T.SphereGeometry(1, 8, 6), n * 2, 'spectator-hands');
    this.legs = mesh(new T.CylinderGeometry(.85, 1, 1, 7), n * 4, 'spectator-trousers');
    this.hats = mesh(new T.BoxGeometry(1, 1, 1), n, 'spectator-cap-brims');
    this.noses = mesh(new T.SphereGeometry(1, 6, 4), n, 'spectator-noses');
    this.eyes = mesh(new T.SphereGeometry(1, 6, 4), n * 2, 'spectator-eyes');
    this.scarves = mesh(new T.TorusGeometry(.084, .019, 5, 12), n, 'spectator-scarves');
    this.shoes = mesh(new T.SphereGeometry(1, 8, 6), n * 2, 'spectator-shoes');
    const seats = mesh(new T.BoxGeometry(1, 1, 1), n, 'stand-treads', false), backs = mesh(new T.BoxGeometry(1, 1, 1), n, 'seat-backs', false);
    const scarfRotation = new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0), Math.PI / 2);
    this.scarves.userData.rotation = scarfRotation;
    this.fans.forEach((fan, i) => {
      const dark = new T.Color(0x18202b).lerp(new T.Color(0x040c18), fan.row * .16);
      this.torso.setColorAt(i, fan.shirt); this.heads.setColorAt(i, fan.skin); this.noses.setColorAt(i, fan.skin);
      this.hair.setColorAt(i, fan.hat ? fan.shirt : fan.hair); this.hats.setColorAt(i, fan.shirt);
      this.scarves.setColorAt(i, i % 2 ? fan.shirt.clone().lerp(new T.Color(0xbfbca9), .5) : new T.Color(0x8c3947));
      seats.setColorAt(i, new T.Color(0x102337).lerp(new T.Color(0x040c18), fan.row * .18));
      backs.setColorAt(i, new T.Color(0x25425a).lerp(new T.Color(0x040c18), fan.row * .18));
      this.part(seats, i, fan, 0, -.17, 0, .55, .28, .57);
      this.part(backs, i, fan, 0, .19, -.17, .39, .35, .035);
      for (let arm = 0; arm < 4; arm++) { this.arms.setColorAt(i * 4 + arm, fan.shirt); this.legs.setColorAt(i * 4 + arm, dark); }
      for (let side = 0; side < 2; side++) {
        this.hands.setColorAt(i * 2 + side, fan.skin); this.eyes.setColorAt(i * 2 + side, dark); this.shoes.setColorAt(i * 2 + side, dark);
      }
    });
    this.pose(false);
  }
  setViewport(width: number, height: number, boxes: { x: number; y: number; width: number; height: number }[] = []) {
    this.viewport.value.set(width, height); this.uiCount.value = Math.min(6, boxes.length);
    boxes.slice(0, 6).forEach((box, i) => this.uiBoxes.value[i].set(box.x, box.y, box.x + box.width, box.y + box.height));
  }
  celebrate() { this.goalRemaining = 4.2; }
  clearCelebration() { this.goalRemaining = 0; this.cheer = false; }
  private part(mesh: T.InstancedMesh, index: number, fan: Fan, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotation?: T.Quaternion) {
    this.yaw.setFromAxisAngle(this.up, fan.yaw);
    this.dummy.position.set(x, y * fan.height, z).applyQuaternion(this.yaw);
    this.dummy.position.x += fan.x; this.dummy.position.y += fan.y; this.dummy.position.z += fan.z;
    this.dummy.quaternion.copy(this.yaw); if (rotation) this.dummy.quaternion.multiply(rotation);
    this.dummy.scale.set(sx, sy * fan.height, sz); this.dummy.updateMatrix(); mesh.setMatrixAt(index, this.dummy.matrix);
  }
  private segment(mesh: T.InstancedMesh, index: number, fan: Fan, a: number[], b: number[], radius: number) {
    this.start.fromArray(a); this.end.fromArray(b); this.direction.copy(this.end).sub(this.start);
    const length = this.direction.length(); this.localRotation.setFromUnitVectors(this.up, this.direction.normalize());
    const center = this.start.add(this.end).multiplyScalar(.5);
    this.part(mesh, index, fan, center.x, center.y, center.z, radius, length, radius, this.localRotation);
  }
  private pose(animate: boolean) {
    this.fans.forEach((fan, i) => {
      const phase = this.elapsed * 1.6 + fan.phase, cheering = animate && this.cheer;
      const sway = animate ? Math.sin(phase) * (cheering ? .036 : .019) : 0;
      const stand = cheering ? .12 + Math.max(0, Math.sin(phase * 3)) * .055 : 0;
      const lean = animate ? Math.sin(phase * .7) * .021 : 0;
      const wave = animate ? Math.max(0, Math.sin(phase * .7)) ** 3 : 0;
      const headX = sway + (animate ? Math.sin(phase * .58) * .013 : 0), headZ = .024 + lean;
      this.part(this.torso, i, fan, sway, .29 + stand, lean, fan.breadth, 1, .67);
      this.part(this.heads, i, fan, headX, .565 + stand, headZ, .082, .108, .084);
      this.part(this.hair, i, fan, headX, .59 + stand, headZ - .01, .088, .099, .09);
      this.part(this.hats, i, fan, headX, .622 + stand, headZ + .073, fan.hat ? .18 : .0001, fan.hat ? .016 : .0001, fan.hat ? .12 : .0001);
      this.part(this.noses, i, fan, headX, .555 + stand, headZ + .081, .019, .025, .026);
      this.part(this.scarves, i, fan, sway, .466 + stand, lean, fan.scarf ? 1 : .001, fan.scarf ? 1 : .001, fan.scarf ? 1 : .001, this.scarves.userData.rotation);
      for (const sign of [-1, 1]) {
        const side = sign < 0 ? 0 : 1, arm = i * 4 + side * 2;
        const lift = cheering ? .74 + .10 * Math.sin(phase * 3 + side * .9) : fan.gesture === side ? wave * .54 : .03;
        const clap = animate && (fan.gesture === 2 || cheering && fan.gesture === 3);
        const shoulder = [sway + sign * .13 * fan.breadth, .4 + stand, lean];
        const elbow = [sway + sign * .205, .26 + stand + lift * .29, .10 + lean];
        const hand = clap ? [sway + sign * (.03 + Math.abs(Math.sin(phase * (cheering ? 7 : 3))) * .073), .40 + stand + (cheering ? .17 : 0), .25]
          : [sway + sign * .22, .18 + stand + lift * .74, .17 - lift * .09];
        this.segment(this.arms, arm, fan, shoulder, elbow, .046);
        this.segment(this.arms, arm + 1, fan, elbow, hand, .037);
        this.part(this.hands, i * 2 + side, fan, hand[0], hand[1], hand[2], .033, .044, .025);
        this.part(this.eyes, i * 2 + side, fan, headX + sign * .031, .583 + stand, headZ + .078, .01, .009, .005);
        const knee = [sign * .087, .092 + stand * .48, .21 - stand * .45], ankle = [sign * .105, -.07, .17];
        this.segment(this.legs, arm, fan, [sway + sign * .077, .14 + stand, .01], knee, .057);
        this.segment(this.legs, arm + 1, fan, knee, ankle, .045);
        this.part(this.shoes, i * 2 + side, fan, ankle[0], -.09, .205, .049, .034, .092);
      }
    });
    for (const mesh of this.dynamic) mesh.instanceMatrix.needsUpdate = true;
  }
  update(delta: number, cheering: boolean, enabled: boolean) {
    if (!enabled) return;
    const dt = Math.min(delta, .05); this.elapsed += dt; this.accumulator += dt;
    this.goalRemaining = Math.max(0, this.goalRemaining - dt);
    const cheer = cheering || this.goalRemaining > 0;
    if (this.accumulator < 1 / 30 && this.cheer === cheer) return;
    this.accumulator = 0; this.cheer = cheer; this.pose(true);
  }
  resetMotion() { this.clearCelebration(); this.pose(false); }
  get presentation() { return { spectators: this.fans.length, instancedMeshes: 13, animationHz: 30, fadedTiers: 4, wraparound: true, uiVignettes: this.uiCount.value, cheering: this.cheer, goalSeconds: this.goalRemaining }; }
}
