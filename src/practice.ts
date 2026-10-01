import './style.css';
import { C } from './config';
import type { Feed } from './config';
import { initPhysics, RinkPhysics } from './physics';
import { RinkView } from './scene';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><div class="brand">HOCKEY <span>SCHTICK</span></div><div class="edition"><i></i> STAGE 02 · PUCK & FLIPPERS</div></header>
<main>
  <aside class="instructions">
    <div class="eyebrow">YOUR END OF THE ICE</div>
    <h1>Save it.<br>Send it back.</h1>
    <p>Two flippers. One slippery puck.<br>Defend the gap, then aim for the far net.</p>
    <div class="key-pair"><div><kbd data-key="0">A</kbd><span>Left flipper</span></div><div><kbd data-key="1">L</kbd><span>Right flipper</span></div></div>
    <p class="small">Tap to strike. Hold to keep a flipper raised. Release to bring it back. Both work together.</p>
    <button id="pause" class="secondary" disabled>Pause <span>Esc</span></button>
    <button id="controls" class="text-button">Change keys</button>
    <a class="practice-link" href="/">← Back to hockey match</a><div class="note">Test rink · no opponents yet<br>Every return is a chance to shoot.</div>
  </aside>
  <section class="arena" aria-label="Playable rink">
    <div class="hud"><div><span>GOALS</span><strong id="goals">0</strong></div><div class="rally-label">PUCK & FLIPPERS <small id="status">Loading rink…</small></div><div class="conceded"><span>CONCEDED</span><strong id="conceded">0</strong></div></div>
    <div id="viewport"></div>
    <div id="cue" class="cue" aria-live="polite"></div>
    <div id="curtain" class="curtain"><div class="start-card"><div class="eyebrow">THE FIRST PLAYABLE SLICE</div><h2 id="curtain-title">Your crease. Your call.</h2><p id="curtain-copy">Block the puck with your flippers and fire it up the ice.</p><button id="start" disabled>Loading…</button></div></div>
    <div class="rink-footer"><span class="led-dot"></span> STRAIGHT SLOTS · GENTLE DOWNHILL PULL <span id="hop-label">· FLAT PUCK</span></div>
  </section>
  <aside class="test-panel">
    <div class="eyebrow">TRY THE SAME SHOT AGAIN</div><h2>Feed the puck</h2>
    <div class="feeds" role="group" aria-label="Puck feed direction"><button class="selected" data-feed="center">Center</button><button data-feed="left">Left</button><button data-feed="right">Right</button></div>
    <button id="feed" disabled>Feed puck <span>Space</span></button><button id="reset" class="secondary" disabled>Reset rink</button>
    <div class="divider"></div><div class="eyebrow">COMPARE THE FEEL</div>
    <label class="toggle"><input id="hops" type="checkbox"><span>Low puck hops<small>Tiny lifts after harder impacts</small></span></label>
    <label class="toggle"><input id="stick" type="checkbox"><span>Moving stick fixture<small>A sliding, rotating collision test</small></span></label>
    <label class="toggle"><input id="sound" type="checkbox" checked><span>Contact sounds</span></label>
    <label class="toggle"><input id="reduced" type="checkbox"><span>Lower render resolution</span></label>
    <p class="small">A scored or conceded puck ends the rally. The next feed follows automatically.</p>
    <details id="lab"><summary>Performance lab</summary><p class="small">Measures this browser and device. The 120-second run repeats feeds, goals, banks, and moving contacts. You can stop it any time.</p><button id="benchmark" class="secondary" disabled>Run 120-second test</button><label class="toggle"><input id="thirty" type="checkbox"><span>Render at 30 FPS<small>Physics stays at 120 Hz</small></span></label><pre id="metrics">Waiting for play</pre><button id="export" class="text-button" disabled>Download test results</button></details>
  </aside>
