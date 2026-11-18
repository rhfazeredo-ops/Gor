// =====================================================================
// Motor de pincéis do Ateliê (Canvas 2D) — estilo ilustrado das referências:
//  · contorno de tinta marrom-escuro, mais grosso na silhueta;
//  · 3–4 tons chapados por face (luz vindo de cima/esquerda);
//  · topo largo e claro com borda (lábio) mais escura;
//  · textura salpicada, fendas e lascas;
//  · sólidos 3D simples projetados na câmera isométrica (2:1).
// Tudo determinístico por "seed": o mesmo asset sai igual no jogo e no Ateliê.
// =====================================================================
export const RES = 2;
export const HW = 32, HH = 16;          // meia largura/altura do losango do tile

export const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
export const lerp = (a, b, t) => a + (b - a) * t;
export function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function shade(h, k, toward = null) {
  const c = hex2rgb(h), t = toward ? hex2rgb(toward) : null;
  const o = c.map((v, i) => Math.max(0, Math.min(255, t ? v + (t[i] - v) * k : v * k)));
  return `rgb(${o[0] | 0},${o[1] | 0},${o[2] | 0})`;
}
export function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
  const g = c.getContext('2d'); g.scale(RES, RES); g.lineJoin = 'round'; g.lineCap = 'round';
  return { c, g, w, h };
}
export const iso = (x, y, z = 0) => [(x - y) * HW, (x + y) * HH - z];

export function path(g, pts, close = true) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); }
// caminho suave (Chaikin) para cantos arredondados
export function smooth(pts, it = 2, closed = true) {
  let p = pts;
  for (let k = 0; k < it; k++) {
    const q = [], n = p.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i], b = p[(i + 1) % n];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

// salpicado: pontinhos claros/escuros dentro do clip atual
export function speckle(g, r, x0, y0, w, h, n, cols, size = [0.6, 1.6]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[(r() * cols.length) | 0];
    const s = size[0] + r() * (size[1] - size[0]);
    g.beginPath(); g.ellipse(x0 + r() * w, y0 + r() * h, s, s * 0.7, r() * 3, 0, Math.PI * 2); g.fill();
  }
}
// fenda com ramificação (ziguezague)
export function crack(g, r, x, y, ang, len, col, w = 1.1, branch = 0.3) {
  g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
  let a = ang, px = x, py = y; const seg = 4 + ((r() * 3) | 0);
  for (let i = 0; i < seg; i++) {
    a += (r() - 0.5) * 0.9; const d = len / seg; px += Math.cos(a) * d; py += Math.sin(a) * d; g.lineTo(px, py);
    if (r() < branch) { g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1.1) * d * 0.7, py + Math.sin(a + 1.1) * d * 0.7); g.moveTo(px, py); }
  }
  g.stroke();
}

