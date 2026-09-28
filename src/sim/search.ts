import { simulate } from './physics.js';
import type { PlayerInput, ScreenDef, SearchResult, SimResult } from './types.js';

export interface SearchConfig {
  /** Radius (force, angle) grows by this factor per prior failed attempt. */
  growthRate: number;
  /** Radius at attempt 0 (the player's very first try on this screen). */
  baseForceRadius: number;
  baseAngleRadius: number;
  /** How many extra variations to sample at attempt 0. */
  baseSampleCount: number;
  /** Hard ceiling so a long-running screen doesn't blow up compute. */
  maxSampleCount: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  growthRate: 1.35,
  baseForceRadius: 0.03,
  baseAngleRadius: 0.03,
  baseSampleCount: 6,
  maxSampleCount: 400,
};

/**
 * How far (and how hard) the precalc is willing to search, given how many
 * times the player has already failed this screen. `failedAttempts` is 0
 * on a player's very first try. This is the ONLY thing that scales with
 * attempt count — it never changes what categories of object are eligible
 * to be part of a kill (see types.ts ScreenDef/SceneObject docs).
 */
export function widenSearch(failedAttempts: number, cfg: SearchConfig = DEFAULT_SEARCH_CONFIG) {
  const growth = Math.pow(cfg.growthRate, failedAttempts);
  return {
    forceRadius: Math.min(1, cfg.baseForceRadius * growth),
    angleRadius: Math.min(Math.PI, cfg.baseAngleRadius * growth),
    sampleCount: Math.min(cfg.maxSampleCount, Math.round(cfg.baseSampleCount * growth)),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function distanceToReal(candidate: PlayerInput, real: PlayerInput, radius: { force: number; angle: number }): number {
  const df = (candidate.force - real.force) / (radius.force || 1);
  const da = (candidate.angle - real.angle) / (radius.angle || 1);
  return Math.sqrt(df * df + da * da);
}

/**
 * Run the full precalc for one attempt: simulate the player's real input
 * first; if that alone kills the bandit, use it untouched. Otherwise sample
 * a widening neighborhood of nearby inputs and, if any of them succeed,
 * present the one closest to what the player actually did (so the "found"
 * solution still reads as a plausible version of their own throw, not an
 * arbitrary lucky swap).
 */
export function runAttempt(
  screen: ScreenDef,
  realInput: PlayerInput,
  failedAttempts: number,
  cfg: SearchConfig = DEFAULT_SEARCH_CONFIG,
): SearchResult {
  const radius = widenSearch(failedAttempts, cfg);
  const searchRadius = { force: radius.forceRadius, angle: radius.angleRadius };

  const realResult = simulate(screen, realInput);
  if (realResult.success) {
    return { ...realResult, variationsChecked: 1, searchRadius, wasAdjusted: false };
  }

  let best: SimResult | null = null;
  let bestDist = Infinity;
  let checked = 1;

  for (let i = 0; i < radius.sampleCount; i++) {
    const candidate: PlayerInput = {
      contraptionId: realInput.contraptionId,
      force: clamp(realInput.force + (Math.random() * 2 - 1) * radius.forceRadius, 0, 1),
      angle: realInput.angle + (Math.random() * 2 - 1) * radius.angleRadius,
    };
    const result = simulate(screen, candidate);
    checked++;
    if (result.success) {
      const d = distanceToReal(candidate, realInput, { force: radius.forceRadius, angle: radius.angleRadius });
      if (d < bestDist) {
        best = result;
        bestDist = d;
      }
    }
  }

  if (best) {
    return { ...best, variationsChecked: checked, searchRadius, wasAdjusted: true };
  }

  return { ...realResult, variationsChecked: checked, searchRadius, wasAdjusted: false };
}
