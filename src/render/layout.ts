import { PerspectiveCamera, Vector2, Vector3, Raycaster, Plane } from 'three';

/**
 * The static wide camera used for all live gameplay. It never moves.
 * World: +x right, +y up, +z toward the camera (camera looks down -z).
 *
 * The horizontal field of view is what's locked; the vertical FOV is
 * derived from the window's aspect ratio so the same slice of the world is
 * visible left-to-right on any screen shape.
 */
export const CAMERA_POS = new Vector3(0, 3, 9);
export const CAMERA_TARGET = new Vector3(0, 1.5, -4);
export const HFOV_DEG = 75;
const MAX_VFOV_DEG = 100;

/** Where the hero may walk (world x/z on the ground plane). */
export const GROUND_BOUNDS = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };

export function verticalFovDeg(aspect: number): number {
  const h = (HFOV_DEG * Math.PI) / 180;
  const v = 2 * Math.atan(Math.tan(h / 2) / aspect);
  return Math.min(MAX_VFOV_DEG, (v * 180) / Math.PI);
}

export function makeCamera(aspect: number): PerspectiveCamera {
  const cam = new PerspectiveCamera(verticalFovDeg(aspect), aspect, 0.1, 200);
  cam.position.copy(CAMERA_POS);
  cam.lookAt(CAMERA_TARGET);
  cam.updateMatrixWorld();
  return cam;
}

export function setCameraAspect(cam: PerspectiveCamera, aspect: number) {
  cam.aspect = aspect;
  cam.fov = verticalFovDeg(aspect);
  cam.updateProjectionMatrix();
}

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();

/** Cast a ray from the camera through an NDC point onto the y=0 ground plane. */
export function screenToGround(ndc: { x: number; y: number }, cam: PerspectiveCamera): Vector3 | null {
  raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), cam);
  const hit = new Vector3();
  return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
}

export function clampToBounds(p: { x: number; z: number }) {
  return {
    x: Math.max(GROUND_BOUNDS.minX, Math.min(GROUND_BOUNDS.maxX, p.x)),
    z: Math.max(GROUND_BOUNDS.minZ, Math.min(GROUND_BOUNDS.maxZ, p.z)),
  };
}
