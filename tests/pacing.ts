import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initPhysics, RinkPhysics } from '../src/physics';
import { HockeyMatch } from '../src/match';
import { C, MATCH_PLAY_TUNING } from '../src/config';
import type { Difficulty } from '../src/opponents';

await initPhysics();
const label = process.argv[2] ?? 'after';
const runs = [];
for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) for (const seed of [1, 42, 1024]) {
  // Preserve the original five-skater speed-tuning comparison, before later play experiments.
  const s = new RinkPhysics(), m = new HockeyMatch(s, 5, false, { ...MATCH_PLAY_TUNING, openingSpeed: 0, rearBoost: 0 }, null); m.start(difficulty, seed);
  let active = 0, slow = 0, sumSpeed = 0, slowRun = 0, longestSlow = 0;
  let shots = 0, passes = 0, misses = 0, returns = 0, goals = 0, recoveries = 0, matches = 0;
  const collect = () => { shots += m.team.stats.shots; passes += m.team.stats.passes; misses += m.team.stats.misses; returns += m.returns; goals += m.score.you + m.score.cpu; recoveries += m.recoveries; };
  for (let i = 0; i < 120 * 120; i++) {
    const p = s.puck.translation(), v = s.puck.linvel(), hit = s.active && p.z > 5 && p.z < 6.5 && v.z > 0;
    s.held = [hit && p.x < .9, hit && p.x > -.9]; m.step();
    if (m.phase === 'playing') {
      active++; const v = s.puck.linvel(), speed = Math.hypot(v.x, v.z); sumSpeed += speed;
      if (speed < 2) { slow++; slowRun++; longestSlow = Math.max(longestSlow, slowRun); } else slowRun = 0;
    } else slowRun = 0;
    if (m.winner) { collect(); matches++; m.start(difficulty, seed + matches * 7919); }
  }
  collect();
  const row = { difficulty, seed, activeSeconds: +(active * C.dt).toFixed(2), slowPercent: +(100 * slow / active).toFixed(1), longestSlowSeconds: +(longestSlow * C.dt).toFixed(2), meanSpeed: +(sumSpeed / active).toFixed(2), shots, passes, misses, returns, goals, recoveries, matches, contacts: s.contactCount };
  runs.push(row);
  if (label === 'after') {
    assert.ok(row.slowPercent < 8 && row.longestSlowSeconds < 2, `${difficulty}/${seed}: lingering puck`);
    assert.ok(row.meanSpeed > 12 && row.returns >= 30 && row.shots >= 4, `${difficulty}/${seed}: insufficient rally action`);
    assert.equal(s.scores.fault, 0); assert.equal(m.team.stats.peakCommitted, 1);
  }
  s.dispose();
}
const report = { label, date: new Date().toISOString(), layout: 'five-skater speed-tuning baseline; opening/bumper and soft-flipper experiments disabled', simulatedSecondsPerRun: 120, slowThreshold: 2, controls: 'same reactive flipper timing as browser rally performance test', runs };
writeFileSync(`evidence/pacing-${label}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
