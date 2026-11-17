import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildCharacter, Animator } from './rig.js';
import { HEROES } from './data/heroes.js';

// Visualizador: escolha um herói e veja as animações em loop.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2633);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
const params = new URLSearchParams(location.search);
const camAng = parseFloat(params.get('ang') || '0.6');
const camDist = parseFloat(params.get('dist') || '7.5');
const camY = parseFloat(params.get('ty') || '0.95');
camera.position.set(Math.sin(camAng) * camDist, camY + 1.45 * camDist / 7.5, Math.cos(camAng) * camDist);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, camY, 0);
if (params.has('noui')) document.getElementById('ui').style.display = 'none';
controls.update();

scene.add(new THREE.HemisphereLight(0xffe8c8, 0x403040, 1.0));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
sun.position.set(4, 8, 5); sun.castShadow = true;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x8ab0ff, 1.2);
rim.position.set(-4, 3, -5);
scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({ color: 0x4a4552, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);

let rig = null, anim = null, current = params.get('anim') || 'idle';
const ANIMS = ['idle', 'run', 'ataque', 'consagracao', 'protecao', 'esquiva', 'dano'];
let loopTimer = 0, variante = 0;

function setHero(def) {
  if (rig) scene.remove(rig.root);
  rig = buildCharacter(def);
  scene.add(rig.root);
  anim = new Animator(rig, def.arma);
  document.querySelectorAll('#heroes button').forEach((b) => b.classList.toggle('on', b.dataset.id === def.id));
}

const hb = document.getElementById('heroes');
for (const h of HEROES) {
  const b = document.createElement('button');
  b.textContent = h.nome; b.dataset.id = h.id;
  b.onclick = () => setHero(h);
  hb.append(b);
}
const ab = document.getElementById('anims');
for (const a of ANIMS) {
  const b = document.createElement('button');
  b.textContent = a; b.dataset.a = a;
  b.onclick = () => { current = a; loopTimer = 0; refresh(); };
  ab.append(b);
}
function refresh() { document.querySelectorAll('#anims button').forEach((b) => b.classList.toggle('on', b.dataset.a === current)); }
refresh();
setHero(HEROES.find((h) => h.id === params.get('hero')) || HEROES[0]);

// Modo de teste: congela a animação num instante (?anim=ataque&n=0.5)
const freezeN = params.has('n') ? parseFloat(params.get('n')) : null;

const clock = new THREE.Clock();
function tick() {
  let dt = Math.min(clock.getDelta(), 0.05) * parseFloat(document.getElementById('speed').value);
  if (freezeN !== null) {
    anim.action = null; anim.prevAction = null;
    if (current === 'run') { anim.speed = 1; anim.t = freezeN; anim.update(0, 1); }
    else if (current === 'idle') anim.update(0, 0);
    else { anim.play(current); anim.action.n = freezeN; anim.update(0, 0); }
  } else {
    const moving = current === 'run';
    if (!['idle', 'run'].includes(current)) {
      loopTimer -= dt;
      if (loopTimer <= 0) { variante ^= 1; anim.play(current, { variante }); loopTimer = 1.4; }
    }
    anim.update(dt, moving ? 1 : 0);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
