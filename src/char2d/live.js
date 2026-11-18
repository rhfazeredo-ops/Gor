import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildDalarian } from '../models/dalarian.js';
import { LowPolyPainter } from './lowpoly.js';
import { dalarianParts } from './dalarian.js';
import animUrl from '../assets/anim/heroi.glb?url';

// =====================================================================
// Herói desenhado em Canvas 2D a cada quadro, animado por captura de
// movimento (Universal Animation Library, Quaternius, CC0).
// A biblioteca só fornece o esqueleto animado (matemática, sem WebGL);
// as rotações são transferidas ("retarget") para o nosso esqueleto e a
// armadura low-poly é pintada em 2D (facetas + luz chapada + contorno).
// Mesma interface do SpriteAnim: play(), update(), draw(), dir.
// =====================================================================
const MAP = {
  hips: ['DEF-hips', 'chest', 'DEF-spine.003'],
  spine: ['DEF-spine.001', 'chest', 'DEF-spine.003'],
  chest: ['DEF-spine.003', 'neck', 'DEF-neck'],
  neck: ['DEF-neck', 'head', 'DEF-head'],
  head: ['DEF-head', '+up', '+axis'],
  upperArmL: ['DEF-upper_arm.L', 'foreArmL', 'DEF-forearm.L'], foreArmL: ['DEF-forearm.L', 'handL', 'DEF-hand.L'], handL: ['DEF-hand.L', '+cont:foreArmL', '+axis'],
  upperArmR: ['DEF-upper_arm.R', 'foreArmR', 'DEF-forearm.R'], foreArmR: ['DEF-forearm.R', 'handR', 'DEF-hand.R'], handR: ['DEF-hand.R', '+cont:foreArmR', '+axis'],
  thighL: ['DEF-thigh.L', 'shinL', 'DEF-shin.L'], shinL: ['DEF-shin.L', 'footL', 'DEF-foot.L'], footL: ['DEF-foot.L', '+toe', 'DEF-toe.L'],
  thighR: ['DEF-thigh.R', 'shinR', 'DEF-shin.R'], shinR: ['DEF-shin.R', 'footR', 'DEF-foot.R'], footR: ['DEF-foot.R', '+toe', 'DEF-toe.R'],
};
const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];

// estados do jogo → clipe da captura
const STATES = {
  idle: { clip: 'Sword_Idle', speed: 1, loop: true, grip: 0, cape: 0.06 },
  corrida: { clip: 'Jog_Fwd_Loop', speed: 1.35, loop: true, grip: 0, cape: 0.45 },
  ataque: { clip: 'Sword_Attack', speed: 1.9, loop: false, grip: 0, cape: 0.2, from: 0.12, to: 0.95 },
  ataque2: { clip: 'Sword_Attack', speed: 1.9, loop: false, grip: 0, cape: 0.2, from: 0.12, to: 0.95 },
  consagracao: { clip: 'Spell_Simple_Shoot', speed: 1.2, loop: false, grip: 0, cape: 0.15 },
  protecao: { clip: 'Spell_Simple_Enter', speed: 1.4, loop: false, grip: 0, cape: 0.1 },
  esquiva: { clip: 'Roll', speed: 3.0, loop: false, grip: 0, cape: 0.3, to: 1.1 },
  dano: { clip: 'Hit_Chest', speed: 1.3, loop: false, grip: 0, cape: 0.15 },
  morte: { clip: 'Death01', speed: 1, loop: false, grip: 0, cape: 0.1 },
};

const wp = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());

