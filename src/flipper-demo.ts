import { C } from './config';
import type { RinkPhysics } from './physics';

/** The visible catch-and-shoot demo uses only the same two flipper inputs as a player. */
export class FlipperDemo {
  stage: 'catch' | 'hold' | 'release' | 'shoot' = 'catch';
  side = 0;
  timer = 0;
  catches = 0;
  shots = 0;
  step(sim: RinkPhysics): boolean[] {
    if (!sim.active) { this.stage = 'catch'; this.timer = 0; return [false, false]; }
    if (this.stage === 'catch') {
      const side = sim.cradledSide();
      if (side !== null) { this.side = side; this.stage = 'hold'; this.timer = 0; this.catches++; }
    } else {
      this.timer += C.dt;
      if (this.stage === 'hold' && this.timer >= .8) { this.stage = 'release'; this.timer = 0; }
      else if (this.stage === 'release' && this.timer >= 1.2) { this.stage = 'shoot'; this.timer = 0; this.shots++; }
      else if (this.stage === 'shoot' && this.timer >= .15) { this.stage = 'catch'; this.timer = 0; }
    }
    return this.stage === 'release' ? [false, false] : this.stage === 'catch' ? [true, true] : [this.side === 0, this.side === 1];
  }
}
