# Playtest tuning — version 0.3.1

The subsequent 0.3.3 side-player travel experiment is documented separately in `Extended Wing Playtest.md`. Its original speed tuning is retained.

The measurements below preserve the **five-skater speed-tuning comparison**. The later 0.3.2 layout experiment removes the two lower skaters while retaining this motion tuning. Its six two-minute three-skater simulations and open-lane collision checks are included in the current `match-results.json`; the original five-skater cases remain for restoration/regression coverage. Both difficulty sets with flat/hopping pucks passed, with zero neutral restarts in all six three-skater runs. The current browser screenshot and state are saved as `open-lanes-browser.jpg` and `open-lanes-browser.json`. Rink artwork and the empty lower slots are retained. Human aiming and difficulty balance remain the purpose of the next playtest.

September 30, 2026. The player reported lingering pucks, weak rebounds, soft strikes, and opponents that did not pursue the puck convincingly.

## Changes

- Match downhill acceleration: **0.85 → 3.2**. This is a continuous physical force, so a slow puck naturally builds speed toward the flippers. Fast shots still travel uphill; the existing speed ceiling remains 40.
- Puck damping: **0.055 → 0.025**. Puck/board/flipper restitution: **0.86 → 0.94**. Skater body/blade restitution: **0.28/0.42 → 0.72/0.90**. Goalie pad/blade restitution: **0.55/0.50 → 0.78/0.85**. Impacts retain more motion.
- Normal skater travel: **2.7 → 4** units/s; windup: **0.50 → 0.30 s**; shot: **10 → 16** units/s; pass: **5.5 → 8** units/s. Easy and Hard retain different reaction, preparation, movement, and aiming limits. Opening pushes now use firm pass strength.
- Support skaters reposition within their own straight slots. Attack cooldowns limit shooting rather than stopping pursuit. An intended receiver moves into the passing lane. Skaters estimate where a moving puck will arrive and begin preparing before it passes them.
- Gold windup cues, actual-contact strike requirements, one committed attacker, bounded travel, goalie delay, and the restriction on assisted point-blank shots remain. No minimum-speed injection, remote strike, puck attachment, or random steering was added.
- The goalie has a shorter clearing preparation and a firmer clear, still requiring actual stick contact.
- Visible angled shoulders below the flippers remove the old end-wall pockets and guide missed saves into the near opening. Rendered and physical geometry share the same vertices. Far-net geometry and the fixed camera remain as before.

The separate Stage 2 practice page keeps the original physics tuning and board geometry. The live match page displays version 0.3.1.

## Comparable action measurements

The before/after runs use the actual Rapier simulation, seeds **1, 42, and 1024**, and the same reactive automatic flipper controls as the browser Performance lab. Each run lasts 120 simulated seconds. Measurements include live rallies only; countdowns and celebrations are excluded. Slow means horizontal speed below **2 game units/s**, including the opening acceleration and the brief turning point of an uphill shot. Each row summarizes three runs of one difficulty.

| Measurement | Easy before / after | Normal before / after | Hard before / after |
|---|---:|---:|---:|
| Mean live puck speed | 7.01 / 18.01 | 7.08 / 17.30 | 7.78 / 16.84 |
| Mean percent of live time at slow speed | 15.8 / 3.2% | 16.1 / 1.7% | 9.3 / 1.5% |
| Longest continuous slow stretch | 19.07 / 1.24 s | 19.88 / 0.36 s | 2.75 / 0.88 s |
| Total flipper returns | 94 / 206 | 77 / 172 | 65 / 147 |
| Total directed CPU shots | 19 / 17 | 26 / 34 | 34 / 36 |

All nine final comparison runs had zero neutral restarts and zero escaped pucks. Easy still produces fewer deliberate shots than the higher levels; much of the livelier action comes from firmer rebounds and flipper returns. These automatic controls measure repeatable rally activity, not human aiming comfort or a difficulty ranking. A faster mean speed does not by itself establish a better game.

Raw reports: `pacing-before.json` and `pacing-after.json`. The baseline was captured before editing the tuning. `pnpm test:pacing` reruns the final nine cases and checks lingering-puck and rally-action limits.

## Regression checks

`pnpm test` passes **295 original physics checks**, **246 match checks**, and the **nine pacing scenarios**. The new match checks verify steady acceleration from a stationary side strip, a firm physical board rebound, and eight missed-save paths into the opening with flat and hopping pucks. Existing checks still cover both winners at seven, contact-gated strikes, one attacker, slot limits, goalie delay, natural complete matches, and a real flipper bank goal against the full team.

`pnpm build` passes TypeScript and generates the match and practice pages. The existing shared Three/Rapier bundle-size warning remains.

## Browser verification

The updated dev build completed the full **120-second Performance lab** in the in-app Chromium browser, Normal / seed 1024 / flat puck / normal rendering. The three-second warm-up was excluded from timing samples.

| Measurement | Result |
|---|---:|
| Animation samples | 7,021 |
| Median / p95 animation interval | 16.7 / 16.8 ms |
| Median / p95 draw interval | 16.7 / 16.8 ms |
| Stalls over 100 ms | 0 |
| p95 physics CPU time per frame | 0.3 ms |
| Puck contacts | 534 |
| Assisted CPU strikes | 14 |
| Your goals / CPU goals | 1 / 1 |
| Neutral restarts | 0 |

Hardware: NVIDIA RTX 3080 Ti via ANGLE/D3D11; Chromium 154 on Windows NT 10.0; reported viewport 1040 × 593; drawing buffer 793 × 565; reported device-pixel ratio 2.72, capped to 1.5 by the renderer. Raw report: `pacing-browser-performance.json`. The original desktop run recorded 231 contacts at a different viewport/drawing-buffer size; the timing results describe the measured desktop configuration, not every device.

Live DOM state confirmed version 0.3.1, downhill acceleration 3.2, all six figures, real passes/shots, and score progression. An A/L combination was applied at tick **2034** after the request at **2033**; both flippers subsequently returned to rest. Pause froze the puck and all actor poses at tick **32069** across separate settled observations, with both inputs cleared. The DOM telemetry refreshes every half-second, so observations were taken after it caught up with the visible pause state. New match restored a 0–0 setup and enabled difficulty selection. Raw control observations: `pacing-browser-controls.json`. The whole rink and the visible lower shoulders were inspected in the browser. Screenshot: `pacing-browser.jpg`.

The original user-owned in-app tab could not be attached because its browser focus command timed out. A fresh background preview was used for these checks. No OS focus or desktop controls were changed. The local server remains at 127.0.0.1:5173. The new pace still needs human feedback on timing and difficulty; automated comparisons cannot establish that balance.
