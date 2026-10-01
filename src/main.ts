import './style.css';
import './match.css';
import { FlipperInput } from './flipper-input';
import { RinkAudio } from './audio';
import { C, MATCH_SKATERS, MATCH_EXTENDED_WINGS } from './config';
import { initPhysics, RinkPhysics } from './physics';
import { RinkView } from './scene';
import { FlipperDemo } from './flipper-demo';
import { HockeyMatch } from './match';
import type { Difficulty } from './opponents';

document.body.classList.add('match-game');
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<header><div class="brand">HOCKEY <span>SCHTICK</span></div><div class="edition"><i></i> TABLETOP HOCKEY. PINBALL SOUL.</div><nav aria-label="Match controls"><button id="pause" class="secondary" disabled>Pause</button><button id="settings" class="secondary" aria-haspopup="dialog">Settings</button></nav></header>
<main>
  <aside class="instructions">
    <div class="eyebrow">YOUR END OF THE ICE</div><h1>Save it.<br>Win it.</h1>
    <p>${MATCH_SKATERS === 3 ? 'Three' : 'Five'} rod skaters. One goalie.<br>Your two flippers take them on.</p>
    <div class="key-pair"><div><kbd data-key="0">A</kbd><span>Left flipper</span></div><div><kbd data-key="1">L</kbd><span>Right flipper</span></div></div>
    <p class="small">Tap to strike. Hold early to cushion and cradle the puck. Release to let it slide inward, then press again to aim your shot.</p>
    <button id="controls" class="text-button">Change keys</button>
    <div class="note">Gold rings warn of a shot or pass.<br>Swing at a nearby skater to check him back. A cyan ring marks the bump.<br>Bank shots count as one goal.</div>
  </aside>
  <section class="arena" aria-label="Playable hockey match">
    <div class="hud"><div><span>YOU</span><strong id="goals">0</strong></div><div class="rally-label">FIRST TO SEVEN <small id="status">Loading rink…</small></div><div class="conceded"><span>CPU</span><strong id="conceded">0</strong></div></div>
    <div id="viewport"></div><div id="cue" class="cue" aria-live="polite"></div>
    <div id="curtain" class="curtain"><div class="start-card"><div id="card-eyebrow" class="eyebrow">ONE RINK. TWO FLIPPERS.</div><h2 id="curtain-title">Own your end.</h2><div id="final-score" hidden></div><p id="curtain-copy">Defend the near gap and fire past their goalie. First to seven wins.</p><button id="start" disabled>Loading…</button><button id="setup-options" class="text-button">Choose your level</button></div></div>
    <div class="flipper-controls" aria-label="Flipper controls"><button id="left-flipper" class="flipper-control" data-side="0" aria-label="Hold left flipper" aria-pressed="false"><kbd data-key="0">A</kbd><span>LEFT FLIPPER</span><i>HOLD · RELEASE · SHOOT</i></button><p>Hold to cradle.<br>Release. Time your shot.</p><button id="right-flipper" class="flipper-control" data-side="1" aria-label="Hold right flipper" aria-pressed="false"><kbd data-key="1">L</kbd><span>RIGHT FLIPPER</span><i>HOLD · RELEASE · SHOOT</i></button></div>
    <div class="rink-footer"><span class="led-dot"></span> THREE SKATERS · TWO FLIPPERS <span id="hop-label">· FLAT PUCK</span></div>
  </section>
