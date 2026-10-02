export const C = {
  dt: 1 / 120,
  width: 10.8,
  length: 18,
  corner: 1.6,
  puckRadius: 0.27,
  puckHalfHeight: 0.105,
  flipperLength: 4.45,
  flipperWidth: 0.95,
  pivotX: 4.6,
  pivotZ: 6.35,
  restAngle: 0.32,
  raisedAngle: -0.48,
  swingSpeed: 10.5,
  returnSpeed: 5.8,
  goalZ: -7.65,
  goalHalfWidth: 1.5,
  drainZ: 8.65,
  drainHalfWidth: 1.05,
  downhill: 0.85,
  maxSpeed: 40,
  hopSpeed: 1.65,
  gravity: 16,
} as const;

// Match pacing is stronger than the original practice fixture, across every difficulty.
export const MATCH_MOTION = { downhill: 3.2, damping: .025, restitution: .94 } as const;
// Tentative open-lane playtest. Set back to 5 to restore the lower pair.
export const MATCH_SKATERS: 3 | 5 = 3;
// Three-skater travel; the match artwork follows these extended side lanes.
export const MATCH_EXTENDED_WINGS = true;
export type PlayTuning = { openingSpeed: number; openingMinX: number; openingMaxX: number; openingZ: number; rearBoost: number; rearMaxSpeed: number; rearCone: number };
export const MATCH_PLAY_TUNING: PlayTuning = {
  openingSpeed: 9.5, openingMinX: 2.2, openingMaxX: 3.6, openingZ: 6.15,
  rearBoost: 2.4, rearMaxSpeed: 24, rearCone: -.65,
};
export type FlipperRubber = { heldRestitution: number; passiveRestitution: number; strikeRestitution: number; friction: number };
export const MATCH_FLIPPER_RUBBER: FlipperRubber = { heldRestitution: .12, passiveRestitution: .3, strikeRestitution: .94, friction: .2 };
export type CheckTuning = { maxDistance: number; fullImpact: number; minImpact: number; cooldown: number };
// A short rail shove, not a free-body launch. Stick-only catches transfer less of the hit.
export const MATCH_CHECK_TUNING: CheckTuning = { maxDistance: .95, fullImpact: 23, minImpact: 1, cooldown: .4 };

// Small far-zone paddles rest wholly behind the existing board collision face.
// One press makes a complete stroke; the shared return cannot be held on the ice.
export const OFFENSE = {
  pivotX: 5.4, pivotZ: -5.65, length: 1.85, width: .16,
  restAngle: Math.PI / 2, shotAngle: .55,
  swingSpeed: 11, returnSpeed: 6.5, cooldown: .32,
} as const;

export type Vec = { x: number; y: number; z: number };
export type Feed = 'center' | 'left' | 'right';
export type Result = 'goal' | 'conceded' | 'fault';
export type ActorPose = { id: string; kind: 'skater' | 'goalie'; x: number; z: number; angle: number; stage: string; kick: number };
export const LANES = [
  { x: -2.8, min: -5.9, max: -2.3, home: -4.1 },
  { x: 2.8, min: -5.9, max: -2.3, home: -4.1 },
  { x: 0, min: -3.25, max: 0.25, home: -1.65 },
  { x: -2.8, min: 1.5, max: 4.9, home: 3.2 },
  { x: 2.8, min: 1.5, max: 4.9, home: 3.2 },
] as const;
export const FEEDS: Record<Feed, { p: Vec; v: Vec }> = {
  center: { p: { x: 0, y: 0.11, z: -4.7 }, v: { x: 0, y: 0, z: 10 } },
  left: { p: { x: -2.7, y: 0.11, z: -4.7 }, v: { x: -2.5, y: 0, z: 11 } },
  right: { p: { x: 2.7, y: 0.11, z: -4.7 }, v: { x: 2.5, y: 0, z: 11 } },
};

// The same boundary vertices drive the visible boards and their collision shapes.
export const outline: Vec[] = [];
for (const [cx, cz, start] of [
  [3.8, 7.4, 0], [-3.8, 7.4, Math.PI / 2],
  [-3.8, -7.4, Math.PI], [3.8, -7.4, 3 * Math.PI / 2],
]) {
  for (let i = 0; i <= 8; i++) {
    const a = start + (i / 8) * Math.PI / 2;
    outline.push({ x: cx + C.corner * Math.cos(a), y: 0, z: cz + C.corner * Math.sin(a) });
  }
}
export const rearArc: Vec[] = Array.from({ length: 25 }, (_, i) => {
  const a = Math.PI - i * Math.PI / 24;
  return { x: C.goalHalfWidth * Math.cos(a), y: 0, z: C.goalZ - 1.3 * Math.sin(a) };
});
export const guides: Vec[][] = [-1, 1].map(s => [
  { x: s * 5.4, y: 0, z: 5.75 },
  { x: s * 4.7, y: 0, z: 6.4 },
  { x: s * 4.2, y: 0, z: 8.9 },
  { x: s * 5.4, y: 0, z: 8.9 },
]);
// A held bat forms a cradle against this short heel guide; dropping it opens the feed onto the shaft.
export const cradleGuides: Vec[][] = [-1, 1].map(s => [
  { x: s * 5.4, y: 0, z: 4.8 },
  { x: s * 5.05, y: 0, z: 4.8 },
  { x: s * 3.98, y: 0, z: 5.92 },
  { x: s * 4.2, y: 0, z: 8.9 },
  { x: s * 5.4, y: 0, z: 8.9 },
]);

// Close the pockets behind the flippers and guide a missed save into the opening.
export const returnApron: Vec[][] = [-1, 1].map(s => [
  { x: s * 3.8, y: 0, z: 7.1 },
  { x: s * .9, y: 0, z: 8.55 },
  { x: s * .9, y: 0, z: 9.25 },
  { x: s * 5.4, y: 0, z: 9.25 },
  { x: s * 5.4, y: 0, z: 7.1 },
]);
