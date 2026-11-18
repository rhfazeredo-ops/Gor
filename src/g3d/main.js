import * as THREE from 'three';
import { createHero } from './hero.js';
import { buildRoom, T } from './world.js';
import { Fx3D } from './fx.js';
import { toon, addOutlines } from './toon.js';
import { ROOMS, parseMap } from '../iso/maps.js';
import { Input } from '../iso/input.js';
import { ABILITIES } from '../data/abilities.js';
import { showHeroSelect } from '../select.js';

// =====================================================================
// Terra de Gor 3D: RPG de ação isométrico em tempo real (Three.js).
// Câmera 3/4 que segue o herói, salas-arena sobre o abismo, ondas de
// inimigos, porta com recompensa, combate com golpes, magia e esquiva.
// =====================================================================
const UI = import.meta.glob('../assets/ui/*.png', { query: '?url', import: 'default', eager: true });
const $ = (id) => document.getElementById(id);

// ---------------- renderizador, cena, câmera ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0814);
scene.fog = new THREE.Fog(0x12081a, 30, 70);
const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
const CAM_DIR = new THREE.Vector3(1, 1.35, 1).normalize();
let camDist = 26, baseFov = 30;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  camera.aspect = w / h;
  // celular deitado: um pouco mais longe para ver a arena
  camDist = h < 520 ? 14 : 15;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0x8a7ab8, 0x2a1420, 0.75));
const moon = new THREE.DirectionalLight(0xd8c8ff, 1.1);
moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
moon.shadow.bias = -0.0008;
scene.add(moon, moon.target);
const heroLight = new THREE.PointLight(0xffe0b0, 2.2, 6, 1.8); scene.add(heroLight);

const input = new Input(canvas);
const fx = new Fx3D(scene);

// ---------------- números de dano (DOM) ----------------
const dmgLayer = document.createElement('div'); dmgLayer.id = 'dmg-layer'; document.body.append(dmgLayer);
const floats = [];
function number(pos, value, color = '#fff') {
  const el = document.createElement('div'); el.className = 'dmg'; el.textContent = Math.round(value); el.style.color = color;
  dmgLayer.append(el); floats.push({ el, p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 2.4, 0)), t: 0 });
}
function updateFloats(dt) {
  const v = new THREE.Vector3();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; f.p.y += dt * 1.6;
    v.copy(f.p).project(camera);
    f.el.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; f.el.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
    f.el.style.opacity = String(Math.min(1, (0.9 - f.t) * 4)); f.el.style.transform = `translate(-50%,-50%) scale(${f.t < 0.1 ? 1.5 : 1})`;
    if (f.t > 0.9) { f.el.remove(); floats.splice(i, 1); }
  }
}

