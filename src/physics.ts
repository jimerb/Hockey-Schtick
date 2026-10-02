import RAPIER from '@dimforge/rapier3d-compat';
import { C, OFFENSE, FEEDS, cradleGuides, guides, outline, rearArc, returnApron } from './config';
import type { ActorPose, Feed, FlipperRubber, Result, Vec } from './config';

export type State = { puck: Vec; angles: number[]; offenseAngles: number[]; stickZ: number; stickAngle: number; active: boolean; actors: ActorPose[] };
export type Contact = { label: string; speed: number; tick: number };
const yaw = (a: number) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
const move = (a: number, b: number, n: number) => a + Math.sign(b - a) * Math.min(Math.abs(b - a), n);
// Keep the shortest way out of a deep paddle contact on the ice, never underneath.
// The same XZ capsule covers the flat puck and the full permitted low-hop envelope.
const paddleHalfHeight = 1.3, paddleCenterY = .3;

export async function initPhysics() { await RAPIER.init(); }

export class RinkPhysics {
  world = new RAPIER.World({ x: 0, y: -C.gravity, z: 0 });
  queue = new RAPIER.EventQueue(true);
  puck: RAPIER.RigidBody;
  puckCollider: RAPIER.Collider;
  flippers: RAPIER.RigidBody[] = [];
  flipperColliders: RAPIER.Collider[][] = [[], []];
  flipperRubber: FlipperRubber | null = null;
  offensePaddles: RAPIER.RigidBody[] = [];
  offenseAngles: number[] = [OFFENSE.restAngle, OFFENSE.restAngle];
  offensePhases: ('rest' | 'shoot' | 'held' | 'return')[] = ['rest', 'rest'];
  offenseHeld = [false, false];
  offenseStrokes = 0;
  stick: RAPIER.RigidBody;
  angles = [C.restAngle, C.restAngle] as number[];
  held = [false, false];
  active = false;
  hops = false;
  stickEnabled = false;
  downhill: number = C.downhill;
  tick = 0;
  rally = 0;
  result: Result | null = null;
  scores = { goal: 0, conceded: 0, fault: 0 };
  contacts: Contact[] = [];
  contactCount = 0;
  private labels = new Map<number, string>();
  private lastHop = -100;
  private stickPhase = 0;
  previous!: State;
  current!: State;
  onContact?: (contact: Contact) => void;
  onResult?: (result: Result) => void;
  actorVisuals: ActorPose[] = [];
  registerCollider(collider: RAPIER.Collider, label: string) { this.labels.set(collider.handle, label); }
  addReturnApron() { for (const polygon of returnApron) this.solid(polygon, .55, 'guide'); }
  addCradleGuides() { for (const polygon of cradleGuides) this.solid(polygon, .6, 'cradle guide', .12); }
  setMotion(motion: { downhill: number; damping: number; restitution: number }) {
    this.downhill = motion.downhill; this.puck.setLinearDamping(motion.damping);
    this.world.forEachCollider(collider => {
      const label = this.labels.get(collider.handle);
      if (label && ['puck', 'board', 'guide', 'base', 'post', 'left flipper', 'right flipper'].includes(label)) collider.setRestitution(motion.restitution);
    });
  }
  setFlipperRubber(rubber: FlipperRubber | null) { this.flipperRubber = rubber; }
  addOffensePaddles() {
    if (this.offensePaddles.length) return;
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? -1 : 1, radius = OFFENSE.width / 2, shaft = OFFENSE.length - radius;
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(sign * OFFENSE.pivotX, .15, OFFENSE.pivotZ).setRotation(yaw(this.offenseBodyAngle(side))));
      const cy = paddleCenterY - .15;
      const shapes = [RAPIER.ColliderDesc.cuboid(shaft / 2, paddleHalfHeight, radius).setTranslation(shaft / 2, cy, 0),
        RAPIER.ColliderDesc.cylinder(paddleHalfHeight, radius).setTranslation(0, cy, 0), RAPIER.ColliderDesc.cylinder(paddleHalfHeight, radius).setTranslation(shaft, cy, 0)];
      for (const shape of shapes) this.registerCollider(this.world.createCollider(shape.setFriction(.03).setRestitution(.8), body), side === 0 ? 'left offensive paddle' : 'right offensive paddle');
      this.offensePaddles.push(body);
    }
  }
  offenseBodyAngle(side: number) { return side === 0 ? -this.offenseAngles[side] : -(Math.PI - this.offenseAngles[side]); }
  shootOffense(side: number) {
    if (!this.active || !this.offensePaddles[side] || this.offenseHeld[side]) return false;
    this.offenseHeld[side] = true; this.offenseStrokes++; return true;
  }
  releaseOffense(side: number) { this.offenseHeld[side] = false; }
  cancelOffense() {
    this.offensePhases = ['rest', 'rest']; this.offenseAngles = [OFFENSE.restAngle, OFFENSE.restAngle]; this.offenseHeld = [false, false];
    this.offensePaddles.forEach((body, side) => {
      body.setRotation(yaw(this.offenseBodyAngle(side)), true); body.setNextKinematicRotation(yaw(this.offenseBodyAngle(side)));
    });
  }
  /** A physically supported, slow puck on the front of a raised held bat. No puck lock. */
  cradledSide(): number | null {
    if (!this.flipperRubber || !this.active || Math.hypot(this.puck.linvel().x, this.puck.linvel().z) > .6) return null;
    const p = this.puck.translation();
    for (let side = 0; side < 2; side++) {
      if (!this.held[side] || Math.abs(this.angles[side] - C.raisedAngle) > .002) continue;
      const s = side === 0 ? 1 : -1, a = this.angles[side], dx = (p.x + s * C.pivotX) * s, dz = p.z - C.pivotZ;
      const along = dx * Math.cos(a) + dz * Math.sin(a), front = dx * Math.sin(a) - dz * Math.cos(a);
      if (along < -.6 || along > C.flipperLength || front < .3 || front > .85) continue;
      if (this.flipperColliders[side].some(c => !!this.puckCollider.contactCollider(c, .015))) return side;
    }
    return null;
  }
  syncStates() { this.current = this.snapshot(); this.previous = this.snapshot(); }
  stopRally() { this.active = false; this.puck.setEnabled(false); this.held = [false, false]; this.cancelOffense(); this.syncStates(); }

  constructor() {
    this.world.timestep = C.dt;
    this.world.numSolverIterations = 8;
    this.world.integrationParameters.maxCcdSubsteps = 4;
    this.fixed(RAPIER.ColliderDesc.cuboid(7, 0.25, 11).setTranslation(0, -0.25, 0).setFriction(0.004).setRestitution(0), 'ice');
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      // Split the near end board at the only concession opening.
      if (a.z > 8.99 && b.z > 8.99) {
        this.bar({ x: -3.8, y: 0, z: 9 }, { x: -C.drainHalfWidth, y: 0, z: 9 }, 0.16, 1, 'board');
        this.bar({ x: C.drainHalfWidth, y: 0, z: 9 }, { x: 3.8, y: 0, z: 9 }, 0.16, 1, 'board');
      } else this.bar(a, b, 0.16, 1, 'board');
    }
    for (const polygon of guides) this.solid(polygon, 0.6, 'guide');
    for (let i = 0; i < rearArc.length - 1; i++) {
      const a = rearArc[i], b = rearArc[i + 1];
      this.bar(a, b, 0.11, 0.65, 'base');
      // A visible filled shoulder closes the space between the rounded pipe and back wall.
      this.solid([a, b, { ...b, z: -9.17 }, { ...a, z: -9.17 }], 0.58, 'base');
    }
    for (const x of [-C.goalHalfWidth, C.goalHalfWidth]) {
      this.fixed(RAPIER.ColliderDesc.cylinder(0.7, 0.085).setTranslation(x, 0.7, C.goalZ), 'post');
    }
    this.puck = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0.11, 5).setCcdEnabled(true).setSoftCcdPrediction(0.55)
      .setLinearDamping(0.055).setCanSleep(false).enabledRotations(false, false, false));
    this.puckCollider = this.world.createCollider(RAPIER.ColliderDesc.cylinder(C.puckHalfHeight, C.puckRadius)
      .setMass(0.16).setFriction(0.008).setRestitution(0.86)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.puck);
    this.labels.set(this.puckCollider.handle, 'puck');
    this.puck.setEnabledTranslations(true, false, true, true);
    this.puck.setEnabled(false);
    for (let side = 0; side < 2; side++) {
      const s = side === 0 ? -1 : 1;
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(s * C.pivotX, 0.29, C.pivotZ).setRotation(yaw(this.bodyAngle(side))));
      const radius = C.flipperWidth / 2, shaft = C.flipperLength - radius;
      // An extruded capsule: the collider follows the visible rounded ends exactly.
      const cy = paddleCenterY - .29;
      const shapes = [RAPIER.ColliderDesc.cuboid(shaft / 2, paddleHalfHeight, radius).setTranslation(shaft / 2, cy, 0),
        RAPIER.ColliderDesc.cylinder(paddleHalfHeight, radius).setTranslation(0, cy, 0), RAPIER.ColliderDesc.cylinder(paddleHalfHeight, radius).setTranslation(shaft, cy, 0)];
      for (const shape of shapes) {
        const col = this.world.createCollider(shape.setFriction(0.05).setRestitution(0.86), body);
        this.labels.set(col.handle, side === 0 ? 'left flipper' : 'right flipper');
        this.flipperColliders[side].push(col);
      }
      this.flippers.push(body);
    }
    this.stick = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.29, -2.8));
    const blade = this.world.createCollider(RAPIER.ColliderDesc.roundCuboid(0.93, 0.17, 0.06, 0.09).setRestitution(0.86), this.stick);
    this.labels.set(blade.handle, 'stick');
    this.stick.setEnabled(false);
    this.current = this.snapshot(); this.previous = this.snapshot();
  }

  private fixed(desc: RAPIER.ColliderDesc, label: string) {
    const c = this.world.createCollider(desc.setRestitution(label === 'ice' ? 0 : 0.86));
    this.labels.set(c.handle, label); return c;
  }
  private bar(a: Vec, b: Vec, radius: number, height: number, label: string) {
    const dx = b.x - a.x, dz = b.z - a.z;
    this.fixed(RAPIER.ColliderDesc.roundCuboid(Math.hypot(dx, dz) / 2, height / 2 - radius, 0.01, radius)
      .setTranslation((a.x + b.x) / 2, height / 2, (a.z + b.z) / 2).setRotation(yaw(-Math.atan2(dz, dx))), label);
  }
  private solid(p: Vec[], height: number, label: string, restitution?: number) {
    const vertices = new Float32Array(p.flatMap(v => [v.x, 0, v.z, v.x, height, v.z]));
    const desc = RAPIER.ColliderDesc.convexHull(vertices);
    if (desc) { const collider = this.fixed(desc, label); if (restitution !== undefined) { collider.setRestitution(restitution); collider.setFriction(.2); } }
  }
  bodyAngle(side: number) { return side === 0 ? -this.angles[0] : -(Math.PI - this.angles[1]); }
  snapshot(): State {
    const t = this.puck.translation();
    return { puck: { x: t.x, y: t.y, z: t.z }, angles: [...this.angles], offenseAngles: [...this.offenseAngles], stickZ: this.stick.translation().z,
      stickAngle: this.stickPhase * 2.6, active: this.active, actors: this.actorVisuals.map(a => ({ ...a })) };
  }
  setHops(enabled: boolean) {
    this.hops = enabled;
    this.puck.setEnabledTranslations(true, enabled, true, true);
    this.puck.setTranslation({ ...this.puck.translation(), y: 0.11 }, true);
    this.puck.setLinvel({ ...this.puck.linvel(), y: 0 }, true);
    this.current = this.snapshot(); this.previous = this.snapshot();
  }
  setStick(enabled: boolean) { this.stickEnabled = enabled; this.stick.setEnabled(enabled); }
  feed(name: Feed) { this.place(FEEDS[name].p, FEEDS[name].v); }
  place(position: Vec, velocity: Vec) {
    this.puck.setEnabled(true);
    this.puck.resetForces(true); this.puck.resetTorques(true);
    this.puck.setTranslation(position, true); this.puck.setLinvel(velocity, true);
    this.active = true; this.result = null; this.rally++;
    this.current = this.snapshot(); this.previous = this.snapshot();
  }
  reset() {
    this.active = false; this.puck.setEnabled(false); this.held = [false, false];
    this.result = null; this.angles = [C.restAngle, C.restAngle]; this.stickPhase = 0;
    this.cancelOffense(); this.offenseStrokes = 0;
    this.flippers.forEach((b, side) => {
      b.setRotation(yaw(this.bodyAngle(side)), true); b.setNextKinematicRotation(yaw(this.bodyAngle(side)));
    });
    this.stick.setTranslation({ x: 0, y: 0.29, z: -2.8 }, true);
    this.stick.setNextKinematicTranslation({ x: 0, y: 0.29, z: -2.8 });
    this.stick.setRotation(yaw(0), true); this.stick.setNextKinematicRotation(yaw(0));
    this.current = this.snapshot(); this.previous = this.snapshot();
  }
  private finish(result: Result) {
    if (!this.active) return;
    this.active = false; this.result = result; this.scores[result]++;
    this.puck.setEnabled(false); this.cancelOffense(); this.onResult?.(result);
  }
  step() {
    this.previous = this.current;
    this.tick++;
    for (let side = 0; side < 2; side++) {
      const offenseTarget = this.offenseHeld[side] ? OFFENSE.shotAngle : OFFENSE.restAngle;
      this.offenseAngles[side] = move(this.offenseAngles[side], offenseTarget, C.dt * (this.offenseHeld[side] ? OFFENSE.swingSpeed : OFFENSE.returnSpeed));
      this.offensePhases[side] = this.offenseHeld[side] ? this.offenseAngles[side] === offenseTarget ? 'held' : 'shoot' : this.offenseAngles[side] === offenseTarget ? 'rest' : 'return';
      this.offensePaddles[side]?.setNextKinematicRotation(yaw(this.offenseBodyAngle(side)));
      const previousAngle = this.angles[side];
      this.angles[side] = move(this.angles[side], this.held[side] ? C.raisedAngle : C.restAngle,
        C.dt * (this.held[side] ? C.swingSpeed : C.returnSpeed));
      if (this.flipperRubber) {
        const r = this.flipperRubber, striking = this.angles[side] < previousAngle - .00001;
        const heldUp = this.held[side] && Math.abs(this.angles[side] - C.raisedAngle) < .002;
        for (const col of this.flipperColliders[side]) {
          col.setRestitution(striking ? r.strikeRestitution : heldUp ? r.heldRestitution : r.passiveRestitution);
          col.setFriction(striking ? .05 : r.friction);
        }
      }
      this.flippers[side].setNextKinematicRotation(yaw(this.bodyAngle(side)));
    }
    if (this.stickEnabled) {
      this.stickPhase += C.dt;
      // Deliberately mechanical travel: alternating move and dwell, confined to one straight slot.
      const phase = (this.stickPhase % 2.4) / 2.4;
      const t = phase < 0.4 ? phase / 0.4 : phase < 0.5 ? 1 : phase < 0.9 ? (0.9 - phase) / 0.4 : 0;
      this.stick.setNextKinematicTranslation({ x: 0, y: 0.29, z: -2.8 + t * 2.6 });
      this.stick.setNextKinematicRotation(yaw(this.stickPhase * 2.6));
    }
    if (this.active) {
      const v = this.puck.linvel(), speed = Math.hypot(v.x, v.z);
      if (speed > C.maxSpeed) this.puck.setLinvel({ x: v.x * C.maxSpeed / speed, y: v.y, z: v.z * C.maxSpeed / speed }, true);
      this.puck.resetForces(true);
      this.puck.addForce({ x: 0, y: 0, z: this.puck.mass() * this.downhill }, true);
    }
    this.world.step(this.queue);
    if (this.active) {
      const v = this.puck.linvel(), speed = Math.hypot(v.x, v.z);
      if (speed > C.maxSpeed) this.puck.setLinvel({ x: v.x * C.maxSpeed / speed, y: v.y, z: v.z * C.maxSpeed / speed }, true);
    }
    this.queue.drainCollisionEvents((a, b, started) => {
      if (!started || !this.active || (a !== this.puckCollider.handle && b !== this.puckCollider.handle)) return;
      const label = this.labels.get(a === this.puckCollider.handle ? b : a) ?? 'unknown';
      if (label === 'ice') return;
      const v = this.puck.linvel();
      const contact = { label, speed: Math.hypot(v.x, v.z), tick: this.tick };
      this.contacts.push(contact); if (this.contacts.length > 500) this.contacts.shift();
      this.contactCount++; this.onContact?.(contact);
      if (this.hops && contact.speed > 4 && this.tick - this.lastHop > 16 && this.puck.translation().y < 0.14) {
        this.puck.setLinvel({ ...v, y: C.hopSpeed }, true); this.lastHop = this.tick;
      }
    });
    if (this.active) {
      const p = this.puck.translation(), prev = this.previous.puck, r = C.puckRadius;
      const crosses = (z: number, far: boolean) => {
        const before = prev.z + (far ? r : -r), after = p.z + (far ? r : -r);
        if (far ? before >= z && after < z : before <= z && after > z) {
          const t = (z - before) / (after - before);
          return prev.x + (p.x - prev.x) * t;
        }
        return null;
      };
      const goalX = crosses(C.goalZ, true), drainX = crosses(C.drainZ, false);
      if (goalX !== null && Math.abs(goalX) + r < C.goalHalfWidth - 0.085) this.finish('goal');
      else if (drainX !== null && Math.abs(drainX) + r <= C.drainHalfWidth + 0.03) this.finish('conceded');
      else if (Math.abs(p.x) > 5.8 || Math.abs(p.z) > 9.65 || p.y < -0.4 || p.y > 0.65) this.finish('fault');
    }
    this.current = this.snapshot();
  }
  dispose() { this.queue.free(); this.world.free(); }
}
