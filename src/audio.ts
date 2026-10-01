/** Locally synthesized rink sounds. No network, autoplay, or per-impact asset decoding. */
export class RinkAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastContact = -Infinity;
  enabled = true;
  get state() { return this.context?.state ?? 'uninitialized'; }
  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.enabled ? .55 : 0; this.master.connect(this.context.destination);
        const length = this.context.sampleRate * 2; this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
        const data = this.noise.getChannelData(0); let previous = 0;
        for (let i = 0; i < length; i++) { previous = (previous + (Math.random() * 2 - 1) * .08) / 1.08; data[i] = previous * 3; }
      }
      if (this.enabled && this.context.state !== 'running') void this.context.resume().catch(() => {});
    } catch { /* A browser may refuse audio; the match still plays. */ }
  }
  mute(muted: boolean) { this.enabled = !muted; if (this.master && this.context) { this.master.gain.cancelScheduledValues(this.context.currentTime); this.master.gain.setValueAtTime(muted ? 0 : .55, this.context.currentTime); } }
  private tone(frequency: number, end: number, duration: number, amplitude: number, type: OscillatorType = 'triangle', delay = 0) {
    const a = this.context!, t = a.currentTime + delay, osc = a.createOscillator(), gain = a.createGain(); osc.type = type; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(end, t + duration);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(amplitude, t + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + duration); osc.connect(gain); gain.connect(this.master!); osc.start(t); osc.stop(t + duration + .02); osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  private hiss(duration: number, amplitude: number, cutoff: number, delay = 0) {
    const a = this.context!, t = a.currentTime + delay, source = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain(); source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(.0001, t); gain.gain.linearRampToValueAtTime(amplitude, t + Math.min(.08, duration / 4)); gain.gain.exponentialRampToValueAtTime(.0001, t + duration); source.connect(filter); filter.connect(gain); gain.connect(this.master!); source.start(t); source.stop(t + duration); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  play(kind: string, force = 8) {
    if (!this.enabled || this.context?.state !== 'running') return false;
    if (kind === 'goal' || kind === 'win') {
      this.tone(196, 196, .68, .09, 'sawtooth'); this.tone(247, 247, .65, .035, 'triangle'); this.hiss(1.7, .24, 1600, .06);
      [392, 494, 587, 784].forEach((f, i) => this.tone(f, f, .23, .055, 'sine', .22 + i * .12)); return true;
    }
    if (kind === 'cpu') { this.tone(147, 139, .3, .075); this.hiss(.7, .085, 950); return true; }
    if (kind === 'drop') { this.tone(830, 710, .11, .035, 'sine'); return true; }
    if (kind === 'flipper') { this.tone(135, 65, .055, .04); return true; }
    if (performance.now() - this.lastContact < 28) return false;
    this.lastContact = performance.now(); const strength = Math.min(1, Math.max(.12, force / 22));
    if (kind === 'check') { this.tone(100 + force * 65, 45, .12, .055 + force * .025); this.hiss(.09, .07, 450); }
    else if (kind === 'post' || kind === 'base') { this.tone(740, 440, .16, .08 * strength, 'sine'); this.tone(1180, 810, .09, .025 * strength, 'sine'); }
    else if (kind.includes('blade') || kind.includes('stick')) { this.tone(410, 140, .065, .12 * strength); this.hiss(.045, .12 * strength, 1800); }
    else if (kind.includes('flipper') || kind.includes('guide')) this.tone(190, 65, .09, .11 * strength);
    else { this.tone(230, 90, .075, .09 * strength); this.hiss(.055, .1 * strength, 950); }
    return true;
  }
}