// ---------------- inimigos: gosmas 3D ----------------
const SLIMES = { verde: { hp: 60, speed: 2.6, dmg: 7, r: 0.5, color: 0x5ab84a, size: 0.65 }, roxa: { hp: 170, speed: 1.9, dmg: 13, r: 0.75, color: 0x9a4ad0, size: 1.0 } };
class Slime {
  constructor(x, z, kind) {
    Object.assign(this, SLIMES[kind]); this.kind = kind; this.maxHp = this.hp; this.alive = true;
    this.pos = new THREE.Vector3(x, 0, z); this.vel = new THREE.Vector3(); this.t = Math.random() * 3; this.state = 'idle'; this.st = 0; this.cool = 0.8; this.hurtT = 0; this.spawnT = 0.9;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(this.size, 14, 10), toon(this.color));
    body.scale.y = 0.8; body.position.y = this.size * 0.75; body.castShadow = true;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(this.size * 0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    shine.position.set(-this.size * 0.35, this.size * 1.2, this.size * 0.4); shine.userData.noOutline = true;
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(this.size * 0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0x140a18 }));
      eye.position.set(s * this.size * 0.3, this.size * 0.85, this.size * 0.7); eye.userData.noOutline = true; g.add(eye);
    }
    g.add(body, shine); addOutlines(g, 0.04);
    this.mesh = g; this.body = body; this.mat = body.material.clone(); body.material = this.mat;
    const bar = document.createElement('div'); bar.className = 'ebar'; bar.innerHTML = '<i></i>'; dmgLayer.append(bar); this.bar = bar;
    scene.add(g); g.position.copy(this.pos); g.scale.setScalar(0.01);
  }
  hurt(dmg, from, push = 7) {
    if (!this.alive) return;
    this.hp -= dmg; this.hurtT = 0.12;
    const d = this.pos.clone().sub(from).setY(0); if (d.lengthSq() > 1e-4) this.vel.copy(d.normalize().multiplyScalar(push));
    if (this.state === 'windup') this.state = 'idle';
    if (this.hp <= 0) {
      this.alive = false; world.kills++;
      fx.sparks(this.pos.clone().setY(0.5), { n: 26, color: this.color, up: 5, speed: 4 });
      scene.remove(this.mesh); this.bar.remove();
    }
  }
  update(dt) {
    this.t += dt; this.hurtT -= dt; this.cool -= dt;
    if (this.spawnT > 0) { this.spawnT -= dt; this.mesh.scale.setScalar(Math.max(0.01, 1 - this.spawnT / 0.9)); this.syncBar(); return; }
    if (this.vel.lengthSq() > 0.01) { moveCollide(this.pos, this.vel.x * dt, this.vel.z * dt, this.r); this.vel.multiplyScalar(Math.pow(0.004, dt)); }
    const to = hero.pos.clone().sub(this.pos).setY(0), d = to.length();
    let squash = 1, hop = 0;
    if (this.state === 'windup') { this.st -= dt; squash = 0.7; if (this.st <= 0) { this.state = 'lunge'; this.st = 0.22; this.vel.copy(to.normalize().multiplyScalar(11)); this.hit = false; } }
    else if (this.state === 'lunge') {
      this.st -= dt; hop = 0.6; squash = 1.2;
      if (!this.hit && this.pos.distanceTo(hero.pos) < this.r + 0.6) { this.hit = true; hurtHero(this.dmg, this.pos); }
      if (this.st <= 0) { this.state = 'idle'; this.cool = 1.4 + Math.random() * 0.6; }
    } else {
      if (hero.alive && d < 1.6 + this.r && this.cool <= 0) { this.state = 'windup'; this.st = 0.5; }
      const ph = (this.t * 2.1) % 1; const moving = ph > 0.25 && ph < 0.75;
      hop = moving ? Math.sin((ph - 0.25) * 2 * Math.PI) * 0.35 : 0; squash = moving ? 1.08 : 0.92;
      if (moving && hero.alive && d > 1.1) moveCollide(this.pos, (to.x / d) * this.speed * dt * 2, (to.z / d) * this.speed * dt * 2, this.r);
      for (const o of world.enemies) { if (o === this || !o.alive) continue; const q = this.pos.clone().sub(o.pos).setY(0), qd = q.length(), m = this.r + o.r; if (qd < m && qd > 1e-3) moveCollide(this.pos, (q.x / qd) * (m - qd) * 0.5, (q.z / qd) * (m - qd) * 0.5, this.r); }
    }
    this.mesh.position.set(this.pos.x, hop, this.pos.z);
    this.mesh.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.mesh.rotation.y = Math.atan2(to.x, to.z);
    this.mat.emissive.setHex(this.hurtT > 0 ? 0xffffff : 0); this.mat.emissiveIntensity = this.hurtT > 0 ? 0.8 : 0;
    this.syncBar();
  }
  syncBar() {
    const v = this.pos.clone().setY(this.size * 2.2).project(camera);
    this.bar.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; this.bar.style.top = ((1 - v.y) / 2) * innerHeight + 'px';
    this.bar.style.display = this.hp < this.maxHp ? 'block' : 'none';
    this.bar.firstChild.style.width = Math.max(0, (100 * this.hp) / this.maxHp) + '%';
  }
  dispose() { scene.remove(this.mesh); this.bar.remove(); }
}

// ---------------- mundo / salas ----------------
let world = null, hero = null, heroModel = null, heroDef = null;
function solidAt(x, z) {
  const i = Math.floor(x / T), j = Math.floor(z / T), m = world.map;
  if (i < 0 || j < 0 || i >= m.w || j >= m.h) return true;
  return m.solid[j * m.w + i];
}
function blocked(x, z, r) { return solidAt(x - r, z - r) || solidAt(x + r, z - r) || solidAt(x - r, z + r) || solidAt(x + r, z + r); }
function moveCollide(p, dx, dz, r) { if (!blocked(p.x + dx, p.z, r)) p.x += dx; if (!blocked(p.x, p.z + dz, r)) p.z += dz; }

