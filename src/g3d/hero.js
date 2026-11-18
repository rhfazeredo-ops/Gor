import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildDalarian } from '../models/dalarian.js';
import { toToon, toon, addOutlines } from './toon.js';
import animUrl from '../assets/anim/heroi.glb?url';

// =====================================================================
// Dalárian 3D em tempo real.
// O esqueleto e as animações vêm da Universal Animation Library
// (Quaternius, CC0, captura de movimento); cada peça da armadura do nosso
// modelo é transferida para o osso equivalente (posição, direção e
// comprimento do segmento). Capa com gravidade e martelo que muda de
// pegada conforme a ação.
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
const STRETCH = new Set(['upperArmL', 'foreArmL', 'upperArmR', 'foreArmR', 'thighL', 'shinL', 'thighR', 'shinR', 'spine', 'neck']);
const CONCEPT = { 0x9a95a4: 0xbc9da8, 0x6c6676: 0x8e7686, 0xdc9a30: 0xf29c27, 0xb07a24: 0xc9771b, 0x2a3c92: 0x2d397e, 0x1c2766: 0x232c66 };

// estados → clipe, velocidade, laço, pegada do martelo (rad), levantar da capa
export const STATES = {
  idle: { clip: 'Sword_Idle', speed: 1, loop: true, grip: 0, cape: 0.06 },
  run: { clip: 'Jog_Fwd_Loop', speed: 1.3, loop: true, grip: 2.5, cape: 0.45 },
  attack: { clip: 'Sword_Attack', speed: 1.9, loop: false, grip: 0, cape: 0.2, from: 0.12, to: 0.95 },
  cast: { clip: 'Spell_Simple_Shoot', speed: 1.0, loop: false, grip: 0.6, cape: 0.15 },
  guard: { clip: 'Spell_Simple_Enter', speed: 1.2, loop: false, grip: 1.2, cape: 0.1 },
  roll: { clip: 'Roll', speed: 1.7, loop: false, grip: 2.5, cape: 0.3, to: 1.1 },
  hit: { clip: 'Hit_Chest', speed: 1, loop: false, grip: 2.5, cape: 0.15 },
  death: { clip: 'Death01', speed: 1, loop: false, grip: 2.5, cape: 0.1 },
};

