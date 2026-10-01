# Extended wing travel — version 0.3.3

October 1, 2026. After removing the two lower skaters, the player requested that the two remaining side skaters travel through the former lower pair's range. Their changing positions should create opportunities to shoot past them. The center player and the existing rink artwork are preserved for this gameplay experiment.

## Behavior

- Side skaters retain fixed horizontal columns at x = −2.8 and +2.8. Their travel now spans z = −5.9 through +4.9, the old lower endpoints. Center travel remains −3.25 through +0.25. The near flipper pivots remain at +6.35.
- Each side skater alternates destinations in the near and far quarters of its range, choosing different positions and brief rests. The existing mechanical slide/rest rhythm and difficulty movement speeds remain. Puck pursuit, receiving, and actual contact swings take priority.
- Roaming uses a separate seeded random sequence, so movement choices do not consume the shot-selection sequence. Replays remain deterministic. No randomness is added to puck rebounds.
- Extended travel permits passes only to a teammate already ahead of the puck. One committed attacker, visible windups, real-contact strike assistance, and the cutoff on deliberate shots near the flippers remain.
- The former lower pair stays absent physically. There are three skaters and a goalie, with no additional invisible defenders. All five old slot markings remain: figures temporarily cross their unmarked gaps. No scene or background assets changed.
- In `src/config.ts`, disable `MATCH_EXTENDED_WINGS` to restore the upper-only three-skater test. Changing `MATCH_SKATERS` to five restores the original separate lanes and disables extension automatically. Stage-2 practice stays as before.

## Validation

The production build passes. The test suites pass 295 physics checks and 265 match checks, plus the retained nine five-skater pacing scenarios. The new six two-minute extended-wing scenarios exercise Easy, Normal, and Hard with flat/hopping pucks. All stay contained with zero neutral restarts, at most one committed attacker, bounded movement, and actual contact for every directed strike. They record 8–15 directed CPU shots and 36–73 flipper returns per run. Goals occur for both sides across the scenarios; these seeded automatic controls do not establish human difficulty balance.

An isolated 20-second physical movement case with an unreachable stationary puck verifies that each wing visits the old lower region and returns. Observed ranges were −4.78 to +4.47 on the left and −5.67 to +4.44 on the right. It also confirms distinct timing, brief rests, unchanged center limits, and unchanged slot artwork. Separate lower-lane fixtures verify a contact-gated forward shot from each side. Full match observations and check results are in `match-results.json`.

The browser check and screenshot are recorded in `extended-wings-browser.json` and `extended-wings-browser.jpg`. Recorded live poses show both wings reaching the lower half. The screenshot shows them at different depths after resuming. The automatic play run was stopped after 13.31 seconds: median/p95 animation intervals were 16.7/16.8 ms, with zero stalls over 100 ms and zero neutral restarts. These figures describe only that short verification, not a completed 120-second performance benchmark. The preview is left at a fresh 0–0 setup.

Human playtesting still needs to establish whether the moving side players leave satisfying aiming windows without crowding the flippers. The rink lines can be joined after the travel behavior is accepted.
