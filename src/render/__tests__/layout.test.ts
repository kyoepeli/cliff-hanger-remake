import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { makeCamera, screenToGround, GROUND_BOUNDS, clampToBounds } from '../layout.js';
import { testFixtureScreen } from '../../screens/test-fixture.js';

const ASPECTS = [16 / 9, 16 / 10, 4 / 3];

function inFrame(p: Vector3, aspect: number, margin = 0.97) {
  const n = p.clone().project(makeCamera(aspect));
  return Math.abs(n.x) <= margin && Math.abs(n.y) <= margin && n.z < 1;
}

describe('static wide camera framing', () => {
  it.each(ASPECTS)('keeps everything gameplay-critical on screen at aspect %f', (aspect) => {
    const contraption = testFixtureScreen.objects.find((o) => o.isInteractive)!.position;
    const wp = testFixtureScreen.bandit.waypoints;
    const points = [
      new Vector3(contraption.x, contraption.y, contraption.z),
      new Vector3(wp[0].x, wp[0].y, wp[0].z), // bandit at the horizon
      new Vector3(wp[wp.length - 1].x, wp[wp.length - 1].y, wp[wp.length - 1].z), // front of the road
      new Vector3(GROUND_BOUNDS.minX, 0, GROUND_BOUNDS.maxZ),
      new Vector3(GROUND_BOUNDS.maxX, 0, GROUND_BOUNDS.maxZ),
      new Vector3(GROUND_BOUNDS.minX, 0, GROUND_BOUNDS.minZ),
      new Vector3(GROUND_BOUNDS.maxX, 0, GROUND_BOUNDS.minZ),
    ];
    for (const p of points) expect(inFrame(p, aspect)).toBe(true);
  });
});

describe('click-to-walk ground picking', () => {
  it('a ground point projected to the screen picks back to the same ground point', () => {
    const cam = makeCamera(16 / 9);
    const target = new Vector3(1.5, 0, -1);
    const ndc = target.clone().project(cam);
    const hit = screenToGround({ x: ndc.x, y: ndc.y }, cam)!;
    expect(hit.x).toBeCloseTo(target.x, 4);
    expect(hit.z).toBeCloseTo(target.z, 4);
  });

  it('clampToBounds keeps the hero inside the walkable region', () => {
    const c = clampToBounds({ x: 99, z: -99 });
    expect(c).toEqual({ x: GROUND_BOUNDS.maxX, z: GROUND_BOUNDS.minZ });
  });
});
