# Opening and rear-body tuning — 0.3.4

October 1, 2026. The user requested a more defendable center opening and a moderate pinball bumper response on skaters' backs, while keeping their side and stick responses.

## Gameplay changes

The center skater's direct opening delivery now aims left or right into the flipper area, rather than at the gap. Each drop uses a fresh seeded choice of side and target within 2.2–3.6 game units of center, aimed at z = 6.15. Its speed is 9.5 game units/s across the three difficulty levels, compared with later shot speeds of 14/16/18. The neutral drop remains centered. Actual teammate passes keep their previous behavior. The independent opening random sequence leaves wing roaming and ordinary shot randomness separate.

A rear body impact adds at most 2.4 game units/s along the actual collision surface. The back is measured opposite the visible stick/face direction, within roughly 49 degrees of directly behind. It requires current body contact and incoming motion into the surface, applies once on contact entry, and has a short per-player cooldown. A quiet touch does not repeatedly accelerate the puck. Rear kicks have a moderate speed ceiling of 24 game units/s; an already faster physical rebound is not slowed, and the global 40-unit ceiling remains. Vertical velocity is preserved.

Rebound direction comes from the collision angle and player facing, with no hidden random steering. Glancing hits can therefore careen differently, and a back-hit deflection can enter the opponents' own goal. Actual stick strikes take priority. Side/front body restitution, blade restitution, stick aiming, figure travel, goalie behavior, flippers, slope, camera, rink art, and the practice rink remain unchanged. The wings still use their extended straight columns.

## Verification

The physics, match, and new play-tuning suites pass 295 + 265 + 30 = **590 checks**. The separate historical speed-tuning suite passes nine two-minute five-skater scenarios, explicitly with these two experiments disabled to retain comparable before/after numbers. The TypeScript and Vite production build passes.

- **72 isolated center openings:** 24 seeds at each difficulty. Each generated a real blade strike, a varying left/right aim, and an actual flipper interception after a 0.3-second reaction delay. Side bodies were disabled to isolate the opening; these cases do not promise that every opening in a full rally is automatically saved, or that holding a flipper produces an aimed offensive return.
- **Rear-contact comparisons:** headings 0, 90 degrees, and 0.7 radians, incoming speeds 3 and 8, with flat/hopping pucks. All 12 cases receive a bounded kick away from the back. Offset rear impacts leave in different directions according to the surface. Additional cases cover fast rebounds, quiet touches, and a rear deflection that physically travels into the far net and counts for the player.
- **Preservation comparisons:** eight side/front contact cases have identical outgoing velocity with the bumper enabled or disabled. The first actual assisted blade strike is also identical between those settings.
- **Full rallies:** eighteen two-minute runs use current tuning across three lineup layouts, three difficulties, and flat/hopping pucks. Travel limits, finite physics, physical strikes, goals, and neutral recovery remain checked. The current extended-wing Easy/flat run had one stationary wedge restart; the other five extended-wing cases had none. The existing whistle handles these rare wedges without awarding a goal. No apron or slot geometry was changed in this tuning pass.

Numerical evidence: `physics-results.json`, `match-results.json`, `play-tuning-results.json`, and `pacing-after.json`. Earlier 0.3.3 travel evidence remains historical; its zero-restart observations are not a claim about every trajectory under this tuning.

## Browser check

The live in-app browser ran Normal, seed 1024, three skaters plus goalie, extended wings, flat puck, full resolution, and current tuning. The built-in automatic flippers were used. The performance capture was **intentionally stopped after 36.2 seconds**, rather than represented as a completed 120-second benchmark.

It recorded 1,990 timing frames after warm-up, a 16.7 ms median and 16.8 ms p95 frame interval, 0.5 ms p95 physics CPU time per frame, and no stalls over 100 ms. There were 167 contacts, four assisted strikes, one conceded goal, and no neutral restart during that capture. Read-only gameplay telemetry separately confirmed two gentle opening deliveries and a rear bump. Live movement and the three-skater layout were visible in the saved screenshot.

Browser: Chromium 154 on Windows; GPU: NVIDIA RTX 3080 Ti; viewport: 1044 × 600; render resolution: 793 × 576. This short desktop check does not establish low-end hardware performance or human play balance. Evidence is in `opening-bumper-browser.json` and `opening-bumper-browser.jpg`. The browser was returned to a fresh 0–0 match setup for the user's playtest.
