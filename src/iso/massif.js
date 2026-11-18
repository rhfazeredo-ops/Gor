// =====================================================================
// Rochedos "estilo Flash": sólidos 3D simples projetados na câmera
// isométrica e pintados como ilustração (Canvas 2D).
// Cada massa é feita de 1–3 camadas empilhadas; cada camada é um prisma
// com contorno irregular e arredondado (no chão, em tiles) e uma altura.
// Pintura: faces laterais em 3 tons conforme a direção (luz vindo da
// esquerda/cima), topo claro com anel de erosão, fendas verticais,
// frisos horizontais, contorno preto e sombra projetada na areia.
// =====================================================================
import { TW, TH, RES } from './art-hd.js';
import { rng, INK, cv } from './castle.js';

const HW = TW / 2, HH = TH / 2;
const PAL = {
  top: '#e9a46e', topHi: '#f7c48c', topLo: '#c98250',
  lit: '#d4895a', mid: '#b56a40', dark: '#7e4026', deep: '#552616',
  crack: 'rgba(60,22,10,0.75)', shadow: 'rgba(110,40,10,0.45)',
};

// contorno irregular arredondado em volta de (0,0), raio rx, ry em tiles
function outline(r, rx, ry, n = 9) {
  const pts = [], k1 = r() * 6, k2 = r() * 6, a1 = 0.08 + r() * 0.08, a2 = 0.05 + r() * 0.06;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const f = (1 + Math.sin(a * 2 + k1) * a1 + Math.sin(a * 3 + k2) * a2) * (0.9 + r() * 0.18);
    pts.push([Math.cos(a) * rx * f, Math.sin(a) * ry * f]);
  }
  return pts;
}
const proj = (x, y, z = 0) => [(x - y) * HW, (x + y) * HH - z];

