import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildDalarian } from '../src/models/dalarian.js';

// =====================================================================
// Animações fluidas por captura de movimento:
// a biblioteca Universal Animation Library (Quaternius, CC0) traz o
// esqueleto humano + dezenas de animações. Aqui "vestimos" esse esqueleto
// com a armadura do Dalárian: cada peça do nosso modelo é transferida para
// o osso correspondente (posição, direção e comprimento do segmento) e
// depois renderizamos as animações em 8 direções.
// Uso: tools/bake-mocap.html?anims=corrida
// =====================================================================
const FW = 300, FH = 300, AX = 150, AY = 262, SS = 2;
const Q = new URLSearchParams(location.search);
export const CLIPS = {
  // nome no jogo: [clipe, quadros, loop, início (s), fim (s) | null]
  tpose: ['A_TPose', 1, true],
  corrida: ['Sprint_Loop', 16, true],
  trote: ['Jog_Fwd_Loop', 16, true],
  idle: ['Sword_Idle', 16, true],
  ataque: ['Sword_Attack', 18, false, 0.1, 0.95],
  ataque2: ['Sword_Attack', 18, false, 0.1, 0.95],
  consagracao: ['Spell_Simple_Shoot', 12, false],
  protecao: ['Spell_Simple_Enter', 10, false],
  esquiva: ['Roll', 14, false, 0.0, 1.1],
  dano: ['Hit_Chest', 8, false],
  morte: ['Death01', 18, false],
};
// nosso osso → osso da biblioteca, e o "filho" que dá a direção do segmento
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

export async function buildMocapHero() {
  const gltf = await new GLTFLoader().loadAsync('./anim-lib/AnimationLibrary_Godot_Standard.gltf');
  const lib = gltf.scene;
  const bone = (n) => lib.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));
  const skinned = []; lib.traverse((o) => o.isSkinnedMesh && skinned.push(o));
  skinned.forEach((m) => m.skeleton.pose());
  lib.updateMatrixWorld(true);
  const wp = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

  // escala da biblioteca para a altura do quadril do nosso herói
  const ours = buildDalarian();
  ours.root.updateMatrixWorld(true);
  const B = ours.bones;
  const s = wp(B.hips).y / wp(bone('DEF-hips')).y;
  lib.scale.setScalar(s); lib.updateMatrixWorld(true);

  // segmento (início, fim) no nosso modelo e na biblioteca
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

  // materiais com as cores do concept, facetados e foscos
  const mats = new Map();
  const restyle = (m) => {
    if (mats.has(m)) return mats.get(m);
    const n = m.clone(); const hx = n.color.getHex(); if (CONCEPT[hx]) n.color.setHex(CONCEPT[hx]);
    n.flatShading = true; n.metalness = Math.min(n.metalness ?? 0, 0.12); n.roughness = Math.max(n.roughness ?? 1, 0.6); n.needsUpdate = true;
    mats.set(m, n); return n;
  };

  const capeRoot = B.cape1;
  for (const k of Object.keys(MAP)) {
    const [a, b] = ourSeg(k), [A, Bb] = libSeg(k);
    const u = b.clone().sub(a).normalize(), U = Bb.clone().sub(A).normalize();
    const R = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(u, U));
    let kLen = STRETCH.has(k) ? THREE.MathUtils.clamp(Bb.distanceTo(A) / b.distanceTo(a), 0.75, 1.35) : 1;
    // escala ao longo do segmento: I + (k-1) u uᵀ
    const S = new THREE.Matrix4().set(
      1 + (kLen - 1) * u.x * u.x, (kLen - 1) * u.x * u.y, (kLen - 1) * u.x * u.z, 0,
      (kLen - 1) * u.y * u.x, 1 + (kLen - 1) * u.y * u.y, (kLen - 1) * u.y * u.z, 0,
      (kLen - 1) * u.z * u.x, (kLen - 1) * u.z * u.y, 1 + (kLen - 1) * u.z * u.z, 0, 0, 0, 0, 1);
    const Mx = new THREE.Matrix4().makeTranslation(A.x, A.y, A.z).multiply(R).multiply(S).multiply(new THREE.Matrix4().makeTranslation(-a.x, -a.y, -a.z));
    const target = bone(MAP[k][0]);
    const inv = target.matrixWorld.clone().invert();
    // peças diretas do osso (malhas e grupos como o martelo, menos outros ossos e a capa)
    const ourBones = new Set(Object.values(B));
    for (const child of [...B[k].children]) {
      if (ourBones.has(child) && child !== capeRoot) continue;
      if (child === capeRoot && k !== 'chest') continue;
      child.updateMatrixWorld(true);
      const world = Mx.clone().multiply(child.matrixWorld);
      const local = inv.clone().multiply(world);
      child.removeFromParent();
      local.decompose(child.position, child.quaternion, child.scale);
      target.add(child);
    }
  }
  lib.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) o.material = restyle(o.material); });
  // o boneco da biblioteca vira a "roupa de baixo" (preenche juntas e pescoço)
  for (const m of skinned) { m.material = new THREE.MeshStandardMaterial({ color: 0x3e3542, roughness: 0.85, flatShading: true }); m.scale.multiplyScalar(0.97); }

  const holder = new THREE.Group(); holder.add(lib);
  const mixer = new THREE.AnimationMixer(lib);
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  const hips = bone('DEF-hips');
  const hipsRest = hips.position.clone();
  const chest = bone('DEF-spine.003');
  lib.updateMatrixWorld(true);
  const capeBind = B.cape1.getWorldQuaternion(new THREE.Quaternion());
  const weapon = ours.weapon.right, weaponQ = weapon.quaternion.clone();
  return { holder, lib, mixer, clips, hips, hipsRest, chest, cape: [B.cape1, B.cape2, B.cape3], capeBind, weapon, weaponQ, bone };
}

