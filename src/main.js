import * as THREE from 'three';
import { Input } from './input.js';
import { Hero, buildHeroModel, updateGallery } from './hero.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Dummy } from './dummy.js';
import { FxManager } from './fx/sprites.js';
import { FxKit } from './fx/kit.js';
import { HEROES } from './data/heroes.js';
import { showHeroSelect } from './select.js';
import { buildArena } from './arena.js';

// --- Renderizador e cena ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2633);
scene.fog = new THREE.Fog(0x2a2633, 30, 60);
// reflexos suaves para o metal e o ouro das armaduras
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;

// --- Câmera 3/4 de cima ---
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
const CAM_OFFSET = new THREE.Vector3(0, 12.5, 9);

// --- Luzes ---
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2e2a, 0.7));
const sun = new THREE.DirectionalLight(0xffe2b8, 2.0);
sun.position.set(10, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 });
scene.add(sun, sun.target);

// --- Arena de treino ---
const arena = buildArena(scene);

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
const fx = new FxManager(scene, camera);   // FX desenhados (spritesheet)
const kit = new FxKit(scene, camera);      // FX por código (shaders + partículas)
const areas = [];                          // áreas de dano contínuo (Consagração)
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

// --- Números de dano ---
const dmgLayer = document.getElementById('dmg-layer');
const floating = [];
function showDamage(pos, value, holy = false) {
  const el = document.createElement('div');
  el.className = 'dmg' + (holy ? ' holy' : '');
  el.textContent = Math.round(value);
  dmgLayer.append(el);
  floating.push({ el, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.2, 0)), t: 0 });
}
function updateDamage(dt) {
  const v = new THREE.Vector3();
  for (let i = floating.length - 1; i >= 0; i--) {
    const f = floating[i]; f.t += dt; f.pos.y += dt * 1.5;
    v.copy(f.pos).project(camera);
    f.el.style.left = ((v.x + 1) / 2) * innerWidth + 'px';
    f.el.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
    f.el.style.opacity = String(Math.min(1, 2 - f.t * 2.2));
    if (f.t > 0.9) { f.el.remove(); floating.splice(i, 1); }
  }
}

// --- Botões de habilidade ---
const skillBtns = {};
function setupSkillButtons(def) {
  const ab = hero.ab;
  for (const [k, id] of [['basico', 'btn-attack'], ['q', 'btn-q'], ['e', 'btn-e']]) {
    const el = document.getElementById(id);
    if (ab[k]) { el.style.backgroundImage = `url(./ui/${ab[k].icone})`; el.title = ab[k].nome; }
    skillBtns[k] = { el, ready: true };
  }
  document.getElementById('buttons').classList.remove('hidden');
}
function updateSkillButtons() {
  for (const [k, b] of Object.entries(skillBtns)) {
    const f = hero.cooldownFrac(k);
    b.el.style.setProperty('--cd', f.toFixed(3));
    b.el.dataset.cd = f > 0 && k !== 'basico' ? Math.ceil(hero.cd[k]) : '';
    if (f <= 0 && !b.ready) { b.el.classList.remove('ready'); void b.el.offsetWidth; b.el.classList.add('ready'); }
    b.ready = f <= 0;
  }
  document.getElementById('hp-fill').classList.toggle('shield', hero.invulneravel > 0);
}

