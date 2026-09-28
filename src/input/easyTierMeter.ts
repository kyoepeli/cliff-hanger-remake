/**
 * Easy input tier (see docs/design-doc.md): three discrete taps, press
 * duration ignored entirely.
 *   tap 1 -> starts an oscillating force meter (0..1)
 *   tap 2 -> locks force, starts an oscillating angle meter
 *   tap 3 -> locks angle, fires
 *
 * This is a plain state machine with no rendering/DOM knowledge, driven by
 * calling `tick(dtSeconds)` every frame and `tap()` on each pointer-down.
 * That keeps it unit-testable and reusable for the Middle tier later,
 * which per the design doc shares the same meter *behavior* and only
 * changes the gesture that drives start/stop (press/release/press instead
 * of three flat taps).
 */

export interface MeterRange {
  min: number;
  max: number;
  /** Full oscillation cycles per second. */
  hz: number;
}

export interface EasyTierConfig {
  force: MeterRange;
  angle: MeterRange;
}

export const DEFAULT_EASY_CONFIG: EasyTierConfig = {
  force: { min: 0, max: 1, hz: 0.6 },
  angle: { min: -Math.PI / 3, max: Math.PI / 3, hz: 0.5 },
};

export type EasyTierPhase = 'idle' | 'force' | 'angle' | 'done';

export interface EasyTierState {
  phase: EasyTierPhase;
  /** Current live value of whichever meter is currently oscillating. */
  liveValue: number;
  force: number | null;
  angle: number | null;
}

function oscillate(range: MeterRange, t: number): number {
  const span = range.max - range.min;
  // triangle wave 0..1..0, not sine, so the ends (extremes) are reachable
  // at a steady, predictable rate rather than lingering near the peak.
  const phase = (t * range.hz) % 1;
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return range.min + tri * span;
}

export class EasyTierMeter {
  private t = 0;
  private state: EasyTierState = { phase: 'idle', liveValue: 0, force: null, angle: null };

  constructor(private cfg: EasyTierConfig = DEFAULT_EASY_CONFIG) {}

  get current(): Readonly<EasyTierState> {
    return this.state;
  }

  /** Advance the currently-oscillating meter. No-op if idle/done. */
  tick(dtSeconds: number) {
    if (this.state.phase === 'idle' || this.state.phase === 'done') return;
    this.t += dtSeconds;
    const range = this.state.phase === 'force' ? this.cfg.force : this.cfg.angle;
    this.state = { ...this.state, liveValue: oscillate(range, this.t) };
  }

  /** Call on each pointer-down/tap. Returns the new phase. */
  tap(): EasyTierPhase {
    switch (this.state.phase) {
      case 'idle':
        this.t = 0;
        this.state = { phase: 'force', liveValue: this.cfg.force.min, force: null, angle: null };
        break;
      case 'force':
        this.t = 0;
        this.state = {
          phase: 'angle',
          liveValue: this.cfg.angle.min,
          force: this.state.liveValue,
          angle: null,
        };
        break;
      case 'angle':
        this.state = { ...this.state, phase: 'done', angle: this.state.liveValue };
        break;
      case 'done':
        break;
    }
    return this.state.phase;
  }

  reset() {
    this.t = 0;
    this.state = { phase: 'idle', liveValue: 0, force: null, angle: null };
  }
}
