import * as THREE from 'three';
import { buildCharacter, Animator } from '../src/rig.js';
import { HEROES } from '../src/data/heroes.js';

// =====================================================================
// Gera os sprites em pixel art de um herói a partir do modelo 3D:
// câmera isométrica (30° de elevação → losangos 2:1), 8 direções,
// todas as animações. Cada quadro é renderizado em 2x, reduzido,
// com paleta limitada e contorno escuro de 1 pixel.
// Uso: tools/bake-sprites.html?hero=dalarian (o script de build salva os PNG).
// =====================================================================
const FRAME = 112;                 // tamanho do quadro em pixels de arte
const PX_PER_UNIT = 25;           // pixels por metro
const ANCHOR = [56, 94];          // pés do personagem dentro do quadro
const SS = 3;                     // supersample
const ANIMS = [
  // nome, ação do Animator (null = locomoção), duração (s), quadros, velocidade, loop
  ['idle', null, 2.86, 8, 0, true],
  ['walk', null, 0.66, 8, 1, true],
  ['ataque', 'ataque', 0.42, 6, 0, false],
  ['ataque2', 'ataque', 0.42, 6, 0, false],
  ['consagracao', 'consagracao', 0.9, 10, 0, false],
  ['protecao', 'protecao', 0.55, 6, 0, false],
  ['esquiva', 'esquiva', 0.22, 4, 0, false],
  ['dano', 'dano', 0.25, 3, 0, false],
];
const OUTLINE = [26, 16, 32];

export async function bake(id) {
  const def = HEROES.find((h) => h.id === id);
  const W = FRAME * SS;
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, W);
  renderer.setClearColor(0x000000, 0);
  const rt = new THREE.WebGLRenderTarget(W, W);
  rt.texture.colorSpace = THREE.SRGBColorSpace;   // lê as cores já em sRGB (senão fica escuro)
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x4a3a40, 1.1));
  const sun = new THREE.DirectionalLight(0xffe6c0, 2.3); sun.position.set(-4, 8, 6); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb0c0ff, 0.6); fill.position.set(5, 3, -2); scene.add(fill);

  // câmera ortográfica: 1 unidade = PX_PER_UNIT pixels; pés no ANCHOR
  const half = FRAME / PX_PER_UNIT / 2;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100);
  const elev = THREE.MathUtils.degToRad(30);
  const D = 20;
  cam.position.set(0, Math.sin(elev) * D, Math.cos(elev) * D);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  // desloca o quadro para que a origem (pés) caia no ANCHOR
  const offX = (FRAME / 2 - ANCHOR[0]) / PX_PER_UNIT, offY = (ANCHOR[1] - FRAME / 2) / PX_PER_UNIT;
  cam.left -= offX; cam.right -= offX; cam.top += offY; cam.bottom += offY;
  cam.updateProjectionMatrix();

  const rig = buildCharacter(def, { outline: false });
  scene.add(rig.root);
  const pixels = new Uint8Array(W * W * 4);

  // 1) renderiza todos os quadros (reduzidos, sem paleta ainda)
  const raw = {};
  for (const [name, action, dur, frames, speed] of ANIMS) {
    raw[name] = [];
    for (let d = 0; d < 8; d++) {
      rig.root.rotation.y = d * Math.PI / 4;
      for (let f = 0; f < frames; f++) {
        const anim = new Animator(rig, def.arma);
        anim.speed = speed;
        if (action) {
          anim.action = { name: action, n: Math.min(0.999, (f + 0.5) / frames), dur, variante: name === 'ataque2' ? 1 : 0 };
          anim.update(0, speed);
        } else { anim.t = (f / frames) * dur; anim.update(0, speed); }
        renderer.setRenderTarget(rt);
        renderer.clear();
        renderer.render(scene, cam);
        renderer.readRenderTargetPixels(rt, 0, 0, W, W, pixels);
        raw[name].push(downsample(pixels, W));
      }
    }
  }
  renderer.setRenderTarget(null);

  // 2) paleta única para o herói (mediana) e aplicação + contorno
  const palette = buildPalette(Object.values(raw).flat(), 44);
  const sheets = {};
  const meta = { frame: FRAME, anchor: ANCHOR, pxPerUnit: PX_PER_UNIT, dirs: ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'], anims: {} };
  for (const [name, , dur, frames, , loop] of ANIMS) {
    const c = document.createElement('canvas');
    c.width = FRAME * frames; c.height = FRAME * 8;
    const ctx = c.getContext('2d');
    raw[name].forEach((img, i) => {
      const d = Math.floor(i / frames), f = i % frames;
      const out = finishFrame(img, palette);
      ctx.putImageData(new ImageData(out, FRAME, FRAME), f * FRAME, d * FRAME);
    });
    sheets[name] = c.toDataURL('image/png');
    meta.anims[name] = { frames, fps: Math.round(frames / dur * 10) / 10, loop };
  }
  return { sheets, meta };
}

