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
  const W = 42, H = 42, r = rng(1234);
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
  // paredões nas bordas de trás (x = 0: original; y = 0: espelhado)
  const walls = ['paredao-1-1', 'paredao-3-1', 'paredao-4-1', 'paredao-5-1', 'paredao-6-1', 'paredao-7-1', 'paredao-2-1'];
  for (let k = 0; k * 7 < H + 4; k++) add(walls[k % walls.length], 1.6, k * 7 + 3.5, { z: -50 });
  for (let k = 0; k * 7 < W + 4; k++) add(walls[(k + 3) % walls.length], k * 7 + 3.5, 1.6, { flip: true, z: -50 });
  // cantos e picos
  add('pico-2-1', 2.5, 2.5, { s: 1.15, z: -40 }); add('pico-1-1', 3, 22, { z: -30 }); add('pico-2-1', 23, 2.8, { z: -30 });
  // frente: rochedos baixos na borda (ficam translúcidos quando o herói passa atrás)
  const front = ['rochedo-7-1', 'rochedo-8-1', 'rochedo-9-1', 'rochedo-6-1', 'rochedo-1-1'];
  for (let k = 0; k < 7; k++) add(front[k % 5], W - 1, 4 + k * 6 + r() * 2, { s: 0.85, r: 0 });
  for (let k = 0; k < 7; k++) add(front[(k + 2) % 5], 4 + k * 6 + r() * 2, H - 1, { s: 0.85, r: 0 });

  // pontos de interesse
  add('ruina-arco-1', 22, 10.5, { s: 1.1 });                    // saída (portal)
  add('estandarte-1-1', 16.5, 11.5); add('estandarte-1-1', 26.5, 12.5);
  add('ruina-pilares-1-1', 9, 9); add('ruina-escada-1', 33, 9, { s: 0.95 }); add('ruina-pilares-2-1', 36, 22, { s: 0.9 });
  add('pilar-1-1', 14, 14); add('pilar-1-1', 28, 14);
  add('lago-2-1', 28, 25); add('lago-1-1', 10, 30, { s: 0.9 });
  add('rochedo-4-1', 7, 18); add('rochedo-5-1', 17, 33); add('rochedo-3-1', 35, 33); add('rochedo-2-1', 22, 18, { s: 0.75 });
  add('rochedo-6-1', 32, 16, { s: 0.7 }); add('pico-1-1', 6, 37, { s: 0.8 });
  for (const [k, x, y] of [['arvore-5-1', 15, 24], ['arvore-6-1', 30, 31], ['arvore-1-1', 5, 12], ['arvore-4-1', 24, 37], ['arvore-3-1', 37, 12], ['arvore-2-1', 12, 37]]) add(k, x, y);
  // vegetação, pedras e ossos espalhados (longe dos pontos de interesse)
  const busy = (x, y) => decos.some((d) => d.R > 0.4 && Math.hypot((d.cx ?? d.x) - x, (d.cy ?? d.y) - y) < d.R + 1.2);
  const fill = (keys, n, minD = 0, sc = 1, phys) => { for (let t = 0, c = 0; t < n * 20 && c < n; t++) { const x = 4 + r() * (W - 7), y = 4 + r() * (H - 7); if (busy(x, y) || Math.hypot(x - 21, y - 21) < minD) continue; add(keys[(r() * keys.length) | 0], x, y, { s: (0.8 + r() * 0.4) * sc, flip: r() < 0.5, phys }); c++; } };
  fill(['grama-1-1', 'grama-2-1', 'grama-3-1', 'grama-4-1', 'itens-1-2'], 70);
  fill(['arbusto-1-1', 'arbusto-2-1', 'arbusto-3-1', 'arbusto-4-1', 'arbusto-5-1', 'arbusto-6-1', 'itens-1-4'], 22);
  fill(['rochas-1', 'rochas-2', 'rochas-3', 'rochas-4', 'rochas-5', 'rochas-6', 'rochas-7', 'rochas-8', 'rochas-9', 'rochas-10', 'itens-1-3'], 30, 4, 0.55);
  // algumas pedras maiores (sólidas)
  for (const [k, x, y] of [['rochas-1', 13, 20], ['rochas-6', 26, 29], ['rochas-8', 31, 37], ['rochas-2', 9, 25]]) add(k, x, y, { s: 1.4, phys: 'solido' });
  // peças novas: árvores secas, arbustos, plantas rasteiras e pedras
  for (const [k, x, y, o] of [['arvore-7-1', 19, 27], ['arvore-7-3', 8, 22], ['arvore-7-4', 34, 27], ['arvore-7-5', 26, 6.5], ['arvore-7-6', 38, 19], ['arvore-7-7', 5.5, 27],
    ['arvore-7-8', 17, 7], ['arvore-7-2', 30, 37], ['arvore-7-9', 20, 36, { phys: 'solido' }], ['arvore-7-10', 37, 37, { phys: 'solido' }], ['arvore-7-11', 9, 16, { phys: 'mole' }]]) add(k, x, y, o);
  for (const [k, x, y] of [['pedras-1-3', 26, 16], ['pedras-1-5', 14, 29], ['pedras-1-7', 31, 21], ['pedras-1-2', 17, 15]]) add(k, x, y);
  const nums = (p, n) => Array.from({ length: n }, (_, i) => `${p}-${i + 1}`);
  fill(nums('arbusto-7', 22), 22);
  fill(nums('grama-5', 42), 38);
  fill(['pedras-1-1', 'pedras-1-4', 'pedras-1-6', 'pedras-1-8'], 10, 4, 0.8, 'chao');
  fill(['ossos-1', 'ossos-6', 'itens-2-2', 'itens-2-3', 'itens-2-4', 'ossos-5'], 9, 5);
  // a escada do portal é caminhável (o anel da borda não a bloqueia)
  const solidAtC = (i, j) => colliders.some((c) => c.t === 'p' ? inPoly(c.pts, i + 0.5, j + 0.5) || distPoly(c.pts, i + 0.5, j + 0.5) < 0.3 : c.t === 'c' ? Math.hypot(i + 0.5 - c.x, j + 0.5 - c.y) < c.r + 0.3 : i + 0.5 > c.x0 - 0.3 && i + 0.5 < c.x1 + 0.3 && j + 0.5 > c.y0 - 0.3 && j + 0.5 < c.y1 + 0.3);
  // flores coletáveis
  const props = [];
  for (let t = 0, c = 0; t < 400 && c < 10; t++) {
    const i = 4 + ((r() * (W - 8)) | 0), j = 5 + ((r() * (H - 9)) | 0);
    if (solid[j * W + i] || solidAtC(i, j) || props.some((p) => Math.hypot(p.i - i, p.j - j) < 5)) continue;
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
    tiles: [], w: W, h: H, floor, solid, walls: [], props, spawns: [], start: { x: 21, y: 30 }, door: { i: ex - 0.5, j: ey - 1.4 }, open, lago: null, ossos: [], decos, colliders, ramps,
  };
}

// chão: textura pintada repetida, recortada no losango do mapa
let pat = null;
export function drawBigGround(ctx, W) {
  if (!pat) pat = ctx.createPattern(GROUND, 'repeat');
  const m = W.map, P = (x, y) => W.toScreen(x, y);
  pat.setTransform(new DOMMatrix().translate(-W.cam.x, -W.cam.y).scale(0.42));
  ctx.beginPath(); ctx.moveTo(...P(0, 0)); ctx.lineTo(...P(m.w, 0)); ctx.lineTo(...P(m.w, m.h)); ctx.lineTo(...P(0, m.h)); ctx.closePath();
  ctx.fillStyle = pat; ctx.fill();
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
