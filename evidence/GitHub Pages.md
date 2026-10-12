# GitHub Pages publication — 0.4.9

Public game: https://jimerb.github.io/Hockey-Schtick/

The README features the user's accepted gameplay screenshot in `docs/gameplay.png`, a prominent Play link, basic controls and the accepted 25% upper-paddle release. The repository's About homepage also points to the game.

GitHub Pages is configured to deploy through GitHub Actions. `.github/workflows/pages.yml` installs the frozen pnpm lockfile using pnpm 11.25.0 and Node 24, builds the game, uploads only `dist/`, and deploys with the official Pages actions. Pushes to `main` trigger publication; manual runs are available. Deploy permissions are restricted to the deploy job. Dependencies, reference images, evidence and README artwork are not part of the game deployment unless referenced by the build.

Vite uses relative asset URLs, and the match/practice links are relative. This supports the GitHub project path while keeping local development at the root URL. No server or API credentials are required during play.

Before publication, the 0.4.9 production build passed and was served from an isolated local `/Hockey-Schtick/` directory. Real WebGL browser checks verified startup, the accepted 2.54375 upper-paddle size, simultaneous A/L paired controls, and navigation from match → practice → match. Browser errors and failed asset responses: zero. See `pages-local.json` and `pages-local.png`. The preceding gameplay validation remains in `Upper Paddle 25 Percent Playtest.md` (572 targeted checks).

`tests/browser-pages.cjs <path-to-playwright> [site-url] [evidence-directory]` runs the same checks against the live site. Omitting the site URL serves the built `dist/` locally under the project path. The publishing task also waits for GitHub Actions deployment and verifies the public URL before reporting completion.

The build retains the existing large shared-bundle warning. Download/startup time and frame performance vary by browser, hardware and connection. Previous desktop performance evidence does not certify phone hardware.

Deployment references: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Vite relative assets](https://vite.dev/guide/build.html#relative-base).
