// =====================================================================
// Mapa grande do deserto montado com os assets pintados (docs/assets-ia).
// Peças posicionadas livremente (em tiles), com escala, espelhamento e
// raio de colisão. Chão: textura pintada repetida sem emenda.
// =====================================================================
import manifest from '../assets/deserto/manifest.json';
const URLS = import.meta.glob('../assets/deserto/*.webp', { query: '?url', import: 'default', eager: true });
import groundUrl from '../assets/deserto-chao/principal.webp?url';

const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
// escala (unidades do mundo por pixel do asset) e colisão (tiles) por tipo
const KIND = {
  paredao: { s: 0.27 }, pico: { s: 0.25, r: 1.6 }, rochedo: { s: 0.23, r: 1.9 }, ruina: { s: 0.3, r: 2.2 },
  lago: { s: 0.28, r: 2.3 }, arvore: { s: 0.19, r: 0.5 }, arbusto: { s: 0.1 }, grama: { s: 0.075 },
  flores: { s: 0.09 }, rochas: { s: 0.14, r: 0.5 }, ossos: { s: 0.12 }, estandarte: { s: 0.13, r: 0.3 }, pilar: { s: 0.15, r: 0.5 }, pedras: { s: 0.16 },
};
// séries desenhadas em outra escala de pixel (folhas com muitos itens): escala própria
const SERIES = { 'arvore-7': 0.38, 'arbusto-7': 0.3, 'grama-5': 0.28, 'pedras-1': 0.16 };
const seriesScale = (key) => SERIES[key.replace(/-\d+$/, '')];
const kindOf = (name) => (name.startsWith('itens-2') ? 'ossos' : name.startsWith('itens-1-3') ? 'rochas' : name.startsWith('itens-1-4') ? 'arbusto' : name.startsWith('itens-1-2') ? 'grama' : name.replace(/-.*/, ''));

let ART = null, GROUND = null;
export async function loadBigDesert() {
  if (ART) return;
  const load = (url) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = url; });
  ART = {};
  const jobs = [];
  for (const [name, pieces] of Object.entries(manifest)) pieces.forEach((p) => {
    const key = `${name}-${pieces.indexOf(p) + 1}`;
    jobs.push(load(URLS[`../assets/deserto/${p.file}`]).then((img) => { ART[key] = { img, ...p, kind: kindOf(key) }; }));
  });
  jobs.push(load(groundUrl).then((i) => (GROUND = i)));
  await Promise.all(jobs);
}
// sprite pronto para desenhar (escala aplicada)
export function sprite(key, s = null) {
  const a = ART[key], k = s ?? seriesScale(key) ?? KIND[a.kind]?.s ?? 0.15;
  return { img: a.img, w: a.w * k, h: a.h * k, ax: a.ax * k, ay: a.ay * k };
}

