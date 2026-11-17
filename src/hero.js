import * as THREE from 'three';
import { ABILITIES } from './data/abilities.js';
import { buildCharacter, Animator } from './rig.js';

// Modelo 3D articulado com animações (veja src/rig.js).
// Os heróis da galeria também respiram e se mexem: guardamos os animadores aqui.
const galleryAnims = [];
export function buildHeroModel(def, { animated = true } = {}) {
  const rig = buildCharacter(def);
  if (animated) {
    const anim = new Animator(rig, def.arma);
    anim.t = Math.random() * 10;
    galleryAnims.push(anim);
  }
  return rig;
}
export function updateGallery(dt) { for (const a of galleryAnims) a.update(dt, 0); }

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
    this.rig = buildCharacter(def);
    this.root = this.rig.root;
    this.anim = new Animator(this.rig, def.arma);
    this.combo = 0;
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
    if (!locked && this.dashTime <= 0 && dx * dx + dz * dz > 0.01) {
      // vira suavemente para a mira (mais rápido durante o ataque)
      const alvo = Math.atan2(dx, dz);
      let d = alvo - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * Math.min(1, dt * (this.action ? 30 : 16));
    }

    // --- comandos ---
    if (!this.action) {
      if (input.skill.q && this.ab.q && this.cd.q <= 0) {
        this.cd.q = this.ab.q.recarga; this.start('q', 0.9); this.anim.play('consagracao'); ev.push({ tipo: 'q-start' });
      } else if (input.skill.e && this.ab.e && this.cd.e <= 0) {
        this.cd.e = this.ab.e.recarga; this.start('e', 0.55); this.anim.play('protecao');
      } else if (input.attackPressed && this.cd.basico <= 0) {
        this.cd.basico = this.ab.basico.recarga; this.combo ^= 1;
        this.start('basico', 0.42); this.anim.play('ataque', { variante: this.combo });
      }
    }

    // --- movimento / esquiva ---
    const move = input.moveDir();
    if (input.dashPressed && this.cd.dash <= 0 && !locked) {
      this.dashDir.copy(move.lengthSq() ? move.clone().normalize() : this.forward());
      this.dashTime = 0.18; this.cd.dash = 0.8;
      this.root.rotation.y = Math.atan2(this.dashDir.x, this.dashDir.z);
      if (!this.action) this.anim.play('esquiva');
      ev.push({ tipo: 'dash' });
    }
    if (this.dashTime > 0) { this.dashTime -= dt; this.position.addScaledVector(this.dashDir, 22 * dt); }
    else if (!locked) this.position.addScaledVector(move, this.speed * (this.action ? 0.4 : 1) * dt);
    this.position.x = THREE.MathUtils.clamp(this.position.x, -20, 20);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -20, 20);

    // --- tempo das ações (os golpes saem no quadro certo da animação) ---
    const a = this.action;
    if (a) {
      a.t += dt;
      const n = a.t / a.dur;
      if (a.tipo === 'basico') {
        if (!a.swung && n > 0.3) { a.swung = true; ev.push({ tipo: 'swing', mirror: this.combo === 1 }); }
        if (!a.fired && n > 0.5) { a.fired = true; ev.push({ tipo: 'basico-hit' }); }
      } else if (a.tipo === 'q') {
        if (!a.fired && n > 0.2) { a.fired = true; ev.push({ tipo: 'q-cast' }); }
      } else if (a.tipo === 'e') {
        if (!a.fired && n > 0.25) { a.fired = true; this.invulneravel = this.ab.e.duracao; ev.push({ tipo: 'e-cast' }); }
      }
      if (a.t >= a.dur) this.action = null;
    }

    // velocidade real (para misturar parado ↔ corrida)
    const moving = move.lengthSq() > 0.01 && !locked;
    const sp = this.dashTime > 0 ? 0 : moving ? (this.action ? 0.5 : 1) : 0;
    this.anim.update(dt, sp);
    return ev;
  }

  // Tranco ao levar dano.
  hurt() { if (!this.anim.busy) this.anim.play('dano'); }
}
