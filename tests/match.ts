import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import { C, LANES, MATCH_PLAY_TUNING } from '../src/config';
import { PROFILES } from '../src/opponents';
import type { Difficulty } from '../src/opponents';

await initPhysics();
const checks: { name: string; passed: boolean }[] = [];
const observations: unknown[] = [];
function check(name: string, run: () => void) { run(); checks.push({ name, passed: true }); }
function drop(match: HockeyMatch) {
  for (let i = 0; i < 600 && match.phase !== 'playing'; i++) match.step();
  assert.equal(match.phase, 'playing');
}
function goal(sim: RinkPhysics, match: HockeyMatch, scorer: 'you' | 'cpu') {
  drop(match);
  sim.place({ x: 0, y: .11, z: scorer === 'you' ? -7.4 : 8.4 }, { x: 0, y: 0, z: scorer === 'you' ? -12 : 20 });
  for (let i = 0; i < 30 && match.phase === 'playing'; i++) match.step();
  assert.notEqual(match.phase, 'playing');
}
for (const winner of ['you', 'cpu'] as const) check(`first to seven: ${winner}, one count per goal, frozen final, rematch`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); let finalEvents = 0;
  m.onEvent = e => { if (e.kind === 'finished') finalEvents++; }; m.start('normal', 33);
  for (let n = 1; n <= 7; n++) {
    goal(s, m, winner); assert.equal(m.score[winner], n); assert.equal(m.score[winner === 'you' ? 'cpu' : 'you'], 0);
    if (n < 7) { assert.equal(m.phase, 'goal'); assert.equal(s.active, false); }
  }
  assert.equal(m.phase, 'finished'); assert.equal(m.winner, winner); assert.equal(finalEvents, 1);
  const frozen = JSON.stringify({ score: m.score, puck: s.current.puck, actors: s.current.actors, time: m.elapsed, tick: s.tick });
  for (let i = 0; i < 400; i++) m.step();
  assert.equal(JSON.stringify({ score: m.score, puck: s.current.puck, actors: s.current.actors, time: m.elapsed, tick: s.tick }), frozen);
  m.start('easy', 34); assert.deepEqual(m.score, { you: 0, cpu: 0 }); assert.equal(m.winner, null); assert.equal(m.team.stats.strikes, 0); assert.equal(m.difficulty, 'easy'); s.dispose();
});
check('no win-by-two; same neutral drop after either scorer', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 12);
  for (let n = 0; n < 6; n++) { goal(s, m, 'you'); goal(s, m, 'cpu'); }
  assert.deepEqual(m.score, { you: 6, cpu: 6 });
  drop(m); assert.deepEqual(s.current.puck, { x: 0, y: Math.fround(.11), z: 0 });
  assert.deepEqual(m.team.skaters.map(a => a.z), LANES.map(l => l.home));
  goal(s, m, 'you'); assert.equal(m.winner, 'you'); assert.deepEqual(m.score, { you: 7, cpu: 6 }); s.dispose();
});
check('new match setup stops a live rally and allows a fresh level', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 12); goal(s, m, 'you'); drop(m); s.held = [true, true];
  m.prepare('hard', 13); assert.equal(m.phase, 'idle'); assert.equal(s.active, false); assert.deepEqual(s.held, [false, false]); assert.deepEqual(m.score, { you: 0, cpu: 0 });
  assert.equal(m.team.stats.strikes, 0); m.start('easy', 14); drop(m); assert.equal(m.difficulty, 'easy'); s.dispose();
});
check('fault and genuine stationary puck produce a neutral restart', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 5); drop(m);
  s.place({ x: 8, y: .11, z: 0 }, { x: 0, y: 0, z: 0 }); m.step();
  assert.equal(m.recoveries, 1); assert.equal(m.phase, 'countdown'); assert.deepEqual(m.score, { you: 0, cpu: 0 });
  drop(m); s.downhill = 0; s.place({ x: 4.8, y: .11, z: 0 }, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 430 && m.phase === 'playing'; i++) m.step();
  assert.equal(m.recoveries, 2); assert.equal(m.phase, 'countdown'); assert.deepEqual(m.score, { you: 0, cpu: 0 }); s.dispose();
});
check('a stationary open-side puck accelerates steadily back toward the flippers', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 5); drop(m);
  s.place({ x: 4.8, y: .11, z: -1 }, { x: 0, y: 0, z: 0 });
  let priorSpeed = 0;
  for (let i = 0; i < 180; i++) { m.step(); assert.ok(s.puck.linvel().z >= priorSpeed); priorSpeed = s.puck.linvel().z; }
  assert.equal(m.recoveries, 0); assert.ok(s.current.puck.z > 2.3); assert.ok(priorSpeed > 4.5); s.dispose();
});
for (const hops of [false, true]) for (const x of [-2.5, -1.5, 1.5, 2.5]) check(`a missed save flows along the visible apron into the goal: x ${x}, hops ${hops}`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); s.setHops(hops);
  m.team.skaters.forEach(a => a.body.setEnabled(false)); m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
  s.held = [true, true]; for (let i = 0; i < 30; i++) s.step();
  s.place({ x, y: .11, z: 7.2 }, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 720 && s.active; i++) s.step();
  assert.equal(s.result, 'conceded'); assert.equal(s.scores.fault, 0); s.dispose();
});
check('match boards preserve a firm rebound instead of absorbing a shot', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s);
  m.team.skaters.forEach(a => a.body.setEnabled(false)); m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
  s.place({ x: 4.4, y: .11, z: .8 }, { x: 12, y: 0, z: 0 });
  for (let i = 0; i < 30 && !s.contacts.some(c => c.label === 'board'); i++) s.step();
  assert.ok(s.contacts.some(c => c.label === 'board')); assert.ok(s.puck.linvel().x < -10.5); s.dispose();
});
check('one constrained skater and goalie form a working first slice', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 1); m.start('normal', 1024); drop(m);
  for (let i = 0; i < 240; i++) m.step(); assert.equal(m.team.skaters.length, 1); assert.ok(m.team.stats.shots > 0); assert.equal(m.team.stats.passes, 0); s.dispose();
});
for (const x of [-2.8, 2.8]) check(`three-skater layout leaves a physical return lane open at x ${x}, including after rematch`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3);
  for (const seed of [1024, 1025]) {
    m.start('normal', seed); drop(m);
    assert.deepEqual(m.team.skaters.map(a => a.index), [0, 1, 2]);
    assert.deepEqual(s.current.actors.map(a => a.id), ['skater-0', 'skater-1', 'skater-2', 'goalie']);
    assert.equal(s.world.bodies.len(), 9, 'The lower pair must be absent physically, not just hidden');
    s.place({ x, y: .11, z: 5.5 }, { x: 0, y: 0, z: -20 });
    for (let i = 0; i < 30; i++) m.step();
    assert.ok(s.current.puck.z < 1); assert.ok(s.puck.linvel().z < -18);
    assert.ok(!s.contacts.some(c => c.label.startsWith('skater-3') || c.label.startsWith('skater-4')));
    assert.equal(s.scores.fault, 0);
  }
  s.dispose();
});
check('extended side skaters visit the former lower range and return, with fixed columns and unchanged center limits', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start('normal', 42); drop(m);
  assert.deepEqual(m.team.lanes[2], LANES[2]);
  assert.deepEqual(LANES.slice(0, 2).map(l => l.max), [-2.3, -2.3], 'The slot artwork remains unchanged');
  assert.deepEqual(m.team.lanes.slice(0, 2).map(l => l.max), [LANES[3].max, LANES[4].max]);
  assert.equal(s.world.bodies.len(), 9);
  s.downhill = 0; s.place({ x: 4.8, y: .11, z: 0 }, { x: 0, y: 0, z: 0 });
  const visits = [0, 1].map(() => ({ low: false, back: false, min: Infinity, max: -Infinity }));
  let differentPositions = false, rested = false;
  // An unreachable stationary puck isolates roaming without match restarts interrupting the route.
  for (let i = 0; i < 2400; i++) {
    const prior = m.team.skaters.map(a => a.z); m.team.preStep(); s.step(); m.team.postStep();
    for (const a of m.team.skaters) {
      const lane = m.team.lanes[a.index];
      assert.ok(a.z >= lane.min && a.z <= lane.max); assert.equal(a.body.translation().x, Math.fround(lane.x));
      assert.ok(Math.abs(a.z - prior[a.index]) <= PROFILES.normal.move * C.dt + 1e-6);
      if (a.index < 2) {
        const v = visits[a.index]; v.min = Math.min(v.min, a.z); v.max = Math.max(v.max, a.z);
        if (a.z > LANES[a.index + 3].home) v.low = true;
        if (v.low && a.z < -3.2) v.back = true;
        if (i > 200 && a.z === prior[a.index]) rested = true;
      }
    }
    if (Math.abs(m.team.skaters[0].z - m.team.skaters[1].z) > .5) differentPositions = true;
    assert.equal(s.current.actors.length, 4); assert.equal(s.scores.fault, 0);
  }
  assert.ok(visits.every(v => v.low && v.back)); assert.ok(differentPositions && rested);
  observations.push({ kind: 'extended-wing-coverage', seed: 42, visits, differentPositions, rested });
  m.start('hard', 43); assert.deepEqual(m.team.skaters.map(a => a.z), LANES.slice(0, 3).map(l => l.home));
  assert.equal(m.team.extendedWings, true); assert.equal(s.world.bodies.len(), 9); s.dispose();
});
for (const index of [0, 1]) check(`extended wing ${index} pursues and strikes a puck in the former lower lane at real blade contact`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 3, true); m.start('normal', 1024); drop(m);
  const a = m.team.skaters[index], lane = m.team.lanes[index];
  // Start with the blade already turned aside, so this fixture tests the deliberate swing.
  a.angle = Math.PI / 2 + (index === 0 ? .58 : -.58);
  const rotation = { x: 0, y: Math.sin(-a.angle / 2), z: 0, w: Math.cos(a.angle / 2) };
  a.body.setRotation(rotation, true); a.body.setNextKinematicRotation(rotation);
  a.z = 2.1; a.body.setTranslation({ x: lane.x, y: 0, z: a.z }, true); a.body.setNextKinematicTranslation({ x: lane.x, y: 0, z: a.z });
  s.place({ x: lane.x, y: .11, z: 3.2 }, { x: 0, y: 0, z: 0 });
  let actualStrike = false;
  for (let i = 0; i < 240 && m.phase === 'playing' && !actualStrike; i++) {
    const count = m.team.stats.strikes; m.step();
    if (m.team.stats.strikes > count) {
      assert.ok(a.struck && a.stage === 'swing'); assert.ok(a.z > LANES[index].max);
      s.world.contactPair(s.puckCollider, a.blade, manifold => { for (let k = 0; k < manifold.numContacts(); k++) if (manifold.contactDist(k) <= .02) actualStrike = true; });
      assert.ok(actualStrike); assert.ok(s.puck.linvel().z > 0); assert.ok(s.puck.translation().z < 4.65);
    }
  }
  assert.ok(actualStrike); assert.equal(s.scores.fault, 0); s.dispose();
});
check('extended travel switches off when the original five-skater lineup is restored', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 5, true);
  assert.equal(m.team.extendedWings, false); assert.deepEqual(m.team.lanes, LANES); assert.equal(m.team.skaters.length, 5); s.dispose();
});
check('goalie responds to delayed puck observation, within speed and travel limits', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 1); drop(m);
  s.place({ x: 2.1, y: .11, z: -2 }, { x: 0, y: 0, z: 0 });
  let prior = 0;
  for (let i = 1; i <= 90; i++) { m.step(); if (i < 28) assert.equal(m.team.goalieX, 0); assert.ok(Math.abs(m.team.goalieX) <= .880001); assert.ok(Math.abs(m.team.goalieX - prior) <= PROFILES.normal.goalieSpeed * C.dt + 1e-6); prior = m.team.goalieX; }
  assert.ok(prior > .7); s.dispose();
});
check('goalie does not read flipper inputs', () => {
  const worlds = [0, 1].map(() => { const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 1); drop(m); s.place({ x: 1.8, y: .11, z: -2 }, { x: 0, y: 0, z: -.2 }); return { s, m }; });
  for (let i = 0; i < 100; i++) {
    worlds[0].s.held = [false, false]; worlds[1].s.held = [true, true]; worlds.forEach(w => w.m.step());
    assert.equal(worlds[0].m.team.goalieX, worlds[1].m.team.goalieX);
  } worlds.forEach(w => w.s.dispose());
});
check('a visible goalie clear requires actual stick contact and has bounded speed', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 42); drop(m);
  s.place({ x: .2, y: .11, z: -6.21 }, { x: 0, y: 0, z: -.1 });
  let sawWindup = false, sawClear = false;
  for (let i = 0; i < 130; i++) { const prior = m.team.stats.clears; m.step(); if (m.team.goalieStage === 'windup') sawWindup = true;
    if (m.team.stats.clears > prior) { sawClear = true; assert.equal(m.team.goalieStage, 'clear'); assert.ok(m.team.goalieKick > 0); assert.ok(Math.hypot(s.puck.linvel().x, s.puck.linvel().z) < 8.2); }
  }
  assert.ok(sawWindup && sawClear); assert.equal(m.team.stats.clears, 1); s.dispose();
});
check('no remote strike when a puck leaves reach during windup', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 1024); drop(m); m.step();
  assert.equal(m.team.skaters[2].stage, 'windup');
  s.place({ x: 4.7, y: .11, z: -1 }, { x: 0, y: 0, z: 0 });
  for (let i = 0; i < 240; i++) m.step(); assert.equal(m.team.stats.strikes, 0); assert.ok(m.team.stats.misses > 0); s.dispose();
});
for (const { count, extended } of [{ count: 3, extended: false }, { count: 5, extended: false }, { count: 3, extended: true }] as const) for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) for (const hops of [false, true]) check(`${count} skaters${extended ? ', extended wings' : ''}, ${difficulty}, ${hops ? 'hops' : 'flat'}: two minutes of real rallies`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, count, extended); s.setHops(hops); m.start(difficulty, 1024);
  let wedgeRestarts = 0;
  m.onEvent = event => { if (event.kind === 'recovery') { const v = s.puck.linvel(); assert.ok(Math.hypot(v.x, v.z) <= .28, 'A neutral restart must be for a stationary wedge'); wedgeRestarts++; } };
  let firstStrike: 'pass' | 'shot' | null = null, lastStrikeTime = -100, lastCount = 0;
  for (let i = 0; i < 120 * 120 && !m.winner; i++) {
    const prev = m.team.skaters.map(a => ({ z: a.z, angle: a.angle })), gx = m.team.goalieX;
    const p = s.puck.translation(), v = s.puck.linvel(), hit = s.active && p.z > 4.65 && p.z < 6.2 && v.z > 0;
    s.held = [hit && p.x < .9, hit && p.x > -.9]; m.step();
    assert.ok(m.team.skaters.filter(a => a.stage === 'windup' || a.stage === 'swing').length <= 1);
    for (let j = 0; j < m.team.skaters.length; j++) {
      const a = m.team.skaters[j], lane = m.team.lanes[a.index];
      assert.ok(a.z >= lane.min - 1e-6 && a.z <= lane.max + 1e-6); assert.equal(s.current.actors[j].x, lane.x);
      if (m.phase === 'playing' && i > 300 && s.tick > 1 && m.team.time > C.dt) assert.ok(Math.abs(a.z - prev[j].z) <= (a.stage === 'checked' ? 6 : PROFILES[difficulty].move) * C.dt + 1e-6);
    }
    if (m.phase === 'playing' && m.team.time > C.dt) assert.ok(Math.abs(m.team.goalieX - gx) <= PROFILES[difficulty].goalieSpeed * C.dt + 1e-6);
    assert.ok(Math.abs(m.team.goalieX) <= .880001); assert.ok(Number.isFinite(s.current.puck.x)); assert.equal(s.scores.fault, 0);
    if (m.team.stats.strikes > lastCount) {
      const striker = m.team.skaters.find(a => a.struck && a.stage === 'swing')!; assert.ok(striker);
      if (firstStrike === null) firstStrike = striker.pass ? 'pass' : 'shot';
      let touching = false; s.world.contactPair(s.puckCollider, striker.blade, manifold => { for (let k = 0; k < manifold.numContacts(); k++) if (manifold.contactDist(k) <= .02) touching = true; }); assert.ok(touching);
      assert.ok(m.elapsed - lastStrikeTime >= PROFILES[difficulty].gap - C.dt * 2); lastStrikeTime = m.elapsed; lastCount = m.team.stats.strikes;
      assert.ok(s.puck.translation().z < 4.65); assert.ok(Math.hypot(s.puck.linvel().x, s.puck.linvel().z) <= PROFILES[difficulty].shot + 1e-5);
    }
  }
  assert.equal(firstStrike, count === 3 ? 'shot' : 'pass'); assert.ok(m.team.stats.shots > 0); if (count === 5) assert.ok(m.team.stats.passes > 0); assert.equal(m.team.stats.peakCommitted, 1);
  assert.equal(m.recoveries, wedgeRestarts);
  observations.push({ skaters: count, extendedWings: extended, difficulty, hops, seconds: 120, score: m.score, stats: m.team.stats, returns: m.returns, goalieSaves: m.goalieSaves, neutralRestarts: m.recoveries }); s.dispose();
});
for (const extended of [false, true]) check(`same seed, controls, and physics produce the same match, extended wings ${extended}`, () => {
  const run = () => { const s = new RinkPhysics(), m = new HockeyMatch(s, extended ? 3 : 5, extended); m.start('normal', 123); const samples: unknown[] = [];
    for (let i = 0; i < 6000; i++) { const t = i / 120; s.held = [t % .9 < .13, t % 1.1 < .14]; m.step(); if (i % 100 === 0) samples.push({ p: s.current.puck, a: s.current.actors, score: { ...m.score }, strikes: m.team.stats.strikes }); }
    s.dispose(); return samples;
  }; assert.deepEqual(run(), run());
});
for (const seed of [1, 42]) check(`original five-skater unscripted complete match, seed ${seed}`, () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s, 5, false, { ...MATCH_PLAY_TUNING, openingSpeed: 0, rearBoost: 0 }, null); m.start('normal', seed); let ticks = 0;
  for (; ticks < 120 * 300 && !m.winner; ticks++) m.step();
  assert.equal(m.winner, 'cpu'); assert.equal(m.score.cpu, 7); assert.equal(s.scores.fault, 0);
  assert.ok(m.team.stats.shots > 0 && m.team.stats.passes > 0 && m.team.stats.pushes > 0);
  observations.push({ kind: 'complete-unattended-match', seed, wallSimulationSeconds: ticks / 120, activePlaySeconds: m.elapsed, score: m.score, stats: m.team.stats, recoveries: m.recoveries }); s.dispose();
});
check('actual flipper returns can score a bank goal against the full team', () => {
  const s = new RinkPhysics(), m = new HockeyMatch(s); m.start('normal', 1);
  for (let i = 0; i < 120 * 120 && m.score.you === 0; i++) {
    const p = s.puck.translation(), v = s.puck.linvel(), hit = s.active && p.z > 5 && p.z < 6.5 && v.z > 0;
    s.held = [hit, hit]; m.step();
  }
  assert.equal(m.score.you, 1); assert.ok(m.returns > 0); assert.equal(m.bankGoals, 1); assert.equal(s.scores.fault, 0); s.dispose();
});

