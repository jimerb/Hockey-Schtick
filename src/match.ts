import { C, MATCH_FLIPPER_RUBBER, MATCH_MOTION, MATCH_PLAY_TUNING, MATCH_CHECK_TUNING } from './config';
import type { Result, PlayTuning, FlipperRubber, CheckTuning } from './config';
import { Opponents } from './opponents';
import type { Difficulty } from './opponents';
import type { Contact, RinkPhysics } from './physics';

export type MatchPhase = 'idle' | 'countdown' | 'playing' | 'goal' | 'finished';
export type MatchEvent = { kind: 'start' | 'drop' | 'goal' | 'recovery' | 'finished'; message: string; scorer?: 'you' | 'cpu' };
export class HockeyMatch {
  team: Opponents;
  phase: MatchPhase = 'idle';
  score = { you: 0, cpu: 0 };
  winner: 'you' | 'cpu' | null = null;
  difficulty: Difficulty = 'normal';
  timer = 0;
  elapsed = 0;
  seed = 1;
  drops = 0;
  recoveries = 0;
  returns = 0;
  goalieSaves = 0;
  bankGoals = 0;
  message = 'First to seven';
  onEvent?: (event: MatchEvent) => void;
  onContact?: (contact: Contact) => void;
  private stalled = 0;
  private anchor = { x: 0, z: 0 };
  private lastReturn = -1000;
  private lastGoalie = -1000;
  private lastBank = -1000;
  constructor(public sim: RinkPhysics, skaterCount: 1 | 3 | 5 = 5, extendedWings = false, tuning: PlayTuning = MATCH_PLAY_TUNING, rubber: FlipperRubber | null = MATCH_FLIPPER_RUBBER, checking: CheckTuning | null = rubber ? MATCH_CHECK_TUNING : null) {
    sim.addReturnApron(); sim.setMotion(MATCH_MOTION);
    sim.setFlipperRubber(rubber); if (rubber) sim.addCradleGuides();
    this.team = new Opponents(sim, skaterCount, extendedWings, tuning, checking);
    sim.onResult = result => this.result(result);
    sim.onContact = contact => {
      if (contact.label.includes('flipper') && sim.puck.linvel().z < -.5 && contact.speed > 1 && sim.tick - this.lastReturn > 18) { this.returns++; this.lastReturn = sim.tick; }
      if (contact.label.startsWith('goalie') && sim.tick - this.lastGoalie > 18) { this.goalieSaves++; this.lastGoalie = sim.tick; }
      if (contact.label === 'board') this.lastBank = sim.tick;
      this.onContact?.(contact);
    };
  }
  prepare(difficulty: Difficulty = 'normal', seed = 1) {
    this.sim.reset(); this.sim.scores = { goal: 0, conceded: 0, fault: 0 }; this.sim.rally = 0;
    this.difficulty = difficulty; this.seed = seed; this.score = { you: 0, cpu: 0 }; this.winner = null;
    this.elapsed = this.drops = this.recoveries = this.returns = this.goalieSaves = this.bankGoals = 0;
    this.lastBank = this.lastReturn = this.lastGoalie = -1000;
    this.team.reset(difficulty, seed); this.phase = 'idle'; this.timer = this.stalled = 0; this.message = 'First to seven';
  }
  start(difficulty: Difficulty = 'normal', seed = 1) {
    this.prepare(difficulty, seed); this.countdown(2.4); this.message = 'Get ready';
    this.onEvent?.({ kind: 'start', message: 'GET READY' });
  }
  private countdown(seconds: number) {
    this.sim.reset(); this.team.reset(this.difficulty, this.seed + this.drops * 71, false);
    this.phase = 'countdown'; this.timer = seconds; this.stalled = 0;
  }
  private drop() {
    this.phase = 'playing'; this.drops++; this.message = 'Play'; this.lastBank = this.lastReturn = -1000;
    this.sim.place({ x: 0, y: .11, z: 0 }, { x: 0, y: 0, z: 0 }); this.anchor = { x: 0, z: 0 };
    this.onEvent?.({ kind: 'drop', message: 'PLAY' });
  }
  private result(result: Result) {
    if (this.phase !== 'playing') return;
    if (result === 'fault') { this.recover(); return; }
    const scorer = result === 'goal' ? 'you' : 'cpu'; this.score[scorer]++;
    if (scorer === 'you' && this.lastBank > this.lastReturn && this.lastReturn >= 0 && this.sim.tick - this.lastBank < 360) this.bankGoals++;
    this.sim.held = [false, false];
    if (this.score[scorer] >= 7) {
      this.phase = 'finished'; this.winner = scorer; this.message = scorer === 'you' ? 'You win!' : 'CPU wins';
      this.onEvent?.({ kind: 'finished', message: this.message, scorer });
    } else {
      this.phase = 'goal'; this.timer = 1.3; this.message = scorer === 'you' ? 'Your goal!' : 'CPU goal';
      this.onEvent?.({ kind: 'goal', message: scorer === 'you' ? 'GOAL!' : 'CPU GOAL', scorer });
    }
  }
  private recover() {
    this.recoveries++; this.message = 'Whistle · neutral restart'; this.countdown(1.6);
    this.onEvent?.({ kind: 'recovery', message: 'WHISTLE · NEW PUCK' });
  }
  step() {
    if (this.phase === 'idle' || this.phase === 'finished') return;
    if (this.phase === 'goal') { this.timer -= C.dt; if (this.timer <= 0) this.countdown(1.2); return; }
    if (this.phase === 'countdown') { this.timer -= C.dt; if (this.timer <= 0) this.drop(); return; }
    this.elapsed += C.dt;
    this.team.preStep(); this.sim.step();
    if (this.phase !== 'playing') return;
    this.team.postStep();
    const p = this.sim.puck.translation(), v = this.sim.puck.linvel();
    if (this.sim.cradledSide() !== null || Math.hypot(p.x - this.anchor.x, p.z - this.anchor.z) > .12 || Math.hypot(v.x, v.z) > .28) {
      this.stalled = 0; this.anchor = { x: p.x, z: p.z };
    } else { this.stalled += C.dt; if (this.stalled > 3.5) this.recover(); }
  }
}
