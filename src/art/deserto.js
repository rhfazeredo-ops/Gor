// =====================================================================
// Receitas do tema DESERTO (referência: docs/referencias/alvo-deserto.png)
// Paleta amostrada da referência.
// =====================================================================
import { canvas, rng, iso, path, smooth, speckle, crack, stoneSolid, castShadow, blobFoot, rectFoot, shade, HW, HH } from './brush.js';

export const PAL = {
  // rocha avermelhada
  rock: { top: '#dc9058', topHi: '#efaa70', topLo: '#a8603a', lip: '#9a5432', lit: '#c0703e', mid: '#9a5434', dark: '#723a24', deep: '#56281a',
    spLight: 'rgba(255,200,140,0.35)', spDark: 'rgba(70,24,10,0.35)', crack: 'rgba(70,26,12,0.55)', ink: '#4a2010', occl: 'rgba(60,20,8,0.45)' },
  // arenito das ruínas
  sand: { top: '#e9b77a', topHi: '#f6cf94', topLo: '#b98450', lip: '#a06c3e', lit: '#d9a468', mid: '#b98450', dark: '#8a5a32', deep: '#6a4022',
    spLight: 'rgba(255,236,190,0.4)', spDark: 'rgba(90,50,20,0.3)', crack: 'rgba(80,40,14,0.75)', ink: '#3a1c0c', occl: 'rgba(80,36,12,0.4)' },
  ground: { base: '#e5803e', light: '#f08d40', lighter: '#fca24b', dark: '#c76e35', darker: '#97502d' },
  water: { deep: '#0e5a66', mid: '#1f9ea6', light: '#4fd0cc', foam: '#bff4ee' },
  ink: '#2e140c',
};

// ---------------- rochedo: aglomerado de blocos chanfrados ----------------
export function rochedo(seed = 1, { R = 1.2, h = 46, tiers = 2 } = {}) {
  const r = rng(seed * 977 + 13);
  const span = (R * 1.6 + 0.8) * (HW + HH);
  const H = h * 2.4 + span;
  const { c, g, w } = canvas(span * 2, H);
  const ox = span, oy = H - span * 0.45;
  // blocos: centros num disco de raio R, tamanhos variados
  const blocks = [];
  const nb = Math.max(1, Math.round(R * R * 1.6)) + ((r() * 2) | 0);
  for (let k = 0; k < nb * 4 && blocks.length < nb; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.75;
    const x = Math.cos(a) * d, y = Math.sin(a) * d, s = 0.55 + r() * 0.4;
    if (blocks.some((b) => Math.hypot(b.x - x, b.y - y) < (b.s + s) * 0.42)) continue;
    blocks.push({ x, y, s, hh: h * (0.6 + r() * 0.6) * (1 - d / (R * 1.6)) });
  }
  // camada de cima (tiers>1): blocos menores sobre os maiores
  if (tiers > 1) for (const b of blocks.slice()) if (b.s > 0.6 && r() < 0.5) blocks.push({ x: b.x - 0.05, y: b.y - 0.05, s: b.s * 0.6, hh: h * (0.3 + r() * 0.3), z: b.hh });
  const all = blocks.map((b) => {
    // quadrado de cantos arredondados, girado e levemente irregular
    const rot = (r() - 0.5) * 0.8, sx = b.s * (0.85 + r() * 0.3), sy = b.s * (0.85 + r() * 0.3);
    const q = [[-sx / 2, -sy / 2], [sx / 2, -sy / 2], [sx / 2, sy / 2], [-sx / 2, sy / 2]].map(([x, y]) => [x * Math.cos(rot) - y * Math.sin(rot) + (r() - 0.5) * 0.06, x * Math.sin(rot) + y * Math.cos(rot) + (r() - 0.5) * 0.06]);
    const ins = [];
    for (let i = 0; i < 4; i++) { const a2 = q[i], b2 = q[(i + 1) % 4]; ins.push(a2, [a2[0] + (b2[0] - a2[0]) * 0.5 + (r() - 0.5) * 0.05, a2[1] + (b2[1] - a2[1]) * 0.5 + (r() - 0.5) * 0.05]); }
    return { ...b, foot: ins.map(([x, y]) => [x + b.x, y + b.y]) };
  });
  for (const b of all) if (!b.z) castShadow(g, b.foot, b.hh, ox, oy, 'rgba(130,48,12,0.22)');
  all.sort((a2, b2) => (a2.z || 0) - (b2.z || 0) || (a2.x + a2.y) - (b2.x + b2.y));
  for (const b of all) stoneSolid(g, r, b.foot, b.z || 0, b.hh, PAL.rock, ox, oy, { round: 3, cracks: 0.5, topCracks: 1, ink: 1.2, bevel: 6, shrink: 0.88, facets: 0.3 });
  return { img: c, w, h: H, ax: ox, ay: oy, R };
}

