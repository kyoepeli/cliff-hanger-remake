import { describe, it, expect } from 'vitest';
import { EasyTierMeter, DEFAULT_EASY_CONFIG } from '../easyTierMeter.js';

describe('EasyTierMeter', () => {
  it('walks idle -> force -> angle -> done across three taps', () => {
    const m = new EasyTierMeter();
    expect(m.current.phase).toBe('idle');
    expect(m.tap()).toBe('force');
    expect(m.tap()).toBe('angle');
    expect(m.tap()).toBe('done');
    // a fourth tap while done is a no-op
    expect(m.tap()).toBe('done');
  });

  it('locks force on the second tap and angle on the third, both within configured range', () => {
    const m = new EasyTierMeter();
    m.tap(); // -> force, oscillating
    for (let i = 0; i < 30; i++) m.tick(0.05);
    m.tap(); // locks force, -> angle
    expect(m.current.force).not.toBeNull();
    expect(m.current.force!).toBeGreaterThanOrEqual(DEFAULT_EASY_CONFIG.force.min);
    expect(m.current.force!).toBeLessThanOrEqual(DEFAULT_EASY_CONFIG.force.max);

    for (let i = 0; i < 30; i++) m.tick(0.05);
    m.tap(); // locks angle, -> done
    expect(m.current.angle).not.toBeNull();
    expect(m.current.angle!).toBeGreaterThanOrEqual(DEFAULT_EASY_CONFIG.angle.min);
    expect(m.current.angle!).toBeLessThanOrEqual(DEFAULT_EASY_CONFIG.angle.max);
  });

  it('ignores tick() while idle or done (no meter is live yet/anymore)', () => {
    const m = new EasyTierMeter();
    m.tick(1); // idle — no-op
    expect(m.current.liveValue).toBe(0);

    m.tap();
    m.tap();
    m.tap(); // now done
    const before = m.current.liveValue;
    m.tick(1);
    expect(m.current.liveValue).toBe(before);
  });

  it('reset() returns to a fresh idle state', () => {
    const m = new EasyTierMeter();
    m.tap();
    m.tick(0.3);
    m.reset();
    expect(m.current).toEqual({ phase: 'idle', liveValue: 0, force: null, angle: null });
  });
});