// polígono da base em pixels de tela (relativo à âncora): contorno de baixo do desenho é a
// borda da frente; a de trás é o espelho dela pela corda entre as pontas esquerda e direita.
// Troncos: só as colunas perto do chão (raízes), ignorando a copa.
function basePolygon(a, s, flip, trunk) {
  const H = a.h;
  let prof = a.prof.slice();
  const low = Math.max(...prof.map((p) => p[1]));
  prof = prof.filter((p) => p[1] >= low - H * (trunk ? 0.07 : 0.5));
  if (prof.length < 3) return null;
  let F = prof.map(([px, py]) => [(px - a.ax) * s * (flip ? -1 : 1), (py - a.ay) * s]);
  F.sort((p, q) => p[0] - q[0]);
  const [L, Rr] = [F[0], F[F.length - 1]];
  const chord = (X) => L[1] + (Rr[1] - L[1]) * ((X - L[0]) / ((Rr[0] - L[0]) || 1));
  // profundidade mínima: a de uma elipse isométrica da mesma largura (evita "lascas" em bases retas)
  const wid = Rr[0] - L[0], D = Math.max(...F.map(([X, Y]) => Y - chord(X)));
  const flat = 2 * D < wid * 0.45;
  const back = F.slice(1, -1).reverse().map(([X, Y]) => {
    if (!flat) return [X, 2 * chord(X) - Y];
    const u = (2 * (X - L[0])) / (wid || 1) - 1;
    return [X, Math.min(2 * chord(X) - Y, Y - wid * 0.5 * Math.sqrt(Math.max(0, 1 - u * u)))];
  });
  let P = [...F, ...back];
  // encolhe um pouco para o herói poder encostar (o raio dele completa o resto)
  const k = trunk ? 0.8 : 1.0, cx = P.reduce((t, p) => t + p[0], 0) / P.length, cy = P.reduce((t, p) => t + p[1], 0) / P.length;
  return P.map(([X, Y]) => [cx + (X - cx) * k, cy + (Y - cy) * k]);
}
function polyCenter(pts) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], c = x0 * y1 - x1 * y0;
    A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
  }
  A /= 2;
  if (Math.abs(A) < 1e-6) return [pts[0][0], pts[0][1], 0.3];
  return [cx / (6 * A), cy / (6 * A), Math.sqrt(Math.abs(A) / Math.PI)];
}
function inPoly(pts, x, y) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function distPoly(pts, x, y) {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

// --------------------------- o mapa ---------------------------
export function buildBigDesert() {
  const W = 72, H = 72, r = rng(1234);
  const floor = new Array(W * H).fill('areia'), solid = new Array(W * H).fill(false);
  const decos = [];
  const colliders = [], ramps = [];
  // física por tipo: 'chao' (passa por cima), 'mole' (passa por dentro e balança), 'solido', 'escada'
  const PHYS = { rochas: 'chao', ossos: 'chao', grama: 'mole', arbusto: 'mole', flores: 'mole', rochedo: 'solido', pico: 'solido', lago: 'solido',
    arvore: 'tronco', pilar: 'solido', pedras: 'solido', estandarte: 'tronco', paredao: 'parede', ruina: 'solido' };
  const STAIRS = { 'ruina-escada-1': { side: 0.42, top: 0.62, h: 0.24 }, 'ruina-pilares-1-1': { side: 0.42, top: 0.62, h: 0.2 }, 'ruina-arco-1': { side: 0.42, top: 0.55, h: 0.2 } };
  const add = (key, x, y, o = {}) => {
    const a = ART[key]; if (!a) return;
    const k = KIND[a.kind] || {}, s = (o.s ?? 1) * (seriesScale(key) ?? k.s ?? 0.15);
    const spr = { img: a.img, w: a.w * s, h: a.h * s, ax: (o.flip ? a.w - a.ax : a.ax) * s, ay: a.ay * s };
    const phys = o.phys || (STAIRS[key] ? 'escada' : PHYS[a.kind] || 'chao');
    const d = { key, x, y, flip: !!o.flip, spr, tall: spr.h > 45, phys, z: o.z ?? 0, sway: 0, swayV: 0, seed: Math.random() * 6 };
    // pegada medida no próprio asset: elipse no chão cuja borda da frente encosta na base desenhada
    const f = a.foot || { x0: 0, x1: a.w, front: a.ay };
    const half = ((f.x1 - f.x0) / 2) * s, midX = ((f.x0 + f.x1) / 2 - a.ax) * s * (o.flip ? -1 : 1), front = (f.front - a.ay) * s;
    const toT = (X, Y) => [X / 64 + Y / 32, Y / 32 - X / 64];
    const [ox, oy] = toT(midX, front - half / 2);       // centro da elipse (em relação à âncora)
    const R = (half / 45) * 0.95;
    const poly = (phys === 'solido' || phys === 'tronco') && a.prof ? basePolygon(a, s, !!o.flip, phys === 'tronco') : null;
    if (poly) {
      // polígono da base medido no contorno do desenho (frente) e espelhado (fundo)
      const pts = poly.map(([X, Y]) => { const [tx, ty] = toT(X, Y); return [x + tx, y + ty]; });
      const c = polyCenter(pts);
      d.cx = c[0]; d.cy = c[1]; d.R = c[2];
      colliders.push({ t: 'p', pts, x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) });
    } else if (phys === 'solido') { d.cx = x + ox; d.cy = y + oy; d.R = R; colliders.push({ t: 'c', x: d.cx, y: d.cy, r: R }); }
    else if (phys === 'tronco') { const r0 = a.kind === 'estandarte' ? 0.16 : 0.26; const [tx, ty] = toT(midX, front - 6); d.cx = x + tx; d.cy = y + ty; d.R = r0; colliders.push({ t: 'c', x: d.cx, y: d.cy, r: r0 }); }
    if (phys === 'escada') {
      // quadrado do tamanho do sprite; degraus descem para +x; lado +y é bloco sólido; fundo é plataforma alta
      const S = (half * 2 / 64) * 0.95, st = STAIRS[key];
      const [fx, fy] = toT(midX, front); const cx = x + fx - S / 2, cy = y + fy - S / 2; d.cx = cx; d.cy = cy; d.S = S; d.R = S * 0.6;
      const hz = spr.h * st.h * 1.0;
      colliders.push({ t: 'b', x0: cx - S / 2, x1: cx + S / 2, y0: cy + S / 2 - S * st.side, y1: cy + S / 2 });          // bloco lateral
      colliders.push({ t: 'b', x0: cx - S / 2, x1: cx - S / 2 + S * 0.18, y0: cy - S / 2, y1: cy + S / 2 });              // parede do fundo
      colliders.push({ t: 'b', x0: cx - S / 2, x1: cx + S / 2, y0: cy - S / 2, y1: cy - S / 2 + S * 0.12 });              // borda de trás
      ramps.push({ x0: cx - S / 2, x1: cx + S / 2, y0: cy - S / 2, y1: cy + S / 2, xTop: cx - S / 2 + S * (1 - st.top), h: hz });
      d.ramp = ramps[ramps.length - 1];
    }
    if (phys === 'chao') d.flat = true;
    decos.push(d);
  };
  // borda: anel sólido (atrás 3 tiles, frente 2)
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (i < 3 || j < 3 || i >= W - 2 || j >= H - 2) solid[j * W + i] = true;
  const has = (k) => !!ART[k];
  const pick = (keys) => { const ok = keys.filter(has); return ok[(r() * ok.length) | 0]; };
  const nums = (p, list) => list.map((n) => `${p}-${n}`);
  // ---------------- composição ----------------
  // trilha principal: do acampamento (baixo) até o portal em ruínas (alto). Fica livre de peças grandes.
  const PATH = [[58, 60], [50, 51], [41, 46], [33, 38], [27, 28], [19, 19], [14, 13]];
  const distPath = (x, y) => { let d = 1e9; for (let k = 0; k < PATH.length - 1; k++) { const [ax, ay] = PATH[k], [bx, by] = PATH[k + 1], dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))); d = Math.min(d, Math.hypot(x - ax - dx * t, y - ay - dy * t)); } return d; };
  const busy = (x, y, pad = 1.2) => decos.some((d) => d.R > 0.4 && Math.hypot((d.cx ?? d.x) - x, (d.cy ?? d.y) - y) < d.R + pad);

  // 1) moldura: paredões ao fundo, picos nos cantos, rochedos baixos na frente (espaçamento irregular)
  const walls = ['paredao-1-1', 'paredao-3-1', 'paredao-4-1', 'paredao-5-1', 'paredao-6-1', 'paredao-7-1', 'paredao-2-1'];
  for (let k = 0; k * 7 < H + 4; k++) add(walls[k % walls.length], 1.6, k * 7 + 3.5, { z: -50 });
  for (let k = 0; k * 7 < W + 4; k++) add(walls[(k + 3) % walls.length], k * 7 + 3.5, 1.6, { flip: true, z: -50 });
  add('pico-2-1', 2.5, 2.5, { s: 1.15, z: -40 }); add('pico-1-1', 3, 36, { z: -30 }); add('pico-2-1', 38, 2.8, { z: -30 });
  const front = ['rochedo-7-1', 'rochedo-8-1', 'rochedo-9-1', 'rochedo-6-1', 'rochedo-1-1'];
  for (let t = 4, k = 0; t < H - 3; t += 7 + r() * 5, k++) add(front[k % 5], W - 1, t, { s: 0.8 + r() * 0.2 });
  for (let t = 4, k = 2; t < W - 3; t += 7 + r() * 5, k++) add(front[k % 5], t, H - 1, { s: 0.8 + r() * 0.2, flip: r() < 0.5 });

  // 2) ruínas: só no alto (portal + dois pilares e estandartes) e um marco no meio do caminho
  add('ruina-arco-1', 13, 9, { s: 1.15 });
  add('estandarte-1-1', 7.5, 10); add('estandarte-1-1', 17.5, 11);
  add('pilar-1-1', 8, 17); add('pilar-1-1', 20, 15, { s: 0.85 });
  add('ruina-pilares-2-1', 45, 23, { s: 0.85 });

  // 3) formações rochosas: paredes do cânion dos dois lados da trilha
  for (const [k, x, y, o] of [
    ['rochedo-4-1', 12, 33], ['pico-1-1', 8, 45, { s: 0.9 }], ['rochedo-5-1', 15, 53], ['rochedo-3-1', 22, 62, { flip: true }],
    ['rochedo-2-1', 34, 13], ['pico-2-1', 47, 9, { s: 0.85 }], ['rochedo-3-1', 56, 19], ['rochedo-5-1', 63, 31, { flip: true }], ['rochedo-4-1', 61, 45, { flip: true }],
    ['rochedo-6-1', 34, 24, { s: 0.75 }], ['rochedo-6-1', 54, 58, { s: 0.7, flip: true }], ['rochedo-1-1', 36, 58, { s: 0.8 }],
  ]) add(k, x, y, o);

  // 4) água: oásis ao lado da trilha e uma poça menor
  add('lago-2-1', 47, 37); add('lago-1-1', 24, 47, { s: 0.8 });

  // 5) árvores secas (uma por grupo, perto de rocha ou água) e troncos caídos
  for (const [k, x, y, o] of [['arvore-7-1', 51, 63], ['arvore-7-4', 52, 42], ['arvore-7-6', 42, 33], ['arvore-7-5', 21, 41], ['arvore-7-8', 30, 17],
    ['arvore-7-7', 61, 52], ['arvore-7-2', 16, 27], ['arvore-7-3', 26, 56], ['arvore-7-9', 29, 50, { phys: 'solido' }], ['arvore-7-10', 57, 27, { phys: 'solido' }]]) add(k, x, y, o);
  for (const [k, x, y] of [['pedras-1-3', 40, 27], ['pedras-1-5', 30, 44], ['pedras-1-7', 57, 49]]) add(k, x, y);

  // 6) vegetação em grupos (densa perto da água e na base das rochas, rala na areia aberta)
  const SECA = [...nums('grama-5', [1, 2, 3, 4, 5, 9, 10, 12, 14, 24, 25, 31, 36, 41, 42]), 'grama-1-1', 'grama-2-1', 'grama-3-1', 'grama-4-1'];
  const VERDE = [...nums('grama-5', [13, 18, 22, 26, 16, 17, 19, 20, 28, 29]), 'arbusto-1-1', 'arbusto-3-1'];
  const ARB = nums('arbusto-7', [1, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15]);
  const cluster = (keys, cx, cy, rad, n, o = {}) => {
    for (let t = 0, c = 0; t < n * 12 && c < n; t++) {
      const a = r() * Math.PI * 2, d = rad * Math.sqrt(r()), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (x < 4 || y < 4 || x > W - 3 || y > H - 3 || busy(x, y, 0.4) || (!o.path && distPath(x, y) < 1.4)) continue;
      add(pick(keys), x, y, { s: (o.s ?? 1) * (0.8 + r() * 0.4), flip: r() < 0.5, phys: o.phys }); c++;
    }
  };
  const ring = (keys, cx, cy, r0, r1, n) => { for (let t = 0, c = 0; t < n * 12 && c < n; t++) { const a = r() * Math.PI * 2, d = r0 + (r1 - r0) * r(); const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (busy(x, y, 0.3) || distPath(x, y) < 1.4) continue; add(pick(keys), x, y, { s: 0.8 + r() * 0.4, flip: r() < 0.5 }); c++; } };
  ring(VERDE, 47, 37, 3.6, 6.5, 26); ring(ARB, 47, 37, 4, 7, 5);       // oásis
  ring(VERDE, 24, 47, 2.6, 4.5, 12);
  for (const d of decos.filter((d) => /rochedo|pico|pedras|ruina|pilar/.test(d.key) && d.x > 4 && d.y > 4 && d.x < W - 2 && d.y < H - 2)) cluster([...SECA, ...ARB], d.cx ?? d.x, d.cy ?? d.y, (d.R || 1) + 2.5, 4);
  for (const d of decos.filter((d) => /arvore-7-[1-8]$/.test(d.key))) cluster(SECA, d.x, d.y, 2.2, 3);
  // areia aberta: tufos esparsos e algumas pedrinhas (passa por cima) e ossos
  for (let k = 0; k < 16; k++) cluster(SECA, 6 + r() * (W - 12), 6 + r() * (H - 12), 1.6, 2 + ((r() * 3) | 0));
  cluster(nums('pedras-1', [1, 4, 6, 8]), W / 2, H / 2, W * 0.45, 14, { s: 0.75, phys: 'chao' });
  cluster(['rochas-1', 'rochas-2', 'rochas-3', 'rochas-4', 'rochas-5', 'rochas-7'], W / 2, H / 2, W * 0.45, 12, { s: 0.55 });
  cluster(['ossos-1', 'ossos-6', 'itens-2-2', 'itens-2-3', 'ossos-5'], 40, 40, 22, 6, { path: true });
  // a escada do portal é caminhável (o anel da borda não a bloqueia)
  const solidAtC = (i, j) => colliders.some((c) => c.t === 'p' ? inPoly(c.pts, i + 0.5, j + 0.5) || distPoly(c.pts, i + 0.5, j + 0.5) < 0.3 : c.t === 'c' ? Math.hypot(i + 0.5 - c.x, j + 0.5 - c.y) < c.r + 0.3 : i + 0.5 > c.x0 - 0.3 && i + 0.5 < c.x1 + 0.3 && j + 0.5 > c.y0 - 0.3 && j + 0.5 < c.y1 + 0.3);
  // flores coletáveis
  const props = [];
  for (let t = 0, c = 0; t < 900 && c < 14; t++) {
    const i = 4 + ((r() * (W - 8)) | 0), j = 5 + ((r() * (H - 9)) | 0);
    if (solid[j * W + i] || solidAtC(i, j) || props.some((p) => Math.hypot(p.i - i, p.j - j) < 9)) continue;
    props.push({ i, j, kind: 'flor' }); c++;
  }
  const open = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!solid[j * W + i] && !solidAtC(i, j) && !ramps.some((r) => i + 0.5 > r.x0 && i + 0.5 < r.x1 && j + 0.5 > r.y0 && j + 0.5 < r.y1)) open.push({ x: i + 0.5, y: j + 0.5 });
  // saída: no alto da escada da ruína do arco
  const arco = decos.find((d) => d.key === 'ruina-arco-1').ramp;
  const ex = (arco.x0 + arco.xTop) / 2 + 0.4, ey = (arco.y0 + arco.y1) / 2 - 0.4;
  return {
    nome: 'Desfiladeiro do Sol', tema: 'grande', grande: true, recompensa: 'fim',
    ondas: [['g', 'g', 'g', 'g'], ['g', 'g', 'r', 'g', 'g'], ['r', 'r', 'g', 'g', 'g'], ['r', 'r', 'r', 'g', 'g', 'g']],
    tiles: [], path: PATH, w: W, h: H, floor, solid, walls: [], props, spawns: [], start: { x: 58.5, y: 60.5 }, door: { i: ex - 0.5, j: ey - 1.4 }, open, lago: null, ossos: [], decos, colliders, ramps,
  };
}

