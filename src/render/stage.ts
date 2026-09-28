import * as THREE from 'three';
import { CAMERA_POS } from './layout.js';

/** Everything visual in the live (static wide camera) view. */
export interface Stage {
  scene: THREE.Scene;
  hero: THREE.Group;
  bandit: THREE.Group;
  banditBody: THREE.Mesh;
  ledgeBoulder: THREE.Mesh;
  /** Larger invisible sphere so the contraption is easy to click/tap. */
  boulderHitProxy: THREE.Mesh;
  projectile: THREE.Mesh;
}

const SAND = 0xd9a45b;
const FOG = 0xffcf8a;

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

export function buildStage(contraptionPos: THREE.Vector3, banditStart: THREE.Vector3): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 16, 46);

  scene.add(new THREE.HemisphereLight(0xfff2d6, 0x8a5a3a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
  sun.position.set(-6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -24, near: 1, far: 50 });
  scene.add(sun);

  // ground + road
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(24, 1, 30),
    new THREE.MeshStandardMaterial({ color: SAND, roughness: 1 }),
  );
  ground.position.set(0, -0.5, -8);
  scene.add(shadowed(ground));

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 24),
    new THREE.MeshStandardMaterial({ color: 0xc08a48, roughness: 1 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, -11);
  road.receiveShadow = true;
  scene.add(road);

  // distant mesas, swallowed by fog for depth
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0xa8683a, flatShading: true, roughness: 1 });
  [-16, -7, 4, 14].forEach((x, i) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(5 + (i % 2) * 2, 5 + i, 6), mesaMat);
    m.position.set(x, 2.2, -32 - (i % 2) * 4);
    scene.add(m);
  });

  // a few cacti for scale
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3f6b4a, roughness: 0.9 });
  [[3.4, -2], [-4.2, -6], [4.8, -9], [-5, -14], [5.2, -16]].forEach(([x, z]) => {
    const c = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8), cactusMat);
    trunk.position.y = 0.7;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), cactusMat);
    arm.position.set(0.3, 0.9, 0);
    arm.rotation.z = -0.9;
    c.add(trunk, arm);
    c.position.set(x, 0, z);
    scene.add(shadowed(c));
  });

  // ledge pedestal the boulder sits on (decorative; the sim only has ground)
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, contraptionPos.y - 0.35, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x8a5a3a, flatShading: true, roughness: 1 }),
  );
  pedestal.position.set(contraptionPos.x - 0.9, (contraptionPos.y - 0.35) / 2, contraptionPos.z);
  scene.add(shadowed(pedestal));

  // boulder resting on the ledge, plus a bigger invisible click target
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b5442, flatShading: true, roughness: 1 });
  const ledgeBoulder = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), rockMat);
  ledgeBoulder.position.copy(contraptionPos);
  scene.add(shadowed(ledgeBoulder));

  const boulderHitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  boulderHitProxy.position.copy(contraptionPos);
  scene.add(boulderHitProxy);

  // the flying boulder during playback (same look, hidden until launch)
  const projectile = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 1), rockMat);
  projectile.visible = false;
  scene.add(shadowed(projectile));

  // hero
  const hero = new THREE.Group();
  const heroBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.6, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0x2f6b4f, roughness: 0.8 }),
  );
  heroBody.position.y = 0.52;
  const heroHat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0xe9d7a8 }),
  );
  heroHat.position.y = 1.12;
  hero.add(heroBody, heroHat);
  hero.position.set(3, 0, 3);
  scene.add(shadowed(hero));

  // bandit (origin at body center, matching the sim's bandit body)
  const bandit = new THREE.Group();
  const banditBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.9 }),
  );
  const banditHat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.07, 12),
    new THREE.MeshStandardMaterial({ color: 0x1c130d }),
  );
  banditHat.position.y = 0.42;
  const banditCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.2, 0.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x1c130d }),
  );
  banditCrown.position.y = 0.52;
  bandit.add(banditBody, banditHat, banditCrown);
  bandit.position.copy(banditStart);
  scene.add(shadowed(bandit));

  return { scene, hero, bandit, banditBody, ledgeBoulder, boulderHitProxy, projectile };
}

/** Distance helper so main can position lights/effects relative to the camera if needed. */
export const cameraDistanceTo = (p: THREE.Vector3) => p.distanceTo(CAMERA_POS);