</main>
<footer>Prototype 0.2 <span>•</span> Keyboard play <span>•</span> Fixed rink view</footer><output id="qa-state" hidden></output>
<dialog id="key-dialog"><form method="dialog"><div class="eyebrow">MAKE IT YOURS</div><h2>Flipper keys</h2><p>Choose a flipper, then press the key you want. Left and right Shift can be assigned separately.</p><div class="bindings"><button type="button" data-bind="0">Left: A</button><button type="button" data-bind="1">Right: L</button></div><p id="bind-note" aria-live="polite">Two distinct keys let both flippers work together.</p><p class="small">Repeated Shift presses can trigger your Windows accessibility shortcut.</p><div class="dialog-actions"><button type="button" id="defaults" class="secondary">Restore A / L</button><button value="close">Done</button></div></form></dialog>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id);
type Binding = { code: string; label: string };
let bindings: Binding[] = [{ code: 'KeyA', label: 'A' }, { code: 'KeyL', label: 'L' }];
try { const stored = JSON.parse(localStorage.getItem('hockey-schtick-keys') ?? 'null');
  if (Array.isArray(stored) && stored.length === 2 && stored.every(b => typeof b.code === 'string' && typeof b.label === 'string') && stored[0].code !== stored[1].code) bindings = stored;
} catch { /* Storage is optional in privacy-restricted browsers. */ }
let bindingTarget: number | null = null;
function paintBindings() {
  bindings.forEach((b, i) => {
    document.querySelectorAll(`[data-key="${i}"]`).forEach(e => { e.textContent = b.label; });
    document.querySelector<HTMLButtonElement>(`[data-bind="${i}"]`)!.textContent = `${i === 0 ? 'Left' : 'Right'}: ${b.label}`;
  });
}
paintBindings();
function labelKey(e: KeyboardEvent) {
  if (e.code === 'ShiftLeft') return 'Left Shift'; if (e.code === 'ShiftRight') return 'Right Shift';
  if (e.code === 'Space') return 'Space';
  return e.key.length === 1 ? e.key.toLocaleUpperCase() : e.key;
}
const percentile = (values: number[], q: number) => {
  if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * q)];
};

