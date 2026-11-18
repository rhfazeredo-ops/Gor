// =====================================================================
// Tema "castelo" (estilo ilustrado/quadrinho da referência), Canvas 2D:
// lajes grandes de pedra roxa com rachaduras e bisel, frisos dourados,
// leão gravado no piso, pétalas vermelhas, muros com balaústres, colunas
// com capitel dourado, braseiros com chama desenhada e animada, estátua
// de leão, rochas azul-escuras facetadas em primeiro plano e caverna
// vermelha incandescente no fundo. Contorno preto marcante em tudo.
// =====================================================================
import { TW, TH, WALL_H, RES } from './art-hd.js';

export const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
export const INK = '#120a18';
const P = {
  slab: ['#6c5a7c', '#64526f', '#715f82', '#5e4d6a'], slabHi: '#8e7aa0', slabLo: '#3e3050',
  stone: '#7a6a8a', stoneHi: '#a493b4', stoneLo: '#463a56', stoneDk: '#2c2238',
  gold: '#e8a23a', goldHi: '#ffd27a', goldLo: '#a0601c',
  navy: '#1c1d40', navyHi: '#2f3268', navyLo: '#0e0e22',
  red: '#c41e32', redHi: '#ff4a4a', redLo: '#5a0a18',
};
export function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
export const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
export function fillInk(g, pts, fill, w = 1.6) { poly(g, pts); g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.stroke(); }
export function obj(w, h, ax, ay, draw) {
  const c = cv(w * RES, h * RES), g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round'; g.lineCap = 'round';
  draw(g); return { img: c, ax, ay, w, h };
}