// ---------------- pedra solta ----------------
export function pedra(seed = 1, s = 0.35) {
  const r = rng(seed * 31 + 5);
  const span = (s * 1.8 + 0.3) * (HW + HH), H = span * 1.5;
  const { c, g, w } = canvas(span * 2, H);
  const ox = span, oy = H - span * 0.5;
  const foot = blobFoot(r, s, s * (0.8 + r() * 0.3), 7, 0.25);
  castShadow(g, foot, 14, ox, oy, 'rgba(130,48,12,0.35)');
  stoneSolid(g, r, foot, 0, 8 + r() * 10, r() < 0.5 ? PAL.rock : PAL.sand, ox, oy, { round: 2, cracks: 0.2, topCracks: 0, ink: 1.6 });
  return { img: c, w, h: H, ax: ox, ay: oy };
}

// lascas: tira pedaços dos cantos de um retângulo
function chip(r, q) {
  const out = [];
  for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length], pv = q[(i + q.length - 1) % q.length];
    if (r() < 0.45) { const k = 0.08 + r() * 0.12; out.push([a[0] + (pv[0] - a[0]) * k, a[1] + (pv[1] - a[1]) * k], [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); } else out.push(a); }
  return out;
}

// ---------------- pilar de arenito (blocos empilhados, arestas vivas) ----------------
export function pilarArenito(seed = 1, { blocos = 3, larg = 0.8 } = {}) {
  const r = rng(seed * 53 + 9);
  const H = 40 + blocos * 34, span = larg * 2.4 * (HW + HH);
  const { c, g, w } = canvas(span * 2, H + span);
  const ox = span, oy = H + span * 0.45;
  // base larga
  castShadow(g, rectFoot(larg * 1.5, larg * 1.5), blocos * 30, ox, oy, 'rgba(120,44,12,0.38)');
  stoneSolid(g, r, chip(r, rectFoot(larg * 1.35, larg * 1.35)), 0, 12, PAL.sand, ox, oy, { round: 1, cracks: 0.3, topCracks: 1, ink: 1.4, bevel: 2, shrink: 0.95 });
  let z = 12;
  for (let b = 0; b < blocos; b++) {
    const s = larg * (1 - b * 0.03) * (0.96 + r() * 0.08), hh = 26 + r() * 8;
    const off = [(r() - 0.5) * 0.06, (r() - 0.5) * 0.06];
    stoneSolid(g, r, chip(r, rectFoot(s, s, off[0], off[1])), z, hh, PAL.sand, ox, oy, { round: 1, cracks: 0.7, topCracks: b === blocos - 1 ? 2 : 0, ink: 1.4, bevel: 2, shrink: 0.94, facets: 0.4 });
    z += hh;
  }
  // capitel
  stoneSolid(g, r, chip(r, rectFoot(larg * 1.18, larg * 1.18)), z, 12, PAL.sand, ox, oy, { round: 1, cracks: 0.2, topCracks: 2, ink: 1.4, bevel: 2, shrink: 0.94 });
  return { img: c, w, h: H + span, ax: ox, ay: oy };
}

