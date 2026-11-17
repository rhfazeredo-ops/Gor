import * as THREE from 'three';
import { Input } from './input.js';
import { Hero } from './hero.js';
import { Dummy } from './dummy.js';

// --- Renderizador e cena ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2633);
scene.fog = new THREE.Fog(0x2a2633, 30, 60);

// --- Câmera 3/4 de cima (estilo ação RPG) ---
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
const CAM_OFFSET = new THREE.Vector3(0, 16, 11);

// --- Luzes ---
scene.add(new THREE.HemisphereLight(0xffe8c8, 0x403040, 0.9));
const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
sun.position.set(10, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
scene.add(sun, sun.target);

// --- Chão em ladrilhos de pedra ---
const tileGeo = new THREE.BoxGeometry(1.95, 0.2, 1.95);
const tileMats = [0x5a5560, 0x635d68, 0x544f5a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
for (let x = -12; x < 12; x++) {
  for (let z = -12; z < 12; z++) {
    const t = new THREE.Mesh(tileGeo, tileMats[(x * 7 + z * 13) & 1 ? 0 : (x + z) % 3 === 0 ? 2 : 1]);
    t.position.set(x * 2 + 1, -0.1, z * 2 + 1);
    t.receiveShadow = true;
    scene.add(t);
  }
}

// Pilares nas bordas da arena.
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x7a7080, roughness: 0.8 });
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 5, 8), pillarMat);
  p.position.set(Math.cos(a) * 22, 2.5, Math.sin(a) * 22);
  p.castShadow = true;
  scene.add(p);
}

// --- Entidades ---
const input = new Input(camera, renderer.domElement);
const hero = new Hero(scene);
const dummies = [[-5, -4], [5, -5], [0, -9], [-7, 4], [7, 3]].map(([x, z]) => new Dummy(scene, x, z));

// Marcador da mira no chão.
const aimRing = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.5, 24),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7 })
);
aimRing.rotation.x = -Math.PI / 2;
scene.add(aimRing);

// Mira automática no celular: inimigo mais próximo, senão a direção do movimento.
const touchAim = new THREE.Vector3();
function autoAim() {
  let best = null, bestD = 7;
  for (const d of dummies) {
    if (!d.alive) continue;
    const dist = d.mesh.position.distanceTo(hero.position);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  if (best) return touchAim.set(best.mesh.position.x, 0, best.mesh.position.z);
  const mv = input.moveDir();
  if (mv.lengthSq() > 0.01) touchAim.copy(hero.position).addScaledVector(mv, 3);
  return touchAim;
}

// Tela cheia + travar na horizontal (Android).
document.getElementById('btn-full').addEventListener('click', async () => {
  try {
    await document.documentElement.requestFullscreen();
    await screen.orientation.lock('landscape');
  } catch (e) { /* iPhone não suporta: jogar pela tela inicial */ }
});

// --- Loop ---
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  let aim = input.updateAim();
  if (input.isTouch) { aim = autoAim(); aimRing.visible = false; }
  aimRing.position.set(aim.x, 0.02, aim.z);

  const attacked = hero.update(dt, input, aim);
  if (attacked) {
    // Acerta bonecos num cone à frente do herói.
    const fwd = new THREE.Vector3(Math.sin(hero.root.rotation.y), 0, Math.cos(hero.root.rotation.y));
    for (const d of dummies) {
      if (!d.alive) continue;
      const to = d.mesh.position.clone().sub(hero.position).setY(0);
      if (to.length() < 2.4 && to.normalize().dot(fwd) > 0.4) d.hit(20, hero.position);
    }
  }
  dummies.forEach((d) => d.update(dt));
  input.consume();

  // Câmera segue o herói com suavidade.
  const target = hero.position.clone().add(CAM_OFFSET);
  camera.position.lerp(target, 1 - Math.pow(0.001, dt));
  camera.lookAt(hero.position.x, 0.8, hero.position.z);
  sun.position.set(hero.position.x + 10, 20, hero.position.z + 8);
  sun.target.position.copy(hero.position);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
camera.position.copy(CAM_OFFSET);
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