function enterRoom(n) {
  if (world) { scene.remove(world.room.group); world.enemies.forEach((e) => e.dispose()); }
  const map = parseMap(ROOMS[n]);
  world = { index: n, map, enemies: [], areas: [], kills: 0, wave: 0, waveT: 1.2, state: 'luta', hitstop: 0, punch: 0 };
  world.room = buildRoom(map, scene);
  hero.pos.set((map.start.x + 2) * T, 0, (map.start.y + 2) * T);
  while (blocked(hero.pos.x, hero.pos.z, 0.45)) { hero.pos.x -= 0.5; hero.pos.z -= 0.5; }
  hero.yaw = Math.PI * 1.25;
  // limites da câmera
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) if (map.floor[j * map.w + i]) { x0 = Math.min(x0, i * T); x1 = Math.max(x1, (i + 1) * T); z0 = Math.min(z0, j * T); z1 = Math.max(z1, (j + 1) * T); }
  world.bounds = { x0: x0 + 3, x1: x1 - 3, z0: z0 + 3, z1: z1 - 3 };
  camTarget.copy(hero.pos); fade = 1;
  banner(map.nome, 2200);
}
function banner(t, ms = 2500) { const b = $('banner'); b.textContent = t; b.classList.add('show'); clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('show'), ms); }

function rooms(dt) {
  world.enemies = world.enemies.filter((e) => e.alive);
  const map = world.map;
  if (world.state === 'luta' && world.enemies.length === 0) {
    if (world.wave >= map.ondas.length) {
      world.state = 'limpa'; banner('Sala limpa! A porta se abriu'); fx.shake = 0.4;
      const d = world.room.door.userData; d.open = true; d.bars.visible = false;
      return;
    }
    world.waveT -= dt;
    if (world.waveT <= 0) {
      for (const kind of map.ondas[world.wave]) {
        let p, tries = 0;
        do { p = map.open[(Math.random() * map.open.length) | 0]; tries++; } while (tries < 60 && Math.hypot(p.x * T - hero.pos.x, p.y * T - hero.pos.z) < 6);
        const e = new Slime(p.x * T, p.y * T, kind === 'r' ? 'roxa' : 'verde');
        world.enemies.push(e); fx.summon(e.pos);
      }
      world.wave++; world.waveT = 1.0;
    }
  } else if (world.state === 'limpa') {
    const d = map.door, dp = new THREE.Vector3((d.i + 0.5) * T, 0, (d.j + 1.3) * T);
    if (hero.pos.distanceTo(dp) < 1.3) {
      if (map.recompensa === 'cura') { hero.hp = Math.min(hero.maxHp, hero.hp + 80); banner('Bênção: +80 de vida'); }
      if (map.recompensa === 'poder') { hero.power++; banner('Bênção: +25% de dano'); }
      if (map.recompensa === 'fim') { world.state = 'vitoria'; banner('Vitória! O Santuário da Luz foi purificado', 6000); return; }
      enterRoom((world.index + 1) % ROOMS.length);
    }
  }
}

// ---------------- herói (lógica) ----------------
function makeHeroLogic(def) {
  return {
    def, ab: ABILITIES[def.id], pos: new THREE.Vector3(), yaw: 0, alive: true, hp: 250, maxHp: 250, atk: 20, power: 0,
    speed: 6.2, cd: { atk: 0, q: 0, e: 0, dash: 0 }, action: null, invuln: 0, dashT: 0, dashDir: new THREE.Vector3(), buffer: null, dead: 0, combo: 0,
    get x() { return this.pos.x; }, get z() { return this.pos.z; },
  };
}
const right = new THREE.Vector3(1, 0, -1).normalize(), fwd = new THREE.Vector3(-1, 0, -1).normalize();
function moveDir() { const s = input.screenMove(); return new THREE.Vector3().addScaledVector(right, s.x).addScaledVector(fwd, -s.y); }
const ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function aimPoint() {
  if (!input.touch && input.mouse.inside) {
    ray.setFromCamera(new THREE.Vector2((input.mouse.x / innerWidth) * 2 - 1, -(input.mouse.y / innerHeight) * 2 + 1), camera);
    const p = new THREE.Vector3(); return ray.ray.intersectPlane(ground, p) ? p : null;
  }
  let best = null, bd = 6;
  for (const e of world.enemies) { if (!e.alive || e.spawnT > 0) continue; const d = e.pos.distanceTo(hero.pos); if (d < bd) { bd = d; best = e.pos; } }
  return best;
}
function faceTo(v) { if (v.lengthSq() > 1e-4) hero.yaw = Math.atan2(v.x, v.z); }
function forwardVec() { return new THREE.Vector3(Math.sin(hero.yaw), 0, Math.cos(hero.yaw)); }