// média por bloco SSxSS (com alfa); vira de cabeça para baixo (readPixels começa embaixo)
function downsample(src, W) {
  const out = new Float32Array(FRAME * FRAME * 4);
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const sy = W - 1 - (y * SS + j), sx = x * SS + i, k = (sy * W + sx) * 4;
      const al = src[k + 3] / 255;
      r += src[k] * al; g += src[k + 1] * al; b += src[k + 2] * al; a += al;
    }
    const o = (y * FRAME + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = a / (SS * SS);
  }
  return out;
}

function buildPalette(frames, n) {
  const pts = [];
  for (const f of frames) for (let i = 0; i < f.length; i += 4 * 3) if (f[i + 3] > 0.5) pts.push([f[i], f[i + 1], f[i + 2]]);
  // median cut
  let boxes = [pts];
  while (boxes.length < n) {
    boxes.sort((a, b) => spread(b) - spread(a));
    const box = boxes.shift();
    if (box.length < 2) { boxes.push(box); break; }
    const ch = axis(box);
    box.sort((a, b) => a[ch] - b[ch]);
    const m = box.length >> 1;
    boxes.push(box.slice(0, m), box.slice(m));
  }
  return boxes.filter((b) => b.length).map((b) => [0, 1, 2].map((c) => Math.round(b.reduce((s, p) => s + p[c], 0) / b.length)));
}
function spread(b) { const a = axis(b, true); return a * Math.log(b.length + 1); }
function axis(b, retRange = false) {
  let best = 0, range = -1;
  for (let c = 0; c < 3; c++) {
    let lo = 255, hi = 0;
    for (const p of b) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
    if (hi - lo > range) { range = hi - lo; best = c; }
  }
  return retRange ? range : best;
}

function finishFrame(img, pal) {
  const out = new Uint8ClampedArray(FRAME * FRAME * 4);
  const solid = new Uint8Array(FRAME * FRAME);
  for (let i = 0; i < FRAME * FRAME; i++) {
    if (img[i * 4 + 3] < 0.5) continue;
    solid[i] = 1;
    let best = 0, bd = 1e9;
    for (let k = 0; k < pal.length; k++) {
      const dr = img[i * 4] - pal[k][0], dg = img[i * 4 + 1] - pal[k][1], db = img[i * 4 + 2] - pal[k][2];
      const dd = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (dd < bd) { bd = dd; best = k; }
    }
    out.set([...pal[best], 255], i * 4);
  }
  // contorno externo de 1 pixel
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) {
    const i = y * FRAME + x;
    if (solid[i]) continue;
    const n = (x > 0 && solid[i - 1]) || (x < FRAME - 1 && solid[i + 1]) || (y > 0 && solid[i - FRAME]) || (y < FRAME - 1 && solid[i + FRAME]);
    if (n) out.set([...OUTLINE, 255], i * 4);
  }
  return out;
}

const id = new URLSearchParams(location.search).get('hero') || 'dalarian';
bake(id).then((r) => { window.__sprites = r; document.body.append('pronto'); })
  .catch((e) => { window.__spritesErr = String(e.stack); document.body.append('erro: ' + e.stack); });
