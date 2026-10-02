# Paddle contact and crowd — 0.4.8

All four paddles retain their rounded horizontal collision footprints. Their collision volumes now span Y = -1.0 to 1.6, covering both the flat puck and the allowed low-hop range. This makes horizontal separation the shortest response to a deeply overlapping puck; the old shallow collider could instead trap or push it under the paddle. Visible paddle heights, rubber restitution, friction, cradle guides and input timing are retained. These are finite regression checks, not a mathematical guarantee of every possible physics state.

The upper paddle length changes from 1.85 to 2.035, exactly 10%. The physical shaft, rounded tip, visible blade, board insert and top resting face all use this shared length. Width, hinge positions and angles are unchanged. Tests verify additional tip contact, an unchanged clear board glide while recessed, upper-paddle goals and full-team containment.

The crowd now has 368 spectators in four tiers along the sides, far corners, far end and short near-corner sections. Thirteen shared instance meshes provide shaped coats, varied proportions and skin tones, hair/caps, faces, scarves, articulated seated legs and shoes. Idle poses include waving, clapping, leaning and head movement. Human goals trigger raised arms, applause and small standing/bobbing movements for 4.2 seconds. Countdown/drop events no longer cancel the reaction. The crowd freezes on pause or reduced motion; the explicit effects preview is allowed to animate while match physics is paused.

Outer rows have lower contrast. A crowd-only shader fades spectators and seating near the actual score/control rectangles and screen edges; it does not darken the ice or puck. The cabinet camera fit is retained. Narrow portrait views and lower graphics detail continue hiding the crowd.

## Regression evidence

- 464 targeted paddle cases: upper/lower, left/right, flat/hopping, deep overlap, held contact, return/restrike, speeds up to the configured 40, and contacts across the shaft. All pass. Rounded-end escape is allowed. The test keeps the ice but isolates the target paddle from unrelated contacts.
- Restoring just the legacy collider heights in the same fixture reproduces 66 failures. `tests/paddle-integrity.ts --legacy-height` records that expected failing-geometry baseline separately; it does not alter production code.
- 64 upper-paddle/input/board-clearance cases pass, including new-tip contact and exact length/pivot checks.
- Existing physics, matches, opening/body responses, cradling/aiming, checking and trapped-player suites pass. With input, crowd geometry/animation and the new paddle suite, there are 1,378 checks, plus nine pacing scenarios.
- Real WebGL checks use isolated headless Chrome and the actual match, physics, scene and controls. A fixture places a puck just before the far goal plane; physical crossing awards a human goal through the normal match event. The crowd raises its hands and stands, and remains animated after the goal pause and countdown return to play. This is separate from the unmodified automatic-rally performance benchmark.
- Desktop rendered paddle bounds match the 2.035 tip and longer board recess. Holding A/L extends both pairs. Score/control clearances and clickable targets pass at 1920×1080, 1280×800, 430×932 and 844×390. Reduced motion freezes the instance poses. No browser errors occurred.

## Rendered evidence

- [Idle crowd and recessed paddles](crowd-rink-idle.png)
- [Held upper and lower paddles](crowd-paddles-held.png)
- [Human goal reaction after the next drop](crowd-human-goal.png)
- [1280×800 and button vignette](crowd-layout-1280x800.png)
- [Portrait layout](crowd-layout-430x932.png)
- [Short landscape layout](crowd-layout-844x390.png)
- [Browser observations](paddles-crowd-browser.json)
- [Collision results](paddle-integrity-results.json) and [legacy-height reproduction](paddle-integrity-before.json)

`tests/browser-paddles-crowd.cjs <path-to-playwright>` instruments only its isolated browser page through request interception; no testing/cheat API is added to the shipped game. Screenshots may activate the existing protective browser-stall pause, so the test resumes explicitly after captures. The normal play and timed goal sequence run without this interruption.

## Browser performance

The unmodified automatic-rally benchmark completed 120 seconds in isolated headless Chrome 154 on the RTX 3080 Ti. At a 1920×1080 CSS viewport and DPR 1.5, the actual rink canvas was 2853×1528 pixels. All 368 spectators, reflections and shadows were enabled. Across 7,021 measured frames, the median interval was 16.7 ms and p95 was 16.8 ms, with no >100 ms stalls or browser errors. Physics p95 was 0.6 ms per frame. The run recorded 511 contacts, two human goals and no neutral restarts. See [the performance record](paddles-crowd-performance.json).

The separate post-benchmark screenshot/resize sequence initially stopped at a paused-state assertion. The capture helper was corrected to wait for the game's reported stall-pause state before toggling Escape. This did not affect the completed performance measurement. Lower-detail and narrow-layout checks are recorded separately in [the layout result](paddles-crowd-layouts.json).

This establishes behavior on the tested desktop GPU. Narrow viewport checks do not certify phone hardware, physical multi-touch or other browsers. The existing large shared-bundle warning remains in the production build.
