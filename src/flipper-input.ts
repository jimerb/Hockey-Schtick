/** Independent input sources preserve two-thumb holds, even when a key is also down. */
export class FlipperInput {
  private sources = new Map<string, number>();
  private pulseUntil = [0, 0];
  press(source: string, side: number, tick: number) {
    if (this.sources.has(source)) return false;
    this.sources.set(source, side); this.pulseUntil[side] = tick + 10; return true;
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
