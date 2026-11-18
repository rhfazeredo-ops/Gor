// =====================================================================
// Cenário pintado por código (Canvas 2D), em alta resolução.
// Sem nenhuma imagem: ruído procedural, gradientes, pinceladas e luz
// calculada. Mesmas unidades do mundo (tile 64x32); tudo é desenhado
// em RES vezes mais pixels para ficar nítido com zoom.
// =====================================================================
import { TW, TH, WALL_H } from './art.js';
export { TW, TH, WALL_H };
export const RES = 2;

// ---------------- ruído ----------------
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s, period) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const P = (a) => (period ? ((a % period) + period) % period : a);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(P(xi), P(yi), s), b = hash(P(xi + 1), P(yi), s), c = hash(P(xi), P(yi + 1), s), d = hash(P(xi + 1), P(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4, period = 0) {
  let t = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 17, period ? period * f : 0) * amp; amp *= 0.5; f *= 2; }
  return t;
}
const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }

// ---------------- texturas do chão (repetem sem emenda) ----------------
function texture(kind, size = 256) {
  const c = cv(size, size), g = c.getContext('2d');
  const img = g.createImageData(size, size), d = img.data;
  const P = {
    grama: { a: hex(0x3f6e2e), b: hex(0x5c8d38), c: hex(0x2e5426), hi: hex(0x86b04c) },
    terra: { a: hex(0x6e5238), b: hex(0x8a6a48), c: hex(0x50392a), hi: hex(0xa3825a) },
    pedra: { a: hex(0x5d5866), b: hex(0x726c7a), c: hex(0x45404e), hi: hex(0x8f889a) },
    madeira: { a: hex(0x6a4428), b: hex(0x84573a), c: hex(0x4a2e1a), hi: hex(0x9a6c46) },
    laje: { a: hex(0x6b5e58), b: hex(0x857369), c: hex(0x4a3f3c), hi: hex(0xa08c7c) },
  }[kind];
  const per = 8;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * per, v = y / size * per;
    const n = fbm(u, v, kind.length * 31, 5, per);
    const n2 = fbm(u * 3, v * 3, 99, 3, per * 3);
    let col = mixc(P.c, P.a, clamp(n * 1.6 - 0.2, 0, 1));
    col = mixc(col, P.b, clamp((n2 - 0.45) * 2.5, 0, 1));
    if (kind === 'grama') {
      // pinceladas verticais (folhinhas)
      const blade = vnoise(x * 0.9, y * 0.25, 7, size * 0.9 / 1) ;
      if (blade > 0.78) col = mixc(col, P.hi, (blade - 0.78) * 3);
      if (blade < 0.12) col = mixc(col, P.c, 0.5);
    }
    if (kind === 'terra' && n2 > 0.72) col = mixc(col, P.hi, 0.5);
    if (kind === 'madeira') { const plank = (y % 32); if (plank < 2) col = mixc(col, P.c, 0.8); col = mixc(col, P.b, vnoise(x * 0.05, y * 0.6, 3, 0) * 0.3); }
    const i = (y * size + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------------- chão inteiro do mapa (um canvas grande) ----------------
import { paintCastleGround, buildCastleArt } from './castle.js';
import { buildThemes, paintGardenGround, paintDesertGround } from './themes.js';
export function paintGround(map) {
  if (map.tema === 'castelo') return paintCastleGround(map);
  if (map.tema === 'jardim') return paintGardenGround(map);
  if (map.tema === 'deserto') return paintDesertGround(map);
  const ox = map.h * (TW / 2);               // deslocamento: tile (0, h) encosta na esquerda
  const CLIFF = map.ondas ? 110 : 0;
  const W = (map.w + map.h) * (TW / 2), H = (map.w + map.h) * (TH / 2) + TH + CLIFF;
  const c = cv(W * RES, H * RES), g = c.getContext('2d');
  g.scale(RES, RES);
  const tex = {}, pat = {};
  for (const k of ['grama', 'terra', 'pedra', 'madeira', 'laje']) { tex[k] = texture(k); pat[k] = g.createPattern(tex[k], 'repeat'); }
  const at = (i, j) => (i < 0 || j < 0 || i >= map.w || j >= map.h ? null : map.floor[j * map.w + i]);
  const scr = (i, j) => [(i - j) * (TW / 2) + ox, (i + j) * (TH / 2)];
  const diamond = (i, j, grow = 0.6) => {
    const [x, y] = scr(i, j);
    g.beginPath(); g.moveTo(x, y - grow); g.lineTo(x + TW / 2 + grow * 2, y + TH / 2); g.lineTo(x, y + TH + grow); g.lineTo(x - TW / 2 - grow * 2, y + TH / 2); g.closePath();
  };
  // base: cada tipo com sua textura (alinhada ao mundo = sem emendas, 1 texel = 1 pixel)
  for (const k in pat) pat[k].setTransform(new DOMMatrix().scale(1 / RES));
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    const k = at(i, j); if (!k) continue;
    g.fillStyle = pat[k]; diamond(i, j); g.fill();
  }
  if (map.ondas) paintArena(g, map, at, scr, diamond, rng(5));
  // lajotas desenhadas por cima da pedra (bisel claro/escuro)
  const r = rng(77);
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (at(i, j) !== 'pedra') continue;
    const [x, y] = scr(i, j);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const cx = x + (a - b) * (TW / 4), cy = y + TH / 4 + (a + b) * (TH / 4);
      const w = TW / 4 - 1.2, h = TH / 4 - 0.8;
      const tone = 0.85 + r() * 0.3;
      g.beginPath(); g.moveTo(cx, cy - h + 1); g.lineTo(cx + w * 2 - 2, cy); g.lineTo(cx, cy + h - 1); g.lineTo(cx - w * 2 + 2, cy); g.closePath();
      g.fillStyle = `rgba(${120 * tone},${114 * tone},${130 * tone},0.35)`; g.fill();
      g.strokeStyle = 'rgba(30,26,38,0.55)'; g.lineWidth = 1; g.stroke();
      g.beginPath(); g.moveTo(cx - w * 2 + 3, cy); g.lineTo(cx, cy - h + 2); g.lineTo(cx + w * 2 - 3, cy);
      g.strokeStyle = 'rgba(200,192,210,0.25)'; g.stroke();
      if (r() < 0.25) { // musgo
        g.fillStyle = 'rgba(80,110,50,0.35)';
        g.beginPath(); g.ellipse(cx + (r() - 0.5) * 12, cy + (r() - 0.5) * 4, 4 + r() * 5, 2 + r() * 2, 0, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // bordas orgânicas: tufos de grama invadindo terra/pedra
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (at(i, j) !== 'grama') continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = at(i + di, j + dj); if (!n || n === 'grama') continue;
      const [x, y] = scr(i + 0.5 + di * 0.5, j + 0.5 + dj * 0.5);
      for (let k = 0; k < 7; k++) {
        const t = r() - 0.5;
        const px = x + (dj - di) * 0 + t * (TW / 2) * (di !== 0 ? -1 : 1) * 0.9 * (dj !== 0 ? 1 : 1);
        const py = y + t * (TH / 2) * (di !== 0 ? 1 : -1) * 0.9;
        g.fillStyle = pat.grama;
        g.beginPath(); g.ellipse(px, py, 4 + r() * 6, 2 + r() * 3, 0, 0, Math.PI * 2); g.fill();
      }
    }
  }
  // detalhes pintados: tufos, flores e pedrinhas na grama; cascalho na terra
  const flowers = [[240, 220, 120], [230, 120, 160], [250, 250, 240], [160, 150, 240]];
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    const k = at(i, j); if (!k) continue;
    const [x, y] = scr(i, j);
    const pt = () => { const a = r(), b = r(); return [x + (a - b) * (TW / 2) * 0.9, y + (a + b) * (TH / 2) * 0.9 + 1]; };
    if (k === 'grama') {
      for (let n = 0; n < 9; n++) {
        const [px, py] = pt();
        const h = 3 + r() * 5, lean = (r() - 0.5) * 3;
        g.strokeStyle = r() < 0.5 ? 'rgba(120,170,70,0.9)' : 'rgba(60,100,40,0.9)'; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + lean * 0.3, py - h * 0.6, px + lean, py - h); g.stroke();
      }
      if (r() < 0.45) for (let n = 0; n < 1 + r() * 4; n++) {
        const [px, py] = pt(); const fc = flowers[(r() * flowers.length) | 0];
        g.fillStyle = rgb(fc); g.beginPath(); g.arc(px, py - 2, 1.3, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,220,0.9)'; g.fillRect(px - 0.4, py - 2.4, 0.8, 0.8);
      }
    }
    if (k === 'terra') for (let n = 0; n < 5; n++) {
      const [px, py] = pt(); g.fillStyle = r() < 0.5 ? 'rgba(60,44,30,0.6)' : 'rgba(170,140,100,0.5)';
      g.beginPath(); g.ellipse(px, py, 1 + r() * 1.5, 0.7 + r(), 0, 0, Math.PI * 2); g.fill();
    }
  }
  // grandes manchas de luz/sombra (variação "pintada")
  g.globalCompositeOperation = 'soft-light';
  for (let n = 0; n < (map.w * map.h) / 6; n++) {
    const x = r() * W, y = r() * H, rad = 30 + r() * 80;
    // só onde existe chão
    const ti = Math.floor((x - ox) / TW + y / TH), tj = Math.floor(y / TH - (x - ox) / TW);
    if (!at(ti, tj)) continue;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const light = r() < 0.5;
    gr.addColorStop(0, light ? 'rgba(255,240,200,0.35)' : 'rgba(20,10,40,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalCompositeOperation = 'source-over';
  // oclusão perto das paredes
  for (const w of map.walls) {
    const [x, y] = scr(w.i + 0.5, w.j + 0.5);
    const gr = g.createRadialGradient(x, y + 6, 4, x, y + 6, 50);
    gr.addColorStop(0, 'rgba(10,6,20,0.45)'); gr.addColorStop(1, 'rgba(10,6,20,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 6, 50, 25, 0, 0, Math.PI * 2); g.fill();
  }
  return { canvas: c, ox, W, H };
}

// ---------------- parede: bloco de pedra pintado ----------------
function wallBlock(seed) {
  const r = rng(seed * 31 + 7);
  const w = TW, h = TH + WALL_H;
  const c = cv(w * RES, h * RES), g = c.getContext('2d'); g.scale(RES, RES);
  const top = [[w / 2, 0], [w, TH / 2], [w / 2, TH], [0, TH / 2]];
  const poly = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); };
  // faces
  const L = [[0, TH / 2], [w / 2, TH], [w / 2, TH + WALL_H], [0, TH / 2 + WALL_H]];
  const R = [[w / 2, TH], [w, TH / 2], [w, TH / 2 + WALL_H], [w / 2, TH + WALL_H]];
  let gr = g.createLinearGradient(0, TH / 2, 0, h); gr.addColorStop(0, '#7b7386'); gr.addColorStop(1, '#4a4352'); poly(L, gr);
  gr = g.createLinearGradient(0, TH / 2, 0, h); gr.addColorStop(0, '#5d5668'); gr.addColorStop(1, '#342e3c'); poly(R, gr);
  // tijolos nas duas faces
  for (const [face, sgn] of [[L, 1], [R, -1]]) {
    g.save(); g.beginPath(); face.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
    for (let row = 0; row < 5; row++) {
      const off = (row % 2) * 8;
      for (let col = -1; col < 4; col++) {
        const x0 = (sgn > 0 ? 0 : w / 2) + col * 16 + off;
        const yb = TH / 2 + row * 8 + (sgn > 0 ? x0 / 2 : (w - x0) / 2) - (sgn > 0 ? 0 : 0);
        const yy = sgn > 0 ? TH / 2 + row * 8 + (x0) / 2 : TH / 2 + row * 8 + (w - x0) / 2;
        void yb;
        const tone = 0.8 + r() * 0.4;
        g.beginPath();
        g.moveTo(x0 + 1, yy + (sgn > 0 ? 0.5 : -0.5) + 1);
        g.lineTo(x0 + 15, yy + (sgn > 0 ? 7.5 : -7.5) + 1);
        g.lineTo(x0 + 15, yy + (sgn > 0 ? 7.5 : -7.5) + 7);
        g.lineTo(x0 + 1, yy + (sgn > 0 ? 0.5 : -0.5) + 7);
        g.closePath();
        g.fillStyle = `rgba(${150 * tone},${140 * tone},${160 * tone},0.18)`; g.fill();
        g.strokeStyle = 'rgba(20,16,28,0.6)'; g.lineWidth = 0.8; g.stroke();
      }
    }
    g.restore();
  }
  // topo
  gr = g.createLinearGradient(0, 0, w, TH); gr.addColorStop(0, '#a49cb0'); gr.addColorStop(1, '#7e7690'); poly(top, gr);
  g.strokeStyle = 'rgba(230,224,240,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, TH / 2); g.lineTo(w / 2, 0); g.lineTo(w, TH / 2); g.stroke();
  if (r() < 0.6) { g.fillStyle = 'rgba(90,120,60,0.55)'; g.beginPath(); g.ellipse(w / 2 + (r() - 0.5) * 20, TH / 2 + (r() - 0.5) * 6, 8, 4, 0, 0, Math.PI * 2); g.fill(); }
  return c;
}

