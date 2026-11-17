import * as THREE from 'three';
import { ABILITIES } from './data/abilities.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

// Monta um herói provisório (formas simples) com a paleta do concept art.
// Depois trocamos por um modelo .glb animado.
export function buildHeroModel(def) {
  const c = def.cores;
  const root = new THREE.Group();
  const skin = mat(c.pele, { roughness: 0.7 });
  const armor = mat(c.armadura, { metalness: 0.5, roughness: 0.4 });
  const trim = mat(c.detalhe, { metalness: 0.7, roughness: 0.3 });
  const cloth = mat(c.tecido, { roughness: 0.85, side: THREE.DoubleSide });
  const hairM = mat(c.cabelo, { roughness: 0.8 });
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; root.add(m); return m; };

  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.45, 4, 8), armor), -0.18, 0.4, 0);
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.45, 4, 8), armor), 0.18, 0.4, 0);
  const torso = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.5, 6, 12), armor), 0, 1.05, 0);
  torso.scale.set(1, 1, 0.75);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.04), cloth), 0, 0.85, 0.3);
  add(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 6, 16), trim), 0, 0.82, 0).rotation.x = Math.PI / 2;
  add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim), -0.48, 1.38, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), trim), 0.48, 1.38, 0);
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), armor), -0.55, 1.0, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skin), 0, 1.75, 0.02);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM), 0, 1.79, -0.04);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.1), hairM), 0, 1.55, -0.22);
  if (def.faccao !== 'humanos') {
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 6), skin), s * 0.27, 1.8, 0).rotation.z = -s * 1.2;
  }
  const cape = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3, 1, 4), cloth), 0, 0.85, -0.34);
  cape.rotation.x = 0.12;

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.55, 1.15, 0.05);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.35, 4, 8), armor);
  arm.position.y = -0.2;
  weaponPivot.add(arm);
  const w = buildWeapon(def.arma, { trim });
  w.position.set(0, -0.4, 0.15);
  weaponPivot.add(w);
  weaponPivot.traverse((o) => (o.castShadow = true));
  root.add(weaponPivot);
  return { root, weaponPivot, cape };
}

function buildWeapon(tipo, m) {
  const g = new THREE.Group();
  const wood = mat(0x5a3a24, { roughness: 0.9 });
  if (tipo === 'martelo') {
    const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), wood);
    cabo.rotation.x = Math.PI / 2; cabo.position.z = 0.5;
    const cabeca = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.32), mat(0x9a96a0, { metalness: 0.6, roughness: 0.35 }));
    cabeca.position.z = 1.15;
    const estrela = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), mat(0xffd86b, { emissive: 0xffb020, emissiveIntensity: 0.9 }));
    estrela.position.set(0, 0.18, 1.15);
    g.add(cabo, cabeca, estrela);
  } else {
    const lamina = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 1.0), m.trim);
    lamina.position.z = 0.6;
    g.add(lamina);
  }
  return g;
}

const ease = (t) => t * t * (3 - 2 * t);

// Herói controlado pelo jogador.
export class Hero {
  constructor(scene, def) {
    this.def = def;
    this.ab = ABILITIES[def.id];
    this.speed = 6;
    this.atk = 20;
    this.hp = 100; this.maxHp = 100;
    this.cd = { basico: 0, q: 0, e: 0, r: 0, dash: 0 };
    this.dashTime = 0; this.dashDir = new THREE.Vector3();
    this.action = null;       // { tipo, t, dur, fired }
    this.invulneravel = 0;
    const m = buildHeroModel(def);
    this.root = m.root; this.weaponPivot = m.weaponPivot; this.cape = m.cape;
    scene.add(this.root);
  }

  get position() { return this.root.position; }
  get yaw() { return this.root.rotation.y; }
  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  cooldownFrac(k) { const a = k === 'basico' ? this.ab.basico : this.ab[k]; return a ? Math.max(0, this.cd[k]) / a.recarga : 0; }

