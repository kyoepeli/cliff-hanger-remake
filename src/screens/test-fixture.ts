import type { ScreenDef } from '../sim/types.js';

/**
 * NOT a real authored level — a minimal 3D fixture used to exercise the
 * simulation + search modules in tests, and the render/input scaffolding.
 *
 * World: +x right, +y up, +z toward the camera (camera looks down -z).
 *
 * Layout: a road runs along the z axis at x=0. The bandit walks it from the
 * horizon (z=-10) to the front of the scene (z=0). A modest rock ledge
 * sits front-left of the road, overlooking it — this is the hero's ambush
 * spot, and the hero starts the screen already standing on it (staked out,
 * not walking over from elsewhere). The boulder rests on that same ledge.
 *
 * Aim mapping: force = push power, angle = azimuth. angle 0 pushes straight
 * toward the road (+x); positive angles swing the push away from the
 * camera (-z), toward wherever the bandit currently is up the road.
 */
const ELEVATION = 0.25; // radians of upward tilt baked into the push
const MAX_PUSH = 5; // m/s

/** Shared with the renderer (stage.ts, main.ts) so the visual ledge, the
 * hero's starting spot, and the physical drop point never drift apart. */
export const LEDGE = {
  center: { x: -2.6, z: 0.6 },
  topY: 1.6,
  halfWidth: 1.1,
  halfDepth: 1.1,
};

const contraptionPos = { x: LEDGE.center.x + 0.3, y: LEDGE.topY, z: LEDGE.center.z - 0.1 };

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
      position: { x: 0, y: -0.5, z: -8 },
      isStatic: true,
      friction: 0.55,
      restitution: 0.15,
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
          shape: { kind: 'sphere', radius: 0.32 },
          position: contraptionPos,
          friction: 0.55,
          restitution: 0.2,
          density: 3,
          linearDamping: 0.35,
          angularDamping: 0.8,
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