// ---------------- objetos ----------------
function obj(w, h, ax, ay, draw) {
  const c = cv(w * RES, h * RES), g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round';
  draw(g); return { img: c, ax, ay, w, h };
}
const shadeFace = (g, pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); };

function rock(seed, size = 1) {
  // pedra low-poly: polígono facetado com luz chapada (como no vídeo)
  const r = rng(seed);
  return obj(60 * size, 46 * size, 30 * size, 40 * size, (g) => {
    const cx = 30 * size, cy = 30 * size, n = 7;
    const ring = [], top = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ring.push([cx + Math.cos(a) * (20 + r() * 7) * size, cy + Math.sin(a) * (10 + r() * 3) * size]);
      top.push([cx + Math.cos(a + 0.3) * (11 + r() * 5) * size, cy - (14 + r() * 6) * size + Math.sin(a + 0.3) * 6 * size]);
    }
    const peak = [cx - 3 * size, cy - 22 * size];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = (i + 0.5) / n * Math.PI * 2;
      const lit = clamp(0.55 - Math.cos(a) * 0.3 - Math.sin(a) * 0.25, 0.15, 1);
      const base = [110, 106, 118];
      shadeFace(g, [ring[i], ring[j], top[j], top[i]], rgb(base.map((v) => v * (0.5 + lit * 0.7))));
      shadeFace(g, [top[i], top[j], peak], rgb(base.map((v) => v * (0.75 + lit * 0.6))));
    }
    g.strokeStyle = 'rgba(25,20,32,0.7)'; g.lineWidth = 1;
    g.beginPath(); ring.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
    g.fillStyle = 'rgba(90,125,60,0.6)'; g.beginPath(); g.ellipse(peak[0] + 4, peak[1] + 6, 7 * size, 3 * size, 0.2, 0, Math.PI * 2); g.fill();
  });
}