export async function bake(names) {
  const H = await buildMocapHero();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(FW * SS, FH * SS); renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene(); scene.add(H.holder);
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x3a2a40, 1.25));
  const key = new THREE.DirectionalLight(0xffe8c8, 2.6); key.position.set(-3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 1.6); rim.position.set(4, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.5); fill.position.set(3, 1, 4); scene.add(fill);
  const ppu = 196 / (2.35 * Math.cos(THREE.MathUtils.degToRad(30)));
  const cam = new THREE.OrthographicCamera(-AX / ppu, (FW - AX) / ppu, AY / ppu, -(FH - AY) / ppu, -50, 50);
  const el = THREE.MathUtils.degToRad(30);
  cam.position.set(0, Math.sin(el) * 10, Math.cos(el) * 10); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();

  // capa: pende com a gravidade (orientação no mundo, não presa à inclinação
  // do peito) e levanta conforme a velocidade da animação, com ondulação
  let capeLift = 0, phase = 0;
  const stepCape = () => {
    const P = H.cape[0].parent.getWorldQuaternion(new THREE.Quaternion());
    const want = H.holder.quaternion.clone().multiply(H.capeBind).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), capeLift + Math.sin(phase * 2) * 0.06 * (capeLift > 0.2 ? 1 : 0.3)));
    H.cape[0].quaternion.copy(P.invert().multiply(want));
    H.cape[1].rotation.set(capeLift * 0.35 + Math.sin(phase * 2 + 1) * 0.08 * capeLift, 0, 0);
    H.cape[2].rotation.set(capeLift * 0.3 + Math.sin(phase * 2 + 2) * 0.12 * capeLift, 0, 0);
  };

  const out = {};
  for (const name of names) {
    const [clipName, frames, loop, t0 = 0, t1v = null] = CLIPS[name];
    const clip = H.clips[clipName];
    if (!clip) throw new Error('clipe não encontrado: ' + clipName);
    const t1 = t1v ?? clip.duration;
    H.mixer.stopAllAction();
    const act = H.mixer.clipAction(clip); act.reset(); act.play(); act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); act.clampWhenFinished = true;
    const sheet = document.createElement('canvas'); sheet.width = FW * frames; sheet.height = FH * 8;
    const sctx = sheet.getContext('2d');
    // martelo: nos golpes aponta para frente (como a espada da captura); correndo/parado vai para trás
    const flip = { corrida: 2.5, trote: 2.5, idle: 0.0, esquiva: 2.5, dano: 2.5, morte: 2.5, consagracao: 0.6, protecao: 1.2 }[name] ?? 0;
    H.weapon.quaternion.copy(H.weaponQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), flip));
    capeLift = { corrida: 0.55, trote: 0.35, esquiva: 0.3, ataque: 0.2, ataque2: 0.2 }[name] ?? 0.06;
    const pose = (t) => {
      phase = ((t - t0) / (t1 - t0)) * Math.PI * 2;
      H.mixer.setTime(t);
      // no lugar: tira o deslocamento horizontal do quadril
      H.hips.position.x = H.hipsRest.x; H.hips.position.y = H.hipsRest.y;
      H.holder.updateMatrixWorld(true);
      stepCape();
      H.holder.updateMatrixWorld(true);
    };
    for (let d = 0; d < 8; d++) {
      H.holder.rotation.y = d * Math.PI / 4;
      // aquece a capa (uma volta antes, para o loop emendar)
      const span = t1 - t0;
      for (let f = 0; f < frames; f++) {
        pose(t0 + (f / frames) * span);
        renderer.render(scene, cam);
        sctx.drawImage(renderer.domElement, f * FW, d * FH, FW, FH);
      }
    }
    out[name] = { url: ink(sheet).toDataURL('image/png'), frames, fps: Math.round(frames / (t1 - t0) * 10) / 10, loop };
  }
  return out;
}

function ink(src, px = 2.5) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const sil = document.createElement('canvas'); sil.width = src.width; sil.height = src.height;
  const s = sil.getContext('2d'); s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(16,8,20,0.95)'; s.fillRect(0, 0, c.width, c.height);
  const g = c.getContext('2d');
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; g.drawImage(sil, Math.cos(t) * px, Math.sin(t) * px); }
  g.drawImage(src, 0, 0);
  return c;
}

if (Q.has('anims')) bake(Q.get('anims').split(',')).then((r) => { window.__bake = r; document.body.append('pronto'); })
  .catch((e) => { window.__bakeErr = String(e.stack); document.body.append('erro ' + e.stack); });