export async function createHero() {
  const gltf = await new GLTFLoader().loadAsync(animUrl);
  const lib = gltf.scene;
  const bone = (n) => lib.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  const skinned = []; lib.traverse((o) => o.isSkinnedMesh && skinned.push(o));
  skinned.forEach((m) => m.skeleton.pose());
  lib.updateMatrixWorld(true);
  const wp = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

  const ours = buildDalarian();
  ours.root.updateMatrixWorld(true);
  const B = ours.bones;
  const s = wp(B.hips).y / wp(bone('DEF-hips')).y;
  lib.scale.setScalar(s); lib.updateMatrixWorld(true);

  const ourSeg = (k) => {
    const a = wp(B[k]); const t = MAP[k][1];
    if (t === '+up') return [a, a.clone().add(new THREE.Vector3(0, 0.3, 0))];
    if (t === '+toe') return [a, a.clone().add(new THREE.Vector3(0, -0.06, 0.25))];
    if (t.startsWith('+cont:')) { const p = wp(B[t.slice(6)]); return [a, a.clone().add(a.clone().sub(p).normalize().multiplyScalar(0.15))]; }
    return [a, wp(B[t])];
  };
  const libSeg = (k) => {
    const o = bone(MAP[k][0]), a = wp(o), t = MAP[k][2];
    if (t === '+axis') { const y = new THREE.Vector3(0, 1, 0).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())); return [a, a.clone().add(y.multiplyScalar(0.15))]; }
    return [a, wp(bone(t))];
  };
  const capeRoot = B.cape1;
  const ourBones = new Set(Object.values(B));
  for (const k of Object.keys(MAP)) {
    const [a, b] = ourSeg(k), [A, Bb] = libSeg(k);
    const u = b.clone().sub(a).normalize(), U = Bb.clone().sub(A).normalize();
    const R = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(u, U));
    const kl = STRETCH.has(k) ? THREE.MathUtils.clamp(Bb.distanceTo(A) / b.distanceTo(a), 0.75, 1.35) : 1;
    const S = new THREE.Matrix4().set(
      1 + (kl - 1) * u.x * u.x, (kl - 1) * u.x * u.y, (kl - 1) * u.x * u.z, 0,
      (kl - 1) * u.y * u.x, 1 + (kl - 1) * u.y * u.y, (kl - 1) * u.y * u.z, 0,
      (kl - 1) * u.z * u.x, (kl - 1) * u.z * u.y, 1 + (kl - 1) * u.z * u.z, 0, 0, 0, 0, 1);
    const Mx = new THREE.Matrix4().makeTranslation(A.x, A.y, A.z).multiply(R).multiply(S).multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z));
    const target = bone(MAP[k][0]);
    const inv = target.matrixWorld.clone().invert();
    for (const child of [...B[k].children]) {
      if (ourBones.has(child) && child !== capeRoot) continue;
      if (child === capeRoot && k !== 'chest') continue;
      child.updateMatrixWorld(true);
      const local = inv.clone().multiply(Mx.clone().multiply(child.matrixWorld));
      child.removeFromParent();
      local.decompose(child.position, child.quaternion, child.scale);
      target.add(child);
    }
  }
  lib.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh) { o.material = toon(0x3e3542); o.scale.multiplyScalar(0.97); }
    else o.material = toToon(o.material, CONCEPT);
    o.castShadow = true;
  });
  addOutlines(lib, 0.022);
  lib.updateMatrixWorld(true);
  const capeBind = B.cape1.getWorldQuaternion(new THREE.Quaternion());
  const weapon = ours.weapon.right, weaponQ = weapon.quaternion.clone();
  // ponta do martelo (para efeitos)
  const hammerTip = new THREE.Object3D(); hammerTip.position.set(0, -0.05, 1.1); weapon.add(hammerTip);

  const root = new THREE.Group(); root.add(lib);
  const mixer = new THREE.AnimationMixer(lib);
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  const hips = bone('DEF-hips'), hipsRest = hips.position.clone();
  const actions = {};
  for (const [k, st] of Object.entries(STATES)) {
    const a = mixer.clipAction(clips[st.clip]);
    a.setLoop(st.loop ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = true; a.timeScale = st.speed;
    actions[k] = a;
  }
  const hero = {
    root, state: 'idle', stateT: 0, grip: 0, capeLift: 0.06, phase: 0,
    hammerTip,
    play(name, fade = 0.12) {
      const st = STATES[name], next = actions[name], prev = actions[this.state];
      if (name === this.state && st.loop) return;
      next.reset(); next.time = st.from || 0; next.setEffectiveWeight(1); next.play();
      if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
      this.state = name; this.stateT = 0;
    },
    duration(name) { const st = STATES[name]; return ((st.to ?? clips[st.clip].duration) - (st.from || 0)) / st.speed; },
    update(dt) {
      this.stateT += dt; this.phase += dt * 8;
      mixer.update(dt);
      const st = STATES[this.state];
      if (st.to && actions[this.state].time > st.to) actions[this.state].paused = true;
      hips.position.x = hipsRest.x; hips.position.y = hipsRest.y;     // no lugar (o jogo move o herói)
      // martelo e capa acompanham suavemente o estado
      this.grip += (st.grip - this.grip) * Math.min(1, dt * 12);
      this.capeLift += (st.cape - this.capeLift) * Math.min(1, dt * 6);
      weapon.quaternion.copy(weaponQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.grip));
      root.updateMatrixWorld(true);
      const P = B.cape1.parent.getWorldQuaternion(new THREE.Quaternion());
      const want = root.getWorldQuaternion(new THREE.Quaternion()).multiply(capeBind)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.capeLift + Math.sin(this.phase) * 0.05 * (0.3 + this.capeLift)));
      B.cape1.quaternion.copy(P.invert().multiply(want));
      B.cape2.rotation.set(this.capeLift * 0.35 + Math.sin(this.phase + 1) * 0.08 * this.capeLift, 0, 0);
      B.cape3.rotation.set(this.capeLift * 0.3 + Math.sin(this.phase + 2) * 0.12 * this.capeLift, 0, 0);
    },
  };
  actions.idle.play();
  return hero;
}
