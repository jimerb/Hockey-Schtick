import RAPIER from '@dimforge/rapier3d-compat';
import { C, LANES, MATCH_PLAY_TUNING } from './config';
import type { ActorPose, PlayTuning, CheckTuning } from './config';
import type { RinkPhysics } from './physics';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const PROFILES = {
  easy: { move: 3.2, reaction: .24, windup: .45, recovery: .85, shot: 14, pass: 7, gap: .45, aim: .32, goalieLag: .34, goalieSpeed: 2, maxPasses: 1, interceptSpeed: 14 },
  normal: { move: 4, reaction: .16, windup: .3, recovery: .7, shot: 16, pass: 8, gap: .32, aim: .2, goalieLag: .24, goalieSpeed: 2.6, maxPasses: 1, interceptSpeed: 18 },
  hard: { move: 4.7, reaction: .12, windup: .23, recovery: .6, shot: 18, pass: 9, gap: .25, aim: .1, goalieLag: .18, goalieSpeed: 3.2, maxPasses: 2, interceptSpeed: 22 },
} as const;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const move = (a: number, b: number, n: number) => a + clamp(b - a, -n, n);
const nearerAngle = (a: number, b: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a));
const yaw = (a: number) => ({ x: 0, y: Math.sin(-a / 2), z: 0, w: Math.cos(a / 2) });
type Skater = { index: number; body: RAPIER.RigidBody; torso: RAPIER.Collider; blade: RAPIER.Collider; z: number; angle: number; stage: string; timer: number; cooldown: number;
  phi: number; sign: number; target: { x: number; z: number }; pass: boolean; push: boolean; struck: boolean; receiver: number; meetAt: number; roamZ: number; roamTimer: number;
  speed: number; gentleOpening: boolean; bodyContact: boolean; lastBump: number;
  previousZ: number; previousAngle: number; checkTime: number; checkDuration: number; checkFrom: number; checkDistance: number; checkStrength: number; lastCheck: number; paddleContact: boolean[] };
export type CheckEvent = { index: number; side: number; strength: number; distance: number; impact: number; part: 'body' | 'stick'; tick: number };
export type TeamStats = { shots: number; passes: number; pushes: number; misses: number; goalieContacts: number; clears: number; strikes: number; peakCommitted: number; openingDeliveries: number; rearBumps: number; checks: number };

/** A local, deliberately limited rod-hockey opponent. It observes puck motion only. */
export class Opponents {
  readonly lanes: { x: number; min: number; max: number; home: number }[];
  readonly extendedWings: boolean;
  skaters: Skater[] = [];
  goalie: RAPIER.RigidBody;
  goalieStick: RAPIER.RigidBody;
  goaliePad: RAPIER.Collider;
  goalieBlade: RAPIER.Collider;
  difficulty: Difficulty = 'normal';
  stats: TeamStats = this.emptyStats();
  active = -1;
  receiver = -1;
  time = 0;
  goalieX = 0;
  goalieStage = 'guard';
  goalieTimer = 0;
  goalieKick = 0;
  private goalieCooldown = 0;
  private goalieStruck = false;
  private decision = 0;
  private gap = 0;
  private opening = true;
  private passChain = 0;
  private preferred = -1;
  private receiveZ = 0;
  private history: { t: number; x: number; z: number; vx: number; vz: number }[] = [];
  private seed = 1;
  private roamSeed = 1;
  private openingSeed = 1;
  private incoming = { x: 0, z: 0, tick: -1 };
  private paddleRising = [false, false];
  lastCheck: CheckEvent | null = null;
  onCheck?: (event: CheckEvent) => void;

