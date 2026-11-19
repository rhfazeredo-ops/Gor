import * as THREE from 'three';
import { toonify, luzes, ink as inkPintado } from './estilo.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// =====================================================================
// Escorpião (modelo do Tripo pintado por tools/pintar-modelo.py), animado por
// deformação procedural dos vértices: patas em onda, cauda (curva/bote),
// pinças, recuo de dano e morte (vira de barriga para cima).
// Renderiza em 8 direções na câmera do jogo → folhas WebP + sprites.json.
// Uso: tools/bake-escorpiao.html?go  (gravado por tools/bake-escorpiao.cjs)
// Convenção do modelo: cabeça/pinças em +Z, cauda em -Z, chão em y=0.
// =====================================================================
const RS = 340, AX = 170, AY = 236, RES = 2;
const PX_PER_UNIT = 118;                 // tamanho no jogo: ~1 unidade do modelo = 118 px
export const ANIMS = {
  // nome: [quadros, loop, fps]
  idle: [8, true, 8],
  andar: [8, true, 14],
  ataque: [10, false, 16],
  dano: [5, false, 18],
  morte: [10, false, 12],
};
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function deformer(geo) {
  // o GLB guarda posição e cor intercaladas no mesmo buffer: separa antes de mexer nas posições
  for (const [k, a] of Object.entries(geo.attributes)) if (a.isInterleavedBufferAttribute) geo.setAttribute(k, a.clone());
  const P0 = geo.attributes.position.array.slice(), n = P0.length / 3;
  const tail = new Float32Array(n), leg = new Float32Array(n), side = new Float32Array(n), legK = new Int8Array(n), claw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2], ax = Math.abs(x);
    tail[i] = sm(0.25, 0.42, y) * (z < 0.08 ? 1 : 0) * (ax < 0.16 ? 1 : 0.6);
    side[i] = Math.sign(x) || 1;
    leg[i] = (ax > 0.12 && y < 0.27 && z < 0.2 && z > -0.43) ? sm(0.12, 0.3, ax) * sm(0.27, 0.05, y) : 0;
    legK[i] = Math.max(0, Math.min(3, Math.floor((z + 0.43) / 0.16)));
    claw[i] = sm(0.17, 0.3, z) * sm(0.04, 0.12, ax) * (y < 0.27 ? 1 : 0);
  }
  const P = geo.attributes.position.array;
  // p: { walk (fase 0..1), walkAmt, tail (ângulo extra), sway, pinch, claws (avanço), lean, roll, legFold, bob }
  return (p) => {
    const ph = p.walk * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      let x = P0[i * 3], y = P0[i * 3 + 1], z = P0[i * 3 + 2];
      // patas: passo em onda (lados e pares alternados)
      if (leg[i] > 0) {
        const f = ph + (legK[i] % 2) * Math.PI + (side[i] > 0 ? Math.PI : 0);
        z += Math.sin(f) * 0.055 * leg[i] * p.walkAmt;
        y += Math.max(0, Math.cos(f)) * 0.04 * leg[i] * p.walkAmt;
        if (p.legFold) { x -= side[i] * p.legFold * 0.12 * leg[i]; y += p.legFold * 0.1 * leg[i]; }
      }
      // pinças: abrem/fecham e avançam
      if (claw[i] > 0) {
        z += p.claws * 0.06 * claw[i];
        x -= side[i] * p.pinch * 0.035 * claw[i];
      }
      // cauda: curva em volta da base (eixo X) + balanço lateral
      if (tail[i] > 0) {
        const a = p.tail * tail[i], py = 0.26, pz = -0.36;
        const dy = y - py, dz = z - pz, c = Math.cos(a), s = Math.sin(a);
        y = py + dy * c - dz * s; z = pz + dy * s + dz * c;
        x += Math.sin(p.sway) * 0.05 * tail[i] * (y - 0.25);
      }
      y += p.bob;
      // corpo inteiro: inclina (dano) e rola (morte)
      if (p.lean) { const c = Math.cos(p.lean), s = Math.sin(p.lean), dy = y - 0.15, dz = z; y = 0.15 + dy * c - dz * s; z = dy * s + dz * c; }
      if (p.roll) { const c = Math.cos(p.roll), s = Math.sin(p.roll), dy = y - 0.18; const nx = x * c - dy * s; y = 0.18 + x * s + dy * c; x = nx; y += p.rollLift || 0; }
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
}

