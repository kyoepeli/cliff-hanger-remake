# Cliff Hanger Remake

A physics-driven remake of the 1984 C64 game *Cliff Hanger*. See
[`docs/design-doc.md`](docs/design-doc.md) for the full design — mechanics,
input tiers, the movie-set "discovery, not gating" act structure, replay
system, and current build status.

## Status

The final product is 3D: a wide static camera in live play, free cameras
in replays, with lens effects (bokeh at least). See the design doc.

Playable now (dev build, placeholder art, one test screen):
- Static wide-camera Three.js scene; click the ground to walk the hero.
- Click the boulder on the left ledge when close enough to open the Easy
  tier meters: tap = start force, tap = lock force + start aim, tap = fire.
- The precalc runs in a Web Worker. While it works, the boulder trembles on
  its ledge (the tremble grows the longer the search takes), then the take
  plays back. Miss repeatedly and the search widens until a "lucky" kill.

Not built yet: replay cameras, lens effects (bokeh/DoF), ragdolls,
Middle/Hardcore tiers, screen data files, leaderboard, Tauri/Capacitor.

## Repo structure

```
src/
  sim/                    headless simulation + search engine (no rendering)
    types.ts              core data model: ScreenDef, SceneObject, PlayerInput, results
    physics.ts             single-run Rapier3D simulation
    search.ts               widening-neighborhood precalc search
    worker.ts / client.ts   runs the search in a Web Worker + main-thread handle
    __tests__/
      search.test.ts       tests for the above, against the fixture screen
    index.ts               public API barrel export
  screens/
    test-fixture.ts        minimal placeholder screen for tests — not a real level
docs/
  design-doc.md            full design doc (source of truth for mechanics)
```

Not yet present (see build order in the design doc):
`src/render/` (Three.js), `src/input/` (tier-based meter capture),
`src/screens/*.json` (authored levels), `src-tauri/`, `android/` / `ios/`
(Capacitor), `.github/workflows/*.yml` (CI).

## Requirements

- Node.js 20+ (built/tested against Node 22)

## Getting started

```bash
npm install
npm run dev        # dev server; open the printed URL (usually http://localhost:5173)
npm test           # run the test suite once
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit
npm run build:web  # production web build to dist/
```

### How to play the current prototype

1. The hero starts already staked out on the cliff ledge, right next to
   the boulder — no walking over required.
2. Click the boulder to open the meter (click the ledge itself first if
   you've wandered a step away and need to step back within reach).
3. Tap anywhere: the click that opened the meter started FORCE; the next tap
   locks force and starts AIM; the next tap locks aim and fires.
4. Try a deliberately bad shot (force near zero) several times in a row and
   watch the take counter climb until the search finds a way.

## Publishing for playtesters (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy.yml`: it type-checks,
runs the tests, builds the web app and publishes it to GitHub Pages. If
tests fail, nothing is deployed.

One-time setup:

1. Create an empty repo on GitHub named `cliff-hanger-remake` (no README,
   .gitignore or license — they already exist here). Pages on a free account
   needs the repo to be **public**.
2. From the project folder:

   ```bash
   git init
   git add -A
   git commit -m "3D sim + static-camera prototype"
   git branch -M main
   git remote add origin https://github.com/kyoepeli/cliff-hanger-remake.git
   git push -u origin main
   ```

3. In the repo on GitHub: **Settings → Pages → Build and deployment →
   Source: GitHub Actions**. (Do this once; then re-run the workflow from the
   **Actions** tab or push again.)
4. After the workflow finishes (about a minute), the game is live at
   `https://kyoepeli.github.io/cliff-hanger-remake/` — that's the link to
   send to friends.

After that, publishing an update is just `git add -A && git commit -m "…" && git push`.

Notes:
- Pushing needs GitHub authentication on your machine (an HTTPS personal
  access token, or SSH keys with the `git@github.com:` remote URL instead).
- The first load downloads about 1.5 MB (the physics engine ships inside the
  worker), so give friends a moment on slow connections.
- The repo is public, so the source is too.
