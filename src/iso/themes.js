// =====================================================================
// Temas "jardim em ruínas" e "desfiladeiro do deserto", no mesmo estilo
// ilustrado do castelo (contorno preto, cores chapadas, luz pintada).
// Tudo em Canvas 2D. Cada tema fornece: chão, bloco de muro, objetos,
// fundo e rochas de primeiro plano.
// =====================================================================
import { TW, TH, WALL_H, RES } from './art-hd.js';
import { rng, INK, cv, poly, fillInk, obj, drawLionHead, navyRock, castlePillar, brazier, lionStatue, banner } from './castle.js';

const G = { // jardim
  slab: ['#7a6e7e', '#72667a', '#807488', '#6c6072'], slabHi: '#a294a8', slabLo: '#463c50',
  stone: '#8a7c86', stoneHi: '#b2a4ae', stoneLo: '#524652', stoneDk: '#30283a',
  gold: '#e8a23a', moss: '#5a7a2a', mossHi: '#8aac3c', mossLo: '#34501c',
  navy: '#22203a', navyHi: '#3a3658', navyLo: '#12101e',
  leaf: '#c8203a', leafHi: '#ff4a5a', leafLo: '#6a0a1c', water: '#1fb0b8', waterHi: '#7af0ee', waterLo: '#0a5a6a',
};
const D = { // deserto
  sand: '#d8843a', sandHi: '#f0a854', sandLo: '#a85a24', path: '#e89a4a',
  rock: '#c47448', rockHi: '#e8a070', rockLo: '#7a4028', rockDk: '#4a2214',
  stone: '#d8b07a', stoneHi: '#f0d4a0', stoneLo: '#8a643c', stoneDk: '#5a3e22',
  gold: '#e8a23a', water: '#1fa8b0', waterHi: '#7ae8e6', waterLo: '#0a5a6a',
  navy: '#7a3a20', navyHi: '#a8582e', navyLo: '#4a2010',
};

function base(map, extraH = 140) {
  const ox = map.h * (TW / 2);
  const W = (map.w + map.h) * (TW / 2), H = (map.w + map.h) * (TH / 2) + TH + extraH;
  const c = cv(W * RES, H * RES), g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round'; g.lineCap = 'round';
  const at = (i, j) => (i < 0 || j < 0 || i >= map.w || j >= map.h ? null : map.floor[j * map.w + i]);
  const scr = (i, j) => [(i - j) * (TW / 2) + ox, (i + j) * (TH / 2)];
  const inFloor = (px, py) => at(Math.floor((px - ox) / TW + py / TH), Math.floor(py / TH - (px - ox) / TW));
  return { c, g, ox, W, H, at, scr, inFloor };
}
function cliffs(B, map, r, faceL, faceR, depthBase = 46) {
  const { g, at, scr } = B;
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const [x, y] = scr(i, j);
    const L = [x - TW / 2, y + TH / 2], Bt = [x, y + TH], R = [x + TW / 2, y + TH / 2], d = depthBase + r() * 30;
    if (!at(i, j + 1)) { fillInk(g, [L, Bt, [Bt[0], Bt[1] + d], [L[0], L[1] + d * 0.9]], faceL); }
    if (!at(i + 1, j)) { fillInk(g, [Bt, R, [R[0], R[1] + d * 0.9], [Bt[0], Bt[1] + d]], faceR); }
  }
}
function crack(g, r, px, py, n = 5) {
  let a = r() * Math.PI * 2; g.strokeStyle = INK; g.lineWidth = 1.1; g.beginPath(); g.moveTo(px, py);
  for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.2; px += Math.cos(a) * (5 + r() * 6); py += Math.sin(a) * (2.5 + r() * 3); g.lineTo(px, py); }
  g.stroke();
}
function blob(g, x, y, rx, ry, fill, r, n = 9, ink = false) {
  g.beginPath();
  for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2, f = 0.75 + r() * 0.4; const px = x + Math.cos(a) * rx * f, py = y + Math.sin(a) * ry * f; k ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.closePath(); g.fillStyle = fill; g.fill(); if (ink) { g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke(); }
}