async function boot() {
  await initPhysics();
  const sim = new RinkPhysics(), view = new RinkView(el('viewport'));
  let started = false, paused = false, ready = 0, accumulator = 0, feed: Feed = 'center';
  let nextFeed = -1, cueTime = 0, lastFrame = performance.now(), lastDraw = 0, lastMetrics = 0;
  let rafSamples: number[] = [], physicsSamples: number[] = [], inputTick: { code: string; requested: number; applied: number } | null = null;
  let pendingInput: { code: string; requested: number } | null = null;
  let physicalHeld = [false, false], pulseUntil = [0, 0];
  let benchmark: { start: number; frames: number[]; physics: number[]; feeds: number; startContacts: number; startScores: typeof sim.scores; warmupUntil: number; settings: object } | null = null;
  let benchmarkResult: Record<string, unknown> | null = null;
  let audio: AudioContext | null = null, lastSound = 0;
  const keyDialog = el<HTMLDialogElement>('key-dialog');
  function sound(kind: string, force = 8) {
    if (!input('sound').checked || !audio || audio.state !== 'running' || performance.now() - lastSound < 35) return;
    lastSound = performance.now();
    const osc = audio.createOscillator(), gain = audio.createGain(); osc.connect(gain); gain.connect(audio.destination);
    const t = audio.currentTime; osc.type = kind === 'goal' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(kind === 'goal' ? 680 : kind === 'conceded' ? 170 : 140 + Math.min(force, 30) * 13, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'goal' ? 1100 : 80, t + 0.1);
    gain.gain.setValueAtTime(0.045, t); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); }; osc.start(t); osc.stop(t + 0.2);
  }
  function unlockAudio() { if (!audio) audio = new AudioContext(); void audio.resume(); }
  function cue(text: string, seconds = 1) { el('cue').textContent = text; el('cue').classList.add('show'); cueTime = seconds; }
  function updateHUD() {
    el('goals').textContent = String(sim.scores.goal); el('conceded').textContent = String(sim.scores.conceded);
    el('status').textContent = paused ? 'Paused' : benchmark ? 'Performance test' : !started ? 'Ready when you are' : sim.active ? `Rally ${sim.rally}` : 'Next puck coming';
    el('pause').textContent = paused ? 'Resume · Esc' : 'Pause · Esc';
  }
  sim.onResult = result => { cue(result === 'goal' ? 'GOAL!' : result === 'conceded' ? 'THROUGH THE GAP' : 'PUCK OUT OF PLAY', 1.15); nextFeed = 1.25; sound(result); updateHUD(); };
  sim.onContact = c => sound(c.label, c.speed);
  function sendFeed() { sim.feed(feed); nextFeed = -1; updateHUD(); }
  function begin() {
    unlockAudio(); started = true; paused = false; ready = 0.45; accumulator = 0; lastFrame = performance.now();
    el('curtain').classList.add('hidden'); el<HTMLButtonElement>('pause').disabled = false;
    if (!sim.active) sendFeed(); cue('READY', 0.45); updateHUD();
  }
  function stopBenchmark(reason = 'Stopped by player') {
    if (!benchmark) return;
    finishBenchmark(reason); el('benchmark').textContent = 'Run 120-second test';
  }
  function pause(reason = 'Paused') {
    if (!started || paused) return;
    paused = true; releaseKeys(); accumulator = 0;
    stopBenchmark(reason);
    el('curtain-title').textContent = reason; el('curtain-copy').textContent = 'The puck is waiting. Resume when you’re ready.';
    el('start').textContent = 'Resume test'; el('curtain').classList.remove('hidden'); updateHUD();
  }
  el('start').onclick = begin;
  el('pause').onclick = () => paused ? begin() : pause();
  el('feed').onclick = () => { unlockAudio(); sendFeed(); if (!started || paused) begin(); };
  el('reset').onclick = () => {
    stopBenchmark('Rink reset'); releaseKeys(); sim.reset(); sim.scores = { goal: 0, conceded: 0, fault: 0 }; sim.rally = 0;
    nextFeed = -1; cueTime = 0; el('cue').classList.remove('show'); sendFeed(); if (!started || paused) begin(); updateHUD();
  };
  document.querySelectorAll<HTMLButtonElement>('[data-feed]').forEach(button => {
    button.onclick = () => { feed = button.dataset.feed as Feed;
      document.querySelectorAll('[data-feed]').forEach(b => b.classList.toggle('selected', b === button)); };
  });
  input('hops').onchange = () => { sim.setHops(input('hops').checked); el('hop-label').textContent = input('hops').checked ? '· LOW HOPS' : '· FLAT PUCK'; input('hops').blur(); };
  input('stick').onchange = () => { sim.setStick(input('stick').checked); input('stick').blur(); };
  input('reduced').onchange = () => { view.setReduced(input('reduced').checked); input('reduced').blur(); };
  input('sound').onchange = () => { if (input('sound').checked) unlockAudio(); input('sound').blur(); };
  input('thirty').onchange = () => input('thirty').blur();
  el('controls').onclick = () => { pause('Controls'); bindingTarget = null; keyDialog.showModal(); };
  document.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button => {
    button.onclick = () => { bindingTarget = Number(button.dataset.bind); el('bind-note').textContent = 'Press your new key. Escape cancels.'; };
  });
  el('defaults').onclick = () => { bindings = [{ code: 'KeyA', label: 'A' }, { code: 'KeyL', label: 'L' }]; saveBindings(); };
  function saveBindings() { paintBindings(); try { localStorage.setItem('hockey-schtick-keys', JSON.stringify(bindings)); } catch {} bindingTarget = null; el('bind-note').textContent = 'Saved. Close this panel, then resume the rink.'; }
  keyDialog.addEventListener('close', () => { bindingTarget = null; });
  window.addEventListener('keydown', e => {
    if (keyDialog.open) {
      if (bindingTarget === null || e.repeat) return;
      e.preventDefault();
      if (e.code === 'Escape') { bindingTarget = null; el('bind-note').textContent = 'Assignment cancelled.'; return; }
      if (e.altKey || e.metaKey || e.ctrlKey || /^(Alt|Meta|Control)/.test(e.code) || /^F\d+$/.test(e.code) || ['Escape', 'Tab', 'Enter', 'Space'].includes(e.code)) {
        el('bind-note').textContent = 'Use a letter, arrow, or Shift key. Space feeds the puck; Escape pauses.'; return;
      }
      if (bindings.some((b, i) => i !== bindingTarget && b.code === e.code)) { el('bind-note').textContent = 'That key already controls the other flipper.'; return; }
      bindings[bindingTarget] = { code: e.code, label: labelKey(e) }; saveBindings(); return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); paused ? begin() : pause(); return; }
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { sendFeed(); if (!started || paused) begin(); } return; }
    const side = bindings.findIndex(b => b.code === e.code);
    if (side < 0) return;
    e.preventDefault();
    if (e.repeat || !started || paused || benchmark) return;
    // Labels follow the actual keyboard layout, while binding remains physical.
    const label = labelKey(e); if (label !== bindings[side].label) { bindings[side].label = label; paintBindings(); }
    physicalHeld[side] = true; pulseUntil[side] = sim.tick + 10;
    pendingInput = { code: e.code, requested: sim.tick }; unlockAudio();
    document.querySelector(`[data-key="${side}"]`)?.classList.add('pressed');
  });
  function releaseKeys() { physicalHeld = [false, false]; pulseUntil = [0, 0]; pendingInput = null; sim.held = [false, false]; document.querySelectorAll('[data-key]').forEach(e => e.classList.remove('pressed')); }
  window.addEventListener('keyup', e => { const side = bindings.findIndex(b => b.code === e.code); if (side >= 0) { physicalHeld[side] = false; document.querySelector(`[data-key="${side}"]`)?.classList.remove('pressed'); } });
  window.addEventListener('blur', () => { releaseKeys(); pause('Focus lost'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseKeys(); pause('Tab hidden'); } });

  function settings() { return { hops: sim.hops, fixture: sim.stickEnabled, reduced: input('reduced').checked, render30: input('thirty').checked, physicsHz: 120, resolution: view.resolution, viewport: `${innerWidth} × ${innerHeight}`, devicePixelRatio, gpu: view.gpu, browser: navigator.userAgent }; }
  function finishBenchmark(reason: string | null) {
    if (!benchmark) return;
    benchmarkResult = { date: new Date().toISOString(), completed: reason === null, reason, activeSeconds: +(Math.min((performance.now() - benchmark.start) / 1000, 120).toFixed(2)), measuredFrames: benchmark.frames.length,
      medianFrameMs: +percentile(benchmark.frames, 0.5).toFixed(3), p95FrameMs: +percentile(benchmark.frames, 0.95).toFixed(3), stallsOver100ms: benchmark.frames.filter(v => v > 100).length,
      p95PhysicsPerFrameMs: +percentile(benchmark.physics, 0.95).toFixed(3), feeds: benchmark.feeds, contacts: sim.contactCount - benchmark.startContacts,
      goals: sim.scores.goal - benchmark.startScores.goal, conceded: sim.scores.conceded - benchmark.startScores.conceded, faults: sim.scores.fault - benchmark.startScores.fault,
      settings: benchmark.settings };
    benchmark = null; releaseKeys(); el('benchmark').textContent = 'Run 120-second test'; el<HTMLButtonElement>('export').disabled = false;
    el('metrics').textContent = JSON.stringify(benchmarkResult, null, 2); if (!reason) cue('TEST COMPLETE', 2);
  }
  el('benchmark').onclick = () => {
    if (benchmark) { stopBenchmark(); return; }
    sim.reset(); input('stick').checked = true; sim.setStick(true); begin();
    benchmark = { start: performance.now(), warmupUntil: performance.now() + 3000, frames: [], physics: [], feeds: 0, startContacts: sim.contactCount, startScores: { ...sim.scores }, settings: settings() };
    benchmarkResult = null; el('benchmark').textContent = 'Stop performance test'; updateHUD();
  };
  el('export').onclick = () => {
    if (!benchmarkResult) return; const url = URL.createObjectURL(new Blob([JSON.stringify(benchmarkResult, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'hockey-schtick-performance.json'; link.click(); URL.revokeObjectURL(url);
  };
  // Read-only inspection for browser QA. All game actions still go through visible controls.
  function qaState() { return { active: sim.active, paused, started, tick: sim.tick, held: [...sim.held], physicalHeld, angles: [...sim.angles], puck: sim.current.puck, velocity: { ...sim.puck.linvel() }, scores: { ...sim.scores }, bindings: bindings.map(b => ({ ...b })), lastInput: inputTick, contacts: sim.contactCount, settings: settings(), benchmarkResult, benchmarkRunning: !!benchmark, benchmarkElapsed: benchmark ? (performance.now() - benchmark.start) / 1000 : 0 }; }

  function frame(now: number) {
    requestAnimationFrame(frame);
    const elapsed = (now - lastFrame) / 1000; lastFrame = now;
    let physicsMs = 0;
    if (started && !paused) {
      if (elapsed > 0.1 && ready <= 0) { if (benchmark && now >= benchmark.warmupUntil) benchmark.frames.push(elapsed * 1000); pause('Paused after a browser stall'); }
      else if (ready > 0) { ready = Math.max(0, ready - elapsed); }
      else {
        rafSamples.push(elapsed * 1000); if (rafSamples.length > 600) rafSamples.shift();
        const t0 = performance.now(); accumulator += elapsed;
        while (accumulator >= C.dt) {
          if (benchmark) {
            const t = sim.tick * C.dt; sim.held[0] = (t % 0.7) < 0.3; sim.held[1] = ((t + 0.23) % 0.83) < 0.33;
            // Deterministic variety: repeated returns, side banks, and an unobstructed scoring feed.
            if (sim.tick % 300 === 0) {
              const variant = benchmark.feeds++ % 4;
              if (variant === 3) sim.place({ x: 0, y: 0.11, z: -5.7 }, { x: 0, y: 0, z: -15 });
              else sim.feed((['center', 'left', 'right'] as Feed[])[variant]);
              nextFeed = -1;
            }
          } else sim.held = physicalHeld.map((held, i) => held || sim.tick < pulseUntil[i]);
          sim.step(); accumulator -= C.dt;
          if (pendingInput) { inputTick = { ...pendingInput, applied: sim.tick }; pendingInput = null; }
          if (nextFeed >= 0 && !benchmark) { nextFeed -= C.dt; if (nextFeed <= 0) sendFeed(); }
          if (cueTime > 0) { cueTime -= C.dt; if (cueTime <= 0) el('cue').classList.remove('show'); }
        }
        physicsMs = performance.now() - t0; physicsSamples.push(physicsMs); if (physicsSamples.length > 600) physicsSamples.shift();
        if (benchmark && now >= benchmark.warmupUntil) { benchmark.frames.push(elapsed * 1000); benchmark.physics.push(physicsMs); }
        if (benchmark && now - benchmark.start >= 120000) finishBenchmark(null);
      }
    }
    if (!input('thirty').checked || now - lastDraw >= 1000 / 30 - 0.3) { view.render(sim.previous, sim.current, paused || !started ? 1 : accumulator / C.dt, sim.stickEnabled); lastDraw = now; }
    if (now - lastMetrics > 700) {
      lastMetrics = now; updateHUD(); el('qa-state').textContent = JSON.stringify(qaState());
      if (!benchmarkResult) el('metrics').textContent = `${benchmark ? `${Math.floor((now - benchmark.start) / 1000)} / 120 seconds\n` : ''}Frame median  ${percentile(rafSamples, 0.5).toFixed(1)} ms\nFrame p95     ${percentile(rafSamples, 0.95).toFixed(1)} ms\nPhysics p95   ${percentile(physicsSamples, 0.95).toFixed(2)} ms/frame\nPhysics       120 Hz\nResolution    ${view.resolution}\nContacts      ${sim.contactCount}\nOut of play   ${sim.scores.fault}`;
    }
  }
  requestAnimationFrame(frame);
  el('status').textContent = 'Ready when you are'; el('start').textContent = 'Start test';
  for (const id of ['start', 'feed', 'reset', 'benchmark']) el<HTMLButtonElement>(id).disabled = false;
}
boot().catch(error => { console.error(error); el('curtain-title').textContent = 'The rink could not start'; el('curtain-copy').textContent = 'This prototype needs WebGL2. Try a current Chrome or Edge browser with hardware acceleration enabled.'; el('status').textContent = 'Startup error'; });