function tree(seed, kind = 'folha') {
  const r = rng(seed);
  return obj(110, 170, 55, 160, (g) => {
    // tronco
    let gr = g.createLinearGradient(48, 0, 62, 0); gr.addColorStop(0, '#7a5232'); gr.addColorStop(1, '#3e2614');
    g.fillStyle = gr; g.beginPath(); g.moveTo(49, 160); g.lineTo(52, 100); g.lineTo(58, 100); g.lineTo(62, 160); g.closePath(); g.fill();
    if (kind === 'pinheiro') {
      for (let k = 0; k < 5; k++) {
        const y = 40 + k * 22, w = 18 + k * 9;
        const g2 = g.createLinearGradient(55 - w, 0, 55 + w, 0); g2.addColorStop(0, '#3f7a4e'); g2.addColorStop(0.5, '#2c5c3c'); g2.addColorStop(1, '#173826');
        g.fillStyle = g2; g.beginPath(); g.moveTo(55, y - 34); g.lineTo(55 + w, y + 8); g.lineTo(55 - w, y + 8); g.closePath(); g.fill();
      }
      return;
    }
    // copa: muitos tufos sobrepostos, sombra embaixo/direita, luz em cima/esquerda
    const blobs = [];
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      blobs.push([55 + Math.cos(a) * d * 38, 62 + Math.sin(a) * d * 34, 12 + r() * 10]);
    }
    blobs.sort((p, q) => p[1] - q[1]);
    for (const pass of [0, 1, 2]) for (const [x, y, s] of blobs) {
      const lit = clamp(((55 - x) * 0.6 + (62 - y)) / 50 + 0.5, 0, 1);
      const col = pass === 0 ? [28, 56, 30] : pass === 1 ? mixc([44, 86, 40], [88, 140, 58], lit) : mixc([60, 110, 46], [150, 196, 90], lit);
      const rr = pass === 0 ? s + 3 : pass === 1 ? s : s * 0.45;
      const ox = pass === 2 ? -s * 0.3 : 0, oy = pass === 2 ? -s * 0.35 : pass === 0 ? 3 : 0;
      if (pass === 2 && lit < 0.45) continue;
      g.fillStyle = rgb(col); g.beginPath(); g.arc(x + ox, y + oy, rr, 0, Math.PI * 2); g.fill();
    }
  });
}