const POSE = {
  idle: (u) => ({ walk: 0, walkAmt: 0, tail: Math.sin(u * 6.283) * 0.07, sway: Math.sin(u * 6.283) * 0.6, pinch: (Math.sin(u * 6.283 * 2) * 0.5 + 0.5) * 0.6, claws: 0, bob: Math.sin(u * 6.283) * 0.004 }),
  andar: (u) => ({ walk: u, walkAmt: 1, tail: Math.sin(u * 6.283 * 2) * 0.05, sway: Math.sin(u * 6.283) * 0.8, pinch: 0.2, claws: 0.1, bob: Math.abs(Math.sin(u * 6.283 * 2)) * 0.008 }),
  // arma o ferrão para trás e dá o bote para a frente
  ataque: (u) => { const a = u < 0.45 ? -0.32 * sm(0, 0.45, u) : u < 0.62 ? -0.32 + 1.05 * sm(0.45, 0.62, u) : 0.73 * (1 - sm(0.7, 1, u)); return { walk: 0, walkAmt: 0, tail: a, sway: 0, pinch: u < 0.5 ? 1 : 0, claws: u > 0.45 && u < 0.85 ? 0.6 : 0.15, bob: 0, lean: u > 0.5 && u < 0.8 ? 0.06 : 0 }; },
  dano: (u) => ({ walk: 0, walkAmt: 0, tail: -0.15 * Math.sin(u * Math.PI), sway: 0, pinch: 1, claws: -0.3, bob: 0, lean: -0.16 * Math.sin(u * Math.PI) }),
  morte: (u) => ({ walk: u * 2, walkAmt: 1 - u, tail: -0.5 * u, sway: 0, pinch: 1, claws: 0, bob: 0, roll: Math.PI * sm(0.15, 0.85, u), rollLift: 0.12 * Math.sin(Math.PI * sm(0.15, 0.85, u)), legFold: sm(0.5, 1, u) }),
};

export async function bake(names = Object.keys(ANIMS)) {
  const g = await new GLTFLoader().loadAsync('./tripo/escorpiao-pintado.glb');
  let mesh; g.scene.traverse((o) => { if (o.isMesh) mesh = o; });
  mesh.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
  const def = deformer(mesh.geometry);
  const holder = new THREE.Group(); holder.add(g.scene);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(RS * 2, RS * 2); renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(); scene.add(holder); toonify(holder);
  luzes(scene);
  const el = THREE.MathUtils.degToRad(30), ppu = PX_PER_UNIT * RES;
  const cam = new THREE.OrthographicCamera(-AX / ppu, (RS - AX) / ppu, AY / ppu, -(RS - AY) / ppu, -50, 50);
  cam.position.set(0, Math.sin(el) * 10, Math.cos(el) * 10); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix();
  const small = document.createElement('canvas'); small.width = RS; small.height = RS; const sctx = small.getContext('2d');
  const raw = {};
  for (const name of names) {
    const [frames, loop, fps] = ANIMS[name];
    const sheet = document.createElement('canvas'); sheet.width = RS * frames; sheet.height = RS * 8; const gx = sheet.getContext('2d');
    for (let d = 0; d < 8; d++) {
      holder.rotation.y = d * Math.PI / 4;
      for (let f = 0; f < frames; f++) {
        const u = loop ? f / frames : f / (frames - 1);
        def({ walk: 0, walkAmt: 0, tail: 0, sway: 0, pinch: 0, claws: 0, bob: 0, ...POSE[name](u) });
        renderer.render(scene, cam);
        sctx.clearRect(0, 0, RS, RS); sctx.drawImage(renderer.domElement, 0, 0, RS, RS);
        gx.drawImage(inkPintado(small, 3.4), f * RS, d * RS);
      }
    }
    raw[name] = { sheet, frames, loop, fps };
  }
  // caixa comum a todos os quadros
  let x0 = RS, y0 = RS, x1 = 0, y1 = 0;
  for (const { sheet } of Object.values(raw)) {
    const data = sheet.getContext('2d').getImageData(0, 0, sheet.width, sheet.height).data;
    for (let y = 0; y < sheet.height; y++) for (let x = 0; x < sheet.width; x++) {
      if (data[(y * sheet.width + x) * 4 + 3] < 8) continue;
      const fx = x % RS, fy = y % RS; if (fx < x0) x0 = fx; if (fx > x1) x1 = fx; if (fy < y0) y0 = fy; if (fy > y1) y1 = fy;
    }
  }
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(RS - 1, x1 + 2); y1 = Math.min(RS - 1, y1 + 2);
  const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
  const out = { meta: { style: 'pintado', frameW: fw, frameH: fh, anchor: [AX - x0, AY - y0], scale: 1 / RES, anims: {} }, files: {} };
  for (const [name, r] of Object.entries(raw)) {
    const c = document.createElement('canvas'); c.width = fw * r.frames; c.height = fh * 8; const gg = c.getContext('2d');
    for (let d = 0; d < 8; d++) for (let f = 0; f < r.frames; f++) gg.drawImage(r.sheet, f * RS + x0, d * RS + y0, fw, fh, f * fw, d * fh, fw, fh);
    out.meta.anims[name] = { frames: r.frames, fps: r.fps, loop: r.loop };
    out.files[name] = c.toDataURL('image/webp', 0.84);
  }
  return out;
}
function ink(src, px = 1.4) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const sil = document.createElement('canvas'); sil.width = src.width; sil.height = src.height;
  const s = sil.getContext('2d'); s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = 'rgba(28,10,10,0.9)'; s.fillRect(0, 0, c.width, c.height);
  const g = c.getContext('2d');
  for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; g.drawImage(sil, Math.cos(t) * px, Math.sin(t) * px); }
  g.drawImage(src, 0, 0); return c;
}
const Q = new URLSearchParams(location.search);
if (Q.has('go')) bake(Q.get('go') ? Q.get('go').split(',') : undefined).then((r) => { window.__bake = r; window.done = 1; }).catch((e) => { window.__bakeErr = String(e.stack); window.done = 1; });