// desenha uma massa; devolve sprite com âncora no centro da base
export function buildMassif(seed, R = 1.4, tiers = 2, height = 70) {
  const r = rng(seed * 131 + 7);
  const layers = [];
  let z = 0, rx = R * (1 + r() * 0.2), ry = R * (0.85 + r() * 0.25), ox = 0, oy = 0;
  for (let t = 0; t < tiers; t++) {
    const h = t === 0 ? height * (0.8 + r() * 0.4) : height * (0.45 + r() * 0.35);
    layers.push({ pts: outline(r, rx, ry), z, h, ox, oy });
    z += h; rx *= 0.6 + r() * 0.2; ry *= 0.6 + r() * 0.2; ox += (r() - 0.5) * R * 0.5; oy += (r() - 0.5) * R * 0.5;
  }
  // limites para o canvas
  const span = (R * 1.4 + 0.5) * (HW + HH) * 1.3;
  const W = Math.ceil(span * 2), H = Math.ceil(span * 1.2 + z + 30);
  const ax = W / 2, ay = H - span * 0.5;
  const c = cv(W * RES, H * RES), g = c.getContext('2d'); g.scale(RES, RES);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const P = (x, y, zz) => { const [sx, sy] = proj(x, y, zz); return [ax + sx, ay + sy]; };

  // sombra projetada (para a direita/baixo)
  const base = layers[0];
  g.fillStyle = PAL.shadow; g.beginPath();
  base.pts.forEach(([x, y], i) => { const [px, py] = P(x + 0.35 + z / 220, y - 0.05 + z / 260, 0); i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.closePath(); g.fill();

  for (const L of layers) {
    const n = L.pts.length;
    const pts = L.pts.map(([x, y]) => [x + L.ox, y + L.oy]);
    // faces laterais visíveis: a câmera olha de (+x,+y) → faces cuja normal tem componente (+1,+1)
    const faces = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const ex = b[0] - a[0], ey = b[1] - a[1];
      const nx = ey, ny = -ex;                         // normal para fora (contorno anti-horário em tela)
      const facing = (nx + ny);
      if (facing <= 0) continue;
      // luz vinda da esquerda (−x na tela = +y no mundo… usamos normal na tela)
      const sxn = (nx - ny), light = -sxn / Math.hypot(nx, ny);
      faces.push({ a, b, light, depth: a[0] + a[1] + b[0] + b[1] });
    }
    faces.sort((p, q) => p.depth - q.depth);
    for (const f of faces) {
      const A0 = P(f.a[0], f.a[1], L.z), B0 = P(f.b[0], f.b[1], L.z), A1 = P(f.a[0], f.a[1], L.z + L.h), B1 = P(f.b[0], f.b[1], L.z + L.h);
      const col = f.light > 0.35 ? PAL.lit : f.light > -0.25 ? PAL.mid : PAL.dark;
      g.beginPath(); g.moveTo(...A0); g.lineTo(...B0); g.lineTo(...B1); g.lineTo(...A1); g.closePath();
      g.fillStyle = col; g.fill(); g.strokeStyle = col; g.lineWidth = 0.8; g.stroke();   // fecha frestas
    }
    // base mais escura (oclusão) e frisos horizontais
    g.save();
    const side = new Path2D();
    for (const f of faces) { const A0 = P(f.a[0], f.a[1], L.z), B0 = P(f.b[0], f.b[1], L.z), A1 = P(f.a[0], f.a[1], L.z + L.h), B1 = P(f.b[0], f.b[1], L.z + L.h); side.moveTo(...A0); side.lineTo(...B0); side.lineTo(...B1); side.lineTo(...A1); side.closePath(); }
    g.clip(side);
    const grd = g.createLinearGradient(0, ay - L.z - L.h, 0, ay - L.z + 40);
    grd.addColorStop(0, 'rgba(255,200,140,0.0)'); grd.addColorStop(0.75, 'rgba(70,24,10,0.0)'); grd.addColorStop(1, 'rgba(70,24,10,0.45)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = PAL.crack; g.lineWidth = 1.2;
    const strata = L.h > 40 ? 1 : 0;
    for (let s = 1; s <= strata; s++) {
      const zz = L.z + (L.h * s) / (strata + 1) + (r() - 0.5) * 4;
      g.beginPath(); let first = true;
      for (let i = 0; i <= n; i++) { const p = pts[i % n]; const [px, py] = P(p[0] * 1.002, p[1] * 1.002, zz + (r() - 0.5) * 3); first ? g.moveTo(px, py) : g.lineTo(px, py); first = false; }
      g.stroke();
    }
    // fendas verticais
    for (const f of faces) {
      if (r() < 0.7) continue;
      const t = r(), x = f.a[0] + (f.b[0] - f.a[0]) * t, y = f.a[1] + (f.b[1] - f.a[1]) * t;
      const [px, py] = P(x, y, L.z + L.h);
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + (r() - 0.5) * 5, py + L.h * (0.25 + r() * 0.3)); g.stroke();
    }
    g.restore();
    // contorno das faces laterais (silhueta inferior + bordas verticais extremas)
    g.strokeStyle = INK; g.lineWidth = 2.2;
    g.beginPath();
    for (const f of faces) { const A0 = P(f.a[0], f.a[1], L.z), B0 = P(f.b[0], f.b[1], L.z); g.moveTo(...A0); g.lineTo(...B0); }
    g.stroke();
    // topo
    g.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = P(x, y, L.z + L.h); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
    g.fillStyle = PAL.top; g.fill();
    g.save(); g.clip();
    // luz chapada no lado esquerdo do topo + fissuras curtas
    g.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = P(x * 0.8 - 0.25, y * 0.8 + 0.2, L.z + L.h); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
    g.fillStyle = PAL.topHi; g.fill();
    g.strokeStyle = PAL.topLo; g.lineWidth = 1.3;
    for (let k = 0; k < 2; k++) { const p0 = pts[(r() * n) | 0]; const [px, py] = P(p0[0] * 0.8, p0[1] * 0.8, L.z + L.h); g.beginPath(); g.moveTo(px, py); g.lineTo(px + (r() - 0.5) * 18, py + (r() - 0.5) * 9); g.stroke(); }
    g.restore();
    // contorno do topo e das laterais (bordas verticais nos extremos da silhueta)
    g.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = P(x, y, L.z + L.h); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
    g.strokeStyle = INK; g.lineWidth = 2.2; g.stroke();
    let minI = 0, maxI = 0;
    pts.forEach(([x, y], i) => { const sx = x - y; if (sx < pts[minI][0] - pts[minI][1]) minI = i; if (sx > pts[maxI][0] - pts[maxI][1]) maxI = i; });
    for (const i of [minI, maxI]) { const [x, y] = pts[i]; g.beginPath(); g.moveTo(...P(x, y, L.z)); g.lineTo(...P(x, y, L.z + L.h)); g.stroke(); }
  }
  return { img: c, ax, ay, w: W, h: H, R };
}

// cobre os tiles de muro do deserto com massas grandes
export function desertMassifs(map) {
  const r = rng(map.w * 7 + map.h * 3);
  const isWall = (i, j) => { const ch = (map.tiles[j] || '')[i]; return ch === '#' || ch === 'E'; };
  const covered = new Set(), out = [];
  const tiles = [];
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) if (isWall(i, j)) tiles.push([i, j]);
  for (let k = tiles.length - 1; k > 0; k--) { const m = (r() * (k + 1)) | 0; [tiles[k], tiles[m]] = [tiles[m], tiles[k]]; }
  let seed = 1;
  for (const [i, j] of tiles) {
    if (covered.has(i + ',' + j)) continue;
    // raio: cresce enquanto houver muro em volta
    let R = 1;
    for (const tryR of [2.2, 1.7, 1.3]) {
      let ok = 0, tot = 0;
      for (let dj = -Math.ceil(tryR); dj <= Math.ceil(tryR); dj++) for (let di = -Math.ceil(tryR); di <= Math.ceil(tryR); di++) { if (di * di + dj * dj > tryR * tryR) continue; tot++; if (isWall(i + di, j + dj)) ok++; }
      if (ok / tot > 0.6) { R = tryR; break; }
    }
    for (let dj = -Math.ceil(R); dj <= Math.ceil(R); dj++) for (let di = -Math.ceil(R); di <= Math.ceil(R); di++) if (di * di + dj * dj <= R * R + 0.3 && isWall(i + di, j + dj)) covered.add(i + di + ',' + (j + dj));
    const tall = 26 + r() * 30 + R * 10;
    const m = buildMassif(seed++, R * 0.8 + 0.35, R > 1.5 ? 3 : 2, tall);
    out.push({ x: i + 0.5, y: j + 0.5, ...m });
  }
  return out;
}