</main>
<dialog id="settings-dialog" aria-labelledby="settings-title"><button id="settings-close" class="text-button dialog-close" aria-label="Close settings">Done</button><h2 id="settings-title">Your rink</h2>
  <aside class="test-panel match-panel">
    <div class="eyebrow">THE MATCHUP</div><h2>Race to seven</h2>
    <label class="difficulty-label" for="difficulty">Opponents</label><select id="difficulty"><option value="easy">Easy · more time to react</option><option value="normal" selected>Normal · balanced rallies</option><option value="hard">Hard · quicker preparation</option></select>
    <p id="profile-note" class="small">Short plays, visible windups, and a goalie that needs time to react.</p>
    <button id="new-match" class="secondary" disabled>New match</button>
    <div id="play-note" class="play-note">Pick your level, then play.</div>
    <div class="match-stats"><div><span>Flipper returns</span><b id="returns">0</b></div><div><span>Their goalie saves</span><b id="saves">0</b></div></div>
    <div class="divider"></div><div class="eyebrow">THE FEEL OF THE ICE</div>
    <label class="toggle"><input id="hops" type="checkbox"><span>Low puck hops<small>Tiny lifts after harder impacts</small></span></label>
    <label class="toggle"><input id="sound" type="checkbox" checked><span>Rink sounds<small>Sticks, boards, checks and goal horns</small></span></label>
    <label class="toggle"><input id="reduced" type="checkbox"><span>Lower render resolution</span></label>
    <label class="toggle"><input id="motion" type="checkbox"><span>Reduce celebration motion</span></label><button id="touch-keys" class="text-button">Change keyboard controls</button>
    <a class="practice-link" href="/practice.html">Puck & flipper practice ↗</a>
    <details id="lab"><summary>Performance lab</summary><p class="small">A 120-second full-team run with automatic flipper taps and rematches. Measures this browser and device. You can stop it any time.</p><button id="benchmark" class="secondary" disabled>Run 120-second test</button><button id="catch-demo" class="secondary" disabled>Watch catch & shoot</button><p class="small">The demo holds, releases, and shoots with the same two flippers. Opponents keep playing. Select New match to take over.</p><div class="effect-previews"><button id="preview-you" class="secondary">Preview your goal</button><button id="preview-cpu" class="secondary">Preview CPU goal</button></div><label class="toggle"><input id="thirty" type="checkbox"><span>Render at 30 FPS<small>Physics stays at 120 Hz</small></span></label><pre id="metrics">Waiting for play</pre><button id="export" class="text-button" disabled>Download test results</button></details>
  </aside>
