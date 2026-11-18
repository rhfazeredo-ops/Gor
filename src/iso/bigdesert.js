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
  flores: { s: 0.09 }, rochas: { s: 0.14, r: 0.5 }, ossos: { s: 0.12 }, estandarte: { s: 0.13, r: 0.3 }, pilar: { s: 0.15, r: 0.5 },
};
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
  const a = ART[key], k = s ?? KIND[a.kind]?.s ?? 0.15;
  return { img: a.img, w: a.w * k, h: a.h * k, ax: a.ax * k, ay: a.ay * k };
}

// --------------------------- o mapa ---------------------------
export function buildBigDesert() {
  const W = 42, H = 42, r = rng(1234);
  const floor = new Array(W * H).fill('areia'), solid = new Array(W * H).fill(false);
  const decos = [];
  const add = (key, x, y, o = {}) => {
    const a = ART[key]; if (!a) return;
    const k = KIND[a.kind] || {}, s = (o.s ?? 1) * (k.s ?? 0.15);
    decos.push({ key, x, y, flip: !!o.flip, spr: { img: a.img, w: a.w * s, h: a.h * s, ax: (o.flip ? a.w - a.ax : a.ax) * s, ay: a.ay * s }, tall: a.h * s > 70, r: o.r ?? k.r ?? 0, z: o.z ?? 0 });
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
  add('ruina-arco-1', 21, 6.5, { s: 1.1 });                     // saída (portal)
  add('estandarte-1-1', 17.5, 8.5); add('estandarte-1-1', 25.5, 8.5);
  add('ruina-pilares-1-1', 9, 9); add('ruina-escada-1', 33, 9, { s: 0.95 }); add('ruina-pilares-2-1', 36, 22, { s: 0.9 });
  add('pilar-1-1', 14, 14); add('pilar-1-1', 28, 14);
  add('lago-2-1', 28, 25); add('lago-1-1', 10, 30, { s: 0.9 });
  add('rochedo-4-1', 7, 18); add('rochedo-5-1', 17, 33); add('rochedo-3-1', 35, 33); add('rochedo-2-1', 22, 18, { s: 0.75 });
  add('rochedo-6-1', 32, 16, { s: 0.7 }); add('pico-1-1', 6, 37, { s: 0.8 });
  for (const [k, x, y] of [['arvore-5-1', 15, 24], ['arvore-6-1', 30, 31], ['arvore-1-1', 5, 12], ['arvore-4-1', 24, 37], ['arvore-3-1', 37, 12], ['arvore-2-1', 12, 37]]) add(k, x, y);
  // vegetação, pedras e ossos espalhados (longe dos pontos de interesse)
  const busy = (x, y) => decos.some((d) => d.r > 0.4 && Math.hypot(d.x - x, d.y - y) < d.r + 1.6);
  const fill = (keys, n, minD = 0) => { for (let t = 0, c = 0; t < n * 20 && c < n; t++) { const x = 4 + r() * (W - 7), y = 4 + r() * (H - 7); if (busy(x, y) || Math.hypot(x - 21, y - 21) < minD) continue; add(keys[(r() * keys.length) | 0], x, y, { s: 0.8 + r() * 0.4, flip: r() < 0.5 }); c++; } };
  fill(['grama-1-1', 'grama-2-1', 'grama-3-1', 'grama-4-1', 'itens-1-2'], 70);
  fill(['arbusto-1-1', 'arbusto-2-1', 'arbusto-3-1', 'arbusto-4-1', 'arbusto-5-1', 'arbusto-6-1', 'itens-1-4'], 22);
  fill(['rochas-1', 'rochas-2', 'rochas-3', 'rochas-4', 'rochas-5', 'rochas-6', 'rochas-7', 'rochas-8', 'rochas-9', 'rochas-10', 'itens-1-3'], 26, 4);
  fill(['ossos-1', 'ossos-6', 'itens-2-2', 'itens-2-3', 'itens-2-4', 'ossos-5'], 9, 5);
  // colisão das peças grandes
  for (const d of decos) if (d.r > 0) for (let j = Math.floor(d.y - d.r); j <= d.y + d.r; j++) for (let i = Math.floor(d.x - d.r); i <= d.x + d.r; i++) {
    if (i < 0 || j < 0 || i >= W || j >= H) continue;
    if (Math.hypot(i + 0.5 - d.x, (j + 0.5 - d.y) * 1.1) < d.r) solid[j * W + i] = true;
  }
  // a escada do portal é caminhável
  for (let j = 7; j <= 9; j++) for (let i = 20; i <= 23; i++) solid[j * W + i] = false;
  // flores coletáveis
  const props = [];
  for (let t = 0, c = 0; t < 400 && c < 10; t++) {
    const i = 4 + ((r() * (W - 8)) | 0), j = 5 + ((r() * (H - 9)) | 0);
    if (solid[j * W + i] || props.some((p) => Math.hypot(p.i - i, p.j - j) < 5)) continue;
    props.push({ i, j, kind: 'flor' }); c++;
  }
  const open = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!solid[j * W + i]) open.push({ x: i + 0.5, y: j + 0.5 });
  return {
    nome: 'Desfiladeiro do Sol', tema: 'grande', grande: true, recompensa: 'fim',
    ondas: [['g', 'g', 'g', 'g'], ['g', 'g', 'r', 'g', 'g'], ['r', 'r', 'g', 'g', 'g'], ['r', 'r', 'r', 'g', 'g', 'g']],
    tiles: [], w: W, h: H, floor, solid, walls: [], props, spawns: [], start: { x: 21, y: 30 }, door: { i: 21, j: 7 }, open, lago: null, ossos: [], decos,
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

// peças: entram na ordenação por profundidade junto com o herói
export function pushDecos(list, W, ctx, hero, vw, vh) {
  const [hsx, hsy] = W.toScreen(hero.x, hero.y);
  for (const d of W.map.decos) list.push({
    key: d.x + d.y + (d.z || 0) / 100,
    draw: () => {
      const [sx, sy] = W.toScreen(d.x, d.y), s = d.spr;
      if (sx + s.w < -40 || sx - s.w > vw + 40 || sy - s.h > vh + 40 || sy + 60 < 0) return;
      // herói atrás de peça alta → peça translúcida
      const behind = d.tall && d.x + d.y > hero.x + hero.y && hsx > sx - s.ax && hsx < sx - s.ax + s.w && hsy < sy && hsy > sy - s.ay;
      if (behind) ctx.globalAlpha = 0.45;
      if (d.flip) { ctx.save(); ctx.translate(sx, sy); ctx.scale(-1, 1); ctx.drawImage(s.img, -(s.w - s.ax), -s.ay, s.w, s.h); ctx.restore(); }
      else ctx.drawImage(s.img, sx - s.ax, sy - s.ay, s.w, s.h);
      ctx.globalAlpha = 1;
    },
  });
}