function hurtHero(dmg, from) {
  if (!hero.alive || hero.invuln > 0) return;
  hero.hp -= dmg; number(hero.pos, dmg, '#ff5a4a'); fx.shake = Math.max(fx.shake, 0.3);
  const d = hero.pos.clone().sub(from).setY(0); if (d.lengthSq() > 1e-4) moveCollide(hero.pos, d.normalize().x * 0.4, d.z * 0.4, 0.45);
  if (hero.hp <= 0) { hero.hp = 0; hero.alive = false; hero.dead = 3.5; hero.action = null; heroModel.play('death', 0.1); }
  else if (!hero.action && hero.dashT <= 0) { hero.action = { type: 'hit', t: 0, dur: 0.3 }; heroModel.play('hit', 0.05); }
}

function updateHero(dt) {
  const H = hero, M = heroModel;
  for (const k in H.cd) H.cd[k] = Math.max(0, H.cd[k] - dt);
  H.invuln = Math.max(0, H.invuln - dt);
  if (!H.alive) {
    H.dead -= dt;
    if (H.dead <= 0) { H.alive = true; H.hp = H.maxHp; H.invuln = 2; M.play('idle', 0.2); enterRoom(world.index); }
    return;
  }
  for (const k of input.pressed) H.buffer = { k, t: 0.4 };
  if (H.buffer) { H.buffer.t -= dt; if (H.buffer.t <= 0) H.buffer = null; }
  const want = H.buffer?.k, use = () => (H.buffer = null);
  const mv = moveDir(), mag = Math.min(1, mv.length()); if (mag > 0) mv.normalize();
  const busy = !!H.action;
  const aim = () => { const a = aimPoint(); faceTo(a ? a.clone().sub(H.pos).setY(0) : mag > 0.1 ? mv : forwardVec()); };

  if (want === 'dash' && H.cd.dash <= 0 && H.dashT <= 0) {
    H.dashDir.copy(mag > 0.1 ? mv : forwardVec()); faceTo(H.dashDir);
    H.dashT = 0.32; H.cd.dash = 0.7; H.invuln = Math.max(H.invuln, 0.35); H.action = { type: 'roll', t: 0, dur: 0.5 };
    M.play('roll', 0.06); use();
    fx.sparks(H.pos.clone().setY(0.2), { n: 10, color: 0xc8b8a0, up: 1.5, speed: 2, g: 3 });
  } else if (!busy && H.dashT <= 0) {
    if (want === 'q' && H.cd.q <= 0) { H.cd.q = H.ab.q.recarga; aim(); H.action = { type: 'q', t: 0, dur: 0.75 }; M.play('cast', 0.08); use(); }
    else if (want === 'e' && H.cd.e <= 0) { H.cd.e = H.ab.e.recarga; H.action = { type: 'e', t: 0, dur: 0.5 }; M.play('guard', 0.08); use(); }
    else if ((want === 'atk' || input.holdingAttack()) && H.cd.atk <= 0) {
      aim(); H.cd.atk = 0.42; H.combo ^= 1;
      H.action = { type: 'atk', t: 0, dur: M.duration('attack') * 0.62 };
      M.play('attack', 0.06); if (want === 'atk') use();
    }
  }
  // movimento
  if (H.dashT > 0) { H.dashT -= dt; moveCollide(H.pos, H.dashDir.x * 13 * dt, H.dashDir.z * 13 * dt, 0.45); }
  else {
    const locked = H.action && (H.action.type === 'q' || H.action.type === 'e');
    if (mag > 0.1 && !locked) {
      const sp = H.speed * mag * (H.action && H.action.type !== 'hit' ? 0.25 : 1);
      moveCollide(H.pos, mv.x * sp * dt, mv.z * sp * dt, 0.45);
      if (!H.action) faceTo(mv);
    }
    if (!H.action) M.play(mag > 0.1 ? 'run' : 'idle', 0.15);
  }
  // ações no quadro certo
  const a = H.action;
  if (a) {
    a.t += dt;
    if (a.type === 'atk' && !a.fired && a.t > a.dur * 0.42) { a.fired = true; basicHit(); fx.swing(H.pos, H.yaw, H.combo === 1); }
    if (a.type === 'q' && !a.fired && a.t > 0.25) { a.fired = true; consecration(); }
    if (a.type === 'e' && !a.fired && a.t > 0.15) { a.fired = true; H.invuln = H.ab.e.duracao; fx.bubble(H, H.ab.e.duracao); fx.sparks(H.pos.clone().setY(1.2), { n: 24, up: 2, speed: 2, g: 1 }); }
    if (a.t >= a.dur) { H.action = null; }
  }
}

