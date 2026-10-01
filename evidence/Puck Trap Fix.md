# Puck trap fix — 0.4.1

The reported symptom was a puck apparently stuck between a skater's feet, with the player repeatedly preparing a shot without releasing it.

## Cause and correction

A repeatable physics fixture placed the puck in a deep overlap with a moving skater's torso. With the original shape, a hopping puck was pushed under the torso against the ice and remained trapped for the full ten-second observation. The figure could carry it along its rail and jitter it at the endpoint. The previous stationary watchdog reset on speed above 0.28 units/s, even when the puck made no useful progress. This reproduces the reported failure pattern; the exact user's rally was not available to replay.

The ice-level skater body/blade and goalie pad/blade shapes now extend below the ice. Their top surfaces and horizontal footprints stay the same. This removes the exposed underside that could pin the disk; visual models, restitution, flipper geometry, paddle rubber, opening tuning, checks, and AI speeds remain unchanged.

As a separate safeguard, the match measures sustained contact with each skater or goalie, independently of absolute puck speed. Two seconds of contact causes a whistle and neutral drop, with no point awarded. Gaps of up to 0.2 seconds tolerate intermittent contact jitter; a clearly separated puck clears the timer, and a restart requires actual contact. Match setup and every drop clear this tracking.

The stationary watchdog now watches position rather than speed. It retains the 3.5-second settling allowance across the playable rink and exempts a genuine held paddle cradle. A stationary puck behind the bats gets a faster 1.25-second restart, because that area cannot support an aimed shot. Long-rally tests found those two apron wedges after the collision trajectories changed. The accepted guide and flipper shapes were retained.

## Regression coverage

`tests/stuck-puck.ts` has 46 checks using the actual Rapier engine:

- 16 isolated deep overlaps: three bodies, three blades, goalie pad and goalie blade, each with hops on and off. Penetration resolves within 0.43 seconds.
- 18 moving-skater cases: all three skaters, all difficulty levels, flat and hopping pucks. The corrected shapes free the puck without a restart.
- Nine safety fixtures deliberately restore the old faulty torso shape. The puck really is carried/jittered by the figure; all cases receive an `actor-pin` whistle at two seconds without changing the score. Peak speeds exceed the old watchdog threshold. A rematch clears the tracking.
- One stationary jitter case verifies that nonzero velocity cannot indefinitely defer recovery.
- Two apron-wedge cases reproduce the unreachable positions found by the long-rally runs and verify prompt, score-neutral recovery.

The existing catch/release/aim, checking, opening, rear-bumper and high-speed impact suites remain part of `pnpm test`. The physical bank-goal replay uses seed 3 for the corrected collision geometry; it still requires an actual flipper return, board contact and goal against the full team. Recovery events carry a reason so rally tests distinguish a wedge from a containment fault.

Numerical evidence is in `stuck-puck-results.json` and the refreshed existing reports. These are finite deterministic tests, not a claim that every possible collision has been enumerated.

## Final verification

- Production TypeScript check and Vite build passed. The existing large shared-bundle warning remains.
- All 790 checks passed, plus all nine two-minute pacing scenarios. The 111 flipper-control checks continue to cover physical catches, holds, release aiming and full-team play.
- A completed 120-second in-app Chromium rally with low hops enabled recorded 517 contacts, 16 assisted strikes, three checks, two player goals and one neutral restart. Frame intervals were 16.7 ms median / 16.8 ms p95, with no stalls over 100 ms. Physics work was 0.5 ms p95 per frame on the tested RTX 3080 Ti. No browser console errors were recorded.
- `stuck-puck-browser.json` contains the browser measurement. The game was returned to a fresh match with the original flat-puck preference restored; `stuck-puck-ready.png` records that final screen.