let fastCases = 0;
for (const hops of [false, true]) for (const speed of [8, 20, 35]) for (const offset of [-.18, 0, .18]) {
  for (const index of [0, 1, 2, 3, 4]) for (const target of ['body', 'blade'] as const) check(`fast ${speed}, offset ${offset}, hops ${hops}: skater ${index} ${target}`, () => {
    const s = new RinkPhysics(), m = new HockeyMatch(s); s.setHops(hops); s.downhill = 0;
    // Isolate each physical footprint; the complete-team run above exercises moving interactions.
    m.team.skaters.forEach(a => { a.body.setEnabled(a.index === index); if (a.index === index) { a.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); a.body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 }); } });
    m.team.goalie.setEnabled(false); m.team.goalieStick.setEnabled(false);
    const lane = LANES[index]; s.place({ x: lane.x + (target === 'blade' ? 1.06 : 0) + offset, y: .11, z: lane.home - 1.2 }, { x: 0, y: 0, z: speed });
    for (let i = 0; i < 90 && s.active; i++) s.step();
    const label = `skater-${index}${target === 'blade' ? '-blade' : ''}`;
    assert.ok(s.contacts.some(c => c.label === label), `missing ${label} contact`); assert.equal(s.scores.fault, 0); assert.ok(Number.isFinite(s.current.puck.z)); fastCases++; s.dispose();
  });
  for (const target of ['pad', 'stick'] as const) check(`fast ${speed}, offset ${offset}, hops ${hops}: goalie ${target}`, () => {
    const s = new RinkPhysics(), m = new HockeyMatch(s); s.setHops(hops); s.downhill = 0; m.team.skaters.forEach(a => a.body.setEnabled(false));
    m.team.goalie.setEnabled(target === 'pad'); m.team.goalieStick.setEnabled(target === 'stick');
    const z = target === 'pad' ? -6.95 : -6.53;
    s.place({ x: offset, y: .11, z: z + 1.2 }, { x: 0, y: 0, z: -speed });
    for (let i = 0; i < 90 && s.active; i++) s.step();
    assert.ok(s.contacts.some(c => c.label === `goalie-${target}`)); assert.equal(s.scores.fault, 0); fastCases++; s.dispose();
  });
}
const report = { date: new Date().toISOString(), passed: checks.length, failed: 0, fastImpactCases: fastCases, observations, checks };
writeFileSync('evidence/match-results.json', JSON.stringify(report, null, 2));
console.log(`${checks.length} stage-3 checks passed, including ${fastCases} opponent impact cases. Report: evidence/match-results.json`);
