import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { makeCamera, screenToGround, clampToBounds, type WalkBounds } from '../layout.js';
import { testFixtureScreen, LEDGE } from '../../screens/test-fixture.js';

const ASPECTS = [16 / 9, 16 / 10, 4 / 3];

const WALK_BOUNDS: WalkBounds = {
  minX: LEDGE.center.x - LEDGE.halfWidth,
  maxX: LEDGE.center.x + LEDGE.halfWidth,
  minZ: LEDGE.center.z - LEDGE.halfDepth,
  maxZ: LEDGE.center.z + LEDGE.halfDepth,
};

function inFrame(p: Vector3, aspect: number, margin = 0.97) {
  const n = p.clone().project(makeCamera(aspect));
  return Math.abs(n.x) <= margin && Math.abs(n.y) <= margin && n.z < 1;
}

describe('static wide camera framing', () => {
  it.each(ASPECTS)('keeps the ledge, the boulder and the whole road on screen at aspect %f', (aspect) => {
    const contraption = testFixtureScreen.objects.find((o) => o.isInteractive)!.position;
    const wp = testFixtureScreen.bandit.waypoints;
    const points = [
      new Vector3(contraption.x, contraption.y, contraption.z),
      new Vector3(wp[0].x, wp[0].y, wp[0].z), // bandit at the horizon
      new Vector3(wp[wp.length - 1].x, wp[wp.length - 1].y, wp[wp.length - 1].z), // front of the road
      new Vector3(WALK_BOUNDS.minX, LEDGE.topY, WALK_BOUNDS.minZ),
      new Vector3(WALK_BOUNDS.maxX, LEDGE.topY, WALK_BOUNDS.minZ),
      new Vector3(WALK_BOUNDS.minX, LEDGE.topY, WALK_BOUNDS.maxZ),
      new Vector3(WALK_BOUNDS.maxX, LEDGE.topY, WALK_BOUNDS.maxZ),
    ];
    for (const p of points) expect(inFrame(p, aspect)).toBe(true);
  });

  it('the boulder projects to a reasonably large, central-ish screen target (not a tiny distant speck)', () => {
    const cam = makeCamera(16 / 9);
    const contraption = testFixtureScreen.objects.find((o) => o.isInteractive)!.position;
    const centerNdc = new Vector3(contraption.x, contraption.y, contraption.z).clone().project(cam);
    // roughly within the middle two-thirds of the frame, not jammed in a corner/edge
    expect(Math.abs(centerNdc.x)).toBeLessThan(0.6);
    expect(Math.abs(centerNdc.y)).toBeLessThan(0.6);
  });
});

describe('click-to-walk ground picking on the ledge plane', () => {
  it('a ledge point projected to the screen picks back to the same point', () => {
    const cam = makeCamera(16 / 9);
    const target = new Vector3(LEDGE.center.x + 0.4, LEDGE.topY, LEDGE.center.z - 0.3);
    const ndc = target.clone().project(cam);
    const hit = screenToGround({ x: ndc.x, y: ndc.y }, cam, LEDGE.topY)!;
    expect(hit.x).toBeCloseTo(target.x, 3);
    expect(hit.z).toBeCloseTo(target.z, 3);
  });

  it('clampToBounds keeps the hero within the ledge', () => {
    const c = clampToBounds({ x: 99, z: -99 }, WALK_BOUNDS);
    expect(c).toEqual({ x: WALK_BOUNDS.maxX, z: WALK_BOUNDS.minZ });
  });
});