  start(tipo, dur) { this.action = { tipo, t: 0, dur, fired: false }; }

  // Devolve uma lista de eventos para o jogo tratar (golpe, consagração, escudo...).
  update(dt, input, aim) {
    const ev = [];
    for (const k in this.cd) this.cd[k] -= dt;
    this.invulneravel = Math.max(0, this.invulneravel - dt);

    const locked = this.action && (this.action.tipo === 'q' || this.action.tipo === 'e');
    const dx = aim.x - this.position.x, dz = aim.z - this.position.z;
    if (!locked && dx * dx + dz * dz > 0.01) this.root.rotation.y = Math.atan2(dx, dz);

    // --- comandos ---
    if (!this.action) {
      if (input.skill.q && this.ab.q && this.cd.q <= 0) { this.cd.q = this.ab.q.recarga; this.start('q', 0.75); ev.push({ tipo: 'q-start' }); }
      else if (input.skill.e && this.ab.e && this.cd.e <= 0) { this.cd.e = this.ab.e.recarga; this.start('e', 0.4); }
      else if (input.attackPressed && this.cd.basico <= 0) { this.cd.basico = this.ab.basico.recarga; this.start('basico', 0.34); ev.push({ tipo: 'swing' }); }
    }

    // --- movimento / esquiva ---
    const move = input.moveDir();
    if (input.dashPressed && this.cd.dash <= 0 && !locked) {
      this.dashDir.copy(move.lengthSq() ? move.clone().normalize() : this.forward());
      this.dashTime = 0.18; this.cd.dash = 0.8;
    }
    if (this.dashTime > 0) { this.dashTime -= dt; this.position.addScaledVector(this.dashDir, 22 * dt); }
    else if (!locked) this.position.addScaledVector(move, this.speed * (this.action ? 0.4 : 1) * dt);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -20, 20);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -20, 20);

    // --- animação das ações ---
    const wp = this.weaponPivot;
    const a = this.action;
    if (a) {
      a.t += dt;
      const t = Math.min(1, a.t / a.dur);
      if (a.tipo === 'basico') {
        // golpe diagonal: de cima/direita para baixo/frente
        const k = t < 0.3 ? ease(t / 0.3) : 1;
        const s = t < 0.3 ? 0 : ease(Math.min(1, (t - 0.3) / 0.35));
        wp.rotation.set(THREE.MathUtils.lerp(-0.2, -1.9, k) + s * 2.2, THREE.MathUtils.lerp(0, 1.2, k) - s * 1.9, 0);
        if (!a.fired && t > 0.55) { a.fired = true; ev.push({ tipo: 'basico-hit' }); }
      } else if (a.tipo === 'q') {
        // ergue o martelo bem alto
        const k = ease(Math.min(1, t / 0.35));
        wp.rotation.set(THREE.MathUtils.lerp(0, -3.0, k), 0, 0);
        if (!a.fired && t > 0.3) { a.fired = true; ev.push({ tipo: 'q-cast' }); }
      } else if (a.tipo === 'e') {
        const k = Math.sin(t * Math.PI);
        wp.rotation.set(-1.2 * k, 0.4 * k, 0);
        if (!a.fired) { a.fired = true; this.invulneravel = this.ab.e.duracao; ev.push({ tipo: 'e-cast' }); }
      }
      if (a.t >= a.dur) this.action = null;
    } else {
      wp.rotation.x = THREE.MathUtils.lerp(wp.rotation.x, 0, 0.2);
      wp.rotation.y = THREE.MathUtils.lerp(wp.rotation.y, 0, 0.2);
    }

    const moving = move.lengthSq() > 0.01 && !locked;
    this.cape.rotation.x = THREE.MathUtils.lerp(this.cape.rotation.x, moving ? 0.5 : 0.12, 0.1);
    this.root.position.y = moving ? Math.abs(Math.sin(performance.now() / 110)) * 0.05 : 0;
    return ev;
  }
}