export async function createLiveHero({ res = 2, height = 92 } = {}) {
  const gltf = await new GLTFLoader().loadAsync(animUrl);
  const lib = gltf.scene;
  const bone = (n) => lib.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  lib.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.pose(); o.visible = false; } });
  lib.updateMatrixWorld(true);

  const rig = buildDalarian();
  rig.root.updateMatrixWorld(true);
  const B = rig.bones;
  const s = wp(B.hips).y / wp(bone('DEF-hips')).y;
  lib.scale.setScalar(s); lib.updateMatrixWorld(true);

  // direção do segmento (em repouso) no nosso esqueleto e na biblioteca
  const ourDir = (k) => {
    const a = wp(B[k]), t = MAP[k][1];
    if (t === '+up') return new THREE.Vector3(0, 1, 0);
    if (t === '+toe') return new THREE.Vector3(0, -0.24, 1).normalize();
    if (t.startsWith('+cont:')) return a.clone().sub(wp(B[t.slice(6)])).normalize();
    return wp(B[t]).sub(a).normalize();
  };
  const libDir = (k) => {
    const o = bone(MAP[k][0]), t = MAP[k][2];
    if (t === '+axis') return new THREE.Vector3(0, 1, 0).applyQuaternion(wq(o));
    return wp(bone(t)).sub(wp(o)).normalize();
  };
  // correção fixa por osso: nosso_mundo = lib_mundo · K
  const K = {}, libB = {};
  for (const k of ORDER) {
    libB[k] = bone(MAP[k][0]);
    const align = new THREE.Quaternion().setFromUnitVectors(ourDir(k), libDir(k));
    K[k] = wq(libB[k]).invert().multiply(align).multiply(wq(B[k]));
  }
  const hipsRestY = B.hips.position.y, libHips = libB.hips, libHipsRestY = wp(libHips).y;
  const capeBind = wq(B.cape1);

  const mixer = new THREE.AnimationMixer(lib);
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  const actions = {};
  for (const [k, st] of Object.entries(STATES)) {
    const a = mixer.clipAction(clips[st.clip]);
    a.setLoop(st.loop ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = true; a.timeScale = st.speed;
    actions[k] = a;
  }

  // pintor 2D (alta resolução, desenhado em escala no jogo)
  const ppu = (height * res) / (2.35 * Math.cos(THREE.MathUtils.degToRad(30)));
  const W = Math.round(140 * res), H = Math.round(150 * res), FEET = Math.round(132 * res);
  const painter = new LowPolyPainter({ width: W, height: H, ppu, feetY: FEET });
  const parts = dalarianParts(B);
  const tmpQ = new THREE.Quaternion(), pq = new THREE.Quaternion();

  const live = {
    isLive: true, name: 'idle', t: 0, dir: 0, yaw: 0, yawTarget: 0, onEnd: null, grip: 0, capeLift: 0.06, phase: 0, scale: 1,
    get info() { return { loop: STATES[this.name].loop }; },
    get done() { const st = STATES[this.name]; return !st.loop && actions[this.name].time >= (st.to ?? clips[st.clip].duration) - 1e-3; },
    play(name, { restart = false, onEnd = null } = {}) {
      if (!STATES[name]) name = 'idle';
      if (this.name === name && !restart && STATES[name].loop) return;
      const st = STATES[name], next = actions[name], prev = actions[this.name];
      next.reset(); next.time = st.from || 0; next.paused = false; next.setEffectiveWeight(1); next.play();
      if (prev && prev !== next) prev.crossFadeTo(next, name === 'dano' || name === 'esquiva' ? 0.06 : 0.12, false);
      this.name = name; this.t = 0; this.onEnd = onEnd;
    },
    update(dt) {
      this.t += dt; this.phase += dt * 8;
      mixer.update(dt);
      const st = STATES[this.name];
      if (st.to && actions[this.name].time > st.to) actions[this.name].paused = true;
      if (this.done && this.onEnd) { const f = this.onEnd; this.onEnd = null; f(); }
      // virar suavemente para onde o jogo manda olhar
      if (this.yawTarget === null) this.yawTarget = this.dir * Math.PI / 4;
      let d = this.yawTarget - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 16);
      this.grip += (st.grip - this.grip) * Math.min(1, dt * 12);
      this.capeLift += (st.cape - this.capeLift) * Math.min(1, dt * 6);
    },
    // aplica a pose da captura no nosso esqueleto
    pose() {
      lib.updateMatrixWorld(true);
      rig.root.rotation.y = 0; rig.root.updateMatrixWorld(true);
      B.hips.position.y = hipsRestY + (wp(libHips).y - libHipsRestY);
      for (const k of ORDER) {
        const world = wq(libB[k]).multiply(K[k]);
        B[k].parent.getWorldQuaternion(pq);
        B[k].quaternion.copy(pq.invert().multiply(world));
        B[k].updateMatrixWorld(true);
      }
      if (this.grip) B.handR.quaternion.multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.grip));
      // capa: pende com a gravidade e levanta com a velocidade
      rig.root.rotation.y = this.yaw; rig.root.updateMatrixWorld(true);
      const P = wq(B.cape1.parent);
      const want = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).multiply(capeBind)
        .multiply(tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.capeLift + Math.sin(this.phase) * 0.05 * (0.3 + this.capeLift)));
      B.cape1.quaternion.copy(P.invert().multiply(want));
      B.cape2.rotation.set(this.capeLift * 0.35 + Math.sin(this.phase + 1) * 0.08 * this.capeLift, 0, 0);
      B.cape3.rotation.set(this.capeLift * 0.3 + Math.sin(this.phase + 2) * 0.12 * this.capeLift, 0, 0);
      rig.root.updateMatrixWorld(true);
    },
    draw(ctx, sx, sy, flash = 0) {
      this.pose();
      const c = painter.render(parts, { outlinePx: 2.5 * res });
      const k = 1 / res;
      ctx.drawImage(c, sx - (W / 2) * k, sy - FEET * k, W * k, H * k);
      if (flash > 0) {
        ctx.save(); ctx.globalAlpha = Math.min(1, flash) * 0.6; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(c, sx - (W / 2) * k, sy - FEET * k, W * k, H * k); ctx.restore();
      }
    },
  };
  live.play('idle');
  return live;
}
