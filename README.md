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

1. Click the ground to walk the hero (green) around.
2. Walk toward the ledge on the left and click the boulder on top of it.
   (Click it from far away and the hero walks over first.)
3. Tap anywhere: the click that opened the meter started FORCE; the next tap
   locks force and starts AIM; the next tap locks aim and fires.
4. Try a deliberately bad shot (force near zero) several times in a row and
   watch the take counter climb until the search finds a way.

## Getting this into your GitHub

This project was scaffolded in a sandboxed environment without push access
to GitHub. To get it into a real repo:

```bash
# 1. Unzip wherever you keep your projects, then:
cd cliff-hanger-remake
git init
git add -A
git commit -m "Initial scaffold: headless precalc/simulation module (step 1)"

# 2. Create an empty repo on GitHub first (no README/gitignore/license —
#    you already have these), then:
git remote add origin git@github.com:kyoepeli/cliff-hanger-remake.git
git branch -M main
git push -u origin main
```

(Swap the remote URL for HTTPS — `https://github.com/kyoepeli/cliff-hanger-remake.git`
— if you don't have SSH keys set up for GitHub.)

From there, continuing the build (step 2 onward: Three.js rendering, input
tiers, etc.) is exactly the kind of work suited to a **Claude Code**
session with your GitHub account connected, since that surface has real
write access to the repo and can run/iterate on the dev server directly.
This chat can keep designing, writing modules, and testing them in the
sandbox — but can't push on its own.
