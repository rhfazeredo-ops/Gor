// =====================================================================
// Arte em pixel art feita por código: tiles isométricos (64x32), blocos
// de parede, objetos do cenário e monstros. Tudo é desenhado pixel a
// pixel num canvas pequeno e depois usado como imagem.
// Quando chegarem os mapas/arte finais, é só trocar estas imagens.
// =====================================================================
export const TW = 64, TH = 32;           // tamanho do losango do chão
export const WALL_H = 40;                // altura dos blocos de parede

const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const shade = (c, k) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const put = (x, y, col, a = 255) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4; img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = a;
  };
  const get = (x, y) => { const i = (y * w + x) * 4; return img.data[i + 3] ? [img.data[i], img.data[i + 1], img.data[i + 2]] : null; };
  const done = () => { ctx.putImageData(img, 0, 0); return c; };
  return { c, put, get, done, w, h };
}

// dentro do losango (x,y relativos ao canto do tile)
const inDiamond = (x, y) => Math.abs(x + 0.5 - TW / 2) / (TW / 2) + Math.abs(y + 0.5 - TH / 2) / (TH / 2) <= 1;

// ---------------- chão ----------------
function floorTile(kind, seed) {
  const r = rng(seed * 7919 + 13);
  const t = canvas(TW, TH);
  const P = {
    pedra: { base: hex(0x6e6676), dark: hex(0x4f4858), light: hex(0x8a8292) },
    grama: { base: hex(0x4f7a3a), dark: hex(0x3b5e2c), light: hex(0x6e9a48) },
    terra: { base: hex(0x7a5a3e), dark: hex(0x5e4430), light: hex(0x93704e) },
    madeira: { base: hex(0x7a4e2e), dark: hex(0x5a3820), light: hex(0x946240) },
  }[kind];
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    if (!inDiamond(x, y)) continue;
    let c = P.base;
    const n = r();
    if (n < 0.12) c = P.dark; else if (n > 0.9) c = P.light;
    if (kind === 'pedra') {
      // lajotas: linhas em coordenadas isométricas
      const u = (x / 2 + y), v = (y - x / 2);
      const su = ((u + 64) % 16), sv = ((v + 64 + (Math.floor((u + 64) / 16) % 2) * 8) % 16);
      if (su < 1 || sv < 1) c = shade(P.dark, 0.85);
      else if (su < 2 || sv < 2) c = P.light;
    }
    if (kind === 'madeira') {
      const u = (x / 2 + y);
      if ((u + 64) % 8 < 1) c = P.dark;
    }
    t.put(x, y, c);
  }
  if (kind === 'grama') for (let k = 0; k < 14; k++) {
    const x = 6 + r() * (TW - 12), y = 4 + r() * (TH - 8);
    if (!inDiamond(x, y)) continue;
    t.put(x, y, P.light); t.put(x, y - 1, P.light); t.put(x + 1, y - 2, hex(0x8ab85a));
  }
  if (kind === 'pedra' && r() < 0.3) for (let k = 0; k < 6; k++) {
    const x = 10 + r() * 44, y = 6 + r() * 20;
    if (inDiamond(x, y)) t.put(x, y, hex(0x5a7a40));
  }
  return t.done();
}

// ---------------- bloco de parede (losango em cima + 2 faces) ----------------
function wallBlock(seed, kind = 'pedra') {
  const r = rng(seed * 31 + 7);
  const t = canvas(TW, TH + WALL_H);
  const top = kind === 'madeira' ? hex(0x8a5a36) : hex(0x8e8696);
  const left = kind === 'madeira' ? hex(0x6a4228) : hex(0x6c6474);
  const right = kind === 'madeira' ? hex(0x52321e) : hex(0x544c5c);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) if (inDiamond(x, y)) t.put(x, y, r() < 0.15 ? shade(top, 0.9) : top);
  for (let x = 0; x < TW; x++) {
    const yTop = x < TW / 2 ? TH / 2 + x / 2 : TH / 2 + (TW - x) / 2;
    const isLeft = x < TW / 2;
    for (let y = Math.floor(yTop); y < yTop + WALL_H; y++) {
      let c = isLeft ? left : right;
      const yy = y - yTop;
      // tijolos
      const row = Math.floor(yy / 8);
      const off = (row % 2) * 8;
      const xx = isLeft ? x : TW - x;
      if (kind !== 'madeira') {
        if (yy % 8 < 1 || (xx + off) % 16 < 1) c = shade(c, 0.72);
        else if (r() < 0.1) c = shade(c, 0.9);
      } else if ((xx) % 10 < 1) c = shade(c, 0.75);
      t.put(x, y, c);
    }
  }
  // borda clara no topo
  for (let x = 0; x < TW; x++) { const y = x < TW / 2 ? TH / 2 - x / 2 : TH / 2 - (TW - x) / 2; t.put(x, Math.round(y), shade(top, 1.15)); }
  return t.done();
}

