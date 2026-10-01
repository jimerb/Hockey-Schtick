# Stage 3 validation — Hockey Match

This report preserves the original **0.3.0 baseline**. The September 30 playtest tuning in version 0.3.1 changes puck motion, opponent behavior, and the lower return guides. See `Playtest Tuning.md` for the current measurements; the older timings and match lengths below should not be treated as current tuning results.

Validated September 30, 2026, in the local Windows workspace. This report distinguishes test evidence from playtest decisions. Original source images, selected mockup four, gameplay overview, and prototype brief were preserved.

## Automated simulation and build

`pnpm test` passed **532 checks**: 295 preserved puck/flipper checks and 237 new match/opponent checks. `pnpm build` passed TypeScript checking and generated both the match page and practice page. The existing large-bundle warning remains; the shared Three/Rapier compat bundle is about 1.82 MB compressed.

The actual Rapier world was exercised, including:

- Both possible winners at seven, 7–6 without win-by-two, single-count goals, frozen final state, new-match setup, and clean rematches.
- Equal center drops after either scorer; first touch is a controlled pass or push in the full team. The one-skater slice also produces a real shot.
- Five fixed horizontal positions, bounded longitudinal slots, bounded travel speeds, one committed windup/swing at a time, and strike cooldowns.
- Goalie observation delay, bounded lateral travel/speed, and identical goalie responses with different flipper inputs when those flippers cannot affect the puck.
- Actual blade contact required for every assisted strike, no remote shot after the puck leaves reach, bounded strike speed, and an actual visible slow-puck goalie clear.
- Six two-minute runs across Easy/Normal/Hard with flat and hopping pucks; repeatable seeded outcomes; a real flipper bank goal against the full team.
- **216 opponent impact cases** at speeds 8, 20, and 35, with centered/offset contacts and flat/hopping motion, targeting all five skater bodies/blades and the goalie pad/blade. Individual footprints were isolated for these impact tests; the six full-team runs exercise moving interactions.
- Two unattended matches, seeds 1 and 42, reaching seven through ordinary physics and opponent play. They took about 194 and 186 simulated seconds including stoppages. Their active play took about 176 and 169 seconds. Neither required a forced goal or an out-of-play reset.
- Neutral recovery for an escaped or stationary puck, and uninterrupted drift for a slow puck returning down the slope.

Reports: `physics-results.json` and `match-results.json`. `stage-2-physics-baseline.json` preserves the prior report. These are finite scenarios, not exhaustive proof of every possible contact.

## Browser performance

The repeatable full-team Performance lab ran for **120 seconds**, excluding a three-second warm-up from timing samples. Five skaters and the goalie were rendered throughout; the normal game rules, local opponent logic, and automatic flipper controls were used. No scoring pucks or forced goals were injected.

| Measurement | Result |
|---|---:|
| Animation callbacks measured | 7,021 |
| Median / p95 animation interval | 16.7 / 16.8 ms |
| Median / p95 actual draw interval | 16.7 / 16.8 ms |
| Animation stalls over 100 ms | 0 |
| p95 physics CPU time per frame | 0.3 ms |
| Puck contacts | 231 |
| Assisted CPU strikes during the run | 15 |
| Goals / concessions | 0 / 2 |
| Neutral restarts | 0 |

Settings: Normal; seed 1024; five skaters plus goalie; flat puck; normal rendering; 120 Hz physics; 1280 × 720 browser viewport; 638 × 503 drawing buffer; reported device-pixel ratio approximately 1. GPU: NVIDIA GeForce RTX 3080 Ti through ANGLE/D3D11. In-app Chromium reported Chrome 154.0.0.0 on Windows NT 10.0.

Saved raw report: `stage-3-performance-desktop-60.json`. The earlier unseeded run also measured 16.7/16.8 ms, no long stalls, and three completed matches, but mostly used straight opening pushes. It is preserved as `stage-3-performance-initial-60.json`; the repeatable run adds passing/return contact coverage. Later UI refinements added new-match setup and a startup ready interval; the physics, opponent behavior, geometry, and draw workload measured here remain the same.

CPU timing does not measure GPU time. These results establish this desktop configuration only. Integrated-GPU laptop performance and Edge have not been verified. The 30 FPS option remains available, but no separate full-team 120-second 30 FPS claim is made in this stage.

## Browser interaction checks

The production static build was opened in the in-app browser as well as the ordinary Chrome connection. Chrome loaded the page and exercised the stall guard, but background animation was throttled and prevented a sustained live match there. Live control checks were performed in the in-app browser.

Confirmed through visible controls and read-only DOM state:

- Play, countdown, six physical figures, a slippery puck, CPU preparation, and score progression.
- Simultaneous A/L input, followed by a full return to rest; the last input was requested at tick 143 and applied at 144.
- Escape pause: puck tick, actor poses, and input states remained frozen/cleared across separate observations; explicit resume restored play.
- Duplicate key binding rejected. Z/M assigned through the modal and applied at tick 272 after request at 271. Reload retained Z/M. A/L was restored afterward.
- New match stopped an active rally, reset the scoreboard, and unlocked the difficulty selector. Easy, Hard, and Normal descriptions were checked before a fresh match.

A physical OS focus switch and real hidden-tab transition have not been independently tested in this stage; those listeners clear input and pause by implementation. The earlier stage-2 report records the same limitation. Human aiming comfort, difficulty balance, goalie strength, and flat-versus-hop preference remain playtest decisions.

## Scope

This stage implements first-to-seven against a local mechanical team. Timed modes, multiplayer, touch/gamepad controls, a leaderboard, sophisticated team AI, and deployment are outside this slice. The stage-2 practice rink is kept as a separate production entry. The dev server remains local at 127.0.0.1:5173; no public site was deployed.

Additional visible production checks confirmed the CPU winner card at 0–7, cleared inputs and stopped physics at the finish, and a rematch reset to 0–0. A repeatable negative test seed produced seven gentle pushes; it used normal goal detection rather than a forced score. Space during a live rally kept the same puck/drop. Optional hops, reduced resolution, and 30 FPS drawing ran with 120 Hz physics; the displayed draw interval reached 33.3 ms in this smoke check. Practice navigation loaded the independent stage-2 production entry and its return link. The full rink and keyboard controls fit at 570 × 593; a 1600 × 900 view was also checked. Screenshots: `stage-3-narrow.jpg`, `stage-3-wide.jpg`, and `stage-3-result.jpg`. Final-score and input snapshots are saved in `stage-3-production-match.json`.

Preview cleanup limitation: the documented in-app browser viewport reset call timed out, so restoration to the normal panel size could not be confirmed. The game tab was marked as a deliverable and opening it was queued in Codex. The temporary production server and agent-created production test tabs were closed; the main dev server at 127.0.0.1:5173 remains available. This browser-control limitation does not affect the saved source, build, or screenshots.