// ======================= JARDIM EM RUÍNAS =======================
export function paintGardenGround(map) {
  const B = base(map), { g, at, scr, inFloor } = B, r = rng(map.w * 41 + 3);
  cliffs(B, map, r, G.stoneLo, G.stoneDk);
  // base: terra/grama escura por baixo de tudo
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const [x, y] = scr(i, j); poly(g, [[x, y - 0.5], [x + TW / 2 + 1, y + TH / 2], [x, y + TH + 0.5], [x - TW / 2 - 1, y + TH / 2]]); g.fillStyle = '#3a4a24'; g.fill();
  }
  // caminho de lajes (onde a letra é ';' e perto do centro); musgo nas bordas
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const ch = map.tiles[j][i];
    const [x, y] = scr(i, j);
    if (ch === ',') { // grama alta
      blob(g, x, y + TH / 2, TW * 0.38, TH * 0.4, G.moss, r);
      for (let k = 0; k < 6; k++) { const px = x + (r() - 0.5) * 40, py = y + TH / 2 + (r() - 0.5) * 16; g.strokeStyle = r() < 0.5 ? G.mossHi : G.mossLo; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + (r() - 0.5) * 4, py - 5 - r() * 5); g.stroke(); }
      continue;
    }
    // laje pequena (quatro por tile, algumas faltando → grama aparece)
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      if (r() < 0.08) continue;
      const cx = x + (a - b) * (TW / 4), cy = y + TH / 4 + (a + b) * (TH / 4);
      const w = TW / 4 - 1.5, h = TH / 4 - 1;
      const col = G.slab[((i + a) * 3 + (j + b) * 5) % 4];
      const q = [[cx, cy - h + 1], [cx + w * 2 - 2, cy], [cx, cy + h - 1], [cx - w * 2 + 2, cy]];
      poly(g, q); g.fillStyle = col; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = G.slabHi; g.lineWidth = 1.2; g.beginPath(); g.moveTo(...q[3]); g.lineTo(...q[0]); g.lineTo(...q[1]); g.stroke();
      if (r() < 0.12) crack(g, r, cx, cy, 3);
    }
    // musgo invadindo
    if (r() < 0.45) blob(g, x + (r() - 0.5) * 24, y + TH / 2 + (r() - 0.5) * 10, 8 + r() * 10, 4 + r() * 4, 'rgba(90,122,42,0.85)', r);
  }
  // laje com leão gravado (2x2 no ponto inicial)
  const [cx, cy] = scr(map.start.x, map.start.y);
  const RX = 64, RY = 32;
  const rh = [[cx, cy - RY], [cx + RX, cy], [cx, cy + RY], [cx - RX, cy]];
  fillInk(g, rh, '#5e5268', 2.5);
  poly(g, rh.map(([x, y]) => [cx + (x - cx) * 0.82, cy + (y - cy) * 0.82])); g.strokeStyle = '#3a3044'; g.lineWidth = 2; g.stroke();
  g.save(); g.translate(cx, cy); g.scale(1, 0.5); drawLionHead(g, 0, 0, 34, '#7a6a5a', '#3a2e30'); g.restore();
  // lago com borda de pedras
  if (map.lago) {
    const [lx, ly] = scr(map.lago.x, map.lago.y);
    blob(g, lx, ly, 70, 34, G.waterLo, r, 12, true);
    blob(g, lx - 4, ly - 3, 60, 28, G.water, r, 12);
    g.strokeStyle = G.waterHi; g.lineWidth = 2; for (let k = 0; k < 4; k++) { const px = lx + (r() - 0.5) * 70, py = ly + (r() - 0.5) * 30; g.beginPath(); g.ellipse(px, py, 8, 3, 0, 0, Math.PI); g.stroke(); }
    for (let k = 0; k < 3; k++) { g.fillStyle = '#4a8a3a'; g.beginPath(); g.ellipse(lx + (r() - 0.5) * 60, ly + (r() - 0.5) * 24, 7, 3.5, 0, 0.3, Math.PI * 2); g.fill(); g.strokeStyle = INK; g.lineWidth = 1; g.stroke(); }
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; fillInk(g, [[lx + Math.cos(a) * 74 - 6, ly + Math.sin(a) * 37], [lx + Math.cos(a) * 74, ly + Math.sin(a) * 37 - 4], [lx + Math.cos(a) * 74 + 6, ly + Math.sin(a) * 37], [lx + Math.cos(a) * 74, ly + Math.sin(a) * 37 + 4]], G.stone, 1.2); }
  }
  // pétalas/folhas vermelhas caídas
  for (let n = 0; n < (map.w * map.h) / 6; n++) {
    const px = r() * B.W, py = r() * B.H; if (!inFloor(px, py)) continue;
    g.fillStyle = r() < 0.5 ? G.leaf : '#9a1426'; g.beginPath(); g.ellipse(px, py, 2 + r() * 2, 1 + r(), r() * 3, 0, Math.PI * 2); g.fill();
  }
  return { canvas: B.c, ox: B.ox, W: B.W, H: B.H };
}
function gardenWall(seed) {
  const r = rng(seed * 17 + 3), w = TW, h = TH + WALL_H + 30, T0 = 30;
  const c = cv(w * RES, h * RES), g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round';
  const top = [[w / 2, T0], [w, T0 + TH / 2], [w / 2, T0 + TH], [0, T0 + TH / 2]];
  const Lf = [[0, T0 + TH / 2], [w / 2, T0 + TH], [w / 2, T0 + TH + WALL_H], [0, T0 + TH / 2 + WALL_H]];
  const Rf = [[w / 2, T0 + TH], [w, T0 + TH / 2], [w, T0 + TH / 2 + WALL_H], [w / 2, T0 + TH + WALL_H]];
  fillInk(g, Lf, G.stone); fillInk(g, Rf, G.stoneLo);
  g.strokeStyle = 'rgba(18,10,24,0.7)'; g.lineWidth = 1.1;
  for (let row = 0; row < 3; row++) { const yy = T0 + TH / 2 + 4 + row * 13; g.beginPath(); g.moveTo(0, yy); g.lineTo(w / 2, yy + TH / 2); g.lineTo(w, yy); g.stroke(); }
  // topo quebrado
  const broken = top.map(([x, y], k) => [x, y + (k === 0 ? r() * 6 : 0)]);
  fillInk(g, broken, G.stoneHi);
  // musgo e trepadeiras descendo
  for (let k = 0; k < 3; k++) blob(g, 8 + r() * (w - 16), T0 + TH / 2 + r() * 6, 8 + r() * 6, 4 + r() * 3, G.moss, r, 8, true);
  for (let k = 0; k < 4; k++) { let x = 6 + r() * (w - 12), y = T0 + TH / 2 + 4; g.strokeStyle = G.mossLo; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); for (let n = 0; n < 5; n++) { x += (r() - 0.5) * 6; y += 5 + r() * 4; g.lineTo(x, y); } g.stroke(); g.fillStyle = G.mossHi; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  return c;
}
function redTree(seed) {
  const r = rng(seed);
  return obj(150, 190, 75, 182, (g) => {
    fillInk(g, [[66, 182], [70, 120], [60, 90], [72, 96], [80, 70], [86, 100], [96, 92], [84, 124], [88, 182]], '#3a2420', 2);
    const blobs = [];
    for (let k = 0; k < 18; k++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); blobs.push([75 + Math.cos(a) * d * 58, 64 + Math.sin(a) * d * 42, 14 + r() * 12]); }
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s] of blobs) {
      const lit = ((75 - x) * 0.5 + (64 - y)) / 60;
      g.beginPath(); for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; const rr = s * (0.7 + ((k * 37 + x) % 10) / 25); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85); } g.closePath();
      g.fillStyle = lit > 0.3 ? G.leafHi : lit > -0.2 ? G.leaf : G.leafLo; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    }
  });
}
function waterfall() {
  return obj(90, 160, 45, 150, (g) => {
    fillInk(g, [[0, 30], [45, 8], [90, 30], [90, 150], [45, 160], [0, 150]], G.navy, 2);
    fillInk(g, [[0, 30], [45, 8], [90, 30], [45, 52]], G.navyHi, 2);
    fillInk(g, [[28, 40], [62, 40], [66, 150], [24, 150]], G.water, 1.5);
  });
}
function flower(color = '#9a5af0', hi = '#d8b0ff') {
  return obj(40, 46, 20, 42, (g) => {
    g.strokeStyle = '#2a4a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 42); g.quadraticCurveTo(18, 30, 20, 20); g.stroke();
    for (const [x, y, a] of [[12, 34, -0.6], [28, 32, 0.6]]) { g.save(); g.translate(x, y); g.rotate(a); fillInk(g, [[0, 0], [6, -4], [12, 0], [6, 4]], '#4a8a3a', 1.2); g.restore(); }
    for (let k = 0; k < 5; k++) { g.save(); g.translate(20, 18); g.rotate((k / 5) * Math.PI * 2); fillInk(g, [[0, 0], [-4, -6], [0, -13], [4, -6]], color, 1.2); g.restore(); }
    g.fillStyle = hi; g.beginPath(); g.arc(20, 18, 3, 0, 7); g.fill();
  });
}

