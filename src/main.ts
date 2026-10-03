import * as THREE from 'three';
import { makeCamera, setCameraAspect, screenToGround, clampToBounds, type WalkBounds } from './render/layout.js';
import { buildStage } from './render/stage.js';
import { SimClient } from './sim/client.js';
import { EasyTierMeter, DEFAULT_EASY_CONFIG } from './input/easyTierMeter.js';
import { getScreen } from './screens/index.js';
import { LEDGE } from './screens/test-fixture.js';
import type { PlayerInput, SearchResult, TrajectoryFrame } from './sim/types.js';

// --- game data ---------------------------------------------------------------
const SCREEN_ID = 'test-fixture';
const screen = getScreen(SCREEN_ID);
const contraption = screen.objects.find((o) => o.isInteractive)!;
const cPos = new THREE.Vector3(contraption.position.x, contraption.position.y, contraption.position.z);
const wp0 = screen.bandit.waypoints[0];
const banditStart = new THREE.Vector3(wp0.x, wp0.y, wp0.z);
const projectileId = `${contraption.id}:projectile`;

const REACH = 1.6; // how close (on the ledge) the hero must be to test an object
const WALK_Y = LEDGE.topY; // the hero's whole reachable area for this screen is the ledge
const WALK_BOUNDS: WalkBounds = {
  minX: LEDGE.center.x - LEDGE.halfWidth,
  maxX: LEDGE.center.x + LEDGE.halfWidth,
  minZ: LEDGE.center.z - LEDGE.halfDepth,
  maxZ: LEDGE.center.z + LEDGE.halfDepth,
};
const HERO_SPEED = 3.2;
const MIN_WINDUP = 0.7; // seconds; the wind-up also absorbs any search compute time

// --- DOM ---------------------------------------------------------------------
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const hudTake = $('hud-take');
const hudStatus = $('hud-status');
const meterEl = $('meter');
const meterLabel = $('meter-label');
const meterMarker = $('meter-marker');
const banner = $('banner');

// --- three setup ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);

const camera = makeCamera(window.innerWidth / window.innerHeight);
const stage = buildStage(cPos, banditStart);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  setCameraAspect(camera, window.innerWidth / window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

// --- sim worker ------------------------------------------------------------------
const sim = new SimClient();
let simReady = false;
hudStatus.textContent = 'loading physics engine…';
sim.warmup().then(
  () => {
    simReady = true;
    setIdleStatus();
  },
  (e) => (hudStatus.textContent = `physics failed to load: ${e}`),
);

// --- state -------------------------------------------------------------------------
type Mode = 'free' | 'meter' | 'windup' | 'playback' | 'result';
let mode: Mode = 'free';
let failedAttempts = 0;
const meter = new EasyTierMeter();
let heroTarget: { x: number; z: number } | null = null;

let windupStart = 0;
let pendingResult: SearchResult | null = null;
let playback: { result: SearchResult; start: number; idx: number } | null = null;
let resultStart = 0;
let resultShownAt = 0;
let lastHit = false;

const setIdleStatus = () =>
  (hudStatus.textContent = simReady
    ? 'click the boulder to test it · click the ledge to shift your footing'
    : 'loading physics engine…');

// --- input ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();

function ndcOf(ev: PointerEvent) {
  const r = renderer.domElement.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * 2 - 1, y: -((ev.clientY - r.top) / r.height) * 2 + 1 };
}

const heroDistToContraption = () =>
  Math.hypot(stage.hero.position.x - cPos.x, stage.hero.position.z - cPos.z);

renderer.domElement.addEventListener('pointerdown', (ev) => {
  const ndc = ndcOf(ev);

  if (mode === 'meter') {
    if (meter.tap() === 'done') launch();
    return;
  }
  if (mode !== 'free') return;

  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const clickedBoulder = raycaster.intersectObject(stage.boulderHitProxy).length > 0;

  if (clickedBoulder) {
    if (!simReady) return;
    if (heroDistToContraption() <= REACH) {
      // press-on-object reveals the meter; this same press is tap 1
      meter.reset();
      meter.tap();
      mode = 'meter';
      heroTarget = null;
    } else {
      heroTarget = clampToBounds({ x: cPos.x - 0.7, z: cPos.z + 0.5 }, WALK_BOUNDS);
      hudStatus.textContent = 'stepping closer…';
    }
    return;
  }

  const ground = screenToGround(ndc, camera, WALK_Y);
  if (ground) heroTarget = clampToBounds(ground, WALK_BOUNDS);
});

function launch() {
  const input: PlayerInput = {
    contraptionId: contraption.id,
    force: meter.current.force!,
    angle: meter.current.angle!,
  };
  mode = 'windup';
  windupStart = performance.now() / 1000;
  pendingResult = null;
  meterEl.hidden = true;
  hudStatus.textContent = '…';
  sim.runAttempt(SCREEN_ID, input, failedAttempts).then(
    (r) => (pendingResult = r),
    (e) => {
      hudStatus.textContent = `simulation error: ${e}`;
      resetToFree();
    },
  );
}

// --- playback helpers -------------------------------------------------------------------
const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

