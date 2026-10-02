/** Independent input sources preserve two-thumb holds, even when a key is also down. */
export class FlipperInput {
  private sources = new Map<string, number>();
  private pulseUntil = [0, 0];
  constructor(private minimumStrokeTicks = 10) {}
  press(source: string, side: number, tick: number) {
    if (this.sources.has(source)) return false;
    this.sources.set(source, side); this.pulseUntil[side] = tick + this.minimumStrokeTicks; return true;
  }
  release(source: string) { this.sources.delete(source); }
  cancel(source: string) {
    const side = this.sources.get(source); this.release(source);
    if (side !== undefined && !this.held[side]) this.pulseUntil[side] = 0;
  }
  clear() { this.sources.clear(); this.pulseUntil = [0, 0]; }
  get held() { const sides = [...this.sources.values()]; return [sides.includes(0), sides.includes(1)]; }
  at(tick: number) { return this.held.map((held, i) => held || tick < this.pulseUntil[i]); }
}

/** One side button drives its lower flipper and upper paddle with their existing tap timing. */
export class PairedPaddleInput {
  private lower = new FlipperInput();
  private upper = new FlipperInput(12);
  press(source: string, side: number, tick: number) {
    const accepted = this.lower.press(source, side, tick);
    if (accepted) this.upper.press(source, side, tick);
    return accepted;
  }
  release(source: string) { this.lower.release(source); this.upper.release(source); }
  cancel(source: string) { this.lower.cancel(source); this.upper.cancel(source); }
  clear() { this.lower.clear(); this.upper.clear(); }
  get held() { return this.lower.held; }
  at(tick: number) { return this.lower.at(tick); }
  upperAt(tick: number) { return this.upper.at(tick); }
}
