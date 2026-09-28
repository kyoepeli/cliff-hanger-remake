# Cliff Hanger Remake — Design Doc

## Concept
A remake of the 1984 C64 game *Cliff Hanger*. The player is a Western hero
trying to kill a bandit who approaches from the horizon toward a trap at the
front of each scene, using increasingly absurd contraptions (boulders,
boomerangs, custom devices). The tone is slapstick/cartoon, and the game
gradually reveals that the "canyon" is actually a movie set being filmed.
Critically: **the full simulation capability exists from level 1** — what
changes across the game is only what the player has learned to expect and
look for (see "Discovery, not gating" below).

## Tech stack
- **Rendering**: 3D (Three.js planned) with post-processing lens effects
  (bokeh / depth of field at minimum). The final product is 3D.
- **Physics**: Rapier3D via WASM (`@dimforge/rapier3d-compat`) — real
  joint-based ragdolls, and fast enough to run many simulated variations
  per attempt headlessly (Web Workers planned for the widening search)
- **Language/build**: TypeScript + Vite
- **Packaging**: Tauri (desktop) + Capacitor (iOS/Android) wrapping the same
  web app — no platform-specific game logic
- **CI**: GitHub Actions — web build → GitHub Pages for playtesting, plus
  separate Tauri/Capacitor release jobs
- **Testing**: Vitest, with the core sim module built headless/engine-
  agnostic specifically so it's unit-testable without any rendering

## Camera & view
- **Live gameplay is always a wide, static camera** looking down the road
  from the front of the scene; the bandit walks from the horizon toward it.
  The camera never moves or orbits during play. Lens look (focal plane,
  depth of field) is art-directed per screen.
- **Replays use free camera angles** by playing back recorded trajectory
  frames from the sim (no re-simulation needed), so heavy lens effects can
  be reserved for replays and the live view can stay light for mobile.
- World convention: +x right, +y up, +z toward the camera. Default aim
  mapping: force = power/how far, angle = horizontal aim (azimuth).

## Core mechanic: physics precalc with expanding search
Implemented in `src/sim/` (`physics.ts` + `search.ts`) and already tested.

- Player input produces two continuous values per attempt: **force** and
  **angle**, captured via one of three input tiers (see below).
- On submission, the game runs the physics simulation multiple times with
  small variations around the player's actual (force, angle) input,
  entirely headless.
- The **only success condition** is "bandit is dead." Collateral effects —
  hitting scenery, destroying props/environment, or hitting crew members —
  do not disqualify a success; a kill via ricochet off any object,
  including a toppled cliffside or a crew member, is exactly as valid as a
  direct hit.
- If ANY simulated variation within the current search neighborhood
  results in a kill, the engine selects the one **closest to the player's
  real input** (so the "found" solution still reads as a plausible version
  of their own throw) and plays that back as the outcome. If none do, the
  player's actual unmodified input is simulated and played back as a
  genuine miss.
- The search neighborhood **widens with each failed attempt on the same
  screen** — both in how far the (force, angle) variations can stray, and
  in how many variations are checked (`widenSearch()` in `search.ts`).
- **Extra compute time from a wider search must never be shown as a
  loading state or an explicit "calculating" plaque/take-counter card.**
  Checking more variations legitimately takes longer, and that time should
  be absorbed naturally by stretching/slowing whatever anticipation
  animation is already playing (the object's flight, a held-breath beat
  before impact) — a wider search should just *feel* like a bigger, more
  dramatic wind-up, never a technical pause. (Not yet implemented — this is
  a rendering-layer concern for a later build step.)
- Each screen resets to an **identical starting canvas on every attempt**,
  regardless of prior destruction — in-fiction, the crew resets the set for
  another take. Saved/shared replays are therefore directly comparable
  across players and across attempts.

## Discovery, not gating: how the "acts" actually work
There is **no engine-level restriction by level or act**. From level 1, the
simulation always has full access to every kill category: ordinary
contraption physics, environmental/set destruction (cliffs toppling, props
revealing themselves as fake), and crew members as physical objects. Acts
are a **level-design and player-knowledge** progression, not a capability
progression:

- **Act 1** ("straight Western"): environmental destruction is fully
  possible in the simulation, but early screens are authored so these
  outcomes require an unlikely search deviation a first-time player won't
  stumble into, and no replay camera angle yet exists to make a destroyed-
  set outcome legible even if it does occur.
- **Act 2** ("the set admits it's a set"): screens are authored so
  environmental destruction is easy to trigger and clearly presented — this
  is where the mechanic is actively taught, not newly enabled.
- **Act 3** ("the crew is real"): crew members are introduced as visible
  (only via specific replay camera angles) and screens are authored so
  crew-collateral kills are easy to trigger and understand.
- **Design implication**: replaying an Act 1 screen after learning Act 2/3
  mechanics should be able to reveal, in retrospect, that an early "lucky"
  kill was quietly a cliffside topple or a crew ricochet. This retroactive
  "oh — THAT'S what happened" is intended replay value, and should inform
  screen/prop authoring even in Act 1.

(Exact level counts per act are flexible — roughly 10 screens per act as a
starting scaffold, not a hard requirement.)

## Movement & interaction
The scene is navigable, not a fixed camera with clickable hotspots:

- Tapping/clicking open ground moves the hero there (point-and-walk,
  pathfinding around scene geometry as needed).
