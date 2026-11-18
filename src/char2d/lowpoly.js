import * as THREE from 'three';

// =====================================================================
// "Tinta low-poly" em Canvas 2D: desenha personagens facetados, peça por
// peça, presos aos ossos do esqueleto animado. Sem imagens e sem WebGL.
//   - cada peça é um sólido simples (caixa afunilada, prisma, losango...)
//     definido no espaço do osso;
//   - a cada quadro: ossos → mundo → tela (câmera isométrica 30°);
//   - faces de costas são descartadas, as outras pintadas com luz chapada
//     (uma cor por face, como no concept), do fundo para a frente;
//   - contorno escuro em volta da silhueta.
// =====================================================================
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- sólidos ----------
// caixa afunilada: base w0 x d0, topo w0*top x d0*topD, altura h (centrada)
export function box(w, h, d, { top = 1, topD = top, shiftTop = [0, 0] } = {}) {
  const b = -h / 2, t = h / 2;
  const v = [
    V(-w / 2, b, -d / 2), V(w / 2, b, -d / 2), V(w / 2, b, d / 2), V(-w / 2, b, d / 2),
    V(-w / 2 * top + shiftTop[0], t, -d / 2 * topD + shiftTop[1]), V(w / 2 * top + shiftTop[0], t, -d / 2 * topD + shiftTop[1]),
    V(w / 2 * top + shiftTop[0], t, d / 2 * topD + shiftTop[1]), V(-w / 2 * top + shiftTop[0], t, d / 2 * topD + shiftTop[1]),
  ];
  const f = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  return { v, f };
}
// prisma de n lados ao longo de Y (r0 embaixo, r1 em cima)
export function prism(n, r0, r1, h, { rz = 1 } = {}) {
  const v = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n; v.push(V(Math.cos(a) * r0, -h / 2, Math.sin(a) * r0 * rz)); }
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n; v.push(V(Math.cos(a) * r1, h / 2, Math.sin(a) * r1 * rz)); }
  const f = [[...Array(n).keys()].reverse(), [...Array(n).keys()].map((i) => i + n)];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; f.push([i, j, j + n, i + n]); }
  return { v, f };
}
// losango (octaedro) com raios rx, ry, rz
export function gem(rx, ry, rz) {
  const v = [V(rx, 0, 0), V(-rx, 0, 0), V(0, ry, 0), V(0, -ry, 0), V(0, 0, rz), V(0, 0, -rz)];
  const f = [[2, 4, 0], [2, 0, 5], [2, 5, 1], [2, 1, 4], [3, 0, 4], [3, 5, 0], [3, 1, 5], [3, 4, 1]];
  return { v, f };
}
// pirâmide (ponta para +Y)
export function spike(n, r, h) {
  const v = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; v.push(V(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  v.push(V(0, h, 0));
  const f = [[...Array(n).keys()].reverse()];
  for (let i = 0; i < n; i++) f.push([i, (i + 1) % n, n]);
  return { v, f };
}

// posiciona um sólido dentro do osso
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3();
export function place(shape, color, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], tag } = {}) {
  M.compose(V(...p), Q.setFromEuler(E.set(...r)), S.set(...s));
  const v = shape.v.map((x) => x.clone().applyMatrix4(M));
  const c = v.reduce((a, b) => a.add(b), V(0, 0, 0)).multiplyScalar(1 / v.length);
  return { v, f: shape.f, color: new THREE.Color(color), center: c, tag };
}

// ---------- renderização ----------
export class LowPolyPainter {
  constructor({ width, height, ppu, feetY, elevDeg = 30 }) {
    this.W = width; this.H = height; this.ppu = ppu; this.feetY = feetY;
    const el = THREE.MathUtils.degToRad(elevDeg);
    this.view = V(0, -Math.sin(el), -Math.cos(el));          // direção para onde a câmera olha
    this.right = V(1, 0, 0);
    this.up = V(0, Math.cos(el), -Math.sin(el));
    this.light = V(-0.55, 0.85, 0.45).normalize();            // luz de cima, da esquerda, de frente
    this.canvas = document.createElement('canvas'); this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.tmp = document.createElement('canvas'); this.tmp.width = width; this.tmp.height = height;
  }

  project(p) { return [this.W / 2 + p.dot(this.right) * this.ppu, this.feetY - p.dot(this.up) * this.ppu, p.dot(this.view)]; }