// ---------------- chão ----------------
export function paintCastleGround(map, theme = null) {
  if (theme) return theme(map);
  const ox = map.h * (TW / 2);
  const W = (map.w + map.h) * (TW / 2), H = (map.w + map.h) * (TH / 2) + TH + 140;
  const c = cv(W * RES, H * RES), g = c.getContext('2d'); g.scale(RES, RES);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const r = rng(map.w * 97 + map.h * 13);
  const at = (i, j) => (i < 0 || j < 0 || i >= map.w || j >= map.h ? null : map.floor[j * map.w + i]);
  const scr = (i, j) => [(i - j) * (TW / 2) + ox, (i + j) * (TH / 2)];
  const D = (i, j, inset = 0) => { const [x, y] = scr(i, j); return [[x, y + inset], [x + TW / 2 - inset * 2, y + TH / 2], [x, y + TH - inset], [x - TW / 2 + inset * 2, y + TH / 2]]; };

  // 1) penhascos (face de rocha onde o chão termina)
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const [x, y] = scr(i, j);
    const L = [x - TW / 2, y + TH / 2], B = [x, y + TH], R = [x + TW / 2, y + TH / 2];
    const depth = 46 + r() * 30;
    if (!at(i, j + 1)) {
      fillInk(g, [L, B, [B[0], B[1] + depth], [L[0], L[1] + depth * 0.9]], P.stoneLo);
      g.strokeStyle = 'rgba(18,10,24,0.6)'; g.lineWidth = 1;
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(L[0], L[1] + k * 15); g.lineTo(B[0], B[1] + k * 15 + (r() - 0.5) * 4); g.stroke(); }
    }
    if (!at(i + 1, j)) {
      fillInk(g, [B, R, [R[0], R[1] + depth * 0.9], [B[0], B[1] + depth]], P.stoneDk);
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
      for (let k = 1; k < 3; k++) { g.beginPath(); g.moveTo(B[0], B[1] + k * 15); g.lineTo(R[0], R[1] + k * 15 + (r() - 0.5) * 4); g.stroke(); }
    }
  }
  // 2) lajes grandes: cada uma ocupa 2x2 tiles quando possível (piso de palácio)
  const used = new Set();
  const slabs = [];
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j) || used.has(i + ',' + j)) continue;
    const big = at(i + 1, j) && at(i, j + 1) && at(i + 1, j + 1) && !used.has(i + 1 + ',' + j) && !used.has(i + ',' + (j + 1)) && (i + j) % 2 === 0 && r() < 0.75;
    const s = big ? 2 : 1;
    for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) used.add(i + a + ',' + (j + b));
    slabs.push([i, j, s]);
  }
  for (const [i, j, s] of slabs) {
    const [x0, y0] = scr(i, j), [x1, y1] = scr(i + s, j), [x2, y2] = scr(i + s, j + s), [x3, y3] = scr(i, j + s);
    const top = [x0, y0], right = [x1, y1], bot = [x2, y2], left = [x3, y3];
    const col = P.slab[(i * 7 + j * 3 + s) % 4];
    const ins = 1.6;
    const q = [[top[0], top[1] + ins], [right[0] - ins * 2, right[1]], [bot[0], bot[1] - ins], [left[0] + ins * 2, left[1]]];
    poly(g, q); g.fillStyle = col; g.fill();
    // bisel: luz em cima-esquerda, sombra embaixo-direita
    g.lineWidth = 2; g.strokeStyle = P.slabHi; g.beginPath(); g.moveTo(...q[3]); g.lineTo(...q[0]); g.lineTo(...q[1]); g.stroke();
    g.strokeStyle = P.slabLo; g.beginPath(); g.moveTo(...q[1]); g.lineTo(...q[2]); g.lineTo(...q[3]); g.stroke();
    // manchas de desgaste (tons chapados)
    if (r() < 0.6) {
      const cx = (top[0] + bot[0]) / 2 + (r() - 0.5) * 18 * s, cy = (top[1] + bot[1]) / 2 + (r() - 0.5) * 8 * s;
      g.fillStyle = 'rgba(30,18,44,0.18)'; g.beginPath(); g.ellipse(cx, cy, 10 * s + r() * 8, 4 * s + r() * 3, 0, 0, Math.PI * 2); g.fill();
    }
    // rachaduras com ramificação
    const nc = s === 2 ? (r() < 0.7 ? 1 : 2) : (r() < 0.35 ? 1 : 0);
    for (let k = 0; k < nc; k++) {
      let px = (top[0] + bot[0]) / 2 + (r() - 0.5) * 30 * s, py = (top[1] + bot[1]) / 2 + (r() - 0.5) * 12 * s;
      let ang = r() * Math.PI * 2;
      g.strokeStyle = INK; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, py);
      for (let n = 0; n < 5; n++) {
        ang += (r() - 0.5) * 1.2; px += Math.cos(ang) * (5 + r() * 6); py += Math.sin(ang) * (2.5 + r() * 3);
        g.lineTo(px, py);
        if (r() < 0.3) { g.moveTo(px, py); g.lineTo(px + Math.cos(ang + 1) * 6, py + Math.sin(ang + 1) * 3); g.moveTo(px, py); }
      }
      g.stroke();
    }
    // juntas pretas
    poly(g, [top, right, bot, left]); g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
  }
  // 3) friso dourado em volta do salão (borda do piso que encosta no muro)
  g.lineWidth = 3;
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const ch = (map.tiles[j - 1] || '')[i], cw = (map.tiles[j] || '')[i - 1];
    const [x, y] = scr(i, j);
    if (ch === '#' || ch === 'X') { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + TW / 2 - 6, y + TH / 2 + 1); g.stroke(); g.strokeStyle = P.gold; g.lineWidth = 2.5; g.stroke(); }
    if (cw === '#' || cw === 'X') { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x - TW / 2 + 6, y + TH / 2 + 1); g.stroke(); g.strokeStyle = P.gold; g.lineWidth = 2.5; g.stroke(); }
  }
  // 4) leão gravado no piso dentro de um losango com borda dourada
  const [cx, cy] = scr(map.start.x, map.start.y);
  const RX = 120, RY = 60;
  g.save();
  const rh = [[cx, cy - RY], [cx + RX, cy], [cx, cy + RY], [cx - RX, cy]];
  fillInk(g, rh, '#3e3466', 3);
  poly(g, rh.map(([x, y]) => [cx + (x - cx) * 0.88, cy + (y - cy) * 0.88])); g.strokeStyle = P.gold; g.lineWidth = 3; g.stroke();
  poly(g, rh.map(([x, y]) => [cx + (x - cx) * 0.8, cy + (y - cy) * 0.8])); g.strokeStyle = 'rgba(232,162,58,0.5)'; g.lineWidth = 1.2; g.stroke();
  g.translate(cx, cy); g.scale(1, 0.5);
  drawLionHead(g, 0, 0, 58, 'rgba(232,162,58,0.85)', 'rgba(150,90,30,0.9)');
  g.restore();
  // 5) pétalas vermelhas espalhadas (em grupos, como na referência)
  for (let n = 0; n < (map.w * map.h) / 10; n++) {
    let ti, tj, tries = 0;
    do { ti = (r() * map.w) | 0; tj = (r() * map.h) | 0; tries++; } while (!at(ti, tj) && tries < 20);
    if (!at(ti, tj)) continue;
    const [x, y] = scr(ti + r(), tj + r());
    for (let k = 0; k < 4 + r() * 7; k++) {
      const px = x + (r() - 0.5) * 26, py = y + (r() - 0.5) * 12;
      if (!at(Math.floor((px - ox) / TW + py / TH), Math.floor(py / TH - (px - ox) / TW))) continue;
      g.fillStyle = r() < 0.5 ? P.red : '#9a1426';
      g.beginPath(); g.ellipse(px, py, 2 + r() * 2.5, 1 + r(), r() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  return { canvas: c, ox, W, H };
}

// cabeça de leão estilizada (juba em pontas + rosto)
export function drawLionHead(g, x, y, R, fill, line) {
  g.save(); g.translate(x, y);
  g.fillStyle = fill; g.strokeStyle = line; g.lineWidth = 2.5;
  g.beginPath();
  for (let k = 0; k < 18; k++) {
    const a0 = (k / 18) * Math.PI * 2, a1 = ((k + 0.5) / 18) * Math.PI * 2;
    const ro = R * (0.95 + (k % 2) * 0.1);
    g.lineTo(Math.cos(a0) * R * 0.62, Math.sin(a0) * R * 0.62);
    g.lineTo(Math.cos(a1 + 0.1) * ro, Math.sin(a1 + 0.1) * ro);
  }
  g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(0, R * 0.05, R * 0.48, R * 0.56, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.stroke();
  g.fillStyle = line;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * R * 0.2, -R * 0.08, R * 0.1, R * 0.05, s * 0.4, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.moveTo(-R * 0.13, R * 0.18); g.lineTo(R * 0.13, R * 0.18); g.lineTo(0, R * 0.32); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-R * 0.18, R * 0.42); g.quadraticCurveTo(0, R * 0.52, R * 0.18, R * 0.42); g.stroke();
  g.restore();
}

// ---------------- muro com balaústre (bloco do tamanho de um tile) ----------------
function castleWall(seed, kind = 'balaustre') {
  const r = rng(seed * 13 + 5);
  const w = TW, h = TH + WALL_H + 30;
  const c = cv(w * RES, h * RES), g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round';
  const base = 30;   // altura extra (o bloco é mais alto que o muro comum)
  const T0 = base;   // y do topo do losango
  // faces do muro baixo
  const top = [[w / 2, T0], [w, T0 + TH / 2], [w / 2, T0 + TH], [0, T0 + TH / 2]];
  const Lf = [[0, T0 + TH / 2], [w / 2, T0 + TH], [w / 2, T0 + TH + WALL_H], [0, T0 + TH / 2 + WALL_H]];
  const Rf = [[w / 2, T0 + TH], [w, T0 + TH / 2], [w, T0 + TH / 2 + WALL_H], [w / 2, T0 + TH + WALL_H]];
  fillInk(g, Lf, P.stone); fillInk(g, Rf, P.stoneLo);
  // blocos de pedra
  g.strokeStyle = 'rgba(18,10,24,0.7)'; g.lineWidth = 1.1;
  for (const [f, sgn] of [[Lf, 1], [Rf, -1]]) {
    g.save(); poly(g, f); g.clip();
    for (let row = 0; row < 3; row++) {
      const yy = T0 + TH / 2 + 4 + row * 13;
      g.beginPath(); g.moveTo(0, yy + (sgn > 0 ? 0 : TH / 2)); g.lineTo(w, yy + (sgn > 0 ? TH / 2 : 0)); g.stroke();
      for (let k = 0; k < 2; k++) { const x = (sgn > 0 ? 6 : w / 2 + 6) + ((row + k) % 2) * 12 + k * 14 + r() * 4; const y = yy + (sgn > 0 ? x / 2 : (w - x) / 2) - (sgn > 0 ? 0 : 0); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 13); g.stroke(); }
    }
    g.restore();
  }
  fillInk(g, top, P.stoneHi);
  // friso dourado
  g.strokeStyle = P.gold; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, T0 + TH / 2 + 4); g.lineTo(w / 2, T0 + TH + 4); g.lineTo(w, T0 + TH / 2 + 4); g.stroke();
  if (kind === 'balaustre') {
    // balaústres em cima do muro (fileira na diagonal de trás)
    const rail = (t) => [w / 2 + (t - 0.5) * w * 0.82, T0 + TH / 2 + (Math.abs(t - 0.5)) * 0 - (0.5 - Math.abs(t - 0.5)) * 0];
    void rail;
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      const x = t * w, y = T0 + TH / 2 + (x < w / 2 ? x / 2 : (w - x) / 2) * 0 + 2;
      fillInk(g, [[x - 2.5, y - 2], [x + 2.5, y - 2], [x + 3.5, y - 10], [x + 2, y - 16], [x + 3, y - 22], [x - 3, y - 22], [x - 2, y - 16], [x - 3.5, y - 10]], P.stone, 1.2);
    }
    // corrimão
    fillInk(g, [[0, T0 + TH / 2 - 24], [w / 2, T0 - 8 + 0], [w, T0 + TH / 2 - 24], [w, T0 + TH / 2 - 19], [w / 2, T0 - 3], [0, T0 + TH / 2 - 19]], P.stoneHi, 1.4);
  }
  return c;
}

