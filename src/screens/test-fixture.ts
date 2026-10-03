import type { ScreenDef } from '../sim/types.js';

/**
 * NOT a real authored level — a minimal 3D fixture used to exercise the
 * simulation + search modules in tests, and the render/input scaffolding.
 *
 * World: +x right, +y up, +z toward the camera (camera looks down -z).
 *
 * Layout: a road runs along the z axis at x=0. The bandit walks it from the
 * horizon (z=-10) to the front of the scene (z=0). A rock ledge occupies
 * the front-left of the scene, overlooking the road — this is the hero's
 * ambush spot, with real room to walk around on. The hero starts the
 * screen already standing on it (staked out, not walking over). The
 * boulder rests near the ledge's road-facing edge.
 *
 * The ledge is a REAL physics object (see `ledge` below, not just visual
 * geometry in the renderer) — the boulder rolls across its surface and
 * off the edge under its own physics, same as it would roll across any
 * other ground.
 *
 * Aim mapping: force = push power, angle = azimuth. angle 0 pushes straight
 * toward the road (+x); positive angles swing the push away from the
 * camera (-z), toward wherever the bandit currently is up the road.
 */
const ELEVATION = 0.2; // radians of upward tilt baked into the push
const MAX_PUSH = 3; // m/s — kept low so the ledge-edge fall doesn't amplify
// small force differences into large landing-distance swings
const GROUND_TOP_Y = 0; // matches the `ground` object below (pos.y=-0.5, height=1)

/** Shared with the renderer (stage.ts, main.ts) so the visual ledge, the
 * hero's walkable area, and the physical collider never drift apart. */
export const LEDGE = {
  // Pulled back from the road (vs. a first pass that put it too close —
  // even a straight, zero-force drop landed within kill range, defeating
  // the point of a "force=0 is a clean miss" fixture). Footprint
  // unchanged, so there's no less room to walk.
  center: { x: -4.6, z: 0.4 },
  topY: 1.6,
  halfWidth: 2.6,
  halfDepth: 2.1,
};

// Boulder sits near the ledge's front-right corner — closest to the road —
// leaving the rest of the ledge as room for the hero to walk around.
const PROJECTILE_RADIUS = 0.32;
// A sphere resting on a flat surface and rolling off a sharp box corner is
// a classically chaotic contact case (a ~0.25%-wide force window flips the
// outcome entirely) — physically real, but useless for gameplay or for the
// precalc search to ever find. So the boulder launches from JUST CLEAR of
// the ledge's edge (open air over the road below, not resting on the
// ledge's flat top), making this a plain projectile arc from frame one —
// smooth and continuous in (force, angle), no edge-corner contact at all.
const contraptionPos = {
  x: LEDGE.center.x + LEDGE.halfWidth + PROJECTILE_RADIUS + 0.05,
  y: LEDGE.topY + PROJECTILE_RADIUS + 0.01,
  z: LEDGE.center.z - LEDGE.halfDepth * 0.35,
};

export const testFixtureScreen: ScreenDef = {
  id: 'test-fixture',
  gravity: -9.81,
  maxSimSeconds: 7,
  bandit: {
    waypoints: [
      { x: 0, y: 0.35, z: -10 },
      { x: 0, y: 0.35, z: 0 },
    ],
    speed: 1.5,
    shape: { kind: 'box', width: 0.5, height: 0.7, depth: 0.5 },
  },
  objects: [
    {
      id: 'ground',
      role: 'environment',
      shape: { kind: 'box', width: 24, height: 1, depth: 30 },
      position: { x: 0, y: GROUND_TOP_Y - 0.5, z: -8 },
      isStatic: true,
      friction: 0.75,
      restitution: 0.1,
    },
    {
      // The physical ledge the boulder rests and rolls on. Must match the
      // renderer's visual footprint (see stage.ts, which imports LEDGE).
      id: 'ledge',
      role: 'environment',
      shape: {
        kind: 'box',
        width: LEDGE.halfWidth * 2,
        height: LEDGE.topY - GROUND_TOP_Y,
        depth: LEDGE.halfDepth * 2,
      },
      position: { x: LEDGE.center.x, y: (LEDGE.topY + GROUND_TOP_Y) / 2, z: LEDGE.center.z },
      isStatic: true,
      friction: 0.7,
      restitution: 0.1,
    },
    {
      id: 'boulder-drop',
      role: 'contraption',
      shape: { kind: 'sphere', radius: 0.1 }, // trigger point, no real collider
      position: contraptionPos,
      isStatic: true,
      isInteractive: true,
      launch: {
        projectile: {
          shape: { kind: 'sphere', radius: PROJECTILE_RADIUS },
          position: contraptionPos,
          friction: 0.55,
          restitution: 0.2,
          density: 3,
          linearDamping: 0.3,
          angularDamping: 0.7,
        },
        forceToVelocity: (force, angle) => {
          const speed = force * MAX_PUSH;
          return {
            x: speed * Math.cos(ELEVATION) * Math.cos(angle),
            y: speed * Math.sin(ELEVATION),
            z: -speed * Math.cos(ELEVATION) * Math.sin(angle),
          };
        },
      },
    },
  ],
};
