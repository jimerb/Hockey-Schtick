# Visual upgrade — 0.4.6

First fit-and-finish pass, October 2, 2026. Visual targets are the user's attached `Baseline.png` and `Current.jpg`. The baseline governs the richer hockey equipment and blue-lit polished ice; the current three-skater lineup, long rails, upper paddles and accepted controls/mechanics are retained.

## What changed

| Area | Appearance |
| --- | --- |
| Skaters | Bent knees, staggered skates and forward shoulders; a tapered jersey and wrapped waist stripe; smaller lacquered helmets with vents, cheek guards, facial features and chin straps; padded gloves, laces, skate blades, jersey numbers and a chest crest. |
| Sticks | Rectangular shafts with grip detail and thinner tapered blades, with tape kept flush to the blade. The horizontal blade footprint remains the existing one. |
| Goalie | Separate leather pad channels, knee rolls, bindings, stitch details and toe straps; shaped shoulders; blocker and catching pocket; a white mask with a curved metal cage and a dark face opening. The moving goalie stick remains separate. |
| Net | Smooth red piping, rear support rails, bindings and a woven diamond texture with transparent holes on curved back/sides and roof. The front opening remains clear. The existing invisible rear bumper physics remains. |
| Ice and materials | A physical ice material replaces the unlit surface. Skate-scuff relief and roughness affect its gloss. Studio strip reflections create camera-dependent highlights on ice, lacquer, metal and glass; longer blue-white LED spill adds the soft edge highlights seen in the baseline. This uses an environment reflection, not a live mirror of every figure. |
| Crowd | 224 seated fans with varied heights, skin/clothing/hair colors, caps and staggered spacing. Seven instanced meshes share their geometry. Gentle idle movement and occasional waves give way to raised-arm goal reactions. Distant tiers are dimmer, and a transparent off-ice veil softens the outer rows/stand edges. |
| Motion and quality | Crowd poses update at most 30 Hz, independently of 120 Hz physics. Pause freezes their pose. Reduced decorative motion returns them to a still seated pose and suppresses celebration movement. Narrow screens and lower rendering quality continue to hide the crowd. |

The original lower flipper and upper paddle geometry, controls and travel are retained. There are **no changes** to `src/physics.ts`, `src/opponents.ts`, `src/match.ts`, `src/config.ts`, or `src/flipper-input.ts`. The centered 57-degree camera and its fit logic are retained. The visual art also appears in the separate practice rink.

## Verification and limits

- Production TypeScript/Vite build passed. The existing large shared-bundle warning remains; the compressed scene bundle is approximately 1.83 MB.
- All 894 accepted gameplay/input checks passed, plus 15 new visual geometry/animation checks and nine pacing runs. The existing gameplay reports retain their results.
- New checks cover finite geometry, model height/camera clearance, drawing/triangle budgets, retained blade reach, a separately moving goalie stick, an open goal mouth, linear bump/roughness map settings, crowd density/variation, faded distant tiers, idle/goal motion, disabled-motion freezing, update throttling, reset and sustained off-ice animation bounds.
- Inspected the actual old/new model geometry with Three.js's offline SVG renderer and viewed the generated comparison. That inspection led to smaller helmets and flush blade tape. The offline renderer does **not** reproduce WebGL smooth shading, PBR gloss, textures or shadows; its image is a geometry inspection, not a screenshot of the game.
- Inspected the actual procedural ice and woven-net texture PNGs. Crowd geometry was inspected with the instances expanded for this preview only; the game retains instancing.
- CPU-only Node measurements of 300 crowd updates are recorded in `visual-upgrade-results.json`; this is not a browser FPS or GPU measurement. Models remain batched by material, and the crowd uses seven shared instance draws for its people. No live shadow maps, bloom, per-person draw calls or live mirror rendering were added.
- Restarted the local Vite server and verified HTTP 200 at `http://127.0.0.1:5173/`.
- During the intermediate art edits, the server log recorded client import errors for the former `iceTexture` export. The final scene uses `iceTextures`; the former export is also retained for in-flight refresh compatibility. A full page refresh loads the completed renderer. The final build passed; live recovery could not be observed through browser automation.
- Browser automation still fails during initialization. Live ice glare/readability, final WebGL appearance, mobile GPU cost, actual browser frame pacing and input interactions could not be inspected in this run. Earlier browser screenshots and 60 FPS reports describe the older art and do not establish this pass's performance. This is a reviewable art upgrade; production readiness remains to be judged through live play and device checks.

## Evidence

- `visual-upgrade-results.json`: geometry/animation checks and budgets.
- `visual-upgrade-model-comparison.png`: old/new offline model geometry.
- `visual-upgrade-crowd-geometry.png`: an offline section of the cheering crowd.
- `visual-upgrade-ice-texture.png`: the actual procedural diffuse map, excluding WebGL reflections.
- `visual-upgrade-net-weave.png`: the actual repeating net texture; holes are transparent.

Run `pnpm run test:visuals` for the portable geometry/animation checks. `tests/render-art.ts` can reproduce the offline preview using paths to existing `@napi-rs/canvas` and `sharp` packages as its two arguments. It obtains the old model from commit `e30ef958` and removes its own temporary source after import. The application gains no new runtime dependency or downloaded artwork.
