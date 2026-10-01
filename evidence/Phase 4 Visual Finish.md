# Phase 4 — visual finish, 0.4.0

Implemented and inspected on October 1, 2026. Baseline: commit `72e4a8d`, the accepted 0.3.6 match. Mockup four governs the visual direction; the later three-skater lineup, long wing travel and accepted paddle behavior govern the game.

## Requirement audit

| Requirement | Implementation and evidence |
| --- | --- |
| Refine the figures toward the tabletop reference | `src/art.ts` builds rounded jerseys, striped socks and sleeves, skates, gloves, helmets, stick shafts/blades, numbers and a masked goalie with ribbed tan pads. Figures are batched by material. Desktop/tablet screenshots show the result. |
| Refine ice and blue LEDs | Procedural skate-scuff texture, rink markings, baked light reflections, soft puck/figure shadows, transparent side/far glass, metal lamp sockets, blue strips and lamp glows. See `phase4-desktop.png` and `phase4-tablet.png`. |
| Angled, centered camera with whole-rink visibility | A fixed 57-degree-elevation perspective camera fits the rink, cabinet and glass without camera rotation, tracking or shake. Phone/tablet/desktop screenshots verify coverage. |
| Exactly three skaters plus goalie | Renderer uses `MATCH_SKATERS = 3`; runtime state reports four actors. The simulation has no lower pair. |
| Continuous end-to-end wing rails | The drawn wing slots use the same -5.9 to 4.9 endpoints as the current opponents. Center retains -3.25 to 0.25. No forks or leftover lower slots in the match. |
| Invisible net bumpers, retained collisions | `makeGoal` no longer draws the filled shoulder polygons; the rear rounded pipe/net remain visible. `src/physics.ts` is unchanged from the baseline, including all net-base and shoulder colliders. |
| Preserve accepted puck/flipper/opponent mechanics | No changes to `physics.ts`, `opponents.ts`, `match.ts`, or numerical tuning constants. Existing physics/gameplay tests all pass. Paddle footprint and angles are unchanged; decorative caps sit above the heel guides so the whole paddle remains readable. |
| Sound and celebrations | Distinct synthesized rubber, board, stick, metal and check contacts; gesture-started audio; goal horn, short fanfare and crowd noise; colored LEDs, off-ice particles, score pulse, final score. Both goal previews were exercised without modifying match scores. Real match audio counters show drops, both flippers, boards, blades, goals and goalie contacts. |
| Desktop, tablet and phone controls | Independent pointer IDs, capture, cancellation, keyboard/pointer mixing, 10-tick minimum taps, keyboard activation and remapping. Phones have large pads below the rink, with side pads in short landscape views. Safe-area padding and dynamic viewport height are used. See `phase4-layouts.json`. |
| Crowd when space allows | Side stands and spectators appear in wider views. Portrait phone views prioritize the rink. Reduced rendering hides the crowd. |
| Browser interruption and accessibility | Settings, focus loss, hidden tabs and orientation changes clear held input and pause; resume is explicit. WebGL context loss pauses. Sound can be muted immediately. Reduced motion suppresses particles, pulsing light and score animation; system preference is respected initially. |

## Checks performed

- Production build passed with the pinned TypeScript/Vite toolchain. The pre-existing embedded Rapier/WASM bundle warning remains, approximately 1.83 MB compressed for the shared scene bundle.
- All **731 existing checks** passed, plus nine historical two-minute pacing scenarios. The generated physics, match, opening/rear-bumper, cradle and checking reports retain their successful results.
- **13 new input checks** passed: two simultaneous finger sources, independent release/aiming, minimum tap timing, mixed keyboard/touch holds, repeat-key rejection, cancellation, duplicate fingers on one pad, complete pause/reset cleanup and a fresh match tick reset.
- Real desktop Chrome opened and played the match. A/L input reached physics on the next tick (example KeyL requested tick 7, applied tick 8). No console errors were observed. State and screenshot: `phase4-chrome-state.json`, `phase4-chrome.png`.
- Both on-screen controls were clicked during a live match. Each generated a flipper event; the final pointer input reached physics on the next tick (requested 53, applied 54). Both held states returned to false. Pause and resume were exercised.
- Phone portrait 390×844 and 320×568, tablet 768×1024, desktop 1440×1000 and phone landscape 844×390 were visually checked. The three portrait/tablet dimensions have no document overflow; touch pads are approximately 65–66 CSS pixels high. The 844×390 side pads are 80×94 CSS pixels and do not overlap the rink.
- Goal preview produced mint lights and off-ice particles while scores remained 0–0 and the audio context was running. CPU preview used red lights. With sound muted and reduced motion/quality enabled, CPU sound count did not increase, the crowd was hidden, and motion was disabled. See the preview screenshots.

## Measured performance

`phase4-desktop-performance.json` records a complete 120-second normal-difficulty rally with the real three skaters, goalie, collisions, sounds and reactive flipper inputs at 1440×1000 in Chromium on this Windows machine's RTX 3080 Ti:

| Measurement | Result |
| --- | --- |
| Measured frames after warm-up | 7,021 |
| Median / p95 animation interval | 16.7 / 16.8 ms |
| Median / p95 draw interval | 16.7 / 16.8 ms |
| Stalls over 100 ms | 0 |
| p95 CPU physics time per frame | 0.4 ms |
| Contacts / assisted strikes / checks | 451 / 12 / 1 |
| Goals for / against | 0 / 1 |
| Neutral wedge recoveries | 1 |

The stationary-wedge recovery is the existing neutral-reset behavior, not a scoring event. This run measures rendering and runtime behavior; it does not establish human aiming quality. Decorative cap height, UI and preview refinements after this run did not change the simulation or rendering strategy. The final build and live layout/control checks passed afterward.

## Compatibility boundaries

Desktop Chrome and the Codex Chromium browser were tested here. Narrow/wide viewport checks used that desktop engine, not mobile device emulation. Native Android Chrome, iOS Safari and Chrome iOS, real simultaneous touch hardware, and mobile GPU performance remain unverified. There is no claim that desktop 60 FPS transfers to every phone. The implementation uses WebGL2, Pointer Events with pointer capture and `touch-action: none`, and user-gesture Web Audio, with no browser-specific game input APIs or external downloads during play.

Primary references used: [MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).

The server is still local at `http://127.0.0.1:5173/`. This phase did not deploy a public website. `Start Game.cmd` continues to launch the installed Vite executable directly. In this managed checkout the pnpm 11 automatic dependency check tried to reinstall an existing dependency tree; verification used the installed pinned tools directly, or `pnpm --config.verify-deps-before-run=false run build`. Fresh clones should use `pnpm install --frozen-lockfile` first as usual.