// ---------------- objetos ----------------
function pillar() {
  const t = canvas(40, 104);
  const base = hex(0x847c8c), dark = hex(0x5c5464), light = hex(0xa8a0b0);
  for (let y = 0; y < 104; y++) {
    const w = y < 10 ? 15 : y > 92 ? 17 : 11;
    for (let x = -w; x <= w; x++) {
      const k = x / w;
      let c = k < -0.4 ? light : k > 0.45 ? dark : base;
      if (y > 10 && y < 92 && Math.abs(x) % 5 === 0 && x !== 0) c = shade(c, 0.85);
      t.put(20 + x, y, c);
    }
  }
  return { img: t.done(), ax: 20, ay: 98 };
}
function torch() {
  const t = canvas(16, 44);
  const wood = hex(0x5a3a22), gold = hex(0xd99a30);
  for (let y = 12; y < 44; y++) for (let x = 6; x < 10; x++) t.put(x, y, x < 8 ? wood : shade(wood, 0.7));
  for (let x = 4; x < 12; x++) { t.put(x, 12, gold); t.put(x, 13, shade(gold, 0.8)); }
  return { img: t.done(), ax: 8, ay: 42, flame: { x: 8, y: 9 } };
}
function barrel(seed) {
  const r = rng(seed);
  const t = canvas(28, 34);
  const wood = hex(0x8a5a32), dark = hex(0x5e3c22), band = hex(0x4a4450);
  for (let y = 4; y < 32; y++) {
    const w = 10 + Math.round(Math.sin((y - 4) / 28 * Math.PI) * 3);
    for (let x = -w; x <= w; x++) {
      let c = x < -w * 0.4 ? shade(wood, 1.15) : x > w * 0.5 ? dark : wood;
      if (Math.abs(x) % 6 === 0) c = shade(c, 0.85);
      if (y === 9 || y === 10 || y === 26 || y === 27) c = band;
      t.put(14 + x, y, c);
    }
  }
  for (let y = 0; y < 8; y++) for (let x = -10; x <= 10; x++) if ((x * x) / 100 + ((y - 4) ** 2) / 16 <= 1) t.put(14 + x, y + 1, (x + y) % 5 === 0 ? dark : shade(wood, 1.05 + r() * 0.05));
  return { img: t.done(), ax: 14, ay: 31 };
}
function crate() {
  const t = canvas(36, 38);
  const top = hex(0xa47448), left = hex(0x8a5e38), right = hex(0x6a462a), edge = hex(0x4a3020);
  for (let y = 0; y < 18; y++) for (let x = 0; x < 36; x++) if (Math.abs(x - 17.5) / 18 + Math.abs(y - 8.5) / 9 <= 1) t.put(x, y, top);
  for (let x = 0; x < 36; x++) {
    const yTop = x < 18 ? 9 + x / 2 : 9 + (36 - x) / 2;
    for (let y = Math.floor(yTop); y < yTop + 20; y++) {
      let c = x < 18 ? left : right;
      if (x === 0 || x === 35 || x === 17 || x === 18 || y >= yTop + 18 || y < yTop + 2) c = edge;
      else if (Math.abs((x < 18 ? x : 36 - x) - (y - yTop)) < 1.2) c = edge;
      t.put(x, y, c);
    }
  }
  return { img: t.done(), ax: 18, ay: 35 };
}
function tree(seed) {
  const r = rng(seed);
  const t = canvas(64, 96);
  const trunk = hex(0x5a3a24);
  for (let y = 66; y < 92; y++) for (let x = 28; x < 36; x++) t.put(x, y, x < 31 ? shade(trunk, 1.2) : trunk);
  const greens = [hex(0x2e5a2a), hex(0x3c7034), hex(0x4e8a3e), hex(0x6aa64c)];
  for (let layer = 0; layer < 3; layer++) {
    const cy = 26 + layer * 16, rad = 16 + layer * 6;
    for (let y = -rad; y <= rad * 0.7; y++) for (let x = -rad - 4; x <= rad + 4; x++) {
      const d = (x * x) / ((rad + 4) ** 2) + (y * y) / (rad * rad);
      if (d > 1 - r() * 0.12) continue;
      const lit = (-x * 0.6 - y) / rad;
      const gi = Math.max(0, Math.min(3, Math.round(1.4 + lit * 1.4 + (r() - 0.5) * 0.8)));
      t.put(32 + x, cy + y, greens[gi]);
    }
  }
  return { img: t.done(), ax: 32, ay: 90 };
}
function dummy() {
  const t = canvas(30, 56);
  const wood = hex(0x6a4428), straw = hex(0xc8a050), sd = hex(0x9a7a38), rope = hex(0x4a3420);
  for (let y = 20; y < 54; y++) for (let x = 13; x < 17; x++) t.put(x, y, wood);
  for (let x = 2; x < 28; x++) for (let y = 22; y < 25; y++) t.put(x, y, wood);
  for (let y = 18; y < 44; y++) for (let x = -7; x <= 7; x++) {
    if (Math.abs(x) > 7 - Math.max(0, (y - 38) * 0.8)) continue;
    let c = x > 3 ? sd : straw;
    if (y === 26 || y === 34) c = rope;
    t.put(15 + x, y, c);
  }
  for (let y = 6; y < 19; y++) for (let x = -6; x <= 6; x++) if (x * x + (y - 12) ** 2 <= 36) t.put(15 + x, y, x > 2 ? sd : straw);
  return { img: t.done(), ax: 15, ay: 53 };
}
function banner() {
  const t = canvas(24, 60);
  const pole = hex(0x5a3a22), blue = hex(0x2a3c92), gold = hex(0xdc9a30);
  for (let y = 0; y < 60; y++) { t.put(11, y, pole); t.put(12, y, shade(pole, 0.8)); }
  for (let y = 4; y < 40; y++) for (let x = 2; x < 22; x++) {
    if (y > 34 && Math.abs(x - 12) < (y - 34) * 2) continue;
    let c = x < 4 || x > 19 ? gold : blue;
    if ((x === 11 || x === 12) && y > 10 && y < 30) c = gold;
    if (y >= 16 && y <= 17 && x > 6 && x < 17) c = gold;
    t.put(x, y, c);
  }
  return { img: t.done(), ax: 12, ay: 58 };
}