// ======================= DESFILADEIRO DO DESERTO =======================
export function paintDesertGround(map) {
  const B = base(map, 60), { g, at, scr, inFloor } = B, r = rng(map.w * 59 + 11);
  cliffs(B, map, r, D.rockLo, D.rockDk, 30);
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const [x, y] = scr(i, j); poly(g, [[x, y - 0.5], [x + TW / 2 + 1, y + TH / 2], [x, y + TH + 0.5], [x - TW / 2 - 1, y + TH / 2]]); g.fillStyle = D.sand; g.fill();
  }
  // manchas de luz/sombra chapadas
  for (let n = 0; n < (map.w * map.h) / 3; n++) { const px = r() * B.W, py = r() * B.H; if (!inFloor(px, py)) continue; blob(g, px, py, 14 + r() * 26, 6 + r() * 10, r() < 0.5 ? 'rgba(240,168,84,0.55)' : 'rgba(168,90,36,0.35)', r); }
  // trilha (letra ':') com marcas de rodas/pés
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    const ch = map.tiles[j][i]; if (ch !== ':' && ch !== 'S') continue;
    const [x, y] = scr(i, j); blob(g, x, y + TH / 2, TW * 0.45, TH * 0.45, D.path, r, 10);
    g.strokeStyle = 'rgba(168,90,36,0.55)'; g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const px = x + (r() - 0.5) * 30, py = y + TH / 2 + (r() - 0.5) * 10; g.beginPath(); g.moveTo(px - 10, py - 5); g.lineTo(px + 10, py + 5); g.stroke(); }
  }
  // pedrinhas
  for (let n = 0; n < (map.w * map.h) / 4; n++) { const px = r() * B.W, py = r() * B.H; if (!inFloor(px, py)) continue; const s = 2 + r() * 4; fillInk(g, [[px - s, py], [px - s * 0.3, py - s * 0.7], [px + s, py - s * 0.2], [px + s * 0.5, py + s * 0.5]], r() < 0.5 ? D.stoneHi : D.stone, 1); }
  // lago turquesa: água com degradê, reflexos e borda de pedras arredondadas
  if (map.lago) {
    const [lx, ly] = scr(map.lago.x, map.lago.y);
    blob(g, lx, ly + 2, 70, 34, D.waterLo, r, 14, true);
    const wg = g.createRadialGradient(lx - 10, ly - 6, 4, lx, ly, 64);
    wg.addColorStop(0, '#5ae0e0'); wg.addColorStop(0.6, D.water); wg.addColorStop(1, '#0e6a78');
    blob(g, lx - 2, ly - 1, 60, 28, wg, r, 14);
    g.strokeStyle = 'rgba(200,255,250,0.7)'; g.lineWidth = 1.6;
    for (let k = 0; k < 5; k++) { const px = lx + (r() - 0.5) * 70, py = ly + (r() - 0.5) * 28; g.beginPath(); g.moveTo(px - 8, py); g.quadraticCurveTo(px, py - 3, px + 8, py); g.stroke(); }
    const stones = [];
    for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2 + r() * 0.2; stones.push([lx + Math.cos(a) * (70 + r() * 6), ly + Math.sin(a) * (34 + r() * 4), 7 + r() * 7]); }
    stones.sort((p, q) => p[1] - q[1]);
    for (const [px, py, s0] of stones) {
      g.beginPath(); g.ellipse(px, py, s0, s0 * 0.62, 0, 0, Math.PI * 2); g.fillStyle = D.rock; g.fill();
      g.beginPath(); g.ellipse(px - s0 * 0.15, py - s0 * 0.18, s0 * 0.75, s0 * 0.42, 0, 0, Math.PI * 2); g.fillStyle = D.rockHi; g.fill();
      g.beginPath(); g.ellipse(px, py, s0, s0 * 0.62, 0, 0, Math.PI * 2); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
    }
  }
  // marcas de vento/pegadas na areia (traços curvos)
  g.strokeStyle = 'rgba(150,70,28,0.35)'; g.lineWidth = 1.2;
  for (let n = 0; n < (map.w * map.h) / 2; n++) { const px = r() * B.W, py = r() * B.H; if (!inFloor(px, py)) continue; g.beginPath(); g.moveTo(px - 12, py + 3); g.quadraticCurveTo(px, py - 3, px + 14, py + 2); g.stroke(); }
  // ossos
  for (const b of map.ossos || []) {
    const [bx, by] = scr(b.x, b.y);
    for (let k = 0; k < 4; k++) { g.save(); g.translate(bx + k * 9, by - k * 3); g.rotate(-0.6); fillInk(g, [[0, 0], [3, -12], [6, -14], [4, -10], [2, 0]], '#efe4cc', 1.2); g.restore(); }
  }
  return { canvas: B.c, ox: B.ox, W: B.W, H: B.H };
}
function mesa(seed, tall = 1) {
  // bloco de rocha irregular e facetado: topo poligonal + faces extrudadas para baixo
  const r = rng(seed * 23 + 1), w = TW + 14, H0 = 22 + tall * 26 + r() * 14, h = TH + H0 + 26, T0 = 14;
  const c = cv(w * RES, h * RES), g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round';
  const cx = w / 2 + (r() - 0.5) * 4, cy = T0 + TH / 2, n = 7;
  const top = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r() * 0.35;
    top.push([cx + Math.cos(a) * (w / 2 - 4) * (0.82 + r() * 0.2), cy + Math.sin(a) * (TH / 2 + 2) * (0.82 + r() * 0.22)]);
  }
  // faces laterais (só as que olham para a câmera: borda de baixo do topo)
  const faces = [];
  for (let k = 0; k < n; k++) {
    const p = top[k], q = top[(k + 1) % n];
    const mid = (p[1] + q[1]) / 2;
    if (mid < cy - 2) continue;
    const dh = H0 * (0.9 + r() * 0.15);
    faces.push({ pts: [p, q, [q[0] + (r() - 0.5) * 3, q[1] + dh], [p[0] + (r() - 0.5) * 3, p[1] + dh]], nx: (p[0] + q[0]) / 2 - cx });
  }
  faces.sort((A, B) => Math.abs(B.nx) - Math.abs(A.nx));
  for (const f of faces) {
    fillInk(g, f.pts, f.nx < -6 ? D.rock : f.nx > 6 ? D.rockLo : '#a86038', 1.8);
    g.strokeStyle = 'rgba(60,24,10,0.55)'; g.lineWidth = 1.1;
    const [p, q] = f.pts; for (let k = 1; k < 3; k++) { const t = (k / 3) * H0 * 0.9; g.beginPath(); g.moveTo(p[0], p[1] + t); g.lineTo(q[0], q[1] + t + (r() - 0.5) * 3); g.stroke(); }
  }
  fillInk(g, top, D.rockHi, 2);
  // relevo no topo: uma camada menor e um realce
  const inner = top.map(([x, y]) => [cx + (x - cx) * 0.62 + (r() - 0.5) * 2, cy + (y - cy) * 0.62 - 1]);
  poly(g, inner); g.strokeStyle = 'rgba(122,64,40,0.5)'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = 'rgba(255,224,176,0.35)'; poly(g, [top[(n - 2) % n], top[(n - 1) % n], top[0], [cx, cy]]); g.fill();
  return { img: c, h, H0, w, off: 7 };
}
function deadTree(seed) {
  const r = rng(seed);
  return obj(110, 140, 55, 134, (g) => {
    const br = (x, y, a, len, w, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.strokeStyle = INK; g.lineWidth = w + 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = '#5a3a2a'; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      if (d > 0) for (let k = 0; k < 2; k++) br(x2, y2, a + (r() - 0.5) * 1.4, len * (0.6 + r() * 0.2), w * 0.6, d - 1);
    };
    br(55, 134, -Math.PI / 2 + (r() - 0.5) * 0.3, 44, 7, 3);
  });
}
function stoneRuin(seed) {
  const r = rng(seed);
  return obj(56, 110, 28, 104, (g) => {
    for (let k = 0; k < 4; k++) {
      const y = 96 - k * 22, s = 1 - k * 0.04 - r() * 0.04, w = 22 * s;
      fillInk(g, [[28 - w, y], [28, y - 10], [28 + w, y], [28 + w, y + 8], [28, y + 18], [28 - w, y + 8]], D.stoneLo, 1.6);
      fillInk(g, [[28 - w, y], [28, y - 10], [28 + w, y], [28, y + 10]], D.stoneHi, 1.6);
      fillInk(g, [[28 - w, y], [28, y + 10], [28, y + 18], [28 - w, y + 8]], D.stone, 1.6);
    }
  });
}
function desertFlower() { const f = flower('#e8402a', '#ffd060'); return { ...f, w: f.w * 1.6, h: f.h * 1.6, ax: f.ax * 1.6, ay: f.ay * 1.6 }; }

