# Closer ice layout — 0.4.2

The previous instruction column and the score/control rows left the rink too small on a wide display. The match now uses a slim 52 px header and nearly the full remaining height for the rink. Scores sit at opposite sides, flipper controls occupy the lower side space, and the repeated control/rink captions are removed. Instructions are available under Settings → How to play, alongside the existing key configuration.

The camera keeps its centered 57° elevation. A perspective fit centers the projected cabinet and balances its upper/lower margins instead of centering the world origin. The full ice, glass, paddles, and near opening remain in view. The practice page retains its previous camera fit. No physics, skater movement, puck tuning, score rules, or input timing changed.

## Verification

- At 1440×900, the actual canvas grew from 1178×619 to 1423×839 CSS pixels: 36% more vertical room, with additional improvement from the tighter camera fit.
- Inspected desktop, tablet, portrait phone, short landscape, Settings/help, key configuration, and final-score layouts. Measured 1920×1080, 1440×900, 900×740, 768×1024, 390×844, 320×568, and 844×390; no document overflow, and both flipper buttons stay in bounds. On portrait phones the pads remain 60 px tall.
- A keyboard A press and the right on-screen button both reached the physics update on the next tick. The existing 13 input checks passed.
- Live desktop timing at 1440×900 measured 16.7 ms median and 16.8 ms p95 frame intervals, with 0.30 ms p95 physics work per frame. This is a short local browser observation, not a new cross-device performance claim.
- TypeScript and the production build passed. The existing large shared-bundle warning remains. Gameplay physics was not changed, so its previous regression evidence is retained.

`ice-layout-checks.json` records the measured dimensions. `ice-layout-desktop.png` shows the final playing view. Responsive testing uses browser viewport sizes; real multi-touch/mobile-device testing remains separate.