function torch() {
  return obj(24, 70, 12, 66, (g) => {
    const gr = g.createLinearGradient(9, 0, 15, 0); gr.addColorStop(0, '#6a4426'); gr.addColorStop(1, '#2e1c10');
    g.fillStyle = gr; g.fillRect(10, 22, 4, 44);
    g.fillStyle = '#c98a2a'; g.beginPath(); g.moveTo(5, 16); g.lineTo(19, 16); g.lineTo(16, 24); g.lineTo(8, 24); g.closePath(); g.fill();
    g.fillStyle = '#7a5218'; g.fillRect(8, 22, 8, 2);
  });
}
function barrel(seed) {
  const r = rng(seed);
  return obj(34, 42, 17, 39, (g) => {
    const gr = g.createLinearGradient(3, 0, 31, 0); gr.addColorStop(0, '#a8744a'); gr.addColorStop(0.45, '#8a5a34'); gr.addColorStop(1, '#4a2e18');
    g.fillStyle = gr; g.beginPath(); g.moveTo(5, 9); g.quadraticCurveTo(1, 24, 5, 38); g.lineTo(29, 38); g.quadraticCurveTo(33, 24, 29, 9); g.closePath(); g.fill();
    g.strokeStyle = '#3e3a46'; g.lineWidth = 2; for (const y of [14, 32]) { g.beginPath(); g.moveTo(3.5, y); g.lineTo(30.5, y); g.stroke(); }
    g.fillStyle = '#9a6a40'; g.beginPath(); g.ellipse(17, 9, 12, 5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(40,24,12,0.6)'; g.lineWidth = 1; g.stroke();
    void r;
  });
}
function crate() {
  return obj(44, 46, 22, 43, (g) => {
    shadeFace(g, [[22, 2], [42, 12], [22, 22], [2, 12]], '#b4814e');
    shadeFace(g, [[2, 12], [22, 22], [22, 44], [2, 34]], '#8c5e36');
    shadeFace(g, [[22, 22], [42, 12], [42, 34], [22, 44]], '#5e3c20');
    g.strokeStyle = '#3a2412'; g.lineWidth = 1.5;
    for (const f of [[[2, 12], [22, 22], [22, 44], [2, 34]], [[22, 22], [42, 12], [42, 34], [22, 44]]]) {
      g.beginPath(); f.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(...f[0]); g.lineTo(...f[2]); g.stroke();
    }
  });
}
function pillar() {
  return obj(46, 120, 23, 114, (g) => {
    const gr = g.createLinearGradient(8, 0, 38, 0); gr.addColorStop(0, '#b0a8bc'); gr.addColorStop(0.4, '#8a8296'); gr.addColorStop(1, '#4a4454');
    g.fillStyle = '#5c5666'; g.beginPath(); g.ellipse(23, 112, 20, 8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = gr; g.fillRect(10, 14, 26, 98);
    g.strokeStyle = 'rgba(30,24,40,0.35)'; g.lineWidth = 1; for (const x of [16, 23, 30]) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x, 110); g.stroke(); }
    g.fillStyle = '#9890a6'; g.fillRect(5, 6, 36, 10); g.fillStyle = '#c4bcd0'; g.fillRect(5, 6, 36, 3);
  });
}
function banner() {
  return obj(30, 80, 15, 77, (g) => {
    g.fillStyle = '#5a3a22'; g.fillRect(14, 0, 3, 80);
    const gr = g.createLinearGradient(3, 0, 27, 0); gr.addColorStop(0, '#3a4ca8'); gr.addColorStop(1, '#1e2766');
    g.fillStyle = gr; g.beginPath(); g.moveTo(3, 6); g.lineTo(27, 6); g.lineTo(27, 48); g.lineTo(15, 56); g.lineTo(3, 48); g.closePath(); g.fill();
    g.strokeStyle = '#e8a33a'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#f2b440'; g.fillRect(13.5, 14, 3, 26); g.fillRect(8, 21, 14, 3);
  });
}
function dummy() {
  return obj(36, 66, 18, 63, (g) => {
    g.fillStyle = '#5a3a22'; g.fillRect(16, 22, 4, 42); g.fillRect(3, 26, 30, 4);
    const gr = g.createLinearGradient(8, 0, 28, 0); gr.addColorStop(0, '#e2bf6e'); gr.addColorStop(1, '#9c7a38');
    g.fillStyle = gr; g.beginPath(); g.ellipse(18, 36, 10, 15, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(18, 14, 8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a3420'; g.lineWidth = 1.5; for (const y of [30, 42]) { g.beginPath(); g.moveTo(8, y); g.lineTo(28, y); g.stroke(); }
  });
}
function bush(seed) {
  const r = rng(seed);
  return obj(50, 34, 25, 31, (g) => {
    for (const pass of [0, 1]) for (let k = 0; k < 9; k++) {
      const x = 10 + r() * 30, y = 12 + r() * 14, s = 6 + r() * 6;
      g.fillStyle = pass ? mixc([60, 110, 46], [130, 180, 80], (40 - x) / 30).reduce((a, v, i) => (a + (i ? ',' : '') + (v | 0)), 'rgb(') + ')' : '#24461f';
      g.beginPath(); g.arc(x, y - (pass ? 2 : 0), pass ? s * 0.8 : s, 0, Math.PI * 2); g.fill();
    }
  });
}

// ---------------- gosmas pintadas ----------------
export function slimeFrames(color, size = 1) {
  const base = hex(color);
  const W = 44 * size, H = 40 * size;
  const shapes = [[1, 1], [1.12, 0.86], [0.92, 1.12], [1, 1], [1.3, 0.7], [1.05, 0.95]];
  const frames = shapes.map(([sx, sy], fi) => {
    const c = cv(W * RES, H * RES), g = c.getContext('2d'); g.scale(RES, RES);
    const rx = 14 * size * sx, ry = 12 * size * sy, cx = W / 2, cy = H - 3 - ry;
    const gr = g.createRadialGradient(cx - rx * 0.35, cy - ry * 0.4, 1, cx, cy, rx * 1.2);
    const lightc = mixc(base, [255, 255, 255], 0.45), dark = base.map((v) => v * 0.45);
    gr.addColorStop(0, rgb(lightc, 0.95)); gr.addColorStop(0.55, rgb(base, 0.92)); gr.addColorStop(1, rgb(dark, 0.95));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx - rx, cy + ry * 0.55);
    g.bezierCurveTo(cx - rx * 1.05, cy - ry * 0.9, cx - rx * 0.4, cy - ry * 1.15, cx, cy - ry * 1.1);
    g.bezierCurveTo(cx + rx * 0.4, cy - ry * 1.15, cx + rx * 1.05, cy - ry * 0.9, cx + rx, cy + ry * 0.55);
    g.quadraticCurveTo(cx, cy + ry * 1.05, cx - rx, cy + ry * 0.55); g.closePath(); g.fill();
    g.strokeStyle = rgb(dark.map((v) => v * 0.6), 0.9); g.lineWidth = 1.2; g.stroke();
    if (fi === 5) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill(); }
    // brilho
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(cx - rx * 0.45, cy - ry * 0.55, rx * 0.22, ry * 0.12, -0.5, 0, Math.PI * 2); g.fill();
    // olhos
    for (const s of [-1, 1]) {
      g.fillStyle = '#1a0f1e'; g.beginPath(); g.ellipse(cx + s * rx * 0.32, cy - ry * 0.1, 2.2 * size, 3 * size, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * rx * 0.32 - 0.7, cy - ry * 0.1 - 1.2, 0.9 * size, 0, Math.PI * 2); g.fill();
    }
    return c;
  });
  return { frames, ax: W / 2, ay: H - 3, w: W, h: H };
}