</dialog>
<footer>HOCKEY SCHTICK <span>•</span> 0.4.1 <span>•</span> KEYBOARD & TOUCH</footer><output id="qa-state" hidden></output>
<dialog id="key-dialog"><form method="dialog"><div class="eyebrow">MAKE IT YOURS</div><h2>Flipper keys</h2><p>Choose a flipper, then press the key you want. Left and right Shift can be assigned separately.</p><div class="bindings"><button type="button" data-bind="0">Left: A</button><button type="button" data-bind="1">Right: L</button></div><p id="bind-note" aria-live="polite">Two distinct keys let both flippers work together.</p><p class="small">Repeated Shift presses can trigger your Windows accessibility shortcut.</p><div class="dialog-actions"><button type="button" id="defaults" class="secondary">Restore A / L</button><button value="close">Done</button></div></form></dialog>`;

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id);
const level = () => el<HTMLSelectElement>('difficulty').value as Difficulty;
type Binding = { code: string; label: string };
let bindings: Binding[] = [{ code: 'KeyA', label: 'A' }, { code: 'KeyL', label: 'L' }];
try { const stored = JSON.parse(localStorage.getItem('hockey-schtick-keys') ?? 'null');
  if (Array.isArray(stored) && stored.length === 2 && stored.every(b => typeof b.code === 'string' && typeof b.label === 'string') && stored[0].code !== stored[1].code) bindings = stored;
} catch {}
let bindingTarget: number | null = null;
function paintBindings() { bindings.forEach((b, i) => {
  document.querySelectorAll(`[data-key="${i}"]`).forEach(e => { e.textContent = b.label; e.classList.toggle('long-key', b.label.length > 3); });
  document.querySelector<HTMLButtonElement>(`[data-bind="${i}"]`)!.textContent = `${i === 0 ? 'Left' : 'Right'}: ${b.label}`;
}); }
paintBindings();
function labelKey(e: KeyboardEvent) { if (e.code === 'ShiftLeft') return 'Left Shift'; if (e.code === 'ShiftRight') return 'Right Shift'; return e.key.length === 1 ? e.key.toLocaleUpperCase() : e.key; }
const percentile = (values: number[], q: number) => { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor((sorted.length - 1) * q)]; };

async function boot() {
  await initPhysics();
  const sim = new RinkPhysics(), match = new HockeyMatch(sim, MATCH_SKATERS, MATCH_EXTENDED_WINGS), view = new RinkView(el('viewport'), true);
  let started = false, paused = false, ready = 0, accumulator = 0, cueTime = 0;
  let lastFrame = performance.now(), lastDraw = 0, lastMetrics = 0, lastCountdown = -1;
  const flipperInput = new FlipperInput();
  let pendingInput: { code: string; requested: number } | null = null;
  let inputTick: { code: string; requested: number; applied: number } | null = null;
  let rafSamples: number[] = [], physicsSamples: number[] = [], drawSamples: number[] = [];
  const audio = new RinkAudio(); let checkSounds = 0, effectPreview = 0; const soundEvents: Record<string, number> = {};
  const keyDialog = el<HTMLDialogElement>('key-dialog');
  const settingsDialog = el<HTMLDialogElement>('settings-dialog');
  let seed = Number(new URLSearchParams(location.search).get('seed')) || (Date.now() >>> 0);
  type Benchmark = { mode: 'rally' | 'control'; demo: FlipperDemo; start: number; warmup: number; frames: number[]; physics: number[]; draws: number[]; contacts: number; goals: number; conceded: number; faults: number; matches: number; strikes: number; checks: number; settings: object };
  let benchmark: Benchmark | null = null, benchmarkResult: Record<string, unknown> | null = null;
  function sound(kind: string, force = 8) {
    if (input('sound').checked && audio.play(kind, force)) { soundEvents[kind] = (soundEvents[kind] ?? 0) + 1; if (kind === 'check') checkSounds++; }
  }
  function unlockAudio() { audio.mute(!input('sound').checked); audio.unlock(); }
  function cue(text: string, seconds = .65) { el('cue').textContent = text; el('cue').classList.add('show'); cueTime = seconds; }
  function paintInput() { flipperInput.held.forEach((held, side) => { document.querySelectorAll(`[data-key="${side}"], [data-side="${side}"]`).forEach(e => e.classList.toggle('pressed', held)); el(side ? 'right-flipper' : 'left-flipper').setAttribute('aria-pressed', String(held)); }); }
  function releaseKeys() { flipperInput.clear(); pendingInput = null; sim.held = [false, false]; paintInput(); }
  function pressFlipper(source: string, side: number) {
    if (!started || paused || benchmark || match.phase !== 'playing') return false;
    if (flipperInput.press(source, side, sim.tick)) { pendingInput = { code: source, requested: sim.tick }; unlockAudio(); sound('flipper'); paintInput(); }
    return true;
  }
  document.querySelectorAll<HTMLButtonElement>('.flipper-control').forEach(button => {
    const side = Number(button.dataset.side);
    button.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); if (pressFlipper(`pointer-${e.pointerId}`, side)) button.setPointerCapture(e.pointerId); });
    button.addEventListener('pointerup', e => { flipperInput.release(`pointer-${e.pointerId}`); paintInput(); });
    for (const event of ['pointercancel', 'lostpointercapture']) button.addEventListener(event, e => { flipperInput.cancel(`pointer-${(e as PointerEvent).pointerId}`); paintInput(); });
    button.addEventListener('contextmenu', e => e.preventDefault());
    button.addEventListener('keydown', e => { if (['Space', 'Enter'].includes(e.code)) { e.preventDefault(); if (!e.repeat) pressFlipper(`button-${side}`, side); } });
    button.addEventListener('keyup', e => { if (['Space', 'Enter'].includes(e.code)) { e.preventDefault(); flipperInput.release(`button-${side}`); paintInput(); } });
    button.addEventListener('blur', () => { flipperInput.cancel(`button-${side}`); paintInput(); });
  });
  function updateHUD() {
    el('goals').textContent = String(match.score.you); el('conceded').textContent = String(match.score.cpu);
    el('returns').textContent = String(match.returns); el('saves').textContent = String(match.goalieSaves);
    const point = match.score.you === 6 || match.score.cpu === 6;
    el('status').textContent = paused ? 'Paused' : benchmark ? benchmark.mode === 'control' ? `Demo · ${benchmark.demo.stage}` : 'Performance test' : match.phase === 'playing' ? point ? 'Match point' : `${match.difficulty[0].toUpperCase()}${match.difficulty.slice(1)} · Play` : match.message;
    el('pause').textContent = paused ? 'Resume · Esc' : 'Pause · Esc'; el<HTMLButtonElement>('pause').disabled = !started || match.phase === 'finished';
    document.querySelector<HTMLLabelElement>('.difficulty-label')!.textContent = started && match.phase !== 'finished' ? 'Opponents · next match' : 'Opponents';
    const charging = match.team.skaters.find(s => s.stage === 'windup' || s.stage === 'swing');
    el('play-note').textContent = paused ? 'The whole match is paused.' : match.phase === 'finished' ? 'Choose a level and play again.' : !started ? 'Pick your level, then play.' : match.phase !== 'playing' ? match.message : charging ? charging.push ? 'Opening drive winding up…' : charging.pass ? 'Pass winding up…' : 'Shot winding up…' : match.team.goalieStage === 'windup' ? 'Their goalie is preparing a clear.' : sim.puck.linvel().z < -1 ? 'Your return is heading up the ice.' : 'Read the puck. Time your flippers.';
    el('profile-note').textContent = level() === 'easy' ? 'Longer windups and a slower goalie. The ice and your flippers stay the same.' : level() === 'hard' ? 'Shorter windups, a faster goalie, and an occasional second pass.' : 'Short plays, visible windups, and a goalie that needs time to react.';
    if (!paused && match.phase === 'playing' && sim.cradledSide() !== null) el('play-note').textContent = 'Puck cradled. Release, let it slide, then press again to shoot.';
  }
  function showResult() {
    el('final-score').hidden = false; el('final-score').textContent = `${match.score.you} – ${match.score.cpu}`; el('curtain').dataset.result = match.winner ?? '';
    el('card-eyebrow').textContent = 'FINAL SCORE'; el('curtain-title').textContent = match.winner === 'you' ? 'You win!' : 'CPU wins';
    el('curtain-copy').textContent = `${match.score.you} – ${match.score.cpu} · ${match.returns} flipper returns. Choose a level for your rematch.`;
    el('start').textContent = 'Play again'; el('curtain').classList.remove('hidden');
  }
  match.onContact = c => sound(c.label, c.speed);
  match.team.onCheck = c => { sound('check', c.strength); if (benchmark) benchmark.checks++; };
  match.onEvent = event => {
    if (event.kind === 'start') { lastCountdown = -1; releaseKeys(); view.setCelebration(null); }
    if (event.kind === 'drop') { cue('PLAY', .35); view.setCelebration(null); sound('drop'); }
    if (event.kind === 'goal' || event.kind === 'finished') {
      releaseKeys(); view.setCelebration(event.scorer ?? null); sound(event.scorer === 'you' ? 'goal' : 'cpu');
      const score = el(event.scorer === 'you' ? 'goals' : 'conceded'); score.classList.remove('scored'); void score.offsetWidth; score.classList.add('scored');
      if (benchmark) { if (event.scorer === 'you') benchmark.goals++; else benchmark.conceded++; }
      if (event.kind === 'finished') { if (benchmark) benchmark.matches++; else showResult(); }
      else cue(event.message, 1.05);
    }
    if (event.kind === 'recovery') { releaseKeys(); cue(event.message, 1); if (benchmark) benchmark.faults++; }
    updateHUD();
  };
  function newMatch(seedOverride?: number) {
    effectPreview++; el('final-score').hidden = true; delete el('curtain').dataset.result;
    settingsDialog.close();
    unlockAudio(); releaseKeys(); started = true; paused = false; accumulator = 0; ready = .45; lastFrame = performance.now();
    match.start(level(), seedOverride ?? seed++); el('curtain').classList.add('hidden'); updateHUD();
  }
  function resume() { effectPreview++; view.setCelebration(null); unlockAudio(); paused = false; ready = .45; accumulator = 0; lastFrame = performance.now(); el('curtain').classList.add('hidden'); cue('READY', .45); updateHUD(); }
  function begin() { if (paused) resume(); else newMatch(); el('start').blur(); }
  function pause(reason = 'Paused') {
    if (!started || paused || match.phase === 'finished') return;
    paused = true; releaseKeys(); audio.mute(true); accumulator = 0; finishBenchmark(reason);
    el('card-eyebrow').textContent = 'TAKE YOUR TIME'; el('curtain-title').textContent = reason; el('curtain-copy').textContent = 'The puck and opponents are waiting. Resume when you’re ready.'; el('start').textContent = 'Resume match'; el('curtain').classList.remove('hidden'); updateHUD();
  }
  el('start').onclick = begin; el('pause').onclick = () => { paused ? resume() : pause(); el('pause').blur(); };
  el('new-match').onclick = () => {
    effectPreview++; el('final-score').hidden = true; delete el('curtain').dataset.result;
    settingsDialog.close(); audio.mute(true);
    finishBenchmark('New match selected'); releaseKeys(); match.prepare(level(), seed); started = paused = false; ready = accumulator = cueTime = 0;
    view.setCelebration(null); el('cue').classList.remove('show'); el('card-eyebrow').textContent = 'THE MATCHUP'; el('curtain-title').textContent = 'Back on the ice.';
    el('curtain-copy').textContent = `${level()[0].toUpperCase()}${level().slice(1)} opponents. A fresh race to seven.`; el('start').textContent = 'Play match'; el('curtain').classList.remove('hidden'); el('new-match').blur(); updateHUD();
  };
  el('difficulty').onchange = () => { updateHUD(); el('difficulty').blur(); };
  input('hops').onchange = () => { sim.setHops(input('hops').checked); el('hop-label').textContent = sim.hops ? '· LOW HOPS' : '· FLAT PUCK'; input('hops').blur(); };
  input('reduced').onchange = () => { view.setReduced(input('reduced').checked); input('reduced').blur(); };
  input('sound').onchange = () => { audio.mute(!input('sound').checked); if (input('sound').checked) unlockAudio(); input('sound').blur(); }; input('thirty').onchange = () => input('thirty').blur();
  input('motion').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  input('motion').onchange = () => { view.setReducedMotion(input('motion').checked); document.body.classList.toggle('reduce-motion', input('motion').checked); };
  document.body.classList.toggle('reduce-motion', input('motion').checked);
  el('settings').onclick = () => { pause('Settings'); releaseKeys(); settingsDialog.showModal(); };
  el('setup-options').onclick = () => { settingsDialog.showModal(); };
  el('settings-close').onclick = () => settingsDialog.close();
  function previewGoal(scorer: 'you' | 'cpu') {
    pause('Effects preview'); releaseKeys(); settingsDialog.close(); el('curtain').classList.add('hidden');
    const token = ++effectPreview; unlockAudio(); view.setCelebration(scorer); sound(scorer === 'you' ? 'goal' : 'cpu'); cue(scorer === 'you' ? 'YOUR GOAL · PREVIEW' : 'CPU GOAL · PREVIEW', 2.5);
    window.setTimeout(() => { if (token !== effectPreview) return; view.setCelebration(null); el('cue').classList.remove('show'); if (paused || !started || match.phase === 'finished') el('curtain').classList.remove('hidden'); if (paused) audio.mute(true); }, 2500);
  }
  el('preview-you').onclick = () => previewGoal('you'); el('preview-cpu').onclick = () => previewGoal('cpu');
  el('touch-keys').onclick = () => { settingsDialog.close(); pause('Controls'); bindingTarget = null; keyDialog.showModal(); };
  el('controls').onclick = () => { pause('Controls'); bindingTarget = null; keyDialog.showModal(); };
  document.querySelectorAll<HTMLButtonElement>('[data-bind]').forEach(button => { button.onclick = () => { bindingTarget = Number(button.dataset.bind); el('bind-note').textContent = 'Press your new key. Escape cancels.'; }; });
  function saveBindings() { paintBindings(); try { localStorage.setItem('hockey-schtick-keys', JSON.stringify(bindings)); } catch {} bindingTarget = null; el('bind-note').textContent = 'Saved. Close this panel, then resume the match.'; }
  el('defaults').onclick = () => { bindings = [{ code: 'KeyA', label: 'A' }, { code: 'KeyL', label: 'L' }]; saveBindings(); };
  keyDialog.addEventListener('close', () => { bindingTarget = null; });
  window.addEventListener('keydown', e => {
    if (settingsDialog.open) return;
    if (keyDialog.open) {
      if (bindingTarget === null || e.repeat) return; e.preventDefault();
      if (e.code === 'Escape') { bindingTarget = null; el('bind-note').textContent = 'Assignment cancelled.'; return; }
      if (e.altKey || e.ctrlKey || e.metaKey || /^(Alt|Meta|Control)/.test(e.code) || /^F\d+$/.test(e.code) || ['Tab', 'Enter', 'Space'].includes(e.code)) { el('bind-note').textContent = 'Use a letter, arrow, or Shift key. Escape pauses the match.'; return; }
      if (bindings.some((b, i) => i !== bindingTarget && b.code === e.code)) { el('bind-note').textContent = 'That key already controls the other flipper.'; return; }
      bindings[bindingTarget] = { code: e.code, label: labelKey(e) }; saveBindings(); return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); if (started && match.phase !== 'finished') paused ? resume() : pause(); return; }
    if ((e.code === 'Space' || e.code === 'Enter') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (!e.repeat && (!started || paused || match.phase === 'finished')) begin(); return; }
    const side = bindings.findIndex(b => b.code === e.code); if (side < 0) return; e.preventDefault();
    if (e.repeat || !started || paused || benchmark || match.phase !== 'playing') return;
    const label = labelKey(e); if (label !== bindings[side].label) { bindings[side].label = label; paintBindings(); }
    pressFlipper(e.code, side);
  });
  window.addEventListener('keyup', e => { flipperInput.release(e.code); paintInput(); });
  window.addEventListener('blur', () => { releaseKeys(); pause('Focus lost'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseKeys(); pause('Tab hidden'); } });
  window.addEventListener('orientationchange', () => { releaseKeys(); pause('Screen rotated'); });
  view.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); releaseKeys(); pause('Graphics interrupted'); });
  function settings() { return { version: '0.4.1', presentation: view.presentation, difficulty: match.difficulty, seed: match.seed, actors: match.team.skaters.length + 1, extendedWings: match.team.extendedWings, playTuning: match.team.tuning, flipperRubber: sim.flipperRubber, checking: match.team.checking, skaterLanes: match.team.skaters.map(s => ({ index: s.index, ...match.team.lanes[s.index] })), hops: sim.hops, reduced: input('reduced').checked, render30: input('thirty').checked, physicsHz: 120, downhill: sim.downhill, resolution: view.resolution, viewport: `${innerWidth} × ${innerHeight}`, devicePixelRatio, gpu: view.gpu, browser: navigator.userAgent }; }
  function finishBenchmark(reason: string | null) {
    if (!benchmark) return;
    benchmarkResult = { date: new Date().toISOString(), mode: benchmark.mode, catches: benchmark.demo.catches, releaseAttempts: benchmark.demo.shots, completed: reason === null, reason, activeSeconds: +Math.min((performance.now() - benchmark.start) / 1000, 120).toFixed(2), measuredFrames: benchmark.frames.length, medianFrameMs: +percentile(benchmark.frames, .5).toFixed(3), p95FrameMs: +percentile(benchmark.frames, .95).toFixed(3), medianDrawIntervalMs: +percentile(benchmark.draws, .5).toFixed(3), p95DrawIntervalMs: +percentile(benchmark.draws, .95).toFixed(3), stallsOver100ms: benchmark.frames.filter(v => v > 100).length, p95PhysicsPerFrameMs: +percentile(benchmark.physics, .95).toFixed(3), contacts: sim.contactCount - benchmark.contacts, goals: benchmark.goals, conceded: benchmark.conceded, neutralRestarts: benchmark.faults, completedMatches: benchmark.matches, assistedStrikes: benchmark.strikes + match.team.stats.strikes, checks: benchmark.checks, settings: benchmark.settings };
    benchmark = null; releaseKeys(); el('benchmark').textContent = 'Run 120-second test'; el<HTMLButtonElement>('export').disabled = false; el('metrics').textContent = JSON.stringify(benchmarkResult, null, 2);
    el('catch-demo').textContent = 'Watch catch & shoot'; el<HTMLButtonElement>('catch-demo').disabled = false;
    if (match.phase === 'finished') showResult(); if (!reason) cue('TEST COMPLETE', 1); updateHUD();
  }
  function beginBenchmark(mode: 'rally' | 'control') {
    if (benchmark) { finishBenchmark('Stopped by player'); return; }
    newMatch(1024); benchmarkResult = null;
    benchmark = { mode, demo: new FlipperDemo(), start: performance.now(), warmup: performance.now() + 3000, frames: [], physics: [], draws: [], contacts: sim.contactCount, goals: 0, conceded: 0, faults: 0, matches: 0, strikes: 0, checks: 0, settings: settings() };
    el('benchmark').textContent = 'Stop performance test'; el('benchmark').blur(); updateHUD();
    el('catch-demo').textContent = mode === 'control' ? 'Stop catch & shoot' : 'Watch catch & shoot'; el<HTMLButtonElement>('catch-demo').disabled = mode !== 'control'; el('catch-demo').blur();
  }
  el('benchmark').onclick = () => beginBenchmark('rally');
  el('catch-demo').onclick = () => beginBenchmark('control');
  el('export').onclick = () => { if (!benchmarkResult) return; const url = URL.createObjectURL(new Blob([JSON.stringify(benchmarkResult, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'hockey-schtick-match-performance.json'; link.click(); URL.revokeObjectURL(url); };
  function qaState() { return { active: sim.active, paused, started, phase: match.phase, winner: match.winner, elapsed: match.elapsed, countdown: match.timer, tick: sim.tick, held: [...sim.held], physicalHeld: flipperInput.held, angles: [...sim.angles], puck: sim.current.puck, velocity: { ...sim.puck.linvel() }, cradledSide: sim.cradledSide(), demo: benchmark?.mode === 'control' ? { stage: benchmark.demo.stage, catches: benchmark.demo.catches, releaseAttempts: benchmark.demo.shots } : null, scores: { ...match.score }, drops: match.drops, recoveries: match.recoveries, returns: match.returns, goalieSaves: match.goalieSaves, actors: sim.current.actors, lastCheck: match.team.lastCheck, checkSounds, soundEvents: { ...soundEvents }, soundEnabled: input('sound').checked, audioState: audio.state, team: { ...match.team.stats }, bindings: bindings.map(b => ({ ...b })), lastInput: inputTick, contacts: sim.contactCount, settings: settings(), benchmarkResult, benchmarkRunning: !!benchmark, benchmarkElapsed: benchmark ? (performance.now() - benchmark.start) / 1000 : 0 }; }
  function frame(now: number) {
    requestAnimationFrame(frame); const elapsed = (now - lastFrame) / 1000; lastFrame = now; let physicsMs = 0;
    if (started && !paused && match.phase !== 'finished') {
      if (elapsed > .1 && ready <= 0) { if (benchmark && now >= benchmark.warmup) benchmark.frames.push(elapsed * 1000); pause('Paused after a browser stall'); }
      else if (ready > 0) ready = Math.max(0, ready - elapsed);
      else {
        rafSamples.push(elapsed * 1000); if (rafSamples.length > 600) rafSamples.shift(); const t0 = performance.now(); accumulator += elapsed;
        while (accumulator >= C.dt) {
          if (benchmark) {
            const p = sim.puck.translation(), v = sim.puck.linvel();
            const strike = sim.active && p.z > 5 && p.z < 6.5 && v.z > 0;
            sim.held = benchmark.mode === 'control' ? benchmark.demo.step(sim) : [strike && p.x < .9, strike && p.x > -.9];
          } else sim.held = flipperInput.at(sim.tick);
          const beforeTick = sim.tick; match.step(); accumulator -= C.dt;
          if (pendingInput && sim.tick > beforeTick) { inputTick = { ...pendingInput, applied: sim.tick }; pendingInput = null; }
          if (match.phase === 'countdown') { const count = Math.ceil(match.timer); if (count !== lastCountdown) { lastCountdown = count; cue(String(count), .8); view.setCelebration(null); } }
          if (cueTime > 0) { cueTime -= C.dt; if (cueTime <= 0) el('cue').classList.remove('show'); }
          if (match.winner !== null) { accumulator = 0; break; }
        }
        physicsMs = performance.now() - t0; physicsSamples.push(physicsMs); if (physicsSamples.length > 600) physicsSamples.shift();
      }
    }
    if (benchmark && !paused) {
      if (now >= benchmark.warmup) { benchmark.frames.push(elapsed * 1000); benchmark.physics.push(physicsMs); }
      if (now - benchmark.start >= 120000) finishBenchmark(null);
      else if (match.phase === 'finished') { benchmark.strikes += match.team.stats.strikes; newMatch(1024 + benchmark.matches * 7919); }
    }
    if (!input('thirty').checked || now - lastDraw >= 1000 / 30 - .3) {
      if (lastDraw) { drawSamples.push(now - lastDraw); if (drawSamples.length > 600) drawSamples.shift(); if (benchmark && now >= benchmark.warmup) benchmark.draws.push(now - lastDraw); }
      view.render(sim.previous, sim.current, paused || match.phase !== 'playing' ? 1 : accumulator / C.dt, false); lastDraw = now;
    }
    if (now - lastMetrics > 500) {
      lastMetrics = now; updateHUD(); el('qa-state').textContent = JSON.stringify(qaState());
      if (!benchmarkResult) el('metrics').textContent = `${benchmark ? `${Math.floor((now - benchmark.start) / 1000)} / 120 seconds\n` : ''}Frame median  ${percentile(rafSamples, .5).toFixed(1)} ms\nFrame p95     ${percentile(rafSamples, .95).toFixed(1)} ms\nDraw interval ${percentile(drawSamples, .5).toFixed(1)} ms\nPhysics p95   ${percentile(physicsSamples, .95).toFixed(2)} ms/frame\nPhysics       120 Hz\nResolution    ${view.resolution}\nActors        ${match.team.skaters.length} skaters + goalie\nContacts      ${sim.contactCount}\nStrikes       ${match.team.stats.strikes}\nNeutral drops ${match.recoveries}`;
    }
  }
  requestAnimationFrame(frame); el('start').textContent = 'Play match'; for (const id of ['start', 'new-match', 'benchmark', 'catch-demo']) el<HTMLButtonElement>(id).disabled = false; updateHUD();
}
boot().catch(error => { console.error(error); el('curtain-title').textContent = 'The rink could not start'; el('curtain-copy').textContent = 'This game needs WebGL2. Try a current Chrome or Safari browser with hardware acceleration available.'; el('status').textContent = 'Startup error'; });
