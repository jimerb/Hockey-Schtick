# Flipper cradle tuning — 0.3.5

October 1, 2026. The user requested pinball-style control: cushion an arriving puck, hold it in a raised paddle's heel, release it to slide toward the tip, and press again to choose a shot angle. The puck should remain vulnerable to opponents.

## Implementation and play

Hold A or L before a manageable puck arrives. The raised paddle dissipates more collision energy, and the downhill force lets the puck settle against its heel guide. Release the key and let the puck slide inward, then press again at a chosen point. Earlier and later presses can produce different angles; an overlong release can drain the puck. Hard arrivals and glancing hits are not guaranteed catches.

The rubber feel uses restitution 0.12 on a held raised bat, 0.30 on a resting/returning bat, and the previous 0.94 during a powered rising stroke. Surface friction is 0.20 while cushioning and the previous 0.05 while striking. Original stroke speeds and key timing remain. This is a contact-material approximation of give, rather than a deforming rubber mesh or an articulated spring model. The puck is not attached, teleported, stopped by script, or aimed automatically.

Softening alone exposed a trap: a puck settled against the circular hinge could stay there even after the bat dropped. Two small cushioned heel guides now keep that settling point on the moving shaft. They are visible in the same place as their collision polygons. Slots, rink artwork, camera, opening aim, rear body bumpers, side/stick response, and extended wing endpoints remain. The original stage-2 practice fixture is preserved separately.

The stuck-puck guard recognizes a slow puck in actual contact with the front of a fully raised, held bat. That deliberate cradle resets the wedge timer. Letting go removes the exception immediately; holding a key does not exempt an unrelated stationary puck elsewhere.

The extended wings can pursue a reachable held puck up to the existing end of their lanes, sweeping and withdrawing their blades. They gain no assisted point-blank shot: only physical blade motion can contest that lower area. This keeps a cradle available for an opponent to disturb rather than granting possession or immunity.

The source inspiration is the cradle, drop/catch, and release-to-shot behavior described in [MAYA Pinball's flipper skills guide](https://mayapinball.com/blog/flipper-skills-guide/), especially its descriptions of energy absorption, micro flips, and releasing a trapped ball toward the tip. The ice puck model remains a game-specific approximation of those skills.

## Verification

All required suites pass: **295 physics + 265 match + 30 opening/body + 111 flipper-control = 701 checks**, plus nine historical speed-pacing runs. The TypeScript and Vite production build passes. Reports: `physics-results.json`, `match-results.json`, `play-tuning-results.json`, `flipper-control-results.json`, and `pacing-after.json`.

The 111 control checks include:

- Four real-impact comparisons on held flippers. In the flat-puck 6-unit incoming fixture, horizontal rebound speed drops from about 5.68 to 2.82, while retaining tangential motion.
- Twelve settling fixtures across both paddles, three approach columns, and flat/hopping pucks. They reach a physical cradle and remain there during a further five-second hold.
- Real release onto the shaft, draining after an overlong release, and deliberately timed shots from both cradles that physically enter the far goal.
- Early/late shot comparisons: releasing for 0.50 versus 0.75 seconds changes the outgoing angle by about 23 degrees on a flat puck and 17 degrees with hops. These are particular fixtures, not universal timing instructions or automatic aim correction.
- Actual contact checks, reproducible control sequences, and no effect from pressing at a distant puck. Ongoing flipper contact is checked directly as well as through solver contacts, because a release-and-strike need not create a new collision-start event.
- No whistle for a deliberate held cradle, immediate loss of that protection on release, and recovery for an unrelated stationary puck despite held keys.
- Both a moving physical opponent blade and the actual wing pursuit/sweep logic dislodging a held puck. The latter requires real contact and preserves zero assisted strikes in the near area.
- Seventy-two fast flipper impact cases at speeds 8/20/35, both paddles, raised/resting states, three shaft locations, and flat/hopping pucks.
- Six two-minute catch-and-shoot runs with the full team, all difficulties, and both hop settings. Every case catches and attempts released shots, with no faults or neutral wedge restart. The demonstration follows fixed timing and is not an optimal player; its score does not establish human balance.

The existing eighteen full-rally cases also run current tuning. Some reactive-tap cases still encounter true stationary wedges, which the existing whistle handles without awarding a point. Intentional cradles are tested separately. Earlier versioned notes retain their original observations; refreshed result files describe this version.

## Browser evidence

`flipper-cradle-browser.json` records a short Normal/seed-1024 demonstration on the final build, intentionally stopped before the 120-second limit. It uses only flipper inputs: full opponents remain active, the puck starts with the regular neutral drop, and no scoring puck or goal is injected. Read-only telemetry and `flipper-cradle-browser.jpg` show the puck supported on a raised paddle, with the UI indicating a cradle.

The final capture lasted 110.82 seconds, with eight catches and seven release attempts. It recorded 6,468 timing frames after warm-up, 16.7 ms median / 16.8 ms p95 frame intervals, 0.5 ms p95 physics CPU time per frame, no stalls over 100 ms, and no neutral restart. The fixed-timing demo conceded eight goals across one completed match and a rematch; it is a technique demonstration rather than an aiming opponent. Isolated physical shot fixtures and the separate full-team bank-goal test establish that aimed returns can score.

The browser is Chromium 154 on Windows with an NVIDIA RTX 3080 Ti, viewport 1280 × 720, and render resolution 958 × 756. Measured duration, frame intervals, catches, release attempts, and restarts are recorded directly in the JSON. This desktop check does not establish low-end device performance, exact real-pinball fidelity, or how much aiming practice a person needs. The game is returned to fresh 0–0 setup after verification.