// ---------------- monstros: gosmas (simétricas, sem direção) ----------------
// devolve quadros: 4 de pulo + 1 de golpe + 1 de dano
export function slimeFrames(color, size = 1) {
  const base = hex(color), dark = shade(base, 0.6), light = mix(base, [255, 255, 255], 0.45), outline = [26, 16, 32];
  const W = Math.round(40 * size), H = Math.round(40 * size);
  const frames = [];
  const shapes = [[1, 1], [1.12, 0.86], [0.92, 1.12], [1, 1], [1.3, 0.7], [1.05, 0.95]];
  shapes.forEach(([sx, sy], fi) => {
    const t = canvas(W, H);
    const rx = 13 * size * sx, ry = 11 * size * sy;
    const cx = W / 2, cy = H - 2 - ry;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + (dy < 0 ? dy * dy : dy * dy * 1.6);
      if (d > 1) continue;
      let c = base;
      if (dy > 0.45 || dx > 0.6) c = dark;
      if (dx < -0.2 && dy < -0.35 && dx > -0.65) c = light;
      if (fi === 5) c = mix(c, [255, 255, 255], 0.6);
      t.put(x, y, c);
    }
    // olhos
    const ey = Math.round(cy - ry * 0.15), ex = Math.round(4 * size * sx);
    for (const s of [-1, 1]) for (let k = 0; k < Math.max(2, 3 * size); k++) { t.put(cx + s * ex, ey + k - 1, [20, 14, 24]); t.put(cx + s * ex - 1, ey + k - 1, [20, 14, 24]); }
    for (const s of [-1, 1]) t.put(cx + s * ex - 1, ey - 1, [255, 255, 255]);
    // contorno
    const solid = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) solid.push(!!t.get(x, y));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (solid[y * W + x]) continue;
      if ((x > 0 && solid[y * W + x - 1]) || (x < W - 1 && solid[y * W + x + 1]) || (y > 0 && solid[(y - 1) * W + x]) || (y < H - 1 && solid[(y + 1) * W + x])) t.put(x, y, outline);
    }
    frames.push(t.done());
  });
  return { frames, ax: W / 2, ay: H - 2 };
}

export function buildArt() {
  const floors = {};
  for (const k of ['pedra', 'grama', 'terra', 'madeira']) floors[k] = [0, 1, 2, 3].map((s) => floorTile(k, s + k.length * 10));
  return {
    floors,
    walls: [0, 1, 2].map((s) => wallBlock(s)),
    wallsWood: [0, 1].map((s) => wallBlock(s, 'madeira')),
    props: {
      pilar: pillar(), tocha: torch(), barril: barrel(3), caixa: crate(), arvore: tree(5), arvore2: tree(9),
      boneco: dummy(), estandarte: banner(),
    },
    slimes: {
      verde: slimeFrames(0x5ab84a, 1),
      roxa: slimeFrames(0x9a4ad0, 1.5),
    },
  };
}
