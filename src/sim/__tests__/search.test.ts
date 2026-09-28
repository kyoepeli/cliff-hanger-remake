import { describe, it, expect, beforeAll } from 'vitest';
import { ensureRapierInit } from '../physics.js';
import { simulate } from '../physics.js';
import { runAttempt, widenSearch } from '../search.js';
import { testFixtureScreen } from '../../screens/test-fixture.js';

beforeAll(async () => {
  await ensureRapierInit();
});

describe('simulate()', () => {
  it('force=0 always misses — the boulder drops straight down, outside the bandit corridor', () => {
    const result = simulate(testFixtureScreen, { contraptionId: 'boulder-drop', force: 0, angle: 0 });
    expect(result.success).toBe(false);
  });

  it('some force level in range actually kills the bandit (sanity check on the fixture + physics)', () => {
    let found: number | null = null;
    for (let f = 0.05; f <= 1; f += 0.05) {
      const r = simulate(testFixtureScreen, { contraptionId: 'boulder-drop', force: f, angle: 0 });
      if (r.success) {
        found = f;
        break;
      }
    }
    expect(found).not.toBeNull();
  });
});

describe('3D aiming', () => {
  it('angle (azimuth) steers the projectile along the depth axis; force sets how far', () => {
    const finalPos = (force: number, angle: number) => {
      const r = simulate(testFixtureScreen, { contraptionId: 'boulder-drop', force, angle });
      const last = r.trajectory[r.trajectory.length - 1];
      return last.bodies['boulder-drop:projectile'].position;
    };
    const straight = finalPos(0.6, 0);
    const swung = finalPos(0.6, 0.6);
    // positive azimuth pushes away from the camera (more negative z)
    expect(swung.z).toBeLessThan(straight.z - 0.5);
    // more force carries the boulder farther toward/along the road (+x)
    expect(finalPos(0.9, 0).x).toBeGreaterThan(finalPos(0.3, 0).x);
  });
});

describe('widenSearch()', () => {
  it('grows both radius and sample count with more failed attempts', () => {
    const a = widenSearch(0);
    const b = widenSearch(10);
    expect(b.forceRadius).toBeGreaterThan(a.forceRadius);
    expect(b.angleRadius).toBeGreaterThan(a.angleRadius);
    expect(b.sampleCount).toBeGreaterThan(a.sampleCount);
  });

  it('is capped so it never exceeds a full valid range', () => {
    const wide = widenSearch(100);
    expect(wide.forceRadius).toBeLessThanOrEqual(1);
    expect(wide.angleRadius).toBeLessThanOrEqual(Math.PI);
  });
});

describe('runAttempt()', () => {
  const badInput = { contraptionId: 'boulder-drop', force: 0, angle: 0 };

  it('a bad input on the very first try (0 prior failures) stays a genuine miss', () => {
    const result = runAttempt(testFixtureScreen, badInput, 0);
    expect(result.success).toBe(false);
    expect(result.wasAdjusted).toBe(false);
  });

  it('the exact same bad input can succeed once enough failed attempts have widened the search', () => {
    // Enough failed attempts that the search radius comfortably covers the
    // full force range — if any force value in [0,1] at angle≈0 works,
    // this should find it.
    const result = runAttempt(testFixtureScreen, badInput, 20);
    expect(result.success).toBe(true);
    expect(result.wasAdjusted).toBe(true);
    // The bandit must actually be dead, killed by something real in the sim.
    expect(result.killedBy).toBeDefined();
  });

  it('an input that already succeeds on its own is used untouched (no unnecessary adjustment)', () => {
    // First locate a genuinely working input directly.
    let good: { force: number; angle: number } | null = null;
    for (let f = 0.05; f <= 1; f += 0.05) {
      const r = simulate(testFixtureScreen, { contraptionId: 'boulder-drop', force: f, angle: 0 });
      if (r.success) {
        good = { force: f, angle: 0 };
        break;
      }
    }
    expect(good).not.toBeNull();

    const result = runAttempt(
      testFixtureScreen,
      { contraptionId: 'boulder-drop', ...good! },
      0,
    );
    expect(result.success).toBe(true);
    expect(result.wasAdjusted).toBe(false);
    expect(result.input).toEqual({ contraptionId: 'boulder-drop', ...good! });
  });
});