// --- Eventos das habilidades do herói ---
function handleEvents(events) {
  for (const ev of events) {
    if (ev.tipo === 'swing') {
      kit.swingTrail(hero.position, hero.yaw, { tilt: 0.55, mirror: ev.mirror });
    }
    if (ev.tipo === 'basico-hit') {
      // Ataque básico: alvo único na frente
      const fwd = hero.forward(); const ab = hero.ab.basico;
      let alvo = null, best = 1e9;
      for (const d of dummies) {
        if (!d.alive) continue;
        const to = d.mesh.position.clone().sub(hero.position).setY(0);
        const dist = to.length();
        if (dist < ab.alcance + 0.5 && to.normalize().dot(fwd) > 0.3 && dist < best) { best = dist; alvo = d; }
      }
      const p = alvo ? alvo.mesh.position.clone().setY(1.1) : hero.position.clone().addScaledVector(fwd, 1.5).setY(1);
      kit.starburst(p, { scale: alvo ? 2.6 : 1.4 });
      kit.sparks(p, { count: alvo ? 26 : 8 });
      if (alvo) { alvo.hit(hero.atk * ab.dano, hero.position); showDamage(alvo.mesh.position, hero.atk * ab.dano); kit.shake = 0.1; }
    }
    if (ev.tipo === 'q-cast') {
      // Consagração: martelo de luz cai sobre o Dalárian e consagra a área
      const c = hero.position.clone().setY(0);
      const q = hero.ab.q;
      kit.lightHammer(c, {
        onImpact: () => {
          kit.shake = 0.35;
          kit.shockwave(c, { radius: q.raio + 1.5, duration: 0.55 });
          kit.pillar(c, { radius: 0.9, height: 10, duration: 0.7 });
          kit.starburst(c.clone().setY(1), { scale: 3.5, duration: 0.35 });
          kit.sparks(c.clone().setY(0.5), { count: 60, speed: 9, up: 5 });
          kit.consecration(c, { radius: q.raio, duration: q.duracao });
          areas.push({ pos: c, raio: q.raio, dps: hero.atk * q.danoPorSeg, resta: q.duracao, tick: 0 });
        },
      });
    }
    if (ev.tipo === 'e-cast') {
      kit.bubble(hero.root, { duration: hero.ab.e.duracao });
      kit.sparks(hero.position.clone().setY(1), { count: 30, speed: 4, up: 2, gravity: 2 });
    }
  }
}

// Dano contínuo das áreas (a cada 0,5 s).
function updateAreas(dt) {
  for (let i = areas.length - 1; i >= 0; i--) {
    const a = areas[i];
    a.resta -= dt; a.tick -= dt;
    if (a.tick <= 0) {
      a.tick = 0.5;
      for (const d of dummies) {
        if (d.alive && d.mesh.position.clone().setY(0).distanceTo(a.pos) <= a.raio + 0.4) {
          d.hit(a.dps * 0.5); showDamage(d.mesh.position, a.dps * 0.5, true);
        }
      }
    }
    if (a.resta <= 0) areas.splice(i, 1);
  }
}

function startGame(def) {
  hero = new Hero(scene, def);
  document.getElementById('hero-name').textContent = `${def.nome} · ${def.titulo}`;
  buildGallery(def.id);
  setupSkillButtons(def);
}

// --- Loop ---
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (hero) {
    let aim = input.updateAim();
    if (input.isTouch) { aim = autoAim(); aimRing.visible = false; }
    aimRing.position.set(aim.x, 0.02, aim.z);

    handleEvents(hero.update(dt, input, aim));
    updateAreas(dt);
    updateSkillButtons();

    const target = hero.position.clone().add(CAM_OFFSET);
    camera.position.lerp(target, 1 - Math.pow(0.001, dt));
    camera.lookAt(hero.position.x, 0.8, hero.position.z);
    if (kit.shake > 0) { camera.position.x += (Math.random() - 0.5) * kit.shake; camera.position.y += (Math.random() - 0.5) * kit.shake; }
    sun.position.set(hero.position.x + 10, 20, hero.position.z + 8);
    sun.target.position.copy(hero.position);
  } else {
    // Fundo da seleção: câmera girando devagar.
    const t = performance.now() / 6000;
    camera.position.set(Math.sin(t) * 18, 12, Math.cos(t) * 18);
    camera.lookAt(0, 0, 0);
  }

  updateGallery(dt);
  arena.update(clock.elapsedTime);
  dummies.forEach((d) => d.update(dt, camera));
  fx.update(dt);
  kit.update(dt);
  updateDamage(dt);
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