function basicHit() {
  const f = forwardVec(), reach = 2.6, dmgBase = hero.atk * (1 + hero.power * 0.25);
  const hits = [];
  for (const e of world.enemies) {
    if (!e.alive || e.spawnT > 0) continue;
    const d = e.pos.clone().sub(hero.pos).setY(0), dist = d.length();
    if (dist > reach + e.r) continue;
    if (dist > 0.5 && d.normalize().dot(f) < 0.2) continue;
    hits.push([dist, e]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  hits.forEach(([, e], i) => {
    const dmg = Math.round(dmgBase * (i ? 0.6 : 1) * (0.9 + Math.random() * 0.2));
    e.hurt(dmg, hero.pos); number(e.pos, dmg);
    const p = e.pos.clone().setY(0.8); fx.burst(p, i ? 0.7 : 1.2); fx.sparks(p, { n: i ? 8 : 18 });
  });
  if (hits.length) { fx.shake = Math.max(fx.shake, 0.3); world.hitstop = 0.06; }
}
function consecration() {
  const p = hero.pos.clone(), q = hero.ab.q, R = 3.4;
  fx.lightHammer(p, () => {
    fx.shake = 1; world.hitstop = 0.1; world.punch = 1;
    fx.ring(p, R + 1.5, 0.5); fx.burst(p.clone().setY(0.6), 3); fx.sparks(p.clone().setY(0.5), { n: 60, speed: 8, up: 7 });
    fx.consecration(p, R, q.duracao);
    for (const e of world.enemies) if (e.alive && e.pos.distanceTo(p) < R + e.r) { const d = Math.round(hero.atk * 1.2); e.hurt(d, p, 9); number(e.pos, d, '#ffe066'); }
    world.areas.push({ p, R, dps: hero.atk * q.danoPorSeg * 5, left: q.duracao, tick: 0.5 });
  });
}
function updateAreas(dt) {
  for (const a of world.areas) { a.left -= dt; a.tick -= dt; if (a.tick <= 0) { a.tick = 0.5; for (const e of world.enemies) if (e.alive && e.spawnT <= 0 && e.pos.distanceTo(a.p) < a.R + e.r) { const d = Math.round(a.dps * 0.5); e.hurt(d, a.p, 0.5); number(e.pos, d, '#ffe066'); } } }
  world.areas = world.areas.filter((a) => a.left > 0);
}

// ---------------- HUD ----------------
function setupHud(def) {
  $('hero-name').textContent = def.nome.toUpperCase();
  const ab = ABILITIES[def.id];
  for (const [k, id] of [['basico', 'btn-attack'], ['q', 'btn-q'], ['e', 'btn-e']]) { const el = $(id); if (ab[k]) { el.style.backgroundImage = `url(${UI['../assets/ui/' + ab[k].icone]})`; el.title = ab[k].nome; } }
  $('hud').classList.remove('hidden'); $('buttons').classList.remove('hidden');
}
function updateHud() {
  $('hp-fill').style.width = (100 * hero.hp) / hero.maxHp + '%';
  $('hp-fill').classList.toggle('shield', hero.invuln > 0.4 && hero.alive);
  $('hp-text').textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
  const m = world.map;
  $('objective').textContent = world.state === 'vitoria' ? 'Vitória!' : world.state === 'limpa' ? `${m.nome} · vá até a porta` : `${m.nome} · Sala ${world.index + 1}/${ROOMS.length} · Onda ${Math.max(1, world.wave)}/${m.ondas.length}`;
  for (const [k, id, max] of [['q', 'btn-q', hero.ab.q.recarga], ['e', 'btn-e', hero.ab.e.recarga], ['dash', 'btn-dash', 0.7]]) {
    const el = $(id), c = hero.cd[k]; el.style.setProperty('--cd', (c / max).toFixed(3)); el.dataset.cd = c > 0 && k !== 'dash' ? Math.ceil(c) : '';
  }
  $('dead').classList.toggle('show', !hero.alive);
}

// ---------------- câmera ----------------
const camTarget = new THREE.Vector3(); let fade = 0;
function updateCamera(dt) {
  const mv = moveDir();
  const look = hero.pos.clone().addScaledVector(forwardVec(), 1.2).addScaledVector(mv, 1.5);
  const b = world.bounds;
  look.x = THREE.MathUtils.clamp(look.x, Math.min(b.x0, b.x1), Math.max(b.x0, b.x1));
  look.z = THREE.MathUtils.clamp(look.z, Math.min(b.z0, b.z1), Math.max(b.z0, b.z1));
  camTarget.lerp(look, 1 - Math.pow(0.02, dt));
  world.punch = Math.max(0, world.punch - dt * 2.5);
  camera.fov = baseFov * (1 - 0.1 * Math.sin(Math.min(1, world.punch) * Math.PI)); camera.updateProjectionMatrix();
  camera.position.copy(camTarget).addScaledVector(CAM_DIR, camDist);
  const s = fx.shake * 0.25; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
  camera.lookAt(camTarget.x, camTarget.y + 0.8, camTarget.z);
  moon.position.copy(camTarget).add(new THREE.Vector3(-8, 18, 6)); moon.target.position.copy(camTarget);
  heroLight.position.copy(hero.pos).setY(2.5);
}

// colunas entre a câmera e o herói ficam transparentes
function fadeOccluders() {
  const cam = new THREE.Vector2(camera.position.x, camera.position.z), h = new THREE.Vector2(hero.pos.x, hero.pos.z);
  const seg = h.clone().sub(cam), L2 = seg.lengthSq();
  for (const pg of world.room.pillars) {
    const p = new THREE.Vector2(pg.userData.pillar.x, pg.userData.pillar.z);
    const t = THREE.MathUtils.clamp(p.clone().sub(cam).dot(seg) / L2, 0, 1);
    const near = t > 0.55 && p.distanceTo(cam.clone().addScaledVector(seg, t)) < 1.6;
    const want = near ? 0.25 : 1;
    pg.traverse((o) => { if (o.isMesh) { o.material.opacity += (want - o.material.opacity) * 0.25; o.material.depthWrite = o.material.opacity > 0.9; } });
  }
}

// ---------------- laço ----------------
const clock = new THREE.Timer();
function frame() {
  clock.update(); let dt = Math.min(0.05, clock.getDelta());
  if (world && hero && heroModel) {
    let wdt = dt; if (world.hitstop > 0) { world.hitstop -= dt; wdt = dt * 0.05; }
    updateHero(wdt);
    heroModel.root.position.copy(hero.pos);
    heroModel.root.rotation.y += Math.atan2(Math.sin(hero.yaw - heroModel.root.rotation.y), Math.cos(hero.yaw - heroModel.root.rotation.y)) * Math.min(1, dt * 18);
    heroModel.update(wdt);
    for (const e of world.enemies) e.update(wdt);
    updateAreas(wdt); rooms(dt);
    fx.update(wdt);
    const t = clock.getElapsed();
    world.room.fires.forEach((f) => f.update(t));
    const d = world.room.door?.userData;
    if (d) { d.icon.rotation.y = t * 1.5; d.icon.position.y = 4.4 + Math.sin(t * 2) * 0.12; if (d.open) { d.portal.material.opacity = 0.75 + Math.sin(t * 5) * 0.1; d.light.intensity = 20; } }
    updateCamera(dt); fadeOccluders(); updateHud(); updateFloats(dt);
    if (fade > 0) { fade = Math.max(0, fade - dt * 1.6); }
    $('fade').style.opacity = String(fade);
  }
  input.consume();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

async function start(def) {
  heroDef = def;
  $('loading').classList.add('show');
  heroModel = await createHero();
  scene.add(heroModel.root);
  hero = makeHeroLogic(def);
  setupHud(def);
  enterRoom(0);
  $('loading').classList.remove('show');
}
$('btn-full').addEventListener('click', async () => { try { await document.documentElement.requestFullscreen(); await screen.orientation?.lock?.('landscape'); } catch { /* iPhone */ } });
window.__game = { get hero() { return hero; }, get world() { return world; }, get model() { return heroModel; }, camera };
requestAnimationFrame(frame);
showHeroSelect(start);
