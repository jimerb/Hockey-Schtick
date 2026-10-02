# Visual finish — 0.4.7

The 0.4.6 image showed washed-out rink markings, a domed net and figures made from visibly separate rounded parts. This revision was evaluated with real WebGL screenshots, including closeups, rather than the earlier geometry-only SVG previews.

## Appearance

- **Ice:** opaque saturated markings, stronger skate scuffs, a cooler blue surface, restrained clearcoat and a softened planar reflection of the players, flippers, net and boards. The reflection is blended at 10% so the lines and puck remain readable. A 512 × 768 render target bounds its cost; spectators are excluded from that extra pass.
- **Lighting:** a 2048 × 2048 directional shadow map anchors the skaters, goalie and net to the ice. The mesh casts a patterned shadow inside and around the goal. Environment fill is lower to preserve color and form.
- **Camera:** elevation is 47°, down ten degrees from 0.4.6. The existing fit calculation still includes the entire cabinet and glass.
- **Skaters:** continuous curved sleeves and a contoured jersey replace the separated shoulder/elbow balls. Double cream stripes, red hockey pants, staggered feet, layered gloves, a fitted helmet with vents and slimmer wood/composite sticks follow the supplied reference more closely. These remain stylized tabletop figures.
- **Goalie and net:** angled separate leather pads, jersey sleeves, a visible face behind the mask, and a stick connected to the blocker. The rounded rectangular mouth and sloped rectangular upper frame replace the dome. The existing D-shaped floor bumper and scoring opening are retained.
- **Crowd:** retains the 224 varied, animated spectators and faded outer tiers. Reduced-motion behavior is retained. Lower graphics detail disables the crowd, planar reflections and shadow mapping as well as reducing pixel resolution.

## Verification

- TypeScript/Vite production build passed. The pre-existing shared-bundle size warning remains (about 1.84 MB gzip, including the physics engine).
- 894 gameplay/input regression checks, 16 visual geometry/animation checks, and nine pacing scenarios passed. A new batching regression confirms translated/rotated roots are preserved; this fixes a doubled visual offset on the independently moving goalie stick.
- No changes to puck physics, opponents, match logic, collision configuration or input routing. Live browser checks also verified that A and L hold only their own upper/lower pairs.
- Inspected real WebGL game views, closeups of both figures and the net, the lower-detail rendering path and a 430 × 932 viewport. The rink remains visible with reachable controls. Resizing/capturing can trigger the existing protective stall pause; resuming after resize is checked separately.
- The full 120-second automatic rally benchmark completed in isolated headless Chrome 154 on the NVIDIA RTX 3080 Ti at **1920 × 1080 CSS pixels, DPR 1.5 (2880 × 1620 rendered)**. 7,021 measured frames: **16.7 ms median, 16.8 ms p95**, no >100 ms stalls, no browser errors, physics p95 **0.5 ms/frame**, 472 contacts and no neutral restarts. See `browser-finish-performance.json`.
- The benchmark captured the art while its version label still said 0.4.6. Subsequent 0.4.7 edits changed labels, graphics-option wording, diagnostics and selected PCF shadow filtering explicitly (the installed Three.js already fell back to it). The model/lighting/reflection settings tested are the final settings. The GPU compiler reports small floating-point precision warnings in generated shaders; no shader compile or browser errors occurred.
- The benchmark establishes desktop performance on this GPU. The narrow viewport check is not a phone GPU test; other devices and browsers have not been performance-certified.

## Rendered evidence

- [Game view](browser-finish-desktop.png)
- [Skater closeup](browser-skater.png)
- [Goalie closeup](browser-goalie.png)
- [Net and shadow closeup](browser-net.png)
- [Lower detail](browser-finish-reduced.png)
- [Narrow layout](browser-finish-mobile.png)
- [Browser layout/input results](browser-finish-layouts.json)

`tests/browser-finish.cjs <path-to-playwright>` runs the timed GPU test and layout check. Add `--layouts` to exercise paired input and layouts without repeating the timed run. `tests/capture-art.cjs <path-to-playwright>` captures WebGL closeups in a separate scene using the game's renderer and lighting. These developer scripts launch an isolated headless Chrome profile and do not attach to personal browser windows. No runtime dependency was added.
