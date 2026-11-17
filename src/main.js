import * as THREE from 'three';
import { Input } from './input.js';
import { Hero, buildHeroModel } from './hero.js';
import { Dummy } from './dummy.js';
import { FxManager } from './fx.js';
import { HEROES } from './data/heroes.js';
import { showHeroSelect } from './select.js';

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

// --- Câmera 3/4 de cima ---
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
const CAM_OFFSET = new THREE.Vector3(0, 15, 10.5);

// --- Luzes ---
scene.add(new THREE.HemisphereLight(0xffe8c8, 0x403040, 0.9));
const sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
sun.position.set(10, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 });
scene.add(sun, sun.target);

// --- Arena de treino ---
const tileGeo = new THREE.BoxGeometry(1.95, 0.2, 1.95);
const tileMats = [0x5a5560, 0x635d68, 0x544f5a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
for (let x = -11; x < 11; x++) for (let z = -11; z < 11; z++) {
  const t = new THREE.Mesh(tileGeo, tileMats[(x * 7 + z * 13) & 1 ? 0 : (x + z) % 3 === 0 ? 2 : 1]);
  t.position.set(x * 2 + 1, -0.1, z * 2 + 1);
  t.receiveShadow = true;
  scene.add(t);
}
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x7a7080, roughness: 0.8 });
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 5, 8), pillarMat);
  p.position.set(Math.cos(a) * 21, 2.5, Math.sin(a) * 21);
  p.castShadow = true;
  scene.add(p);
}

// Galeria: os heróis ainda não jogáveis ficam parados no fundo da arena, em pedestais.
const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x3a3542, roughness: 0.9 });
function buildGallery(exceptId) {
  const others = HEROES.filter((h) => h.id !== exceptId);
  others.forEach((h, i) => {
    const x = (i - (others.length - 1) / 2) * 3.2;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.4, 12), pedestalMat);
    ped.position.set(x, 0.2, -15); ped.receiveShadow = true; ped.castShadow = true;
    const { root } = buildHeroModel(h);
    root.position.set(x, 0.4, -15);
    scene.add(ped, root);
  });
}

// --- Estado do jogo ---
const input = new Input(camera, renderer.domElement);
const fx = new FxManager(scene, camera);
let hero = null;
const dummies = [[-5, -4], [5, -5], [0, -8], [-7, 4], [7, 3]].map(([x, z]) => new Dummy(scene, x, z));

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
  } catch (e) { /* iPhone não suporta: adicionar à tela inicial */ }
});

let shake = 0;
function startGame(def) {
  hero = new Hero(scene, def);
  document.getElementById('hero-name').textContent = `${def.nome} · ${def.titulo}`;
  buildGallery(def.id);
}

// --- Loop ---
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (hero) {
    let aim = input.updateAim();
    if (input.isTouch) { aim = autoAim(); aimRing.visible = false; }
    aimRing.position.set(aim.x, 0.02, aim.z);

    const ev = hero.update(dt, input, aim);
    if (ev === 'impact') {
      // Martelo bate no chão: dano em área na frente do herói + FX.
      const hit = hero.position.clone().addScaledVector(hero.forward(), 1.6);
      fx.play('dalarian-impacto', hit, { scale: 4 });
      shake = 0.18;
      for (const d of dummies) {
        if (d.alive && d.mesh.position.clone().setY(0).distanceTo(hit) < 2.2) d.hit(25, hit);
      }
    }

    const target = hero.position.clone().add(CAM_OFFSET);
    camera.position.lerp(target, 1 - Math.pow(0.001, dt));
    camera.lookAt(hero.position.x, 0.8, hero.position.z);
    if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
    sun.position.set(hero.position.x + 10, 20, hero.position.z + 8);
    sun.target.position.copy(hero.position);
  } else {
    // Fundo da seleção: câmera girando devagar.
    const t = performance.now() / 6000;
    camera.position.set(Math.sin(t) * 18, 12, Math.cos(t) * 18);
    camera.lookAt(0, 0, 0);
  }

  dummies.forEach((d) => d.update(dt));
  fx.update(dt);
  input.consume();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
showHeroSelect(startGame);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