// ---------------- props ----------------
export function castlePillar(pal = P) {
  const P = pal;
  return obj(56, 170, 28, 162, (g) => {
    // base escalonada
    fillInk(g, [[6, 150], [28, 140], [50, 150], [50, 160], [28, 170], [6, 160]], P.stoneLo);
    fillInk(g, [[6, 150], [28, 140], [50, 150], [28, 160]], P.stoneHi);
    // fuste com caneluras e luz chapada
    fillInk(g, [[12, 148], [12, 30], [44, 30], [44, 148]], P.stone);
    g.fillStyle = P.stoneHi; g.fillRect(14, 31, 8, 116);
    g.fillStyle = P.stoneLo; g.fillRect(34, 31, 9, 116);
    g.strokeStyle = 'rgba(18,10,24,0.6)'; g.lineWidth = 1;
    for (const x of [22, 28, 34]) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x, 146); g.stroke(); }
    // faixas douradas e capitel
    for (const y of [40, 136]) fillInk(g, [[11, y], [45, y], [45, y + 5], [11, y + 5]], P.gold, 1.2);
    fillInk(g, [[4, 22], [28, 12], [52, 22], [52, 30], [28, 40], [4, 30]], P.stoneLo);
    fillInk(g, [[4, 22], [28, 12], [52, 22], [28, 32]], P.stoneHi);
    fillInk(g, [[8, 30], [48, 30], [44, 36], [12, 36]], P.gold, 1.2);
    // cruz dourada em relevo
    g.fillStyle = P.gold; g.strokeStyle = INK; g.lineWidth = 1;
    g.beginPath(); g.rect(26, 62, 5, 26); g.rect(21, 70, 15, 5); g.fill(); g.stroke();
  });
}
export function brazier() {
  return obj(60, 74, 30, 70, (g) => {
    fillInk(g, [[18, 70], [42, 70], [38, 40], [22, 40]], P.stoneLo);
    g.fillStyle = P.stone; g.fillRect(23, 42, 6, 26);
    fillInk(g, [[12, 36], [48, 36], [44, 44], [16, 44]], P.stoneDk);
    // tigela octogonal
    fillInk(g, [[4, 22], [56, 22], [50, 36], [10, 36]], P.stone);
    g.fillStyle = P.stoneHi; g.beginPath(); g.moveTo(6, 23); g.lineTo(24, 23); g.lineTo(20, 35); g.lineTo(11, 35); g.fill();
    fillInk(g, [[4, 22], [30, 14], [56, 22], [30, 30]], '#3a1608');
    g.fillStyle = '#ff8a2a'; g.beginPath(); g.ellipse(30, 22, 20, 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd060'; g.beginPath(); g.ellipse(30, 22, 11, 3.5, 0, 0, Math.PI * 2); g.fill();
    fillInk(g, [[4, 26], [56, 26], [55, 29], [5, 29]], P.gold, 1);
  });
}
export function lionStatue() {
  return obj(90, 150, 45, 142, (g) => {
    // pedestal
    fillInk(g, [[10, 110], [45, 96], [80, 110], [80, 132], [45, 146], [10, 132]], P.stoneLo);
    fillInk(g, [[10, 110], [45, 96], [80, 110], [45, 124]], P.stoneHi);
    fillInk(g, [[10, 112], [45, 126], [45, 146], [10, 132]], P.stone);
    fillInk(g, [[13, 118], [42, 130], [42, 133], [13, 121]], P.gold, 1);
    // leão sentado (silhueta em blocos, pedra dourada envelhecida)
    const L = '#9a7a52', Lh = '#c8a46c', Ld = '#5e4630';
    fillInk(g, [[26, 108], [30, 70], [46, 58], [64, 66], [66, 108]], L);              // corpo
    fillInk(g, [[30, 108], [32, 84], [40, 84], [40, 108]], Lh);                       // pata da frente
    fillInk(g, [[50, 108], [52, 86], [60, 86], [62, 108]], Ld);
    // juba
    g.save(); g.translate(44, 46);
    g.fillStyle = Lh; g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath();
    for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2, a1 = ((k + 0.5) / 14) * Math.PI * 2; g.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); g.lineTo(Math.cos(a1) * 24, Math.sin(a1) * 22); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = L; g.beginPath(); g.ellipse(2, 2, 11, 13, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = Ld; g.beginPath(); g.ellipse(9, 8, 6, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke();      // focinho
    g.fillStyle = INK; g.beginPath(); g.ellipse(5, -2, 2.2, 1.2, 0.3, 0, Math.PI * 2); g.fill();
    g.restore();
  });
}
export function banner() {
  return obj(40, 110, 20, 106, (g) => {
    g.fillStyle = INK; g.fillRect(4, 2, 32, 4);
    fillInk(g, [[6, 6], [34, 6], [34, 80], [27, 74], [20, 86], [13, 74], [6, 80]], '#2a3a9a', 1.6);
    g.fillStyle = '#3e52c4'; g.beginPath(); g.moveTo(7, 7); g.lineTo(14, 7); g.lineTo(14, 74); g.lineTo(7, 79); g.fill();
    fillInk(g, [[6, 6], [34, 6], [34, 11], [6, 11]], P.gold, 1);
    g.fillStyle = P.gold; g.strokeStyle = INK; g.lineWidth = 1;
    g.beginPath(); g.rect(18, 18, 4, 44); g.rect(11, 30, 18, 4); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(20, 13); g.lineTo(24, 19); g.lineTo(16, 19); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(19, 86, 2, 20);
  });
}

// rocha azul-escura facetada (primeiro plano)
export function navyRock(seed, s = 1, pal = null) {
  const r = rng(seed * 7 + 3);
  const W = 120 * s, H = 110 * s;
  return obj(W, H, W / 2, H - 6, (g) => {
    const n = 6 + ((r() * 3) | 0), cx = W / 2, cy = H * 0.62;
    const ring = [], top = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.3;
      ring.push([cx + Math.cos(a) * W * (0.36 + r() * 0.1), cy + Math.sin(a) * H * (0.2 + r() * 0.06) + H * 0.18]);
      top.push([cx + Math.cos(a + 0.25) * W * (0.22 + r() * 0.08), cy - H * (0.32 + r() * 0.16) + Math.sin(a) * H * 0.08]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = (i + 0.5) / n * Math.PI * 2;
      const lit = Math.cos(a + 2.4);
      fillInk(g, [ring[i], ring[j], top[j], top[i]], lit > 0.3 ? (pal || P).navyHi : lit > -0.3 ? (pal || P).navy : (pal || P).navyLo, 2);
    }
    fillInk(g, top, (pal || P).navyHi, 2);
    g.strokeStyle = 'rgba(120,130,220,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(...top[0]); for (const p of top.slice(1, 4)) g.lineTo(...p); g.stroke();
  });
}

export function buildCastleArt() {
  return {
    walls: [0, 1, 2].map((s) => castleWall(s)),
    props: { pilar: castlePillar(), braseiro: Object.assign(brazier(), { flame: { x: 30, y: 20 } }), leao: lionStatue(), estandarte: banner() },
    rocks: [0, 1, 2, 3, 4].map((s) => navyRock(s, 0.9 + (s % 3) * 0.25)),
  };
}

// ---------------- chama desenhada (animada) ----------------
export function drawFlame(ctx, x, y, size, t, seed = 0) {
  const layers = [['#e2361a', 1.0], ['#ff8a1e', 0.78], ['#ffd25a', 0.52], ['#fff4c0', 0.28]];
  ctx.save();
  for (const [col, k] of layers) {
    const h = size * 2.2 * k * (0.9 + Math.sin(t * 9 + seed) * 0.08), w = size * k;
    ctx.beginPath(); ctx.moveTo(x - w, y);
    // lado esquerdo com línguas de fogo
    for (let i = 1; i <= 4; i++) {
      const f = i / 4, wob = Math.sin(t * 12 + seed + i * 1.7) * w * 0.25;
      ctx.quadraticCurveTo(x - w * (1 - f) - w * 0.35 + wob, y - h * (f - 0.12), x - w * (1 - f) * 0.9 + wob * 0.5, y - h * f);
    }
    ctx.quadraticCurveTo(x + Math.sin(t * 7 + seed) * w * 0.4, y - h * 1.15, x + w * 0.2, y - h * 0.82);
    for (let i = 3; i >= 0; i--) {
      const f = i / 4, wob = Math.sin(t * 11 + seed + i * 2.3) * w * 0.25;
      ctx.quadraticCurveTo(x + w * (1 - f) + w * 0.35 + wob, y - h * (f + 0.1), x + w * (1 - f) * (i === 0 ? 1 : 0.9) + wob * 0.5, y - h * f);
    }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  // faíscas
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.9 + k * 0.27 + seed) % 1;
    ctx.fillStyle = `rgba(255,${200 - p * 120 | 0},80,${1 - p})`;
    ctx.fillRect(x + Math.sin(k * 3 + t * 2 + seed) * size * 0.8, y - size * 2 - p * size * 3, 2, 2);
  }
  ctx.restore();
}

// ---------------- fundo: caverna vermelha incandescente ----------------
let bgCache = null;
export function drawCavern(ctx, VW, VH, camX, camY, time) {
  if (!bgCache || bgCache.w !== Math.ceil(VW) || bgCache.h !== Math.ceil(VH)) {
    const W = Math.ceil(VW * 1.6), H = Math.ceil(VH * 1.6);
    const c = cv(W, H), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a0614'); gr.addColorStop(0.5, '#5a0a1c'); gr.addColorStop(1, '#14040c');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = rng(42);
    // fendas incandescentes
    for (let k = 0; k < 26; k++) {
      const x = r() * W, y = r() * H, s = 30 + r() * 90;
      g.fillStyle = r() < 0.5 ? P.red : '#e8303e';
      g.beginPath(); g.moveTo(x, y); for (let n = 0; n < 6; n++) g.lineTo(x + (r() - 0.3) * s, y + (r() - 0.5) * s * 0.6); g.closePath(); g.fill();
    }
    // rochedos escuros por cima (formas quebradas)
    for (let k = 0; k < 40; k++) {
      const x = r() * W, y = r() * H, s = 40 + r() * 120;
      g.fillStyle = r() < 0.5 ? '#1a0a1e' : '#24102a'; g.strokeStyle = '#05020a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); for (let n = 0; n < 5; n++) g.lineTo(x + (r() - 0.5) * s, y + (r() - 0.5) * s * 0.7); g.closePath(); g.fill(); g.stroke();
    }
    bgCache = { c, w: Math.ceil(VW), h: Math.ceil(VH) };
  }
  const c = bgCache.c;
  const px = ((-camX * 0.25) % c.width + c.width) % c.width, py = ((-camY * 0.25) % c.height + c.height) % c.height;
  for (const dx of [-c.width, 0]) for (const dy of [-c.height, 0]) ctx.drawImage(c, px + dx, py + dy);
  const pulse = 0.18 + 0.06 * Math.sin(time * 1.3);
  ctx.fillStyle = `rgba(255,40,60,${pulse})`; ctx.globalCompositeOperation = 'soft-light'; ctx.fillRect(0, 0, VW, VH); ctx.globalCompositeOperation = 'source-over';
}

// posições das rochas de primeiro plano: abismo logo abaixo/direita do chão
export function foregroundRocks(map) {
  if (map.tema === 'deserto') return [];
  const r = rng(map.w * 3 + 7), out = [];
  const at = (i, j) => (i < 0 || j < 0 || i >= map.w || j >= map.h ? null : map.floor[j * map.w + i]);
  for (let j = 0; j < map.h + 3; j++) for (let i = 0; i < map.w + 3; i++) {
    if (at(i, j)) continue;
    // só na beira da frente (abaixo na tela), a pelo menos 1 tile do chão
    if (at(i - 1, j) || at(i, j - 1) || at(i - 1, j - 1)) continue;
    const near = at(i - 2, j) || at(i, j - 2) || at(i - 2, j - 1) || at(i - 1, j - 2) || at(i - 2, j - 2);
    if (!near || r() < 0.25) continue;
    out.push({ x: i + 0.3 + r() * 0.6, y: j + 0.3 + r() * 0.6, k: (r() * 5) | 0 });
  }
  return out;
}