  constructor(public sim: RinkPhysics, count: 1 | 3 | 5 = 5, extendedWings = false, public tuning: PlayTuning = MATCH_PLAY_TUNING, public checking: CheckTuning | null = null) {
    this.extendedWings = count === 3 && extendedWings;
    this.lanes = LANES.map((lane, index) => ({ ...lane, max: this.extendedWings && index < 2 ? LANES[index + 3].max : lane.max }));
    const indices = count === 1 ? [2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3, 4];
    for (const index of indices) {
      const lane = this.lanes[index];
      const body = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(lane.x, 0, lane.home));
      // Extend ice-level shapes below the ice, keeping their tops and footprints.
      // Otherwise a deep contact can choose the underside as its escape direction
      // and pin a puck against the ice (or its locked vertical axis).
      const torso = sim.world.createCollider(RAPIER.ColliderDesc.cylinder(.82, .27).setTranslation(0, .32, 0).setRestitution(.72), body);
      const blade = sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.24, .42, .09).setTranslation(1.06, -.08, 0).setFriction(.02).setRestitution(.9), body);
      sim.registerCollider(torso, `skater-${index}`); sim.registerCollider(blade, `skater-${index}-blade`);
      this.skaters.push({ index, body, torso, blade, z: lane.home, angle: Math.PI / 2, stage: 'idle', timer: 0, cooldown: 0, phi: 0, sign: 1, target: { x: 0, z: 8 }, pass: false, push: false, struck: false, receiver: -1, meetAt: 0, roamZ: lane.home, roamTimer: 0, speed: 0, gentleOpening: false, bodyContact: false, lastBump: -1000,
        previousZ: lane.home, previousAngle: 0, checkTime: 0, checkDuration: 0, checkFrom: lane.home, checkDistance: 0, checkStrength: 0, lastCheck: -1000, paddleContact: [false, false] });
    }
    this.goalie = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0, -6.95));
    this.goaliePad = sim.world.createCollider(RAPIER.ColliderDesc.roundCuboid(.43, .51, .13, .04).setTranslation(0, .01, 0).setRestitution(.78), this.goalie);
    const upper = sim.world.createCollider(RAPIER.ColliderDesc.cylinder(.38, .26).setTranslation(0, .78, 0).setRestitution(.65), this.goalie);
    sim.registerCollider(this.goaliePad, 'goalie-pad'); sim.registerCollider(upper, 'goalie-body');
    this.goalieStick = sim.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, .16, -6.53));
    this.goalieBlade = sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.45, .385, .07).setTranslation(0, -.275, 0).setRestitution(.85), this.goalieStick);
    sim.registerCollider(this.goalieBlade, 'goalie-stick');
    this.reset('normal', 1);
  }
  private emptyStats(): TeamStats { return { shots: 0, passes: 0, pushes: 0, misses: 0, goalieContacts: 0, clears: 0, strikes: 0, peakCommitted: 0, openingDeliveries: 0, rearBumps: 0, checks: 0 }; }
  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private roamRandom() { this.roamSeed = (Math.imul(this.roamSeed, 1664525) + 1013904223) >>> 0; return this.roamSeed / 4294967296; }
  private openingRandom() { this.openingSeed = (Math.imul(this.openingSeed, 1664525) + 1013904223) >>> 0; return this.openingSeed / 4294967296; }
  private roam(s: Skater) {
    if (Math.abs(s.z - s.roamZ) < .05) {
      s.roamTimer -= C.dt;
      if (s.roamTimer <= 0) {
        const lane = this.lanes[s.index], span = lane.max - lane.min;
        // Alternate between the far and near quarters, with independent destinations and rests.
        s.roamZ = s.z < (lane.min + lane.max) / 2 ? lane.max - this.roamRandom() * span * .25 : lane.min + this.roamRandom() * span * .25;
        s.roamTimer = .2 + this.roamRandom() * .55;
      }
    }
    return s.roamZ;
  }
  reset(difficulty: Difficulty, seed: number, clearStats = true) {
    this.difficulty = difficulty; this.seed = seed >>> 0; this.time = 0; this.decision = 0; this.gap = 0;
    this.roamSeed = (seed ^ 0x9e3779b9) >>> 0;
    this.openingSeed = (Math.imul(seed, 0x85ebca6b) ^ 0xc2b2ae35) >>> 0; this.incoming.tick = -1;
    this.active = this.receiver = this.preferred = -1; this.opening = true; this.passChain = 0; this.history = [];
    this.paddleRising = [false, false]; this.lastCheck = null;
    if (clearStats) this.stats = this.emptyStats();
    for (const s of this.skaters) {
      const lane = this.lanes[s.index];
      s.z = lane.home; s.angle = lane.x > 0 ? Math.PI : 0; s.stage = 'idle'; s.timer = s.cooldown = 0; s.struck = false;
      s.bodyContact = false; s.lastBump = -1000; s.gentleOpening = false;
      s.previousZ = s.checkFrom = s.z; s.previousAngle = s.angle; s.checkTime = s.checkDuration = s.checkDistance = s.checkStrength = 0; s.lastCheck = -1000; s.paddleContact = [false, false];
      s.roamZ = lane.home; s.roamTimer = .15 + this.roamRandom() * .65;
      s.body.setTranslation({ x: lane.x, y: 0, z: s.z }, true); s.body.setNextKinematicTranslation({ x: lane.x, y: 0, z: s.z });
      s.body.setRotation(yaw(s.angle), true); s.body.setNextKinematicRotation(yaw(s.angle));
    }
    this.goalieX = this.goalieKick = this.goalieCooldown = this.goalieTimer = 0; this.goalieStage = 'guard'; this.goalieStruck = false;
    this.goalie.setTranslation({ x: 0, y: 0, z: -6.95 }, true); this.goalie.setNextKinematicTranslation({ x: 0, y: 0, z: -6.95 });
    this.goalieStick.setTranslation({ x: 0, y: .16, z: -6.53 }, true); this.goalieStick.setNextKinematicTranslation({ x: 0, y: .16, z: -6.53 });
    this.publish(); this.sim.syncStates();
  }
  private reachable(s: Skater, x: number, z: number) {
    const lane = this.lanes[s.index];
    const nearReach = this.extendedWings && s.index < 2 ? 5.7 : 4.65;
    return Math.abs(x - lane.x) < 1.48 && z > lane.min - 1.35 && z < lane.max + 1.35 && z < nearReach;
  }
  private choose() {
    if (this.skaters.some(s => s.stage === 'windup' || s.stage === 'swing')) return;
    const p = this.sim.puck.translation(), v = this.sim.puck.linvel();
    const x = p.x + v.x * .12, z = p.z + v.z * .12;
    const candidates = this.skaters.filter(s => s.cooldown <= 0 && this.reachable(s, x, z));
    candidates.sort((a, b) => {
      const distance = (s: Skater) => Math.hypot(x - this.lanes[s.index].x, z - s.z) - (s.index === this.preferred ? .6 : 0);
      return distance(a) - distance(b);
    });
    this.active = candidates[0]?.index ?? -1;
  }
  private intercept(s: Skater) {
    const lane = this.lanes[s.index], profile = PROFILES[this.difficulty], p = this.sim.puck.translation(), v = this.sim.puck.linvel();
    if (Math.hypot(v.x, v.z) > profile.interceptSpeed) return null;
    // Begin before a moving puck arrives, rather than winding up after it has passed.
    for (let t = profile.windup; t <= profile.windup + .45; t += .04) {
      const x = p.x + v.x * t, z = p.z + v.z * t + .5 * this.sim.downhill * t * t;
      if (!this.reachable(s, x, z)) continue;
      const dx = x - lane.x, offset = Math.sqrt(Math.max(.05, 1.12 ** 2 - dx ** 2));
      const base = clamp(z - offset, lane.min, lane.max);
      if (Math.hypot(dx, z - base) < 1.4 && Math.abs(base - s.z) <= profile.move * t * .9) return { x, z, t };
    }
    return null;
  }
  private prepare(s: Skater, meet: { x: number; z: number; t: number }) {
    const p = this.sim.puck.translation(), lane = this.lanes[s.index], profile = PROFILES[this.difficulty];
    const options = this.skaters.filter(o => o !== s && this.lanes[o.index].max > s.z + .9 && o.cooldown <= 0 && (!this.extendedWings || o.z > p.z + .5));
    options.sort((a, b) => this.lanes[b.index].max - this.lanes[a.index].max);
    // An opening push is now a firm drive, rather than a barely moving puck.
    s.push = this.skaters.length > 1 && this.opening && s.index === 2 && this.random() < .4;
    const doPass = !s.push && options.length > 0 && (this.opening || (this.passChain < profile.maxPasses && this.random() < .38));
    const receiver = doPass ? options[Math.floor(this.random() * Math.min(options.length, 2))] : undefined;
    s.pass = s.push || !!receiver; s.receiver = receiver?.index ?? -1;
    const error = (this.random() * 2 - 1) * profile.aim;
    s.gentleOpening = this.tuning.openingSpeed > 0 && this.opening && s.index === 2 && !receiver;
    s.speed = s.gentleOpening ? this.tuning.openingSpeed : s.pass ? profile.pass : profile.shot;
    if (s.gentleOpening) {
      const side = this.openingRandom() < .5 ? -1 : 1;
      s.target = { x: side * (this.tuning.openingMinX + this.openingRandom() * (this.tuning.openingMaxX - this.tuning.openingMinX)), z: this.tuning.openingZ };
    } else s.target = s.push ? { x: 0, z: 8.8 } : receiver ? { x: this.lanes[receiver.index].x + error, z: receiver.z - .3 } : { x: error * 1.8, z: 8.8 };
    s.phi = Math.atan2(meet.z - s.z, meet.x - lane.x);
    const direction = Math.atan2(s.target.z - p.z, s.target.x - p.x);
    s.sign = Math.sin(direction - s.phi) >= 0 ? 1 : -1;
    s.phi = nearerAngle(s.angle, s.phi);
    s.stage = 'windup'; s.timer = profile.windup; s.meetAt = this.time + meet.t; s.struck = false; this.receiver = s.receiver;
    if (receiver) this.receiveZ = clamp(s.target.z - .9, this.lanes[receiver.index].min, this.lanes[receiver.index].max);
  }
  preStep() {
    const dt = C.dt, profile = PROFILES[this.difficulty];
    this.time += dt; this.gap = Math.max(0, this.gap - dt); this.decision -= dt;
    if (this.decision <= 0) { this.decision = profile.reaction; this.choose(); }
    const p = this.sim.puck.translation(), v = this.sim.puck.linvel();
    this.incoming = { x: v.x, z: v.z, tick: this.sim.tick + 1 };
    for (const s of this.skaters) {
      const lane = this.lanes[s.index]; s.cooldown = Math.max(0, s.cooldown - dt);
      s.previousZ = s.z; s.previousAngle = s.angle;
      if (s.checkTime < s.checkDuration) {
        s.checkTime = Math.min(s.checkDuration, s.checkTime + dt);
        const t = s.checkTime / s.checkDuration;
        s.z = clamp(s.checkFrom - s.checkDistance * (1 - (1 - t) ** 2), lane.min, lane.max);
        s.stage = 'checked';
      } else if (s.stage === 'windup') {
        const lead = Math.max(.035, s.meetAt - this.time), px = p.x + v.x * lead, pz = p.z + v.z * lead + .5 * this.sim.downhill * lead * lead;
        const dx = Math.abs(px - lane.x), offset = Math.sqrt(Math.max(.05, 1.12 * 1.12 - dx * dx));
        s.phi = nearerAngle(s.phi, Math.atan2(pz - s.z, px - lane.x));
        const primed = s.phi - s.sign * .58;
        s.timer -= dt; s.angle = move(s.angle, primed, dt * 8);
        // Turn the blade aside before moving within reach. Preparation cannot strike early.
        if (Math.abs(s.angle - primed) < .18 || Math.hypot(p.x - lane.x, p.z - s.z) > 1.65) s.z = move(s.z, clamp(pz - offset, lane.min, lane.max), dt * profile.move);
        if (s.timer <= 0 && s.meetAt - this.time < .07 && Math.abs(s.angle - primed) < .18 && Math.hypot(p.x - lane.x, p.z - s.z) < 1.5) { s.stage = 'swing'; s.timer = .23; }
        else if (this.time > s.meetAt + .35) { s.stage = 'recover'; s.cooldown = profile.recovery; this.active = -1; this.stats.misses++; }
      } else if (s.stage === 'swing') {
        s.timer -= dt;
        // Stop the motor on a successful hit so a later sweep cannot undo the directed strike.
        if (!s.struck) s.angle = move(s.angle, s.phi + s.sign * .78, dt * 10);
        if (s.timer <= 0) {
          if (!s.struck) this.stats.misses++;
          s.stage = 'recover'; s.cooldown = profile.recovery; this.active = -1;
        }
      } else {
        s.stage = s.cooldown > 0 ? 'recover' : s.index === this.active ? 'track' : s.index === this.receiver ? 'receive' : 'idle';
        let targetZ = lane.home as number;
        // Support skaters reposition along their own slots while one attacker prepares.
        // A strike cooldown limits shooting, never the ability to chase a puck.
        const pursuing = s.index === this.active || s.index === this.receiver || this.reachable(s, p.x + v.x * .18, p.z + v.z * .18);
        if (pursuing) {
          const dx = Math.abs(p.x - lane.x);
          targetZ = s.index === this.receiver ? this.receiveZ : clamp(p.z + v.z * (profile.windup + .08) - (dx < .6 ? .83 : 0), lane.min, lane.max);
        } else if (this.extendedWings && s.index < 2) {
          targetZ = this.roam(s); if (s.cooldown <= 0) s.stage = 'roam';
        }
        // The figures alternate short slides and rests; the puck never inherits this jerkiness.
        const moving = ((this.time + s.index * .19) % .6) < .5;
        if (moving) s.z = move(s.z, targetZ, dt * profile.move);
        // Near a held cradle, a wing can reach with its physical blade, but gets no point-blank shot assist.
        const poking = pursuing && this.extendedWings && s.index < 2 && p.z >= 4.65;
        if (poking) s.stage = 'poke';
        // Sweep and withdraw, rather than leaving a blade pressed into a trapped puck forever.
        const pokeSweep = Math.sin((this.time + s.index * .37) * Math.PI * 2 / 1.4) * .55;
        const facing = pursuing ? Math.atan2(p.z - s.z, p.x - lane.x) + (poking ? pokeSweep : -.8) : lane.x > 0 ? Math.PI : 0;
        s.angle = move(s.angle, nearerAngle(s.angle, facing), dt * 5);
        if (!poking && s.index === this.active && s.cooldown <= 0 && this.gap <= 0) { const meet = this.intercept(s); if (meet) this.prepare(s, meet); }
      }
      s.body.setNextKinematicTranslation({ x: lane.x, y: 0, z: s.z }); s.body.setNextKinematicRotation(yaw(s.angle));
    }
    this.stats.peakCommitted = Math.max(this.stats.peakCommitted, this.skaters.filter(s => s.stage === 'windup' || s.stage === 'swing').length);
    this.history.push({ t: this.time, x: p.x, z: p.z, vx: v.x, vz: v.z });
    while (this.history.length > 1 && this.history[1].t <= this.time - profile.goalieLag) this.history.shift();
    const seen = this.history[0];
    if (seen && this.time >= profile.goalieLag) {
      const crossing = seen.vz < -.5 ? clamp((-6.8 - seen.z) / seen.vz, 0, .55) : 0;
      const target = clamp(seen.x + seen.vx * crossing, -.88, .88);
      this.goalieX = move(this.goalieX, target, profile.goalieSpeed * dt);
    }
    this.goalieCooldown = Math.max(0, this.goalieCooldown - dt);
    if (this.goalieStage === 'windup') {
      this.goalieTimer -= dt;
      if (this.goalieTimer <= 0) { this.goalieStage = 'clear'; this.goalieTimer = .24; this.goalieStruck = false; }
    } else if (this.goalieStage === 'clear') {
      this.goalieKick = Math.min(1, this.goalieKick + dt * 6); this.goalieTimer -= dt;
      if (this.goalieTimer <= 0) { this.goalieStage = 'guard'; this.goalieCooldown = 1.4; }
    } else this.goalieKick = Math.max(0, this.goalieKick - dt * 4);
    this.goalie.setNextKinematicTranslation({ x: this.goalieX, y: 0, z: -6.95 });
    this.goalieStick.setNextKinematicTranslation({ x: this.goalieX, y: .16, z: -6.53 + this.goalieKick * .4 });
    this.publish();
  }
  private touching(collider: RAPIER.Collider) {
    let touching = false;
    this.sim.world.contactPair(this.sim.puckCollider, collider, manifold => {
      for (let i = 0; i < manifold.numContacts(); i++) if (manifold.contactDist(i) <= .02) touching = true;
    });
    return touching;
  }
  private checkSkaters() {
    const tuning = this.checking; if (!tuning) return;
    const rising = this.sim.angles.map((a, side) => a < this.sim.previous.angles[side] - .00001);
    for (const s of this.skaters) {
      if (!s.body.isEnabled() || s.z < 3.5) { s.paddleContact = [false, false]; continue; }
      for (const side of [0, 1]) {
        const bat = this.sim.flipperColliders[side];
        const touching = bat.some(c => !!c.contactCollider(s.torso, 0) || !!c.contactCollider(s.blade, 0));
        const fresh = !s.paddleContact[side] || !this.paddleRising[side]; s.paddleContact[side] = touching;
        if (!rising[side] || !fresh || s.checkTime < s.checkDuration || this.sim.tick - s.lastCheck < tuning.cooldown / C.dt) continue;
        // Kinematic rods and bats don't repel each other in the solver. Sample their real
        // shapes through this 120 Hz stroke, including both figures' motion, to gate a check.
        const delta = this.sim.angles[side] - this.sim.previous.angles[side];
        const omega = (side === 0 ? -delta : delta) / C.dt;
        const pivot = this.sim.flippers[side].translation();
        let hit: { strength: number; impact: number; part: 'body' | 'stick' } | null = null;
        for (let sample = 0; sample <= 8 && !hit; sample++) {
          const t = sample / 8, a = this.sim.previous.angles[side] + delta * t;
          const axis = side === 0 ? a : Math.PI - a, rotation = yaw(axis);
          const figureAngle = s.previousAngle + (s.angle - s.previousAngle) * t;
          const figureZ = s.previousZ + (s.z - s.previousZ) * t;
          for (const [part, target] of [['body', s.torso], ['stick', s.blade]] as const) {
            const local = target.translationWrtParent()!;
            const position = { x: this.lanes[s.index].x + local.x * Math.cos(figureAngle) - local.z * Math.sin(figureAngle), y: local.y, z: figureZ + local.x * Math.sin(figureAngle) + local.z * Math.cos(figureAngle) };
            for (const c of bat) {
              const offset = c.translationWrtParent()!;
              const batPosition = { x: pivot.x + offset.x * Math.cos(axis), y: pivot.y + offset.y, z: pivot.z + offset.x * Math.sin(axis) };
              const contact = c.shape.contactShape(batPosition, rotation, target.shape, position, yaw(figureAngle), 0);
              if (!contact || contact.normal1.z >= -.15) continue;
              const n = contact.normal1;
              const vx = omega * (contact.point1.z - pivot.z), vz = -omega * (contact.point1.x - pivot.x);
              const approach = vx * n.x + (vz - (s.z - s.previousZ) / C.dt) * n.z;
              if (approach <= tuning.minImpact) continue;
              const strength = clamp((approach - tuning.minImpact) / (tuning.fullImpact - tuning.minImpact), 0, 1) * -n.z * (part === 'stick' ? .55 : 1);
              hit = { strength, impact: approach, part }; break;
            }
            if (hit) break;
          }
        }
        if (!hit) continue;
        const distance = Math.min(this.lanes[s.index].max - this.lanes[s.index].min, s.z - this.lanes[s.index].min, tuning.maxDistance * (.12 + .88 * hit.strength));
        if (distance < .01) continue;
        s.checkFrom = s.z; s.checkDistance = distance; s.checkStrength = hit.strength;
        s.checkTime = 0; s.checkDuration = .16 + .16 * hit.strength;
        s.stage = 'checked'; s.timer = 0; s.cooldown = Math.max(s.cooldown, s.checkDuration + .12); s.struck = false; s.receiver = -1; s.lastCheck = this.sim.tick;
        if (this.active === s.index) { this.active = -1; this.receiver = -1; }
        if (this.receiver === s.index) this.receiver = -1;
        if (this.preferred === s.index) this.preferred = -1;
        const event: CheckEvent = { index: s.index, side, ...hit, distance, tick: this.sim.tick };
        this.stats.checks++; this.lastCheck = event; this.onCheck?.(event);
      }
    }
    this.paddleRising = rising;
  }
  private rearBump(s: Skater, stickStrike: boolean) {
    const p = this.sim.puck.translation(), body = s.body.translation(), dx = p.x - body.x, dz = p.z - body.z, distance = Math.hypot(dx, dz);
    // CCD manifolds can retain the pre-impact distance. Query the shapes at their current poses.
    const contact = s.body.isEnabled() && distance < .62 ? this.sim.puckCollider.contactCollider(s.torso, .005) : null;
    const touching = !!contact, entered = touching && !s.bodyContact; s.bodyContact = touching;
    if (!entered || stickStrike || this.tuning.rearBoost <= 0 || this.incoming.tick !== this.sim.tick || this.sim.tick - s.lastBump < 18 || this.touching(s.blade)) return;
    if (distance < .01) return;
    // The visible jersey back is opposite the stick/face direction (+local X).
    if ((dx * Math.cos(s.angle) + dz * Math.sin(s.angle)) / distance > this.tuning.rearCone) return;
    let normal: { x: number; z: number } | null = null;
    this.sim.world.contactPair(this.sim.puckCollider, s.torso, manifold => { if (manifold.numContacts() > 0) normal = manifold.normal(); });
    // At zero separation a shape query's normal can be ambiguous; use the solver's surface normal.
    if (!normal) return;
    const raw = normal as { x: number; z: number }, horizontal = Math.hypot(raw.x, raw.z); if (horizontal < .6) return;
    const sign = raw.x * dx + raw.z * dz < 0 ? -1 : 1;
    const n = { x: sign * raw.x / horizontal, z: sign * raw.z / horizontal }, bv = s.body.linvel(), v = this.sim.puck.linvel();
    const impact = -((this.incoming.x - bv.x) * n.x + (this.incoming.z - bv.z) * n.z);
    if (impact < .5) return;
    const outward = (v.x - bv.x) * n.x + (v.z - bv.z) * n.z;
    const boost = Math.min(this.tuning.rearBoost, Math.max(0, Math.min(12, impact * .9 + this.tuning.rearBoost) - outward));
    if (boost < .01) return;
    let x = v.x + n.x * boost, z = v.z + n.z * boost;
    // Moderate kick only; already-fast rebounds are neither accelerated wildly nor slowed down.
    const ceiling = Math.min(C.maxSpeed, Math.max(this.tuning.rearMaxSpeed, Math.hypot(v.x, v.z))), speed = Math.hypot(x, z);
    if (speed > ceiling) { x *= ceiling / speed; z *= ceiling / speed; }
    this.sim.puck.setLinvel({ x, y: v.y, z }, true); s.lastBump = this.sim.tick; this.stats.rearBumps++;
  }
  postStep() {
    if (!this.sim.active) return;
    this.checkSkaters();
    const p = this.sim.puck.translation(), v = this.sim.puck.linvel(), profile = PROFILES[this.difficulty];
    let stickStrike = false;
    for (const s of this.skaters) if (s.stage === 'swing' && !s.struck && p.z < 4.65 && this.touching(s.blade)) {
      const dx = s.target.x - p.x, dz = s.target.z - p.z, length = Math.hypot(dx, dz);
      const speed = s.speed;
      // A single bounded strike assist at real blade contact, never a catch, teleport, or remote shot.
      this.sim.puck.setLinvel({ x: dx / length * speed, y: v.y, z: dz / length * speed }, true);
      s.struck = true; s.timer = Math.min(s.timer, .08); this.stats.strikes++; this.gap = profile.gap;
      stickStrike = true; if (s.gentleOpening) this.stats.openingDeliveries++;
      if (s.push) { this.stats.pushes++; this.preferred = -1; }
      else if (s.pass) { this.stats.passes++; this.passChain++; this.preferred = s.receiver; }
      else { this.stats.shots++; this.passChain = 0; this.preferred = -1; this.receiver = -1; }
      this.opening = false;
    }
    for (const s of this.skaters) this.rearBump(s, stickStrike);
    const padContact = this.touching(this.goaliePad), bladeContact = this.touching(this.goalieBlade);
    if (this.goalieStage === 'guard' && this.goalieCooldown <= 0 && Math.hypot(v.x, v.z) < 2.3 && (padContact || bladeContact)) {
      this.goalieStage = 'windup'; this.goalieTimer = .3; this.stats.goalieContacts++;
    }
    if (this.goalieStage === 'clear' && !this.goalieStruck && bladeContact) {
      this.sim.puck.setLinvel({ x: clamp(p.x - this.goalieX, -.4, .4) * 3, y: v.y, z: 8 }, true);
      this.goalieStruck = true; this.stats.clears++;
    }
    this.publish(); this.sim.current.actors = this.sim.actorVisuals.map(a => ({ ...a }));
  }
  publish() {
    this.sim.actorVisuals = [
      ...this.skaters.map(s => ({ id: `skater-${s.index}`, kind: 'skater' as const, x: this.lanes[s.index].x, z: s.z, angle: s.angle, stage: s.stage, kick: s.checkDuration ? s.checkStrength * Math.max(0, 1 - s.checkTime / s.checkDuration) : 0 })),
      { id: 'goalie', kind: 'goalie', x: this.goalieX, z: -6.95, angle: Math.PI / 2, stage: this.goalieStage, kick: this.goalieKick },
    ] satisfies ActorPose[];
  }
}
