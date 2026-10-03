import { PerspectiveCamera, Vector2, Vector3, Raycaster, Plane } from 'three';

/**
 * The static wide camera used for all live gameplay. It never moves.
 * World: +x right, +y up, +z toward the camera (camera looks down -z).
 *
 * The horizontal field of view is what's locked; the vertical FOV is
 * derived from the window's aspect ratio so the same slice of the world is
 * visible left-to-right on any screen shape.
 */
export const CAMERA_POS = new Vector3(0, 2.6, 8);
export const CAMERA_TARGET = new Vector3(-0.6, 1.3, -4);
export const HFOV_DEG = 75;
const MAX_VFOV_DEG = 100;

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

const raycaster = new Raycaster();

/**
 * Cast a ray from the camera through an NDC point onto a horizontal plane
 * at the given y (world height). `planeY` defaults to 0 (open ground) but
 * a screen where the hero stands on an elevated ledge should pass that
 * ledge's surface height instead, or click-to-walk targets will land on
 * the wrong plane.
 */
export function screenToGround(ndc: { x: number; y: number }, cam: PerspectiveCamera, planeY = 0): Vector3 | null {
  const plane = new Plane(new Vector3(0, 1, 0), -planeY);
  raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), cam);
  const hit = new Vector3();
  return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
}

export interface WalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function clampToBounds(p: { x: number; z: number }, bounds: WalkBounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, p.x)),
    z: Math.max(bounds.minZ, Math.min(bounds.maxZ, p.z)),
  };
}
