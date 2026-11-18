import * as THREE from 'three';
import { toon, addOutlines } from './toon.js';

// =====================================================================
// Sala-arena 3D construída a partir do mapa em texto (src/iso/maps.js):
// lajes de pedra, mosaico do leão, penhascos sobre o abismo, muros com
// estandartes, colunas, braseiros com fogo e luz, porta de saída,
// rochas escuras em primeiro plano e um fundo vermelho incandescente.
// 1 tile = T metros. Mundo: x = coluna (i), z = linha (j), y = altura.
// =====================================================================
export const T = 1.8;
const rnd = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// mosaico dourado do leão (Ordem da Luz), pintado por código
function lionMosaic() {
  return canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    g.clearRect(0, 0, w, w);
    g.fillStyle = 'rgba(40,30,60,0.55)'; g.beginPath(); g.arc(c, c, 250, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c98a2e'; g.lineWidth = 14; g.beginPath(); g.arc(c, c, 236, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#f2c060'; g.lineWidth = 3; g.beginPath(); g.arc(c, c, 228, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#a8742a'; g.lineWidth = 8; g.beginPath(); g.arc(c, c, 160, 0, Math.PI * 2); g.stroke();
    // juba: raios ondulados
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      g.fillStyle = k % 2 ? '#d9a040' : '#b07a2a';
      g.beginPath();
      g.moveTo(c + Math.cos(a - 0.09) * 80, c + Math.sin(a - 0.09) * 80);
      g.quadraticCurveTo(c + Math.cos(a + 0.05) * 140, c + Math.sin(a + 0.05) * 140, c + Math.cos(a + 0.12) * 150, c + Math.sin(a + 0.12) * 150);
      g.lineTo(c + Math.cos(a + 0.09) * 80, c + Math.sin(a + 0.09) * 80); g.closePath(); g.fill();
    }
    // rosto do leão
    g.fillStyle = '#e6aa44'; g.beginPath(); g.ellipse(c, c + 6, 70, 82, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b07a2a';
    g.beginPath(); g.moveTo(c - 26, c + 20); g.lineTo(c + 26, c + 20); g.lineTo(c, c + 50); g.closePath(); g.fill();
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(c + s * 28, c - 12, 14, 7, s * 0.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(c + s * 50, c - 62); g.lineTo(c + s * 70, c - 90); g.lineTo(c + s * 30, c - 74); g.fill();
    }
    g.strokeStyle = '#8a5a1e'; g.lineWidth = 5; g.beginPath(); g.moveTo(c, c - 30); g.lineTo(c, c + 20); g.stroke();
    g.beginPath(); g.moveTo(c - 20, c + 62); g.quadraticCurveTo(c, c + 74, c + 20, c + 62); g.stroke();
  });
}

function bannerTex() {
  return canvasTex(128, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#3a4cb0'); gr.addColorStop(1, '#1e2766');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h - 50); g.lineTo(w / 2, h); g.lineTo(0, h - 50); g.closePath(); g.fill();
    g.strokeStyle = '#f2a83a'; g.lineWidth = 10; g.stroke();
    g.fillStyle = '#f2b440'; g.fillRect(w / 2 - 9, 50, 18, 170); g.fillRect(w / 2 - 44, 100, 88, 18);
    g.beginPath(); g.moveTo(w / 2, 30); g.lineTo(w / 2 + 14, 52); g.lineTo(w / 2 - 14, 52); g.fill();
  });
}

