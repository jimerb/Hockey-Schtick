# Paddle checking — 0.3.6

Date: October 1, 2026. The accepted 0.3.5 catching/cradling, release timing, paddle rubber, stroke speed, puck slope and rebound tuning are retained.

## What the player can do

A rising paddle can check a nearby red skater out of a scramble. Use the existing left/right flipper buttons. A full body hit makes a firmer shove; a short finishing stroke makes a smaller bump. Catching just the hockey stick transfers less of the impact. The figure slides away from your end along its own rail, briefly loses its prepared play, then resumes its normal behavior. A cyan ring identifies the check and a short low thud follows its strength. Contact sounds still mute it.

The skater stays at the same horizontal position and height. The largest single shove is 0.95 rink units, under the length of a figure and stick, over 0.16–0.32 seconds. Motion eases to a stop, with a maximum initial speed below 6 units/s at the current tuning. Slot endpoints further shorten the shove. A 0.4-second per-skater contact cooldown and the fresh-contact/stroke gate prevent repeated energy from one overlap. A held or returning paddle does not check a figure. Holding a cradle remains vulnerable to the wing's actual stick; checking requires a powered stroke that makes contact.

## Contact and behavior

The rails and paddles use kinematic bodies, so the ordinary solver does not push one out of the other's way. The response therefore queries their existing collision shapes through the actual 120 Hz stroke, with eight angular intervals and interpolated skater motion. It uses the contact surface and the paddle's speed at that contact point to measure the hit. Only contact pushing toward the far end counts; distant figures and very slow touches cannot trigger it. Body and stick shapes keep their existing dimensions. The response does not add velocity to, attach, or steer the puck.

The bounded displacement is applied during subsequent normal physics steps, with matching render poses. It cancels the checked skater's windup/swing, clears his attacking/receiving assignment, and temporarily reserves his movement for the shove. The rest of the team and puck keep playing. Round and match resets clear the contact and shove state. Checking is enabled in the current match and disabled in the preserved historical hard-flipper comparison fixtures and the separate stage-2 practice rink.

`MATCH_CHECK_TUNING` holds the experiment's limits. `Opponents.onCheck` reports actual checks for the sound and performance capture. No new package, input binding, external AI, or image is required.

## Verification

`pnpm test` passes 731 checks plus nine historical two-minute pacing scenarios. `pnpm build` passes TypeScript and builds both match and practice pages. The pre-existing large shared Rapier/Three bundle warning remains.

The 30 new checking checks cover real mirrored body contacts, short/full strokes, stick hits, smooth physical rail displacement, interrupted plays and recovery, slot-end clamping, sustained contact, held/returning paddles, unreachable figures, disabled checking, reset cleanup, repeatability, and no direct kick to a remote puck. Isolated body fixtures move 0.897 units on a full stroke versus 0.528 on a short finishing stroke; the stick-only fixture moves 0.449 units. These use the actual Rapier shapes and normal flipper motion.

Six two-minute full-team scramble simulations cover all three difficulty levels with flat and hopping pucks. They record 6–13 checks per run, with no off-rail movement, escaped puck, or neutral restart. The largest sampled live shove is 0.872 units. These are deliberately frequent input sequences for exercising collisions, not an optimal human strategy.

All 111 accepted paddle-control checks still pass, including physical cradling, release timing, aiming, natural goals, low hops, and the ability of an actual wing to contest a stationary cradle. The existing opening, rear-bumper, match and practice checks also pass.

Current numerical evidence: `checking-results.json`, `flipper-control-results.json`, `match-results.json`, `play-tuning-results.json`, `physics-results.json`, and `pacing-after.json`. Browser evidence is recorded separately in `checking-browser.json` and `checking-browser.jpg`. Automated cases verify bounded behavior; the amount of space and the sound's feel remain human playtest decisions.

## Browser run

The in-app browser completed the normal-difficulty, flat-puck catch-and-shoot run for 120 seconds at the normal render resolution (958 × 756, viewport 1280 × 720) on the NVIDIA RTX 3080 Ti. It recorded two real checks, nine catches and nine release attempts, 263 puck contacts, and zero neutral restarts or animation stalls over 100 ms. Frame median was 16.7 ms and p95 was 16.8 ms; physics CPU time p95 was 0.5 ms per frame. The first sampled check was a right-wing stick contact that produced a 0.537-unit shove. Audio was running with contact sounds enabled, and two check sounds were scheduled. This verifies audio dispatch, not a subjective listening evaluation.

The demo finished 0–5 and remains a technique/performance exercise, not an optimal aiming controller. Its controls use the same real flippers as the human player; no figures or scoring pucks were injected. The saved screenshot shows the current rink and instructions during this run. Afterwards the game was returned to fresh 0–0 setup for the user's playtest. These performance numbers describe this browser/device; they do not establish laptop or cross-browser performance.