// chão: textura pintada repetida, recortada no losango do mapa
let pat = null;
// variação de tom do chão em grande escala (pintada uma vez): manchas de areia clara e escura,
// trilha gasta, chão úmido e escuro em volta da água e sombra ao pé das rochas
const TK = 0.25;
let toneFor = null, tone = null;
function buildTone(m) {
  const ox = m.h * 32, Wt = (m.w + m.h) * 32, Ht = (m.w + m.h) * 16;
  const c = document.createElement('canvas'); c.width = Math.ceil(Wt * TK); c.height = Math.ceil(Ht * TK);
  const g = c.getContext('2d'); g.scale(TK, TK);
  const S = (x, y) => [(x - y) * 32 + ox, (x + y) * 16];
  const r = rng(77);
  const blob = (x, y, rad, col) => { const [sx, sy] = S(x, y); g.save(); g.translate(sx, sy); g.scale(1, 0.5); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rad * 45); gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rad * 45, 0, 7); g.fill(); g.restore(); };
  for (let k = 0; k < 26; k++) blob(4 + r() * (m.w - 8), 4 + r() * (m.h - 8), 4 + r() * 7, r() < 0.5 ? 'rgba(95,32,10,0.22)' : 'rgba(255,205,140,0.16)');
  // trilha gasta: faixa larga mais clara e empoeirada, borda suave
  if (m.path) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, col] of [[150, 'rgba(255,214,160,0.10)'], [90, 'rgba(255,214,160,0.14)'], [40, 'rgba(240,190,130,0.12)']]) {
      g.filter = 'blur(18px)'; g.strokeStyle = col; g.lineWidth = w; g.beginPath();
      m.path.forEach(([x, y], i) => { const [sx, sy] = S(x, y); i ? g.lineTo(sx, sy) : g.moveTo(sx, sy); }); g.stroke();
    }
    g.filter = 'none';
  }
  for (const d of m.decos) {
    if (/lago/.test(d.key)) blob(d.cx ?? d.x, d.cy ?? d.y, (d.R || 2) + 4, 'rgba(70,40,15,0.32)');
    else if (d.R > 0.5 && !d.flat && d.phys !== 'mole') blob(d.cx ?? d.x, d.cy ?? d.y, d.R * 1.6 + 0.8, 'rgba(70,20,6,0.28)');
  }
  return c;
}
export function drawBigGround(ctx, W) {
  if (!pat) pat = ctx.createPattern(GROUND, 'repeat');
  const m = W.map, P = (x, y) => W.toScreen(x, y);
  pat.setTransform(new DOMMatrix().translate(-W.cam.x, -W.cam.y).scale(0.42));
  ctx.beginPath(); ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(m.w, 0)); ctx.lineTo(...P(m.w, m.h)); ctx.lineTo(...P(0, m.h)); ctx.closePath();
  ctx.fillStyle = pat; ctx.fill();
  if (toneFor !== m) { tone = buildTone(m); toneFor = m; }
  ctx.save(); ctx.clip();
  ctx.drawImage(tone, -m.h * 32 - W.cam.x, -W.cam.y, tone.width / TK, tone.height / TK);
  ctx.restore();
  // sombra suave ao pé dos paredões (cantos de trás)
  const g = ctx.createLinearGradient(...P(2, 2), ...P(8, 8));
  g.addColorStop(0, 'rgba(70,20,6,0.45)'); g.addColorStop(1, 'rgba(70,20,6,0)');
  ctx.fillStyle = g; ctx.fill();
}

