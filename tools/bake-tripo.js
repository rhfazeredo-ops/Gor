import * as THREE from 'three';
import { toonify, luzes, ink as inkPintado } from './estilo.js';
import { buildTripoHero } from './tripo-rig.js';

// =====================================================================
// Sprites do Dalárian a partir do modelo do Tripo 3D, com rig automático
// (tools/tripo-rig.js) e as animações da Universal Animation Library.
// Renderiza cada animação em 8 direções (câmera isométrica do jogo),
// corta todas as folhas na mesma caixa e devolve WebP + metadados.
// Uso: tools/bake-tripo.html?go  (o script tools/bake-tripo.cjs grava)
// =====================================================================
const RS = 256, AX = 128, AY = 214;            // quadro de trabalho e ponto dos pés
const HERO_PX = 50, RES = 2.6;                  // altura do herói no jogo e resolução extra
export const ANIMS = {
  // nome: [clipe, quadros, loop, velocidade, início, fim, martelo (giro), capa]
  idle: ['Sword_Idle', 12, true, 1, 0, null, 0, 0.06],
  corrida: ['Jog_Fwd_Loop', 12, true, 1.35, 0, null, -0.8, 0.5],
  ataque: ['Sword_Attack', 12, false, 1.9, 0.12, 0.95, 0, 0.2],
  consagracao: ['Spell_Simple_Shoot', 12, false, 1.2, 0, null, 0.6, 0.15],
  protecao: ['Spell_Simple_Enter', 10, false, 1.4, 0, null, 1.2, 0.1],
  esquiva: ['Roll', 12, false, 3.0, 0, 1.1, -0.8, 0.3],
  dano: ['Hit_Chest', 6, false, 1.3, 0, null, -0.8, 0.15],
  morte: ['Death01', 14, false, 1, 0, null, -0.8, 0.1],
};

export async function bake(names = Object.keys(ANIMS)) {
  const H = await buildTripoHero();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(RS * 2, RS * 2); renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.add(H.holder); toonify(H.holder);
  luzes(scene);
  const el = THREE.MathUtils.degToRad(30);
  const ppu = (HERO_PX * RES) / (0.871 * Math.cos(el));
  const cam = new THREE.OrthographicCamera(-AX / ppu, (RS - AX) / ppu, AY / ppu, -(RS - AY) / ppu, -50, 50);
  cam.position.set(0, Math.sin(el) * 10, Math.cos(el) * 10); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  const weaponQ = H.weapon.quaternion.clone();
  const small = document.createElement('canvas'); small.width = RS; small.height = RS;
  const sctx = small.getContext('2d');

  const raw = {};
  for (const name of names) {
    const [clipName, frames, loop, speed, t0, t1v, flip0, cape] = ANIMS[name];
    const flip = Q.has('flip') ? +Q.get('flip') : flip0;
    const clip = H.clips[clipName];
    const t1 = t1v ?? clip.duration;
    H.mixer.stopAllAction();
    const act = H.mixer.clipAction(clip); act.reset(); act.play();
    act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); act.clampWhenFinished = true;
    H.weapon.quaternion.copy(weaponQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), flip));
    const sheet = document.createElement('canvas'); sheet.width = RS * frames; sheet.height = RS * 8;
    const g = sheet.getContext('2d');
    for (let d = 0; d < 8; d++) {
      H.holder.rotation.y = d * Math.PI / 4; H.holder.updateMatrixWorld(true);
      act.reset(); act.play();
      for (let f = 0; f < frames; f++) {
        const u = loop ? f / frames : f / (frames - 1);
        H.mixer.setTime(t0 + u * (t1 - t0));
        H.fixHips(); H.holder.updateMatrixWorld(true);
        H.setCape(cape, u * Math.PI * 2); H.holder.updateMatrixWorld(true);
        renderer.render(scene, cam);
        sctx.clearRect(0, 0, RS, RS);
        sctx.drawImage(renderer.domElement, 0, 0, RS, RS);    // supersampling 2×
        g.drawImage(inkPintado(small, 4.2), f * RS, d * RS);
      }
    }
    raw[name] = { sheet, frames, loop, fps: Math.round((frames / ((t1 - t0) / speed)) * 10) / 10 };
  }
  // caixa comum a todos os quadros
  let x0 = RS, y0 = RS, x1 = 0, y1 = 0;
  for (const { sheet, frames } of Object.values(raw)) {
    const data = sheet.getContext('2d').getImageData(0, 0, sheet.width, sheet.height).data;
    for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) {
      if (data[(y * sheet.width + x) * 4 + 3] < 8) continue;
      const fx = x % RS, fy = y % RS;
      if (fx < x0) x0 = fx; if (fx > x1) x1 = fx; if (fy < y0) y0 = fy; if (fy > y1) y1 = fy;
    }
  }
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(RS - 1, x1 + 2); y1 = Math.min(RS - 1, y1 + 2);
  const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
  const out = { meta: { style: 'pintado', frameW: fw, frameH: fh, anchor: [AX - x0, AY - y0], scale: 1 / RES, anims: {} }, files: {} };
  for (const [name, r] of Object.entries(raw)) {
    const c = document.createElement('canvas'); c.width = fw * r.frames; c.height = fh * 8;
    const g = c.getContext('2d');
    for (let d = 0; d < 8; d++) for (let f = 0; f < r.frames; f++) g.drawImage(r.sheet, f * RS + x0, d * RS + y0, fw, fh, f * fw, d * fh, fw, fh);
    out.meta.anims[name] = { frames: r.frames, fps: r.fps, loop: r.loop };
    out.files[name] = c.toDataURL('image/webp', 0.86);
  }
  out.meta.anims.ataque2 = { ...out.meta.anims.ataque, sheet: 'ataque' };
  return out;
}

// contorno de tinta fino (como as peças pintadas do mapa)
function ink(src, px = 1.6) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const sil = document.createElement('canvas'); sil.width = src.width; sil.height = src.height;
  const s = sil.getContext('2d'); s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(28,14,18,0.9)'; s.fillRect(0, 0, c.width, c.height);
  const g = c.getContext('2d');
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; g.drawImage(sil, Math.cos(t) * px, Math.sin(t) * px); }
  g.drawImage(src, 0, 0);
  return c;
}

const Q = new URLSearchParams(location.search);
if (Q.has('go')) bake(Q.get('go') ? Q.get('go').split(',') : undefined)
  .then((r) => { window.__bake = r; window.done = 1; })
  .catch((e) => { window.__bakeErr = String(e.stack); window.done = 1; });
