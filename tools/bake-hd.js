import * as THREE from 'three';
import { buildDalarian } from '../src/models/dalarian.js';
import { Animator, POSES } from '../src/rig.js';

// =====================================================================
// Renderiza o Dalárian 3D (low-poly, como o concept) em folhas de sprite
// pintadas, 8 direções, para o jogo. Mesmo formato do build-hd-sprites:
// quadro 220x250, âncora (110, 236), corpo ~196 px.
// Uso: tools/bake-hd.html?anims=corrida  (o script salva os PNG)
// =====================================================================
const FW = 300, FH = 300, AX = 150, AY = 262, SS = 2;
const Q = new URLSearchParams(location.search);
const ANIMS = {
  // nome: [pose, duração do ciclo (s), quadros, loop]
  corrida: ['corrida', 0.6, 10, true],
  idle: ['idle', 2.86, 8, true],
  ataque: ['@ataque', 0.42, 8, false, 0], ataque2: ['@ataque', 0.42, 8, false, 1],
  consagracao: ['@consagracao', 0.9, 10, false], protecao: ['@protecao', 0.55, 6, false],
  esquiva: ['@esquiva', 0.22, 4, false], dano: ['@dano', 0.25, 4, false],
};

export async function bake(names) {
  const rig = buildDalarian();
  // facetas chapadas como no concept
  const CONCEPT = { 0x9a95a4: 0xbc9da8, 0x6c6676: 0x8e7686, 0xdc9a30: 0xf29c27, 0xb07a24: 0xc9771b, 0x2a3c92: 0x2d397e, 0x1c2766: 0x232c66 };
  rig.root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material = o.material.clone();
    const hx = m.color.getHex(); if (CONCEPT[hx]) m.color.setHex(CONCEPT[hx]);
    m.flatShading = true; m.metalness = Math.min(m.metalness, 0.12); m.roughness = Math.max(m.roughness, 0.6); m.needsUpdate = true;
  });
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(FW * SS, FH * SS);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.add(rig.root);
  scene.add(new THREE.HemisphereLight(0xfff2e0, 0x3a2a40, 1.25));
  const key = new THREE.DirectionalLight(0xffe8c8, 2.6); key.position.set(-3, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 1.6); rim.position.set(4, 3, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.5); fill.position.set(3, 1, 4); scene.add(fill);

  // altura do corpo em unidades (pés → topo do cabelo) para escalar 196 px
  rig.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig.root);
  const bodyH = box.max.y - box.min.y;
  const ppu = 196 / (2.35 * Math.cos(THREE.MathUtils.degToRad(30)));   // ~2,35 m do pé ao topo do cabelo
  void bodyH;
  const cam = new THREE.OrthographicCamera(-AX / ppu, (FW - AX) / ppu, AY / ppu, -(FH - AY) / ppu, -50, 50);
  const el = THREE.MathUtils.degToRad(30);
  cam.position.set(0, Math.sin(el) * 10, Math.cos(el) * 10); cam.lookAt(0, 0, 0);
  // a câmera olha para a origem (pés); o deslocamento vertical do frustum já põe os pés em AY
  cam.updateProjectionMatrix();

  const out = {};
  for (const name of names) {
    const [pose, dur, frames, loop, variante = 0] = ANIMS[name];
    const sheet = document.createElement('canvas'); sheet.width = FW * frames; sheet.height = FH * 8;
    const sctx = sheet.getContext('2d');
    for (let d = 0; d < 8; d++) {
      rig.root.rotation.y = d * Math.PI / 4;
      for (let f = 0; f < frames; f++) {
        const anim = new Animator(rig, 'martelo');
        if (pose[0] === '@') {    // ação: quadro f da ação sobre a pose parada
          anim.action = { name: pose.slice(1), n: Math.min(0.999, (f + 0.5) / frames), dur, variante };
          anim.update(0, 0);
        } else { anim.cycle = pose; anim.t = (f / frames) * dur; anim.update(0, pose === 'idle' ? 0 : 1); }
        rig.root.updateMatrixWorld(true);
        renderer.render(scene, cam);
        sctx.drawImage(renderer.domElement, f * FW, d * FH, FW, FH);
      }
    }
    out[name] = { url: ink(sheet).toDataURL('image/png'), frames, fps: Math.round(frames / dur * 10) / 10, loop };
  }
  return out;
}

// contorno escuro (traço de tinta) em volta da silhueta, sem mudar o tamanho
function ink(src, px = 2.5) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const sil = document.createElement('canvas'); sil.width = src.width; sil.height = src.height;
  const s = sil.getContext('2d'); s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(16,8,20,0.95)'; s.fillRect(0, 0, c.width, c.height);
  const g = c.getContext('2d');
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; g.drawImage(sil, Math.cos(t) * px, Math.sin(t) * px); }
  g.drawImage(src, 0, 0);
  return c;
}

bake((Q.get('anims') || 'corrida').split(',')).then((r) => { window.__bake = r; document.body.append('pronto'); })
  .catch((e) => { window.__bakeErr = String(e.stack); document.body.append('erro ' + e.stack); });
void POSES;