// ---------------- arena: lajes entalhadas, mosaico e penhascos ----------------
function paintArena(g, map, at, scr, diamond, r) {
  // penhascos: face de rocha descendo onde o chão termina no abismo
  const faces = [];
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const [x, y] = scr(i, j);
    const L = [x - TW / 2, y + TH / 2], B = [x, y + TH], R = [x + TW / 2, y + TH / 2];
    if (!at(i, j + 1)) faces.push([L, B, -1]);
    if (!at(i + 1, j)) faces.push([B, R, 1]);
  }
  for (const [a, b, side] of faces) {
    const D = 70 + r() * 40;
    const gr = g.createLinearGradient(0, a[1], 0, a[1] + D);
    gr.addColorStop(0, side < 0 ? '#5d4f55' : '#43383f'); gr.addColorStop(0.5, side < 0 ? '#3a2f38' : '#2a2129'); gr.addColorStop(1, 'rgba(14,8,20,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(b[0], b[1] + D); g.lineTo(a[0], a[1] + D * 0.8); g.closePath(); g.fill();
    // estratos da rocha
    g.strokeStyle = 'rgba(15,8,18,0.45)'; g.lineWidth = 1;
    for (let k = 1; k < 4; k++) { const t = k * 13 + r() * 6; g.beginPath(); g.moveTo(a[0], a[1] + t); g.lineTo(b[0], b[1] + t + (r() - 0.5) * 4); g.stroke(); }
    // borda clara (lábio da pedra) + contorno escuro
    g.strokeStyle = 'rgba(20,10,22,0.95)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    g.strokeStyle = 'rgba(255,220,180,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1] - 1.2); g.lineTo(b[0], b[1] - 1.2); g.stroke();
  }
  // lajes grandes: cada tile = uma laje com bisel, rachaduras e desgaste
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (at(i, j) !== 'laje') continue;
    const [x, y] = scr(i, j);
    const tone = 0.85 + r() * 0.3;
    g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + TW / 2 - 4, y + TH / 2); g.lineTo(x, y + TH - 2); g.lineTo(x - TW / 2 + 4, y + TH / 2); g.closePath();
    g.fillStyle = `rgba(${150 * tone},${128 * tone},${116 * tone},0.22)`; g.fill();
    g.strokeStyle = 'rgba(22,14,18,0.75)'; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = 'rgba(230,205,180,0.28)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x - TW / 2 + 5, y + TH / 2); g.lineTo(x, y + 3); g.lineTo(x + TW / 2 - 5, y + TH / 2); g.stroke();
    if (r() < 0.35) { // rachadura
      g.strokeStyle = 'rgba(20,12,16,0.6)'; g.lineWidth = 0.9; g.beginPath();
      let px = x + (r() - 0.5) * 30, py = y + TH / 2 + (r() - 0.5) * 10; g.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 12; py += (r() - 0.5) * 6; g.lineTo(px, py); }
      g.stroke();
    }
  }
  // mosaico da Ordem da Luz no centro da sala (anéis dourados e raios)
  const [cx, cy] = scr(map.start.x, map.start.y);
  g.save(); g.translate(cx, cy); g.scale(1, 0.5);
  const R0 = 105;
  g.strokeStyle = 'rgba(20,12,16,0.85)'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, R0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#c98a2e'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#f0c060'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, R0 - 1, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#a8742a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R0 * 0.62, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, long = k % 2 === 0;
    g.fillStyle = long ? '#d9a040' : '#9a6a28';
    g.beginPath(); g.moveTo(Math.cos(a - 0.06) * R0 * 0.64, Math.sin(a - 0.06) * R0 * 0.64);
    g.lineTo(Math.cos(a) * R0 * (long ? 0.97 : 0.85), Math.sin(a) * R0 * (long ? 0.97 : 0.85));
    g.lineTo(Math.cos(a + 0.06) * R0 * 0.64, Math.sin(a + 0.06) * R0 * 0.64); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(20,12,16,0.7)'; g.lineWidth = 1; g.stroke();
  }
  // cruz central
  g.fillStyle = '#e8b04a'; g.strokeStyle = 'rgba(20,12,16,0.8)'; g.lineWidth = 1.5;
  g.beginPath(); g.rect(-6, -40, 12, 80); g.rect(-30, -12, 60, 12); g.fill(); g.stroke();
  g.restore();
}

