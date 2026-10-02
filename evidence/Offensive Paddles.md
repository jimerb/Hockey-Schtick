# Offensive paddle mechanics prototype — 0.4.3

Two short paddles are hinged into the straight far-zone boards, at matching positions just beyond the far blue line. Each is 1.85 units long and 0.16 wide, compared with the lower flippers' 4.45 length and 0.95 width. They rest along the boards, entirely behind the existing collision face. The board artwork stays intact while their mechanics are tested; small blue seams mark their resting positions.

Space is dedicated to one simultaneous upper-paddle stroke. A stroke sweeps inward toward the far goal, automatically returns to the boards in roughly 0.27 seconds, and has a 0.32-second retrigger interval. Holding Space cannot repeat strokes or keep a paddle deployed. A compact Upper Paddles button provides the same action for pointer/touch controls. Escape pauses and resumes; Play or Enter starts a match. Goals, resets, focus loss and pause clear the stroke and recess the paddles. Lower-flipper control and tuning are retained.

The puck responds through actual moving-collider contact. No attraction, auto-aim, remote impulse, extra puck, or scoring assist is used. Strike timing/contact position determine whether the puck shoots toward goal, banks, or misses. Collision shapes extend below the ice to avoid an underside trap, and the existing puck-speed limit and match recovery safeguards still apply. The practice rink does not gain upper paddles.

## Verification

- Production TypeScript/Vite build passed; the existing shared-bundle size warning remains.
- Full suite: 833 checks passed, plus nine pacing runs. Existing actor-count assertions subtract the two new paddle bodies and still require the removed lower skaters to be physically absent.
- The 43 offensive checks cover mirrored movement, automatic retraction, inactive/practice rejection, identical board glide with/without recessed paddles at three speeds and both hop settings, physical goals from both sides, no steering at a distant puck, fast traveling-puck impacts, goal/reset cancellation, and actual strokes during three full-team difficulty runs.
- Both sides can score through physical contact with flat or hopping pucks. These isolated shots exclude opponents and establish a scoring path, not a guaranteed goal against their goalie. Full-team tests exercise the paddles and retain bounded motion.
- The local server responded successfully at the game address. Browser automation failed to initialize after the reboot, so appearance, live keyboard focus, responsive placement and real touch behavior were not inspected in this run. The browser control code builds, but it still needs hands-on playtesting.

`offense-results.json` records the tuning, individual checks, shot observations and full-team results. The other regression reports were refreshed by the full suite.