- Interactivity is only discoverable by proximity: when the hero is
  standing next to an object, press-and-hold on that object tests whether
  it's interactive at all. If it is, this reveals/pops the force meter and
  begins the input-tier sequence. If it isn't, holding does nothing (or
  gives a small "not this" cue) — no meter appears.
- This applies uniformly to obvious contraptions and secret ones — there is
  no visual distinction between "the trap" and "just scenery" until the
  player is close enough to test it. A screen's true secret solutions
  should be objects a player has no strong reason to approach or test, not
  objects that are simply hidden from view.
- Contraptions should vary enough in behavior/flavor that a player
  generally can't predict what a given object's meter sequence will do on
  first encounter — the "what even is this and what will it do"
  uncertainty is intentional.
- Each interactable object needs, at minimum: a proximity/adjacency check,
  an `isInteractive` flag (see `SceneObject` in `src/sim/types.ts`), and its
  own simulation parameters. Authoring a screen means placing 1+
  interactive objects (some obvious, some not) plus purely decorative,
  non-interactive scenery whose job is to make the secret ones non-obvious.

## Input tiers (player preference, not difficulty)
All three tiers resolve to the same underlying (force, angle) pair and are
mechanically fair to compare — the leaderboard tracks them as three
separate categories (golf handicap-style), since the point is player
preference/bragging rights, not actual difficulty. Switchable mid-level,
never mid-meter.

- **Easy**: three discrete taps, press duration ignored entirely. Tap 1
  starts an oscillating force meter. Tap 2 locks force and starts an
  oscillating angle meter. Tap 3 locks angle and launches.
- **Middle**: same three decisions via press/release/press instead of three
  flat taps — press starts the (oscillating) force meter, release locks
  force and starts the (oscillating) angle meter, press again locks angle
  and launches. Mechanically identical to Easy — purely a different input
  gesture/rhythm.
- **Hardcore**: same press/release/press structure as Middle, but both
  meters climb one-way instead of oscillating, and each stage has a
  reaction deadline — failing to release/press in time auto-locks that
  axis to its worst-case value. Real risk, no waiting-out-a-cycle safety
  net.

## Ragdoll & impact
Characters (bandit, and crew once revealed) use skeletal ragdoll physics on
impact — proper joint-constrained rigid bodies, not a single rigid sprite
flying off. Primary comedy payoff; should look physically convincing even
when the outcome is absurd.

## Replay system
- A hit (and, ideally, near-misses too) triggers a slow-motion instant
  replay of the selected simulation variation.
- Default camera behavior is an automatic "cinematic switcher" — a small
  fixed sequence of cuts (establishing wide shot → tracking shot on the
  projectile → close-up at impact).
- A single tap during replay advances to the **next** camera angle in a
  fixed, one-direction cycle (no free camera, no d-pad) — order is
  consistent screen-to-screen so a player can learn "tap 3 times for my
  favorite angle." Camera choice only affects the current replay.
- A "skip replay / next take" control is always easily accessible and
  doesn't conflict with the tap-to-cycle input.
- Crew members are only ever visible from specific replay camera angles,
  never in the default/live scene view — even in early screens where crew
  objects may technically be present in the simulation.

## Current status
- [x] Headless precalc/simulation module (`src/sim/physics.ts`), built on
      Rapier3D, unit-tested without any rendering
- [x] Widening-search module (`src/sim/search.ts`) with tests confirming
      the core "same bad input fails early, succeeds after enough failed
      attempts" behavior
- [x] Sim ported to 3D (Rapier3D, `Vec3`/`Quat` types, azimuth aiming)
- [x] Minimal test-fixture screen (`src/screens/test-fixture.ts`) — NOT a
      real authored level, just enough geometry to exercise the sim
- [x] Easy input tier meter (`src/input/easyTierMeter.ts`), unit-tested
- [x] Three.js static wide-camera scene: click-to-walk (ray to ground
      plane), click-object-to-open-meter, Easy tier meters, worker-driven
      precalc with tremble wind-up hiding the compute, trajectory playback
      (framing and picking are unit-tested; visuals not yet playtested)
- [ ] Full input-tier system (Easy/Middle/Hardcore) wired to real
      pointer/touch events
- [ ] Ragdoll impact, slow-motion replay, camera-cycling system, with the
      anticipation-stretching approach to hiding search compute time
- [ ] Screen data format (JSON) for authoring without code changes
- [ ] Destructible-environment screens (Act 2 style)
- [ ] Crew-object screens (Act 3 style)
- [ ] Leaderboard, take-counter/UI polish
- [ ] Tauri + Capacitor packaging, GitHub Actions CI

## Build order
1. ~~Headless precalc/simulation module~~ ✅ done
2. Static wide-camera Three.js scene of a single Act-1-style screen driven
   by the sim module, including the full input-tier system, so the core
   loop is validated end-to-end before adding scope (in progress: Easy
   tier done, Middle/Hardcore remaining)
3. Ragdoll impact + slow-motion replay + free replay cameras + lens
   effects (bokeh/DoF)
4. Screen data format (JSON) so new screens can be authored without code
   changes
5. Author a batch of Act-2-style screens (environmental destruction easy
   to trigger, clearly taught)
6. Author a batch of Act-3-style screens (crew revealed, crew-collateral
   kills easy to trigger)
7. Leaderboard (per input tier) and take-counter/UI polish
8. Tauri and Capacitor packaging passes
