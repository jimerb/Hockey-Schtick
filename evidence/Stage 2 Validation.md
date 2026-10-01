# Stage 2 validation — September 30, 2026

The puck-and-flippers prototype is runnable. Automated physics checks and two timed desktop browser runs passed. Human playtesting is still needed to judge aiming comfort and whether the optional hops help the game.

## Build and simulation

- TypeScript validation and the Vite production build passed. The built static app was also loaded and played in Chrome through a separate preview server.
- **295 simulation checks passed; 284 are targeted fast-impact scenarios.** The complete record is `physics-results.json`.
- Fast-impact coverage includes both moving flippers, a moving/rotating blade, side boards, rounded rear-base geometry, shallow board grazes, and simultaneous flipper contacts, with both flat and hopping pucks.
- No observed tunneling or escapes occurred in those scenarios. Tests require relevant contact events and check returns or containment; they do not prove every possible trajectory safe.
- Center shots and bank shots off either side can score from the same repeatable feed with a timed flipper stroke. These are simulated input sequences, not a claim that a human has confirmed the aiming feels good.
- Goal and concession checks count once. A scored puck is disabled before it can rebound from the rear base. The rear curved-surface angle probe starts inside the goal area to isolate geometry; normal play removes a scored puck before that contact.
- An untouched center feed can concede. Holding both flippers raised is not a substitute for timing.

## Timed desktop runs

Both runs used a **1280 × 720 browser viewport**, a **638 × 503 drawing buffer**, and the moving center fixture. Each lasted 120 seconds; frame measurements exclude a three-second warm-up. The first drew every animation callback. The second drew at approximately 30 FPS while keeping the same 120 Hz simulation.

| Observation | Flat puck / normal drawing | Low hops / 30 FPS drawing |
|---|---:|---:|
| Completed | Yes | Yes |
| Measured animation callbacks | 7,020 | 7,020 |
| Median callback interval | 16.7 ms | 16.7 ms |
| 95th percentile callback interval | 16.8 ms | 16.8 ms |
| Callbacks over 100 ms | 0 | 0 |
| 95th percentile physics CPU time per callback | 0.3 ms | 0.3 ms |
| Programmed repeat feeds | 48 | 48 |
| Recorded non-ice contacts | 96 | 115 |
| Goals during the run | 15 | 13 |
| Puck escapes/out-of-play faults | 0 | 0 |

The callback rate stays near 60 Hz in the 30 FPS draw comparison; that row is **not** a claim of 60 rendered frames per second in that mode. Physics runs independently of the draw choice. Low hops intentionally change collisions, so goal totals between flat and hopping runs need not match.

Raw results: `performance-desktop-60.json` and `performance-desktop-hops-30.json`. These measurements cover the simple stage-2 scene, not a full team or final artwork. The benchmark periodically feeds pucks, so its zero escapes is not a proof that every long rally is free of dead spots.

Observed device information:

- GPU reported by WebGL: NVIDIA GeForce RTX 3080 Ti through ANGLE / Direct3D 11.
- CPU identifier exposed by Windows: AMD64 Family 25 Model 97 Stepping 2, AuthenticAMD. The full CPU product name was unavailable through the sandboxed system query.
- OS version: Microsoft Windows NT 10.0.26200.0.
- Browser: Chromium/Chrome 154.0.0.0. Timed measurements used the Codex in-app browser; the production build also received a separate Chrome smoke test.
- Render pixel ratio: approximately 1 in the measured viewport. The app caps pixel ratio at 1.5 elsewhere and offers a lower-resolution option.

## Browser and controls

Observed checks passed for startup, visible full-rink layout at 1280 × 720, keyboard taps, both-key input, an input applied on the next physics tick, manual feed, automatic next rally, reset, pause/resume, and settings changes. Wide and narrow layouts were inspected; the narrow layout retains the full rink and a keyboard control strip, with test settings below it.

Key remapping was exercised through the real interface: a letter assignment worked, a duplicate assignment was rejected, separate left/right Shift assignments worked, and the bindings survived a reload. Defaults were restored to A / L. Hold and independent release were exercised in the simulation tests; human sustained-key play remains part of the feel check.

Focus-loss and visibility-change handlers clear input and require explicit resume. The browser automation's background-tab operations did not reproduce an actual OS focus change, so **physical window switching and hidden-tab behavior remain unverified**. Browser modifier shortcuts are excluded from flipper input. No browser console errors were observed during the checked sessions.

## Next checks before opponents

Play the slice with a physical keyboard and judge whether saves and deliberate returns feel responsive, whether the central gap feels fair, and whether flat motion or low hops is easier to read. Check actual window/tab switching while a flipper key is held. Test an integrated-GPU laptop and Edge; neither was exercised here. Recheck collision coverage and performance as opponents and more detailed art are introduced.

Launch and tuning details are in the project README. The saved gameplay screenshot is `stage-2-playable.jpg`.