export function buildRoom(map, scene) {
  const g = new THREE.Group(); g.name = 'room';
  const r = rnd(map.w * 31 + map.h);
  const at = (i, j) => (i < 0 || j < 0 || i >= map.w || j >= map.h ? null : map.floor[j * map.w + i]);
  const ch = (i, j) => (map.tiles[j] || '')[i] || ' ';
  const wpos = (i, j) => new THREE.Vector3((i + 0.5) * T, 0, (j + 0.5) * T);

  // ---------------- chão: lajes com variação ----------------
  const slabGeo = new THREE.BoxGeometry(T * 0.97, 0.4, T * 0.97);
  const slabCols = [0x6a5e72, 0x625668, 0x70647a, 0x5c5064];
  const slabs = slabCols.map((c) => toon(c));
  const cliffMat = toon(0x2a2232), cliffDark = toon(0x1c1622);
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    if (!at(i, j)) continue;
    const m = new THREE.Mesh(slabGeo, slabs[(i * 7 + j * 13 + ((r() * 3) | 0)) % 4]);
    const p = wpos(i, j); m.position.set(p.x, -0.2 - r() * 0.03, p.z);
    m.receiveShadow = true; g.add(m);
    // penhasco: coluna de rocha descendo onde o vizinho é abismo
    if (!at(i, j + 1) || !at(i + 1, j) || !at(i - 1, j) || !at(i, j - 1)) {
      const d = 4 + r() * 5;
      const c = new THREE.Mesh(new THREE.BoxGeometry(T * (0.9 + r() * 0.2), d, T * (0.9 + r() * 0.2)), r() < 0.5 ? cliffMat : cliffDark);
      c.position.set(p.x + (r() - 0.5) * 0.2, -0.4 - d / 2, p.z + (r() - 0.5) * 0.2);
      g.add(c);
    }
  }
  // fios dourados entre as lajes do centro (anel em volta do mosaico)
  const start = wpos(map.start.x - 0.5, map.start.y - 0.5);
  const mosaic = new THREE.Mesh(new THREE.CircleGeometry(T * 2.6, 64), new THREE.MeshToonMaterial({ map: lionMosaic(), transparent: true, gradientMap: null }));
  mosaic.rotation.x = -Math.PI / 2; mosaic.position.set(start.x, 0.01, start.z); mosaic.receiveShadow = true;
  g.add(mosaic);

  // ---------------- muros, porta, estandartes ----------------
  const wallMat = toon(0x4a4054), wallTop = toon(0x6a5e74), gold = toon(0xd9962e);
  const wallGeo = new THREE.BoxGeometry(T, 3.4, T);
  const banner = bannerTex();
  let door = null;
  for (const w of map.walls) {
    const p = wpos(w.i, w.j);
    if (w.door) {
      door = new THREE.Group(); door.position.set(p.x, 0, p.z);
      // arco
      for (const s of [-1, 1]) { const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 0.6), wallTop); col.position.set(s * 0.75, 1.8, 0); door.add(col); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.7), wallTop); top.position.y = 3.6; door.add(top);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.12, 0.75), gold); trim.position.y = 3.35; door.add(trim);
      const bars = new THREE.Group();
      for (let k = -2; k <= 2; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.1, 0.08), toon(0x2a2430)); b.position.set(k * 0.27, 1.55, 0.05); bars.add(b); }
      door.add(bars);
      const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.1), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      portal.position.set(0, 1.55, 0.02); portal.userData.noOutline = true; door.add(portal);
      const light = new THREE.PointLight(0xffd890, 0, 9, 1.6); light.position.set(0, 1.8, 1); door.add(light);
      // símbolo da recompensa
      const icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), toon(map.recompensa === 'cura' ? 0xe04848 : map.recompensa === 'poder' ? 0xf2c040 : 0xffffff, { emissive: 0x402000, emissiveIntensity: 0.6 }));
      icon.position.y = 4.4; door.add(icon);
      door.userData = { bars, portal, light, icon, open: false };
      g.add(door);
      continue;
    }
    const m = new THREE.Mesh(wallGeo, wallMat); m.position.set(p.x, 1.5, p.z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(T * 1.04, 0.3, T * 1.04), wallTop); cap.position.set(p.x, 3.3, p.z); g.add(cap);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(T * 1.05, 0.08, T * 1.05), gold); tr.position.set(p.x, 3.12, p.z); g.add(tr);
    if ((w.i + w.j) % 4 === 1) {   // estandarte na face de dentro
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), new THREE.MeshToonMaterial({ map: banner, transparent: true, side: THREE.DoubleSide }));
      b.userData.noOutline = true;
      if (w.j === 0) { b.position.set(p.x, 1.7, p.z + T / 2 + 0.03); }
      else { b.position.set(p.x + T / 2 + 0.03, 1.7, p.z); b.rotation.y = Math.PI / 2; }
      g.add(b);
    }
  }

  // ---------------- colunas, braseiros, entulho ----------------
  const fires = [], pillars = [];
  for (const p0 of map.props) {
    const p = wpos(p0.i, p0.j);
    if (p0.kind === 'pilar') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.3), wallTop); base.position.set(p.x, 0.25, p.z);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 5.2, 8), toon(0x7a6e84)); col.position.set(p.x, 3.0, p.z);
      const capi = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.4, 1.25), wallTop); capi.position.set(p.x, 5.7, p.z);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.15, 8), gold); ring.position.set(p.x, 5.4, p.z);
      const pg = new THREE.Group();
      for (const o of [base, col, capi, ring]) { o.castShadow = true; o.receiveShadow = true; pg.add(o); }
      pg.userData.pillar = new THREE.Vector3(p.x, 0, p.z); g.add(pg); pillars.push(pg);
    } else if (p0.kind === 'braseiro') {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 8), toon(0x2e2632)); ped.position.set(p.x, 0.55, p.z);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.45, 0.45, 10), gold); bowl.position.set(p.x, 1.3, p.z);
      const coal = new THREE.Mesh(new THREE.CircleGeometry(0.62, 10), new THREE.MeshBasicMaterial({ color: 0xff7a20 })); coal.rotation.x = -Math.PI / 2; coal.position.set(p.x, 1.53, p.z); coal.userData.noOutline = true;
      for (const o of [ped, bowl]) { o.castShadow = true; g.add(o); }
      g.add(coal);
      fires.push(makeFire(g, new THREE.Vector3(p.x, 1.5, p.z), 1));
    } else if (p0.kind === 'entulho') {
      for (let k = 0; k < 5; k++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + r() * 0.3, 0), toon(0x6a5e66));
        rock.position.set(p.x + (r() - 0.5) * 1.2, 0.15, p.z + (r() - 0.5) * 1.2); rock.rotation.set(r() * 3, r() * 3, r() * 3);
        rock.castShadow = true; g.add(rock);
      }
      const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 8), toon(0x7a6e84));
      piece.rotation.z = Math.PI / 2; piece.rotation.y = r() * 3; piece.position.set(p.x, 0.4, p.z); piece.castShadow = true; g.add(piece);
    }
  }

  // ---------------- rochas escuras em primeiro plano (beira do abismo) ----------------
  const rockMat = toon(0x1c1a34);
  for (let j = 0; j < map.h + 2; j++) for (let i = 0; i < map.w + 2; i++) {
    if (at(i, j)) continue;
    const near = at(i - 1, j) || at(i, j - 1) || at(i - 1, j - 1);
    if (!near || r() < 0.45) continue;
    const s = 0.9 + r() * 1.4;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    const p = wpos(i, j);
    rock.position.set(p.x + (r() - 0.5), -1.6 - r() * 1.2, p.z + (r() - 0.5)); rock.rotation.set(r() * 3, r() * 3, r() * 3);
    rock.scale.y = 1.3; g.add(rock);
  }

  // ---------------- fundo vermelho incandescente atrás dos muros ----------------
  const back = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshBasicMaterial({
    map: canvasTex(16, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a0610'); gr.addColorStop(0.55, '#7a1420'); gr.addColorStop(0.8, '#c0283a'); gr.addColorStop(1, '#2a0814'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }),
    fog: false,
  }));
  back.userData.noOutline = true;
  const cx = (map.w / 2) * T, cz = (map.h / 2) * T;
  back.position.set(cx - 22, -6, cz - 22); back.lookAt(cx + 10, -6, cz + 10);
  g.add(back);

  addOutlines(g, 0.035);
  scene.add(g);
  // materiais próprios para poder deixar cada coluna transparente
  for (const pg of pillars) pg.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; } });
  return { group: g, fires, door, mosaicPos: start, pillars };
}

// ---------------- fogo: chamas em camadas + luz que tremula ----------------
const flameMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
export function makeFire(group, pos, size = 1) {
  const f = new THREE.Group(); f.position.copy(pos);
  const layers = [];
  for (const [c, o, s, h] of [[0xff5010, 0.55, 0.55, 1.5], [0xff9a20, 0.75, 0.4, 1.15], [0xffe080, 0.9, 0.22, 0.8]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(s * size, h * size, 7, 1, true), flameMat(c, o));
    m.position.y = (h * size) / 2; m.userData.noOutline = true; f.add(m); layers.push(m);
  }
  const light = new THREE.PointLight(0xff9a40, 18 * size, 11 * size, 1.5); light.position.y = 1.2; f.add(light);
  group.add(f);
  const seed = Math.random() * 10;
  return {
    update(t) {
      const k = 0.85 + Math.sin(t * 11 + seed) * 0.1 + Math.sin(t * 23 + seed * 2) * 0.06;
      layers.forEach((m, i) => { m.scale.set(1 + Math.sin(t * 9 + i) * 0.08, k * (1 + i * 0.05), 1 + Math.cos(t * 7 + i) * 0.08); m.rotation.y = t * (1 + i); });
      light.intensity = 18 * size * k;
    },
  };
}