// ---------------- escadaria de ruína (degraus em diagonal) ----------------
export function escada(seed = 1, { degraus = 4, larg = 1.6 } = {}) {
  const r = rng(seed * 71 + 3);
  const span = (larg + degraus * 0.4 + 1) * (HW + HH), H = degraus * 14 + span * 1.2;
  const { c, g, w } = canvas(span * 2, H);
  const ox = span, oy = H - span * 0.35;
  for (let d = degraus - 1; d >= 0; d--) {
    const x = -d * 0.42, z = d * 12;
    const n = 3;
    for (let k = n - 1; k >= 0; k--) {
      const bw = larg / n, y = -larg / 2 + bw * (k + 0.5);
      stoneSolid(g, r, chip(r, rectFoot(0.42, bw * 0.96, x, y)), 0, z + 12, PAL.sand, ox, oy, { round: false, cracks: 0.35, topCracks: r() < 0.4 ? 1 : 0, ink: 1.3 });
    }
  }
  return { img: c, w, h: H, ax: ox, ay: oy };
}

// ---------------- árvore seca retorcida ----------------
export function arvoreSeca(seed = 1, { alt = 120 } = {}) {
  const r = rng(seed * 113 + 1);
  const W = alt * 1.3, H = alt * 1.25;
  const { c, g, w } = canvas(W, H);
  const ox = W / 2, oy = H - 8;
  const col = '#3a2218', colHi = '#8a5a34', ink = '#1e0e08';
  const branch = (x, y, a, len, wd, d) => {
    const pts = [[x, y]]; let px = x, py = y, aa = a;
    for (let i = 0; i < 4; i++) { aa += (r() - 0.5) * 0.5; px += Math.cos(aa) * len / 4; py += Math.sin(aa) * len / 4; pts.push([px, py]); }
    // contorno + preenchimento (tronco grosso afinando)
    for (const [cw, cc] of [[wd + 2.4, ink], [wd, col]]) { g.strokeStyle = cc; g.lineWidth = cw; path(g, pts, false); g.stroke(); }
    g.strokeStyle = colHi; g.lineWidth = Math.max(0.8, wd * 0.3); path(g, pts.map(([a2, b2]) => [a2 - wd * 0.2, b2]), false); g.stroke();
    if (d > 0) { const nb = 2 + (r() < 0.5 ? 1 : 0); for (let k = 0; k < nb; k++) branch(px, py, aa + (k - (nb - 1) / 2) * 0.9 + (r() - 0.5) * 0.5, len * (0.5 + r() * 0.2), wd * 0.58, d - 1); }
    else for (let k = 0; k < 3; k++) { const ta = aa + (r() - 0.5) * 2; g.strokeStyle = ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(ta) * 9, py + Math.sin(ta) * 9); g.stroke(); }
  };
  g.fillStyle = 'rgba(120,44,12,0.3)'; g.beginPath(); g.ellipse(ox + 14, oy, 26, 9, 0, 0, Math.PI * 2); g.fill();
  branch(ox, oy, -Math.PI / 2 + (r() - 0.5) * 0.4, alt * 0.42, 15, 4);
  // raízes
  for (const s of [-1, 1]) branch(ox, oy - 2, Math.PI / 2 + s * 1.3, 14, 4, 0);
  return { img: c, w, h: H, ax: ox, ay: oy };
}