  // parts: [{ bone: Object3D, solids: [...] }]
  render(parts, { outline = '#1a1020', outlinePx = 2, rootMatrix = null } = {}) {
    const faces = [];
    const w = V(0, 0, 0), n = V(0, 0, 0), a = V(0, 0, 0), b = V(0, 0, 0), fc = V(0, 0, 0);
    for (const part of parts) {
      part.bone.updateWorldMatrix(true, false);
      const mw = part.bone.matrixWorld;
      for (const s of part.solids) {
        const wv = s.v.map((x) => x.clone().applyMatrix4(mw));
        const wc = s.center.clone().applyMatrix4(mw);
        const pv = wv.map((x) => this.project(x));
        for (const f of s.f) {
          // normal (Newell) orientada para fora do sólido
          n.set(0, 0, 0);
          for (let i = 0; i < f.length; i++) {
            const p = wv[f[i]], q = wv[f[(i + 1) % f.length]];
            n.x += (p.y - q.y) * (p.z + q.z); n.y += (p.z - q.z) * (p.x + q.x); n.z += (p.x - q.x) * (p.y + q.y);
          }
          if (n.lengthSq() < 1e-12) continue;
          n.normalize();
          fc.set(0, 0, 0); for (const i of f) fc.add(wv[i]); fc.multiplyScalar(1 / f.length);
          if (a.copy(fc).sub(wc).dot(n) < 0) n.negate();
          if (n.dot(this.view) >= 0) continue;                // de costas para a câmera
          let depth = 0; for (const i of f) depth += pv[i][2]; depth /= f.length;
          faces.push({ pts: f.map((i) => pv[i]), depth, color: this.shade(s.color, n, s.tag) });
        }
      }
    }
    faces.sort((p, q) => q.depth - p.depth);
    const t = this.tmp.getContext('2d');
    t.clearRect(0, 0, this.W, this.H);
    t.lineJoin = 'round';
    for (const f of faces) {
      t.beginPath();
      t.moveTo(f.pts[0][0], f.pts[0][1]);
      for (let i = 1; i < f.pts.length; i++) t.lineTo(f.pts[i][0], f.pts[i][1]);
      t.closePath();
      t.fillStyle = f.color.fill; t.fill();
      t.strokeStyle = f.color.edge; t.lineWidth = 0.9; t.stroke();       // aresta da faceta (fecha frestas)
    }
    // contorno da silhueta
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);
    if (outlinePx > 0) {
      const o = this.outlineCanvas || (this.outlineCanvas = document.createElement('canvas'));
      o.width = this.W; o.height = this.H;
      const oc = o.getContext('2d');
      oc.drawImage(this.tmp, 0, 0); oc.globalCompositeOperation = 'source-in'; oc.fillStyle = outline; oc.fillRect(0, 0, this.W, this.H);
      oc.globalCompositeOperation = 'source-over';
      for (let dy = -outlinePx; dy <= outlinePx; dy++) for (let dx = -outlinePx; dx <= outlinePx; dx++) {
        if (dx * dx + dy * dy > outlinePx * outlinePx + 0.5) continue;
        c.drawImage(o, dx, dy);
      }
    }
    c.drawImage(this.tmp, 0, 0);
    return this.canvas;
  }

  // luz chapada por face: claro puxa para o quente, sombra para o frio (como no concept)
  shade(base, n, tag) {
    const d = Math.max(0, n.dot(this.light));
    const up = Math.max(0, n.y);
    let k = 0.4 + 0.5 * d + 0.08 * up;
    const col = base.clone();
    if (tag === 'glow') k = 1.25;
    const lit = col.clone().multiplyScalar(k);
    if (k > 0.95) lit.lerp(new THREE.Color(1, 0.94, 0.82), (k - 0.95) * 0.35);        // luz quente
    else lit.lerp(new THREE.Color(0.22, 0.2, 0.42), (0.95 - k) * 0.35);               // sombra fria/roxa
    if (tag === 'metal' && d > 0.82) lit.lerp(new THREE.Color(1, 1, 0.95), (d - 0.82) * 1.6); // brilho do metal
    const hex = (cc) => '#' + cc.clone().convertLinearToSRGB().getHexString();
    const keep = (cc) => '#' + new THREE.Color(Math.min(1, cc.r), Math.min(1, cc.g), Math.min(1, cc.b)).getHexString();
    void hex;
    return { fill: keep(lit), edge: keep(lit.clone().multiplyScalar(0.86)) };
  }
}