// contorno escuro em volta da silhueta (o "traço de tinta" das ilustrações)
export function inkOutline(src, px = 2, color = 'rgba(16,8,20,0.95)') {
  const c = cv(src.width + px * 2, src.height + px * 2), g = c.getContext('2d');
  const sil = cv(src.width, src.height), s = sil.getContext('2d');
  s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = color; s.fillRect(0, 0, sil.width, sil.height);
  for (let a = 0; a < 16; a++) { const t = (a / 16) * Math.PI * 2; g.drawImage(sil, px + Math.cos(t) * px, px + Math.sin(t) * px); }
  g.drawImage(src, px, px);
  return c;
}
function outlined(o, px = 2) {
  const img = inkOutline(o.img, px * RES);
  return { ...o, img, ax: o.ax + px, ay: o.ay + px, w: o.w + px * 2, h: o.h + px * 2 };
}

function brazier() {
  return obj(40, 60, 20, 56, (g) => {
    g.fillStyle = '#2e2630'; g.beginPath(); g.moveTo(10, 56); g.lineTo(30, 56); g.lineTo(25, 30); g.lineTo(15, 30); g.closePath(); g.fill();
    const gr = g.createLinearGradient(4, 0, 36, 0); gr.addColorStop(0, '#d9a050'); gr.addColorStop(0.5, '#a06a28'); gr.addColorStop(1, '#5a3a18');
    g.fillStyle = gr; g.beginPath(); g.moveTo(3, 20); g.lineTo(37, 20); g.lineTo(31, 32); g.lineTo(9, 32); g.closePath(); g.fill();
    g.fillStyle = '#3a1a0a'; g.beginPath(); g.ellipse(20, 20, 17, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff9a3a'; g.beginPath(); g.ellipse(20, 20, 13, 3.5, 0, 0, Math.PI * 2); g.fill();
  });
}
function rubble(seed) {
  const r = rng(seed);
  return obj(70, 50, 35, 42, (g) => {
    for (let k = 0; k < 6; k++) {
      const x = 12 + r() * 46, y = 22 + r() * 18, w = 10 + r() * 12, h = 7 + r() * 8;
      shadeFace(g, [[x - w, y], [x, y - h * 0.6], [x + w, y], [x, y + h * 0.4]], '#8a7c78');
      shadeFace(g, [[x - w, y], [x, y + h * 0.4], [x, y + h], [x - w, y + h * 0.6]], '#5e524f');
      shadeFace(g, [[x, y + h * 0.4], [x + w, y], [x + w, y + h * 0.6], [x, y + h]], '#423836');
    }
    // pedaço de coluna caída
    const gr = g.createLinearGradient(0, 8, 0, 26); gr.addColorStop(0, '#b0a4a0'); gr.addColorStop(1, '#5a4e4c');
    g.fillStyle = gr; g.save(); g.translate(35, 18); g.rotate(-0.35); g.fillRect(-24, -7, 48, 14); g.restore();
  });
}

export function buildArt() {
  const art = {
    hd: true,
    walls: [0, 1, 2, 3].map((s) => wallBlock(s)),
    wallsWood: [0, 1].map((s) => wallBlock(s + 9)),
    props: {
      pilar: pillar(), tocha: Object.assign(torch(), { flame: { x: 12, y: 13 } }), barril: barrel(3), caixa: crate(),
      arvore: tree(5), arvore2: tree(9, 'pinheiro'), boneco: dummy(), estandarte: banner(),
      pedra: rock(4), pedra2: rock(8, 1.4), moita: bush(2), braseiro: Object.assign(brazier(), { flame: { x: 20, y: 18 } }), entulho: rubble(6),
    },
    slimes: { verde: slimeFrames(0x5ab84a, 1), roxa: slimeFrames(0x9a4ad0, 1.5) },
  };
  // traço de tinta em tudo que fica de pé
  for (const k in art.props) if (k !== 'tocha' && k !== 'braseiro') art.props[k] = outlined(art.props[k], 1.6);
  for (const k of ['braseiro', 'tocha']) { const f = art.props[k].flame; art.props[k] = outlined(art.props[k], 1.6); art.props[k].flame = { x: f.x + 1.6, y: f.y + 1.6 }; }
  for (const k in art.slimes) {
    const sl = art.slimes[k];
    sl.frames = sl.frames.map((f) => inkOutline(f, 1.5 * RES)); sl.ax += 1.5; sl.ay += 1.5; sl.w += 3; sl.h += 3;
  }
  art.castle = buildCastleArt();
  art.themes = { castelo: { ...art.castle, wallH: 30, ambient: 'rgba(30,10,50,0.32)' }, ...buildThemes() };
  return art;
}