// ---------------- Flor do Deserto (pétalas vermelhas, miolo luminoso) ----------------
export function flor(seed = 1, { s = 1 } = {}) {
  const r = rng(seed * 7 + 2);
  const W = 90 * s, H = 100 * s;
  const { c, g, w } = canvas(W, H);
  const ox = W / 2, oy = H - 6;
  const ink = PAL.ink;
  g.fillStyle = 'rgba(120,44,12,0.3)'; g.beginPath(); g.ellipse(ox, oy, 20 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
  // folhas largas
  for (const [a, l] of [[-2.8, 34], [-0.35, 34], [-2.2, 26], [-0.9, 26]]) {
    g.save(); g.translate(ox, oy - 4 * s); g.rotate(a + (r() - 0.5) * 0.2);
    const L = l * s;
    path(g, [[0, 0], [L * 0.45, -L * 0.22], [L, 0], [L * 0.45, L * 0.18]]); g.fillStyle = '#7a7a34'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = '#4a4a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 0); g.lineTo(L * 0.85, 0); g.stroke();
    g.restore();
  }
  // caule
  g.strokeStyle = ink; g.lineWidth = 4 * s; g.beginPath(); g.moveTo(ox, oy - 4); g.quadraticCurveTo(ox - 2, oy - 24 * s, ox, oy - 42 * s); g.stroke();
  g.strokeStyle = '#5a6a2a'; g.lineWidth = 2.2 * s; g.stroke();
  // pétalas pontudas em camadas
  const cx = ox, cy = oy - 46 * s;
  for (const [n, R, col, rot] of [[6, 30, '#a01c26', 0.25], [6, 24, '#e2402e', 0], [5, 13, '#ff7a3a', 0.3]]) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rot - Math.PI / 2, RR = R * s * (0.85 + r() * 0.25);
      const tip = [cx + Math.cos(a) * RR, cy + Math.sin(a) * RR * 0.8];
      const l = [cx + Math.cos(a - 0.35) * RR * 0.45, cy + Math.sin(a - 0.35) * RR * 0.4], rr = [cx + Math.cos(a + 0.35) * RR * 0.45, cy + Math.sin(a + 0.35) * RR * 0.4];
      path(g, [[cx, cy], l, tip, rr]); g.fillStyle = col; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.2; g.stroke();
    }
  }
  const gl = g.createRadialGradient(cx, cy, 0, cx, cy, 9 * s); gl.addColorStop(0, '#fff8c0'); gl.addColorStop(0.5, '#ffd040'); gl.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, 9 * s, 0, Math.PI * 2); g.fill();
  return { img: c, w, h: H, ax: ox, ay: oy };
}

// ---------------- tufo de mato seco ----------------
export function mato(seed = 1) {
  const r = rng(seed * 19 + 4);
  const { c, g, w, h } = canvas(40, 30);
  const ox = 20, oy = 27;
  for (let k = 0; k < 14; k++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 1.8, l = 8 + r() * 14;
    g.strokeStyle = r() < 0.5 ? '#c8a040' : '#9a7024'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(ox + (r() - 0.5) * 8, oy); g.quadraticCurveTo(ox + Math.cos(a) * l * 0.5, oy + Math.sin(a) * l * 0.6, ox + Math.cos(a) * l, oy + Math.sin(a) * l); g.stroke();
  }
  return { img: c, w, h, ax: ox, ay: oy };
}

// ---------------- costelas de ossada sobre a pedra ----------------
export function ossos(seed = 1) {
  const r = rng(seed * 3 + 1);
  const { c, g, w, h } = canvas(90, 50);
  const ink = PAL.ink;
  for (let k = 0; k < 4; k++) {
    const x = 14 + k * 17, y = 38 - k * 6;
    g.save(); g.translate(x, y); g.rotate(-0.5 + (r() - 0.5) * 0.15);
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-4, -10, 4, -22, 14, -22); g.bezierCurveTo(10, -18, 4, -10, 5, 0); g.closePath();
    g.fillStyle = '#f0e2c4'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
    g.strokeStyle = 'rgba(160,120,80,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(3, -3); g.bezierCurveTo(1, -10, 6, -18, 12, -20); g.stroke();
    g.restore();
  }
  return { img: c, w, h, ax: 45, ay: 40 };
}