// ======================= fundos =======================
let cache = {};
export function drawThemeBackground(ctx, tema, VW, VH, camX, camY, time) {
  const key = tema + Math.ceil(VW) + 'x' + Math.ceil(VH);
  if (!cache[key]) {
    const W = Math.ceil(VW * 1.6), H = Math.ceil(VH * 1.6), c = cv(W, H), g = c.getContext('2d'), r = rng(tema.length * 9);
    if (tema === 'jardim') {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0e0c1a'); gr.addColorStop(1, '#1a1428'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 40; k++) { const x = r() * W, y = r() * H, s = 50 + r() * 120; g.fillStyle = r() < 0.5 ? '#1e1a30' : '#262040'; g.strokeStyle = '#08060e'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); for (let n = 0; n < 5; n++) g.lineTo(x + (r() - 0.5) * s, y + (r() - 0.5) * s * 0.7); g.closePath(); g.fill(); g.stroke(); }
    } else {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5a2a14'); gr.addColorStop(1, '#3a180c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (let k = 0; k < 40; k++) { const x = r() * W, y = r() * H, s = 50 + r() * 120; g.fillStyle = r() < 0.5 ? '#6a3018' : '#7a3a1e'; g.strokeStyle = '#2a0e06'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); for (let n = 0; n < 5; n++) g.lineTo(x + (r() - 0.5) * s, y + (r() - 0.5) * s * 0.7); g.closePath(); g.fill(); g.stroke(); }
    }
    cache[key] = c;
  }
  const c = cache[key];
  const px = ((-camX * 0.25) % c.width + c.width) % c.width, py = ((-camY * 0.25) % c.height + c.height) % c.height;
  for (const dx of [-c.width, 0]) for (const dy of [-c.height, 0]) ctx.drawImage(c, px + dx, py + dy);
  if (tema === 'jardim') { // raio de luz entrando pelas árvores
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(0, 0, VW * 0.4, VH * 0.6); gr.addColorStop(0, 'rgba(255,200,110,0.18)'); gr.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(VW * 0.08, 0); ctx.lineTo(VW * 0.22, 0); ctx.lineTo(VW * 0.5, VH * 0.7); ctx.lineTo(VW * 0.36, VH * 0.7); ctx.fill(); ctx.restore();
  }
}

export function buildThemes() {
  return {
    jardim: {
      walls: [0, 1, 2].map((s) => gardenWall(s)), wallH: 30,
      props: { pilar: castlePillar(G), braseiro: Object.assign(brazier(), { flame: { x: 30, y: 20 } }), leao: lionStatue(), estandarte: banner(), arvore: redTree(4), arvore2: redTree(9), cascata: waterfall(), flor: flower() },
      rocks: [0, 1, 2, 3].map((s) => navyRock(s + 10, 0.9 + (s % 3) * 0.25, G)),
      ground: paintGardenGround, ambient: 'rgba(16,10,40,0.34)',
    },
    deserto: {
      mesas: [0, 1, 2, 3, 4, 5].map((s) => mesa(s, 1 + (s % 3) * 0.6)),
      props: { pilar: stoneRuin(3), braseiro: Object.assign(brazier(), { flame: { x: 30, y: 20 } }), estandarte: banner(), arvore: deadTree(5), arvore2: deadTree(11), flor: desertFlower(), pedra: stoneRuin(7) },
      rocks: [], ground: paintDesertGround, ambient: 'rgba(90,30,10,0.12)',
    },
  };
}