// ---------------------------------------------------------------------
// Sólido de pedra: contorno no chão (em tiles, ao redor de 0,0), altura h.
// Pinta faces laterais visíveis com tom por direção, topo com lábio,
// textura e fendas. Devolve a silhueta (para contorno externo).
// ---------------------------------------------------------------------
export function stoneSolid(g, r, foot, z0, h, pal, ox, oy, o = {}) {
  const P = (x, y, z) => { const [a, b] = iso(x, y, z); return [ox + a, oy + b]; };
  const pts = o.round === false ? foot : smooth(foot, o.round ?? 2);
  const n = pts.length;
  // faces laterais visíveis (normal apontando para a câmera: +x+y)
  const faces = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const len = Math.hypot(nx, ny) || 1;
    if (nx + ny <= 0.0001) continue;
    // luz: vinda de −x (esquerda da tela) e de cima → faces com normal +y (lado esquerdo na tela) ficam claras
    const L = (ny - nx) / len;
    faces.push({ a, b, L });
  }
  faces.sort((p, q) => (p.a[0] + p.a[1] + p.b[0] + p.b[1]) - (q.a[0] + q.a[1] + q.b[0] + q.b[1]));
  const sidePath = new Path2D();
  const bev = o.bevel ?? 0;                     // altura do chanfro
  const hs = h - bev;
  for (const f of faces) {
    const base = f.L > 0.45 ? pal.lit : f.L > -0.1 ? pal.mid : f.L > -0.6 ? pal.dark : pal.deep;
    const m = o.facets ? Math.max(1, Math.round(Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) / o.facets)) : 1;
    for (let k = 0; k < m; k++) {
      const t0 = k / m, t1 = (k + 1) / m;
      const a2 = [f.a[0] + (f.b[0] - f.a[0]) * t0, f.a[1] + (f.b[1] - f.a[1]) * t0], b2 = [f.a[0] + (f.b[0] - f.a[0]) * t1, f.a[1] + (f.b[1] - f.a[1]) * t1];
      const dz = m > 1 ? (r() - 0.5) * 6 : 0;
      const q = [P(a2[0], a2[1], z0), P(b2[0], b2[1], z0), P(b2[0], b2[1], z0 + hs + dz), P(a2[0], a2[1], z0 + hs + dz)];
      const col = m > 1 ? shade(base, 0.9 + r() * 0.2) : base;
      path(g, q); g.fillStyle = col; g.fill(); g.strokeStyle = col; g.lineWidth = 0.9; g.stroke();
      if (m > 1 && k > 0) { g.strokeStyle = pal.crack; g.lineWidth = 1; g.beginPath(); g.moveTo(...q[0]); g.lineTo(...q[3]); g.stroke(); }
    }
    const q = [P(f.a[0], f.a[1], z0), P(f.b[0], f.b[1], z0), P(f.b[0], f.b[1], z0 + hs), P(f.a[0], f.a[1], z0 + hs)];
    sidePath.moveTo(...q[0]); for (const p of q.slice(1)) sidePath.lineTo(...p); sidePath.closePath();
  }
  // textura e fendas nas laterais
  g.save(); g.clip(sidePath);
  const yTop = oy - z0 - h - 200, yBot = oy - z0 + 200;
  const og = g.createLinearGradient(0, oy - z0 - h * 0.3, 0, oy - z0 + 30);
  og.addColorStop(0, 'rgba(0,0,0,0)'); og.addColorStop(1, pal.occl || 'rgba(60,20,8,0.45)');
  g.fillStyle = og; g.fillRect(ox - 400, yTop, 800, yBot - yTop);
  speckle(g, r, ox - 200, oy - z0 - h - 60, 400, h + 140, Math.floor(h * 3 + 20), [pal.spLight, pal.spDark], [0.5, 1.3]);
  for (const f of faces) {
    if (r() > (o.cracks ?? 0.55)) continue;
    const t = 0.15 + r() * 0.7, x = f.a[0] + (f.b[0] - f.a[0]) * t, y = f.a[1] + (f.b[1] - f.a[1]) * t;
    const [px, py] = P(x, y, z0 + h - 1);
    crack(g, r, px, py, Math.PI / 2 + (r() - 0.5) * 0.4, h * (0.4 + r() * 0.5), pal.crack, 1.2, 0.2);
  }
  if (o.strata) {   // linhas de camada
    g.strokeStyle = pal.crack; g.lineWidth = 1;
    for (let s = 1; s <= o.strata; s++) { const zz = z0 + (h * s) / (o.strata + 1); path(g, pts.map(([x, y]) => P(x, y, zz + (r() - 0.5) * 2)), false); g.stroke(); }
  }
  g.restore();
  // chanfro (faixa arredondada entre lateral e topo)
  const cxm = pts.reduce((s2, p) => s2 + p[0], 0) / n, cym = pts.reduce((s2, p) => s2 + p[1], 0) / n;
  const shrink = o.bevel ? (o.shrink ?? 0.86) : 1;
  const topPts = pts.map(([x, y]) => [cxm + (x - cxm) * shrink, cym + (y - cym) * shrink]);
  if (o.bevel) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = pts[i], b = pts[j];
      const nx = b[1] - a[1], ny = -(b[0] - a[0]), len = Math.hypot(nx, ny) || 1;
      if (nx + ny < -0.0001 * len) continue;
      const L = (ny - nx) / len;
      const col = L > 0.3 ? pal.topHi : L > -0.3 ? pal.top : pal.lit;
      const q = [P(a[0], a[1], z0 + hs), P(b[0], b[1], z0 + hs), P(topPts[j][0], topPts[j][1], z0 + h), P(topPts[i][0], topPts[i][1], z0 + h)];
      path(g, q); g.fillStyle = col; g.fill(); g.strokeStyle = col; g.lineWidth = 0.8; g.stroke();
    }
  }
  // topo
  const top = topPts.map(([x, y]) => P(x, y, z0 + h));
  path(g, top); g.fillStyle = pal.top; g.fill();
  g.save(); path(g, top); g.clip();
  // área iluminada (desloca para a esquerda/cima) e lábio escuro
  const cx = cxm, cy = cym;
  const inner = topPts.map(([x, y]) => P(cx + (x - cx) * 0.82 - 0.06, cy + (y - cy) * 0.82 + 0.04, z0 + h + 1.5));
  path(g, smooth(inner, 1)); g.fillStyle = pal.topHi; g.fill();
  speckle(g, r, ox - 200, oy - z0 - h - 120, 400, 200, 60, [pal.spLight, pal.spDark, pal.topLo], [0.5, 1.4]);
  if (o.topCracks !== 0) for (let k = 0; k < (o.topCracks ?? 2); k++) {
    const p = topPts[(r() * n) | 0]; const [px, py] = P(cx + (p[0] - cx) * 0.95, cy + (p[1] - cy) * 0.95, z0 + h);
    const [tx, ty] = P(cx, cy, z0 + h); crack(g, r, px, py, Math.atan2(ty - py, tx - px) + (r() - 0.5) * 0.6, 10 + r() * 14, pal.topLo, 1.1, 0.25);
  }
  g.restore();
  path(g, top); g.strokeStyle = pal.lip || pal.topLo; g.lineWidth = 1.2; g.stroke();
  // contorno de tinta: topo + bordas verticais extremas + base
  g.strokeStyle = pal.ink; g.lineWidth = o.ink ?? 1.8;
  if (!o.bevel) { path(g, top); g.stroke(); }
  else { // topo: só linha suave de cor (sem tinta), arestas claras do lado iluminado
    g.save(); g.strokeStyle = pal.topLo; g.lineWidth = 1; path(g, top); g.stroke(); g.restore();
    g.save(); g.strokeStyle = 'rgba(255,225,180,0.75)'; g.lineWidth = 1.3; g.beginPath();
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; const nx = b[1] - a[1], ny = -(b[0] - a[0]); if (ny - nx > 0.2 * Math.hypot(nx, ny) && nx + ny > 0) { g.moveTo(...P(a[0], a[1], z0 + hs)); g.lineTo(...P(b[0], b[1], z0 + hs)); } }
    g.stroke(); g.restore();
  }
  if (o.bevel) { // silhueta de trás (contorno externo onde o chanfro encontra o fundo)
    g.beginPath();
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; if ((b[1] - a[1]) - (b[0] - a[0]) <= 0) { g.moveTo(...P(topPts[i][0], topPts[i][1], z0 + h)); g.lineTo(...P(topPts[(i + 1) % n][0], topPts[(i + 1) % n][1], z0 + h)); } }
    g.stroke();
  }
  let mi = 0, ma = 0;
  pts.forEach(([x, y], i) => { const s = x - y; if (s < pts[mi][0] - pts[mi][1]) mi = i; if (s > pts[ma][0] - pts[ma][1]) ma = i; });
  for (const i of [mi, ma]) { g.beginPath(); g.moveTo(...P(pts[i][0], pts[i][1], z0)); g.lineTo(...P(pts[i][0], pts[i][1], z0 + hs)); g.lineTo(...P(topPts[i][0], topPts[i][1], z0 + h)); g.stroke(); }
  g.beginPath(); for (const f of faces) { g.moveTo(...P(f.a[0], f.a[1], z0)); g.lineTo(...P(f.b[0], f.b[1], z0)); } g.stroke();
  return pts;
}

// sombra projetada no chão (para baixo/direita)
export function castShadow(g, foot, height, ox, oy, col = 'rgba(120,40,10,0.35)') {
  const k = height / 220;
  const pts = smooth(foot, 2).map(([x, y]) => { const [a, b] = iso(x + 0.3 + k * 0.5, y - 0.15 + k * 0.6, 0); return [ox + a, oy + b]; });
  path(g, pts); g.fillStyle = col; g.fill();
}

// contorno irregular em volta de (0,0) (em tiles)
export function blobFoot(r, rx, ry, n = 9, wob = 0.18) {
  const pts = [], k1 = r() * 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const f = 1 + Math.sin(a * 2 + k1) * wob * 0.6 + (r() - 0.5) * wob;
    pts.push([Math.cos(a) * rx * f, Math.sin(a) * ry * f]);
  }
  return pts;
}
// retângulo em tiles (para blocos de arenito)
export const rectFoot = (w, d, x = 0, y = 0) => [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];
