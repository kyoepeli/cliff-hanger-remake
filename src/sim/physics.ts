import RAPIER from '@dimforge/rapier3d-compat';
import type {
  ScreenDef,
  PlayerInput,
  SimResult,
  TrajectoryFrame,
  SceneObject,
  Vec3,
  Quat,
} from './types.js';
import { IDENTITY_QUAT } from './types.js';

let rapierReady: Promise<void> | null = null;
/** Rapier's WASM init is async and must only run once per process. */
export function ensureRapierInit(): Promise<void> {
  if (!rapierReady) rapierReady = RAPIER.init();
  return rapierReady;
}

const FIXED_DT = 1 / 60;
/** Record a trajectory frame every N physics steps to keep replay data small. */
const FRAME_SAMPLE_STRIDE = 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Position of the bandit along its waypoint path at time t (seconds). */
function banditPositionAt(path: ScreenDef['bandit'], t: number): Vec3 {
  const { waypoints, speed } = path;
  let remaining = speed * t;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (remaining <= segLen) {
      const f = segLen === 0 ? 0 : remaining / segLen;
      return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), z: lerp(a.z, b.z, f) };
    }
    remaining -= segLen;
  }
  return waypoints[waypoints.length - 1];
}

function shapeToCollider(shape: SceneObject['shape']): RAPIER.ColliderDesc {
  return shape.kind === 'sphere'
    ? RAPIER.ColliderDesc.ball(shape.radius)
    : RAPIER.ColliderDesc.cuboid(shape.width / 2, shape.height / 2, shape.depth / 2);
}

/**
 * Run one full physics simulation of a screen for a given input. Same
 * screen + same input always produces the same result (no hidden
 * randomness), so the search module can sample a neighborhood of inputs
 * and trust that differences in outcome come from the input, not noise.
 */
