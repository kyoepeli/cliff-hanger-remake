import type { ScreenDef } from '../sim/types.js';

/**
 * NOT a real authored level — a minimal 3D fixture used to exercise the
 * simulation + search modules in tests. Real screens (step 4 of the build
 * order) will be authored as data files.
 *
 * World: +x right, +y up, +z toward the camera (camera looks down -z).
 *
 * Layout: a road runs along the z axis at x=0. The bandit walks it from the
 * horizon (z=-10) to the front of the scene (z=0). The boulder contraption
 * sits on a ledge at the front-left (x=-3), well off the road, so firing
 * with zero force drops the boulder straight down beside the road — a
 * clean, unambiguous miss.
 *
 * Aim mapping: force = push power, angle = azimuth. angle 0 pushes straight
 * right (+x, toward the road); positive angles swing the push away from the
 * camera (-z), i.e. toward where the bandit currently is farther up the road.
 */
const ELEVATION = 0.3; // radians of upward tilt baked into the contraption
const MAX_PUSH = 6; // m/s

export const testFixtureScreen: ScreenDef = {
  id: 'test-fixture',
  gravity: -9.81,
  maxSimSeconds: 8,
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
      position: { x: -3, y: 5, z: 0 },
      isStatic: true,
      isInteractive: true,
      launch: {
        projectile: {
          shape: { kind: 'sphere', radius: 0.35 },
          position: { x: -3, y: 5, z: 0 },
          friction: 0.55,
          restitution: 0.2,
          density: 3,
          linearDamping: 0.4,
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