function applyFrame(frames: TrajectoryFrame[], e: number, pb: { idx: number }) {
  while (pb.idx < frames.length - 2 && frames[pb.idx + 1].t <= e) pb.idx++;
  const a = frames[pb.idx];
  const b = frames[Math.min(pb.idx + 1, frames.length - 1)];
  const k = b.t > a.t ? Math.min(1, Math.max(0, (e - a.t) / (b.t - a.t))) : 0;

  const pose = (id: string, obj: THREE.Object3D) => {
    const pa = a.bodies[id];
    const pbd = b.bodies[id];
    if (!pa || !pbd) return;
    obj.position.set(
      pa.position.x + (pbd.position.x - pa.position.x) * k,
      pa.position.y + (pbd.position.y - pa.position.y) * k,
      pa.position.z + (pbd.position.z - pa.position.z) * k,
    );
    qa.set(pa.rotation.x, pa.rotation.y, pa.rotation.z, pa.rotation.w);
    qb.set(pbd.rotation.x, pbd.rotation.y, pbd.rotation.z, pbd.rotation.w);
    obj.quaternion.copy(qa.slerp(qb, k));
  };
  pose(projectileId, stage.projectile);
  // the bandit is a kinematic sensor: take position only, keep upright
  const ba = a.bodies['bandit'];
  const bb = b.bodies['bandit'];
  if (ba && bb) {
    stage.bandit.position.set(
      ba.position.x + (bb.position.x - ba.position.x) * k,
      ba.position.y + (bb.position.y - ba.position.y) * k,
      ba.position.z + (bb.position.z - ba.position.z) * k,
    );
  }
}

function resetToFree() {
  mode = 'free';
  playback = null;
  pendingResult = null;
  lastHit = false;
  meter.reset();
  meterEl.hidden = true;
  banner.classList.remove('show');
  stage.bandit.position.copy(banditStart);
  stage.bandit.rotation.set(0, 0, 0);
  (stage.banditBody.material as THREE.MeshStandardMaterial).color.setHex(0x5a3a26);
  stage.ledgeBoulder.visible = true;
  stage.ledgeBoulder.position.copy(cPos);
  stage.projectile.visible = false;
  setIdleStatus();
}

// --- main loop ---------------------------------------------------------------------------
let last = performance.now();
function frame(nowMs: number) {
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  const now = nowMs / 1000;

  // hero walking (always allowed while free)
  if (mode === 'free' && heroTarget) {
    const dx = heroTarget.x - stage.hero.position.x;
    const dz = heroTarget.z - stage.hero.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.06) {
      heroTarget = null;
      if (hudStatus.textContent?.startsWith('too far')) setIdleStatus();
    } else {
      const step = Math.min(d, HERO_SPEED * dt);
      stage.hero.position.x += (dx / d) * step;
      stage.hero.position.z += (dz / d) * step;
      stage.hero.rotation.y = Math.atan2(dx, dz);
    }
  }

  if (mode === 'meter') {
    meter.tick(dt);
    const phase = meter.current.phase;
    if (phase === 'force' || phase === 'angle') {
      const range = phase === 'force' ? DEFAULT_EASY_CONFIG.force : DEFAULT_EASY_CONFIG.angle;
      const frac = (meter.current.liveValue - range.min) / (range.max - range.min);
      meterEl.hidden = false;
      meterLabel.textContent = phase === 'force' ? 'FORCE — tap to lock' : 'AIM — tap to lock';
      meterMarker.style.left = `${frac * 100}%`;
    }
  }

  if (mode === 'windup') {
    // The boulder trembles on its ledge. The tremble grows the longer the
    // search takes, so a heavier precalc just reads as a bigger wind-up.
    const waited = now - windupStart;
    const amp = 0.02 + Math.min(1, waited / 4) * 0.09;
    stage.ledgeBoulder.position.set(
      cPos.x + Math.sin(now * 47) * amp,
      cPos.y + Math.sin(now * 61) * amp * 0.6,
      cPos.z + Math.cos(now * 53) * amp,
    );
    if (pendingResult && waited >= MIN_WINDUP) {
      playback = { result: pendingResult, start: now, idx: 0 };
      stage.ledgeBoulder.visible = false;
      stage.projectile.visible = true;
      mode = 'playback';
      hudStatus.textContent = 'rolling…';
    }
  }

  if (mode === 'playback' && playback) {
    const e = now - playback.start;
    applyFrame(playback.result.trajectory, e, playback);
    if (e >= playback.result.durationSeconds + 0.3) {
      const hit = playback.result.success;
      failedAttempts = hit ? 0 : failedAttempts + 1;
      hudTake.textContent = `TAKE ${failedAttempts + 1}`;
      banner.textContent = hit ? 'GOT HIM!' : 'MISSED!';
      banner.className = `show ${hit ? 'hit' : 'miss'}`;
      hudStatus.textContent = playback.result.wasAdjusted
        ? 'lucky bounce — the search found a way'
        : hit
          ? 'clean shot'
          : 'search radius widens with every miss';
      lastHit = hit;
      resultStart = now;
      resultShownAt = now;
      mode = 'result';
      if (hit) (stage.banditBody.material as THREE.MeshStandardMaterial).color.setHex(0xc0392b);
    }
  }

  if (mode === 'result') {
    // a hit knocks the bandit over backwards; a miss just lets him walk on
    if (lastHit) {
      const k = Math.min(1, (now - resultStart) / 0.35);
      stage.bandit.rotation.x = -k * (Math.PI / 2);
    }
    if (now - resultShownAt > 1.6) resetToFree();
  }

  renderer.render(stage.scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
