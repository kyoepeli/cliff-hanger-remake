/**
 * Core types for the headless precalc/simulation module (3D).
 *
 * This module knows nothing about rendering, input devices, or UI. It takes
 * a screen definition and a player's (force, angle) input, and answers one
 * question: "given this input, and how many times the player has already
 * failed this screen, what actually happens?"
 *
 * World convention: right-handed, +x right, +y up, +z TOWARD the camera.
 * The static wide camera looks down -z, so the bandit walks from the
 * horizon (large negative z) toward the front of the scene (z near 0).
 *
 * Design rule (see docs/design-doc.md): there is NO per-act/per-level
 * gating of what counts as a valid kill. Environment objects and crew
 * objects, if present in a ScreenDef, are always eligible collision targets
 * and always eligible kill vectors, from level 1 onward. What differs
 * between an "early" screen and a "late" screen is purely how the screen
 * is authored and how the game presents/reveals it — never a rule change
 * in this module.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Unit quaternion. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export const IDENTITY_QUAT: Quat = { x: 0, y: 0, z: 0, w: 1 };

export type Shape =
  | { kind: 'sphere'; radius: number }
  | { kind: 'box'; width: number; height: number; depth: number };

/**
 * What role an object plays. Metadata for authoring/UI/replay only — it
 * never changes how the physics treats the object. A 'crew' object and a
 * 'contraption' object are both just rigid bodies to Rapier.
 */
export type ObjectRole = 'contraption' | 'environment' | 'crew' | 'decoration';

export interface SceneObject {
  id: string;
  role: ObjectRole;
  shape: Shape;
  position: Vec3;
  rotation?: Quat;
  isStatic: boolean;
  density?: number;
  friction?: number;
  restitution?: number;
  /**
   * If true, this object breaks free / topples once an impact exceeds
   * `destructionThreshold` (a static body is swapped for a dynamic one).
   */
  destructible?: boolean;
  destructionThreshold?: number;
  /**
   * True for the small set of objects the hero can walk up to and
   * hold-click to trigger. Environment and crew objects are never directly
   * interactive — they're just physically present and can be hit.
   */
  isInteractive?: boolean;
  /**
   * For interactive objects: how (force, angle) map to an initial launch
   * velocity for a projectile spawned at `position`. Each contraption
   * defines its own mapping, so wildly different contraptions can share
   * this interface. Convention for the default contraptions: force is
   * power (0..1) and angle is the horizontal aim (azimuth) in radians.
   */
  launch?: {
    projectile: Omit<SceneObject, 'id' | 'role' | 'isStatic' | 'isInteractive' | 'launch'> & {
      linearDamping?: number;
      angularDamping?: number;
    };
    forceToVelocity: (force: number, angle: number) => Vec3;
  };
}

export interface BanditPath {
  /** Waypoints the bandit walks through at constant speed, in order. */
  waypoints: Vec3[];
  speed: number; // units/second
  /** Collision volume for the bandit (a sensor). */
  shape: Shape;
}

export interface ScreenDef {
  id: string;
  objects: SceneObject[];
  bandit: BanditPath;
  /** World gravity, downward-positive magnitude expressed as a negative y value. */
  gravity: number;
  /** Safety cap so a bad screen def can't spin forever. */
  maxSimSeconds: number;
}

export interface PlayerInput {
  contraptionId: string;
  /** Normalized 0..1, as locked in by whichever input tier was used. */
  force: number;
  /** Radians. */
  angle: number;
}

/** One sampled frame of every body's pose, for replay rendering. */
export interface TrajectoryFrame {
  t: number;
  bodies: Record<string, { position: Vec3; rotation: Quat; alive: boolean }>;
}

export interface SimResult {
  success: boolean;
  /** The (force, angle) actually simulated — may differ from the player's
   * real input if this came from the search. */
  input: PlayerInput;
  killedBy?: string;
  destroyedObjects: string[];
  crewHit: string[];
  trajectory: TrajectoryFrame[];
  durationSeconds: number;
}

export interface SearchResult extends SimResult {
  variationsChecked: number;
  searchRadius: { force: number; angle: number };
  /** True if `input` differs from the player's real input (a "found" solution). */
  wasAdjusted: boolean;
}