export function simulate(screen: ScreenDef, input: PlayerInput): SimResult {
  const world = new RAPIER.World({ x: 0, y: screen.gravity, z: 0 });

  const bodies = new Map<
    string,
    { rb: RAPIER.RigidBody; role: SceneObject['role']; destructible?: SceneObject }
  >();
  const destroyed = new Set<string>();
  const crewHit = new Set<string>();
  let killedBy: string | undefined;

  const contraption = screen.objects.find((o) => o.id === input.contraptionId);
  if (!contraption || !contraption.launch) {
    throw new Error(`Unknown or non-launching contraption id: ${input.contraptionId}`);
  }

  // --- level objects ---
  for (const obj of screen.objects) {
    if (obj.role === 'contraption') continue; // the trigger point itself has no body
    const desc = obj.isStatic ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(obj.position.x, obj.position.y, obj.position.z);
    if (obj.rotation) desc.setRotation(obj.rotation);
    const rb = world.createRigidBody(desc);

    const colliderDesc = shapeToCollider(obj.shape)
      .setFriction(obj.friction ?? 0.5)
      .setRestitution(obj.restitution ?? 0.2)
      .setDensity(obj.density ?? 1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    if (obj.destructible) {
      colliderDesc.setActiveEvents(
        RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS,
      );
      colliderDesc.setContactForceEventThreshold(obj.destructionThreshold ?? 5000);
    }
    world.createCollider(colliderDesc, rb);
    bodies.set(obj.id, { rb, role: obj.role, destructible: obj.destructible ? obj : undefined });
  }

  // --- bandit: kinematic sensor, position driven manually each step ---
  const start = screen.bandit.waypoints[0];
  const banditRb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z),
  );
  world.createCollider(
    shapeToCollider(screen.bandit.shape)
      .setSensor(true)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    banditRb,
  );
  bodies.set('bandit', { rb: banditRb, role: 'crew' /* unused for bandit logic */ });

  // --- projectile spawned by the chosen contraption ---
  const vel = contraption.launch.forceToVelocity(input.force, input.angle);
  const projShape = contraption.launch.projectile;
  const projRb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(contraption.position.x, contraption.position.y, contraption.position.z)
      .setLinvel(vel.x, vel.y, vel.z)
      .setLinearDamping(projShape.linearDamping ?? 0)
      .setAngularDamping(projShape.angularDamping ?? 0),
  );
  world.createCollider(
    shapeToCollider(projShape.shape)
      .setFriction(projShape.friction ?? 0.5)
      .setRestitution(projShape.restitution ?? 0.3)
      .setDensity(projShape.density ?? 1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    projRb,
  );
  const projectileId = `${contraption.id}:projectile`;
  bodies.set(projectileId, { rb: projRb, role: 'contraption' });

  const handleToId = new Map<number, string>();
  for (const [id, b] of bodies) handleToId.set(b.rb.handle, id);

  const eventQueue = new RAPIER.EventQueue(true);
  const trajectory: TrajectoryFrame[] = [];

  let t = 0;
  let dead = false;
  const maxSteps = Math.ceil(screen.maxSimSeconds / FIXED_DT);

  for (let step = 0; step < maxSteps && !dead; step++) {
    t = step * FIXED_DT;
    banditRb.setNextKinematicTranslation(banditPositionAt(screen.bandit, t));

    world.step(eventQueue);

    eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started || dead) return;
      const c1 = world.getCollider(h1);
      const c2 = world.getCollider(h2);
      if (!c1 || !c2) return;
      const id1 = handleToId.get(c1.parent()?.handle ?? -1);
      const id2 = handleToId.get(c2.parent()?.handle ?? -1);
      if (!id1 || !id2) return;

      if (id1 === 'bandit' || id2 === 'bandit') {
        dead = true;
        killedBy = id1 === 'bandit' ? id2 : id1;
        return;
      }

      // projectile-vs-crew contact, purely informational
      if (id1 === projectileId || id2 === projectileId) {
        const other = id1 === projectileId ? id2 : id1;
        if (bodies.get(other)?.role === 'crew') crewHit.add(other);
      }
    });

    eventQueue.drainContactForceEvents((event) => {
      const c1 = world.getCollider(event.collider1());
      const c2 = world.getCollider(event.collider2());
      const id1 = c1 ? handleToId.get(c1.parent()?.handle ?? -1) : undefined;
      const id2 = c2 ? handleToId.get(c2.parent()?.handle ?? -1) : undefined;
      for (const id of [id1, id2]) {
        if (!id) continue;
        const entry = bodies.get(id);
        const def = entry?.destructible;
        if (def && !destroyed.has(id) && event.totalForceMagnitude() >= (def.destructionThreshold ?? 5000)) {
          // "Break" it: swap the fixed body for a dynamic one at the same
          // pose so it now falls/topples under normal physics.
          const oldRb = entry.rb;
          const pos = oldRb.translation();
          const rot = oldRb.rotation();
          world.removeRigidBody(oldRb);
          const newRb = world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation(rot),
          );
          world.createCollider(
            shapeToCollider(def.shape)
              .setFriction(def.friction ?? 0.7)
              .setDensity(def.density ?? 3)
              .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
            newRb,
          );
          bodies.set(id, { rb: newRb, role: entry!.role });
          handleToId.set(newRb.handle, id);
          destroyed.add(id);
        }
      }
    });

    if (step % FRAME_SAMPLE_STRIDE === 0 || dead) {
      const frame: TrajectoryFrame = { t, bodies: {} };
      for (const [id, b] of bodies) {
        const p = b.rb.translation();
        const r: Quat = b.rb.rotation() ?? IDENTITY_QUAT;
        frame.bodies[id] = {
          position: { x: p.x, y: p.y, z: p.z },
          rotation: { x: r.x, y: r.y, z: r.z, w: r.w },
          alive: true,
        };
      }
      trajectory.push(frame);
    }
  }

  world.free();

  return {
    success: dead,
    input,
    killedBy,
    destroyedObjects: [...destroyed],
    crewHit: [...crewHit],
    trajectory,
    durationSeconds: t,
  };
}