// atualiza o balanço do capim/arbustos quando algo passa por dentro
export function updateDecos(W, dt, movers, time) {
  for (const d of W.map.decos) {
    if (d.phys !== 'mole') continue;
    for (const m of movers) {
      if (!m || m.alive === false) continue;
      const dx = m.x - d.x, dy = m.y - d.y, dist = Math.hypot(dx, dy), rr = 0.25 + d.spr.w / 180;
      if (dist < rr) {
        const vx = (m.x - (m._px ?? m.x)), vy = (m.y - (m._py ?? m.y));
        const push = ((vx - vy) / Math.max(dt, 1e-3)) * 0.05 + (dx - dy > 0 ? -1 : 1) * 0.6 * (1 - dist / rr);
        d.swayV += push * dt * 60;
      }
    }
    // mola + vento
    const wind = Math.sin(time * 1.7 + d.seed) * 0.03;
    d.swayV += (-(d.sway - wind) * 40 - d.swayV * 6) * dt;
    d.sway += d.swayV * dt;
    d.sway = Math.max(-0.55, Math.min(0.55, d.sway));
  }
  for (const m of movers) if (m) { m._px = m.x; m._py = m.y; }
}

// objetos baixos (pedrinhas, ossos): desenhados no chão, sob os pés
export function drawFlatDecos(ctx, W, vw, vh) {
  for (const d of W.map.decos) if (d.flat) drawDeco(ctx, W, d, vw, vh, 1);
}
function drawDeco(ctx, W, d, vw, vh, alpha) {
  const [sx, sy] = W.toScreen(d.x, d.y), s = d.spr;
  if (sx + s.w < -40 || sx - s.w > vw + 40 || sy - s.h > vh + 40 || sy + 60 < 0) return;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(sx, sy);
  if (d.sway) ctx.transform(1, 0, -d.sway, 1, 0, 0);       // inclina a partir da base
  if (d.flip) ctx.scale(-1, 1);
  ctx.drawImage(s.img, d.flip ? -(s.w - s.ax) : -s.ax, -s.ay, s.w, s.h);
  ctx.restore();
}
export function drawColliders(ctx, W) {
  ctx.save(); ctx.lineWidth = 1.5;
  const P = (x, y) => W.toScreen(x, y);
  for (const c of W.map.colliders) {
    ctx.strokeStyle = 'rgba(0,255,255,0.9)'; ctx.beginPath();
    if (c.t === 'p') { c.pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }
    else if (c.t === 'c') for (let a = 0; a <= 32; a++) { const [x, y] = P(c.x + Math.cos(a / 32 * 6.283) * c.r, c.y + Math.sin(a / 32 * 6.283) * c.r); a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    else { ctx.moveTo(...P(c.x0, c.y0)); ctx.lineTo(...P(c.x1, c.y0)); ctx.lineTo(...P(c.x1, c.y1)); ctx.lineTo(...P(c.x0, c.y1)); ctx.closePath(); }
    ctx.stroke();
  }
  for (const r of W.map.ramps) { ctx.strokeStyle = 'rgba(255,255,0,0.9)'; ctx.beginPath(); ctx.moveTo(...P(r.x0, r.y0)); ctx.lineTo(...P(r.x1, r.y0)); ctx.lineTo(...P(r.x1, r.y1)); ctx.lineTo(...P(r.x0, r.y1)); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(...P(r.xTop, r.y0)); ctx.lineTo(...P(r.xTop, r.y1)); ctx.stroke(); }
  ctx.restore();
}

// peças: entram na ordenação por profundidade junto com o herói
export function pushDecos(list, W, ctx, hero, vw, vh) {
  const [hsx, hsy] = W.toScreen(hero.x, hero.y);
  for (const d of W.map.decos) {
    if (d.flat) continue;
    const key = (d.cx ?? d.x) + (d.cy ?? d.y) + (d.R ? d.R * 0.35 : 0) + (d.z || 0) / 100;
    list.push({ key, draw: () => {
      const [sx, sy] = W.toScreen(d.x, d.y), s = d.spr;
      // herói atrás de peça alta → peça translúcida
      const behind = d.tall && !(d.ramp && (hero.z || 0) > 4) && key > hero.x + hero.y && hsx > sx - s.ax && hsx < sx - s.ax + s.w && hsy < sy && hsy > sy - s.ay;
      drawDeco(ctx, W, d, vw, vh, behind ? 0.45 : 1);
    } });
  }
}

// altura do chão (escadas) e colisão com as peças
export function groundHeight(map, x, y) {
  for (const r of map.ramps || []) {
    if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
    if (x <= r.xTop) return r.h;
    return r.h * (r.x1 - x) / (r.x1 - r.xTop);
  }
  return 0;
}
export function hitsCollider(map, x, y, rad) {
  for (const c of map.colliders || []) {
    if (c.t === 'c') { if (Math.hypot(x - c.x, y - c.y) < c.r + rad) return true; }
    else if (c.t === 'p') { if (x > c.x0 - rad && x < c.x1 + rad && y > c.y0 - rad && y < c.y1 + rad && (inPoly(c.pts, x, y) || distPoly(c.pts, x, y) < rad)) return true; }
    else if (x > c.x0 - rad && x < c.x1 + rad && y > c.y0 - rad && y < c.y1 + rad) return true;
  }
  return false;
}