// ---------------- estandarte rasgado ----------------
export function estandarte(seed = 1) {
  const r = rng(seed);
  const { c, g, w, h } = canvas(50, 130);
  const ink = PAL.ink;
  g.fillStyle = '#4a2a16'; g.fillRect(4, 2, 42, 5); g.strokeStyle = ink; g.lineWidth = 1.4; g.strokeRect(4, 2, 42, 5);
  const pts = [[7, 7], [43, 7], [43, 92]];
  for (let k = 0; k <= 4; k++) pts.push([43 - k * 9, 92 + (k % 2 ? 12 : 0) + (r() - 0.5) * 4]);
  pts.push([7, 92]);
  path(g, pts); g.fillStyle = '#2c3488'; g.fill();
  g.save(); path(g, pts); g.clip();
  g.fillStyle = '#3e48b0'; g.fillRect(7, 7, 12, 100);
  g.fillStyle = 'rgba(14,16,50,0.4)'; g.fillRect(34, 7, 10, 100);
  g.strokeStyle = '#d9962e'; g.lineWidth = 4; path(g, pts); g.stroke();
  g.restore();
  path(g, pts); g.strokeStyle = ink; g.lineWidth = 1.6; g.stroke();
  g.fillStyle = '#e8a83a'; g.strokeStyle = ink; g.lineWidth = 1.2;
  g.beginPath(); g.rect(22.5, 20, 5, 52); g.rect(13, 34, 24, 5); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(25, 13); g.lineTo(29, 20); g.lineTo(21, 20); g.closePath(); g.fill(); g.stroke();
  return { img: c, w, h, ax: 25, ay: 128 };
}

// ---------------- textura do chão (repete sem emenda) ----------------
export function chaoTextura(seed = 1, size = 256) {
  const r = rng(seed);
  const cvx = document.createElement('canvas'); cvx.width = cvx.height = size;
  const g = cvx.getContext('2d'), G = PAL.ground;
  g.fillStyle = G.base; g.fillRect(0, 0, size, size);
  const tile = (fn) => { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  // grandes manchas de luz/sombra chapadas
  for (let k = 0; k < 16; k++) {
    const x = r() * size, y = r() * size, rx = 30 + r() * 60, ry = rx * 0.45, col = r() < 0.55 ? G.light : G.dark, a = r() * 0.3;
    tile(() => { g.fillStyle = col; g.globalAlpha = 0.22; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; });
  }
  // salpicado e pedrinhas
  for (let k = 0; k < 500; k++) { g.fillStyle = r() < 0.5 ? G.lighter : G.darker; g.globalAlpha = 0.5; g.fillRect(r() * size, r() * size, 1 + r() * 1.5, 1); }
  g.globalAlpha = 1;
  // marcas de vento
  g.strokeStyle = 'rgba(151,80,45,0.35)'; g.lineWidth = 1.2;
  for (let k = 0; k < 18; k++) { const x = r() * size, y = r() * size; tile(() => { g.beginPath(); g.moveTo(x - 14, y + 3); g.quadraticCurveTo(x, y - 3, x + 16, y + 2); g.stroke(); }); }
  return cvx;
}

// catálogo para o Ateliê
export const CATALOG = {
  rochedo: { fn: rochedo, ref: 'rochedo', params: { R: [0.6, 2.2, 1.2], h: [20, 90, 46], tiers: [1, 3, 2] } },
  pedra: { fn: (s, p) => pedra(s, p.s), ref: 'lago', params: { s: [0.15, 0.6, 0.35] } },
  pilarArenito: { fn: pilarArenito, ref: 'ruina', params: { blocos: [1, 5, 3], larg: [0.35, 0.9, 0.55] } },
  escada: { fn: escada, ref: 'ruina', params: { degraus: [2, 6, 4], larg: [0.8, 2.6, 1.6] } },
  arvoreSeca: { fn: arvoreSeca, ref: 'arvore', params: { alt: [60, 180, 120] } },
  flor: { fn: flor, ref: 'flor', params: { s: [0.5, 1.6, 1] } },
  mato: { fn: (s) => mato(s), ref: 'chao', params: {} },
  ossos: { fn: (s) => ossos(s), ref: 'ossos', params: {} },
  estandarte: { fn: (s) => estandarte(s), ref: 'ruina', params: {} },
};
