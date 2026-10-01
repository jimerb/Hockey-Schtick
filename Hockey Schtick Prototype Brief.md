# Hockey Schtick Prototype Brief

**Stage 1 — September 30, 2026**

The next deliverable is a playable browser test rink that proves saving and deliberately shooting a puck feels good. Start with simple 3D objects in mockup four’s layout, then add a hockey match once the controls and collisions work.

This brief makes the initial development decisions. It accompanies the [Gameplay Overview](https://chatgpt.com/space/page_9f90f191c8c08191a9de131c8eccd2ba); that overview remains the source for the eventual five-skater, first-to-seven game. This stage creates the brief only. Implementation and measured results follow in Stage 2.

## Decisions for the first build

| Area | Decision |
| --- | --- |
| Presentation | Real 3D rink; fixed elevated camera centered behind the defending end; full rink visible. |
| Visual direction | Mockup four: straight slots, red figures, blue LED boards, broad flippers, clear foreground. |
| Primary platform | Desktop and laptop browsers with physical keyboards. Develop and verify in current Chrome and Edge on Windows first. |
| Controls | A for left flipper and L for right flipper on a standard QWERTY keyboard; remapping included. |
| Development | TypeScript, Three.js with its WebGL 2 renderer, Rapier 3D physics, and Vite. |
| Motion | Slippery puck, weak continuous pull toward the player, and optional restrained physical hops for comparison. |
| Rear goal | Rounded rear base pipe provides lively, angle-based rebounds; space behind it is inaccessible. |
| Initial opponents | One moving test-stick fixture for collision checks; no autonomous team in the first test rink. |
| Match after the test rink | Five constrained skaters, one goalie, short readable attacks, first to seven goals. |
| Performance | Target steady 60 FPS with responsive controls; prove it on recorded test devices. |

These are working defaults. Physics values and the choice of physics library remain subject to the tests below. Mobile, gamepad, and mouse support can follow after keyboard play works.

## What the player does

1. Open the prototype link and wait for the rink to load.
2. See a compact control legend and press **Start Test**.
3. Receive repeatable feeds from up the rink. Press either flipper key to save and return the puck.
4. Try different timings to aim through the middle or bank off either side.
5. Use **Feed Puck** to repeat a shot and **Reset Rink** to restore the starting setup. These are test-rink controls, not match rules.
6. Open **Controls** to remap the two flippers. Press **Escape** or the Pause button to pause.

The test rink has no winner or leaderboard. A simple “Goal” or “Conceded” cue confirms scoring boundaries, followed by another feed. It exists to judge control and motion before an opponent adds difficulty.

## Keyboard behavior

A key press starts the corresponding flipper’s upward stroke; holding it keeps the flipper raised; releasing it returns the flipper. Both keys can be pressed and held independently. A strike transfers motion through contact with the puck rather than firing a preset shot.

Treat keys as held or released. Keyboard auto-repeat must not create extra strikes. Apply input on the next physics update, and release both flippers whenever play pauses or loses focus.

Remapping should show **Left flipper** and **Right flipper**, accept one physical key for each, reject duplicate assignments, and offer **Restore Defaults**. Save mappings locally in that browser. Display the actual key labels, so a different keyboard layout does not show misleading QWERTY names.

Allow separate left and right Shift keys as an alternative when the tested browser distinguishes them. Avoid Alt and operating-system shortcut combinations as defaults. Repeated Shift presses can trigger Windows Sticky Keys when its shortcut is enabled; the game should not require changing accessibility settings. [Microsoft accessibility shortcuts](https://support.microsoft.com/en-us/accessibility/windows/windows-keyboard-shortcuts-for-accessibility).

When a settings field has focus, flipper bindings should not interfere with editing. Pause on tab switching or focus loss, then require an explicit Resume followed by a short ready cue.

## What Stage 2 includes

Build one rink, two flippers, one puck, both scoring boundaries, and the far goal’s rounded base. Use repeatable center and angled feeds. Include a simple sliding and rotating stick fixture that can be enabled for fast-contact tests.

Keep the complete rink and flippers visible at a normal laptop window size. On a wide screen, center the tall rink with spare space beside it. Preserve its proportions rather than stretching or cropping it.

Use simple geometry and materials with recognizable ice, boards, slots, and blue perimeter lights. The generated hero image is a visual reference; it is not a substitute for the playable 3D scene. Finished figures, rich reflections, and elaborate effects belong later.

Keep puck and collision geometry consistent with what is visible. The puck cannot pass through a flipper, a stick, or the goal’s base because it moved quickly between frames.

Test flat motion first, then enable low physical hops after strong contacts. A hop changes the puck’s actual position and collisions, with a clear shadow beneath it. Limit it so it cannot clear the blocking height of sticks or flippers. Higher airborne shots remain outside this prototype.

The rear base pipe redirects according to its curved surface and the incoming angle. Start with an ordinary lively rebound; add a modest contact-triggered speed boost only if needed. Do not randomize its direction. Close rear gaps visibly in the geometry, including potential landing spaces for low hops.

A goal requires the whole puck to cross the goal line between its boundaries. Count it once and end that rally before another contact can bounce it out. The near end retains flipper coverage and accessible return corners, without side drains bypassing both flippers.

## Development approach

Use **TypeScript with a plain browser interface**. Keep menus and the control legend in ordinary HTML and CSS, and the rink inside one rendering canvas. This small interface does not need a larger UI framework.

Use **Three.js** for the scene, camera, materials, lights, and displayed motion. Its WebGL renderer requires WebGL 2. Check that capability before starting and show a useful unsupported-graphics message if it is absent. [Three.js renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html).

Use **Rapier 3D as the first physics candidate**. The puck is a dynamic body; boards and the goal base are fixed; flippers and the test stick have controlled movement. Use simple collision shapes that match their effective visible outlines. Rapier documents controlled kinematic bodies and continuous collision detection, but these features still need testing with our fast puck and rotating flippers. [Rapier rigid-body documentation](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/).

Start physics at a fixed **120 updates per second**, independently of drawing. Interpolate displayed positions between physics updates. Draw through the browser’s animation cycle, which can follow different display refresh rates. [MDN animation timing](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

Cap catch-up work after a long stall. If the simulation cannot keep up, pause and recover instead of jumping the puck forward or silently skipping contacts. Changing graphics quality must not change game speed or physical rules.

Use **Vite** for local development and a static browser build. Pin compatible dependency versions and retain the lockfile when implementation starts. No game server or external decision model is needed for this test rink. [Vite guide](https://vite.dev/guide/).

Separate controls, physics, rendering, rink dimensions, and later opponent behavior so each can be tuned without rebuilding the others. Keep development measurements out of the normal player interface.

## Starting performance budget

Test at a **1280 × 720 browser content viewport** on a recorded desktop and a laptop with integrated graphics when available. The laptop result is required before claiming laptop smoothness; a fast desktop alone cannot establish it.

Begin at a capped rendering resolution, with one restrained lighting setup, simple puck shadows, and blue LEDs represented mainly by glowing materials. Avoid numerous shadow-casting point lights, live mirror-like ice reflections, and heavy glow effects in the first build.

Use a two-minute active test with repeated feeds, both flippers, the moving stick fixture, bank shots, and goal cues. After loading and warm-up, aim for a median frame interval near **16.7 ms**, a 95th percentile no worse than **25 ms**, and no recurring stalls over **100 ms**. These are prototype acceptance targets, not measured results.

Record frame pacing, physics time, rendering resolution, browser, device, and graphics settings. If the target fails, simplify lighting or resolution first and rerun the same test. Check input handling and collisions under a deliberately reduced draw rate as well.

Before the later complete match is accepted, repeat this check with all five skaters, the goalie, and celebrations active. Firefox and Safari need separate verification before broader compatibility claims; phone performance is a later milestone.

## Checks before adding opponents

| Check | Required evidence |
| --- | --- |
| Flipper control | Tap, hold, release, simultaneous presses, remapping, pause, and focus loss work without stuck input. Input is applied on the next physics update. |
| Aimed returns | With repeatable incoming feeds, timing produces distinguishable center, left-bank, and right-bank shots. A human tester can intentionally repeat those choices. |
| Tilt and ice feel | A strong shot reaches the far end; a slow unreachable puck returns toward playable space without frequent recovery resets. |
| Fast collisions | Run at least 200 targeted impacts across both flippers, the moving stick, boards, and base pipe. No observed tunneling, escaped puck, or duplicate goal. Include grazing and simultaneous moving contacts. |
| Rear goal | Angled approaches from both sides rebound out; low hops cannot enter the rear pocket; goals count before any return impulse. |
| Low hops | Compare with flat motion. Keep hops only if they remain readable, defensible, and consistent with visible contact. |
| Browser behavior | Current Chrome and Edge checks, resize, pause/resume, tab switching, and startup failure states are recorded. |
| Smoothness | Active frame-pacing results meet the stated target on each device being claimed as supported. |

A finite test set is evidence for those cases, not proof of every possible collision. Record failures, tune geometry or simulation settings, and repeat affected checks.

If Rapier cannot deliver reliable fast moving contacts within the performance budget, stop adding features and address that decision directly: adjust its configuration and collider approach first, then evaluate a simpler dedicated puck-and-flipper collision model if necessary.

## Build order and completion

1. **Foundation:** Browser shell, fixed camera, simple rink, physical-key controls, pause, and remapping.
2. **Contact test:** Puck, flippers, moving stick fixture, boards, and both scoring boundaries.
3. **Motion and recovery:** Gentle pull, goal-base rebounds, closed dead space, and flat-versus-hop comparison.
4. **Verification:** Repeatable feeds, collision checks, frame measurements, and a hands-on aiming session.
5. **Following stage:** Add one autonomous skater and goalie, then the full constrained team and first-to-seven match.
6. **Visual finish:** Refine toward mockup four and recheck performance with finished assets.

The Stage 2 handoff should contain a runnable local prototype, launch instructions, the chosen tuning values, test evidence, and a short list of remaining gameplay questions. Include a screenshot or recording of the playable scene. A successful code build alone does not establish that it feels good.

Defer timed matches, multiple difficulty levels, power-play events, leaderboards, multiplayer, external AI services, and polished character assets until the basic rally works. Basic contact sounds and a restrained goal cue are useful in the test rink.

**Stage 1 is complete when this brief is saved and checked against the gameplay overview.** The next authorized development step can use it directly; no further design questionnaire is needed. Browser smoothness, collision reliability, aiming quality, and the final hop settings remain unverified until the playable tests run.

