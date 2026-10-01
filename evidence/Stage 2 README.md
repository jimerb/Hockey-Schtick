# Hockey Schtick — Stage 2

A local browser prototype of the puck-and-flippers loop. Two flippers defend the near gap and return shots toward the far net. The straight slots, elevated centered camera, and blue board lighting follow selected mockup four. The rink is real 3D geometry; the reference image is not used as a background.

## Play

The current local address is **http://127.0.0.1:5173/**. To restart it later, double-click **Start Game.cmd** and keep its terminal window open. The launcher opens your default browser. If another copy is already serving the game, use the same address.

1. Select **Start test**.
2. **A** controls the left flipper; **L** controls the right. Tap for a quick stroke, hold to keep it raised, and release to return it. Both can work together.
3. **Space** feeds another puck. Pick Center, Left, or Right to repeat a feed. The game also feeds again after a goal or concession.
4. **Escape** pauses. **Change keys** supports letters, arrows, and separate left/right Shift bindings. Assignments persist locally; duplicate assignments are rejected.
5. Compare **Low puck hops** with the flat default. **Moving stick fixture** adds a mechanical sliding and rotating blade in the center slot.

Focus loss and hidden tabs pause play and clear input. Resume is explicit, with a short ready cue. Controls remain accessible in a narrow browser panel, but this is a physical-keyboard prototype, not a touch game.

## What is implemented

- Slippery puck motion, a gentle continuous pull toward your end, bank shots, and rounded rink corners.
- Two motor-driven flippers with rounded collision shapes that match the visible outline. The hinge stays at the metal pin.
- Fixed 120 Hz Rapier simulation with continuous collision detection and interpolation between physics states. Lowering render resolution or choosing 30 FPS rendering does not change the physics settings.
- A far goal that counts only when the whole puck crosses inside the posts. The rally ends immediately, preventing duplicate goals or a scored puck rebounding back into play.
- Rounded rear-base pipe contact with geometry-driven angles. Visible solid shoulders close the dead space between the frame and rear boards. No random steering or artificial bumper speed boost is applied.
- Small physical hops with a grounded puck shadow. These are kept below the height of blocking surfaces.
- Repeatable feeds, rally counters, basic synthesized contact sounds, reset, pause, key remapping, and local performance capture/download.

The five straight slots are visual references. There are **no autonomous skaters, goalie, match winner, or leaderboard** in this stage. The moving center fixture is a collision test object, not an opponent.

## Current tuning

These are game-world units, not a scale model of real rink dimensions or a measured physical table slope. Values live in `src/config.ts`.

| Item | Current value |
|---|---|
| Rink | 10.8 wide × 18 long; rounded corners |
| Puck | Radius 0.27; thickness 0.21 |
| Flippers | Hinge-to-tip reach 4.45; width 0.95 |
| Stroke | Rest +0.32 radians; raised −0.48 radians |
| Motor | Raise 10.5 rad/s; return 5.8 rad/s |
| Short tap | Minimum 10 physics ticks (about 83 ms) of activation; auto-repeat does not retrigger it |
| Downhill acceleration | 0.85 toward the near end |
| Horizontal damping | 0.055 |
| Contact restitution | 0.86; ice restitution 0 |
| Horizontal speed ceiling | 40 |
| Optional hop | Upward speed 1.65; vertical gravity 16; impact cooldown |
| Physics | 120 Hz, 8 solver iterations, up to 4 CCD substeps |
| Render | Normally every animation frame; device-pixel ratio capped at 1.5 |

An untouched center feed can fall through the center gap. A well-timed stroke can intercept it as the flipper sweeps across the middle; leaving a flipper raised is not an automatic save. Current feeds take roughly a second to approach the flippers, which provides a useful timing exercise before opponents are introduced.

## Verification and remaining decisions

`pnpm test` exercises the actual Rapier simulation. Its complete report is saved to `evidence/physics-results.json`.

The current suite includes **284 targeted fast-impact scenarios**, split between flat motion and hops, across both flippers, the moving blade, side boards, and rear base. It includes shallow board grazes and simultaneous moving-flipper contacts, and checks recorded contacts, returns, containment, and relevant rebound behavior. All **295 checks passed**. Additional checks cover independent hold/release, downhill return, a post graze, single-count scoring/concessions, reproducibility, and center/left-bank/right-bank scoring from the same feed. These are finite scenarios, not a guarantee for every possible collision.

The Performance lab measures a repeatable 120-second active browser run after a three-second warm-up. It records frame intervals, physics time per frame, contact/rally counts, rendering settings, viewport, browser, and GPU. Frames are measured from animation callbacks; physics time is CPU timing, not GPU timing. A long browser stall pauses play rather than taking a large simulation step.

See `evidence/Stage 2 Validation.md` for observed browser results and their limits. Human judgement of aiming comfort and flat-versus-hop readability is still required before expanding to opponents. Integrated-GPU laptop performance must be tested on an actual laptop. This build does not establish full-team performance.

The important next tuning decisions are flipper response and return angles, feed speed, downhill strength, and whether hops improve the feel. Once this slice feels right, stage 3 can add one constrained skater and a goalie, then expand to five skaters and first-to-seven play.

## Development

Pinned dependencies: Three.js 0.186.1, Rapier 3D compat 0.21.0, Vite 8.3.1, TypeScript 7.0.2. The pnpm lockfile is kept with the project files. Node 24 was used here. Package installation requires the registry; play requires only the local static assets, with no game server, external fonts, AI model, or network opponent.

```text
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm preview
```

`src/physics.ts` owns simulation; `src/scene.ts` owns drawing; `src/main.ts` owns controls and the test shell; `src/config.ts` owns tuning and shared geometry. `dist/` is the built static app. The compat package embeds its WebAssembly payload, so the current main bundle is large (about 1.8 MB compressed). Production loading/asset packaging can be refined after the gameplay slice is accepted.
