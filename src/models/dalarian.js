import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// =====================================================================
// Dalárian, Paladino da Luz: modelo detalhado a partir do concept art.
// Mesmos ossos do rig genérico (src/rig.js), então usa as mesmas animações.
// O personagem olha para +Z; o lado esquerdo dele é +X (s = +1 esq., -1 dir.).
// =====================================================================

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const rbox = (w, h, d, r = 0.04, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.99);

export function buildDalarian() {
  const M = {
    steel: std(0x9a95a4, { metalness: 0.8 }),
    steelDark: std(0x6c6676, { metalness: 0.8 }),
    gold: std(0xdc9a30, { metalness: 0.9 }),
    goldDark: std(0xb07a24, { metalness: 0.9 }),
    blue: std(0x2a3c92),
    blueDark: std(0x1c2766),
    leather: std(0x6a3f24),
    leatherDark: std(0x3e2616),
    under: std(0x4c4652),
    skin: std(0xf1b48c),
    skinDark: std(0xd88f68),
    hair: std(0xf4c55e),
    hairDark: std(0xcf9634),
    beard: std(0x8e5a2c),
    white: std(0xffffff),
    iris: std(0x3e7ee0),
    dark: std(0x2a1a14),
    gem: std(0x3a8bff, { emissive: 0x2a6bff, emissiveIntensity: 1 }),
  };

  const bones = {};
  const bone = (name, parent, x, y, z) => {
    const g = new THREE.Group(); g.name = name; g.position.set(x, y, z);
    parent.add(g); bones[name] = g; return g;
  };
  const P = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.scale.set(sx, sy, sz);
    parent.add(mesh); return mesh;
  };
  const gemSet = (parent, x, y, z, size = 0.05, rx = 0, ry = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(rx, ry, 0); parent.add(g);
    P(g, rbox(size * 2.2, size * 2.2, size * 0.6, size * 0.3), M.gold, 0, 0, 0, 0, 0, Math.PI / 4);
    P(g, new THREE.OctahedronGeometry(size, 0), M.gem, 0, 0, size * 0.3, 0, 0, 0, 1, 1.2, 0.55);
    return g;
  };

  const root = new THREE.Group();
  const hips = bone('hips', root, 0, 1.02, 0);
  const spine = bone('spine', hips, 0, 0.12, 0);
  const chest = bone('chest', spine, 0, 0.3, 0);
  const neck = bone('neck', chest, 0, 0.4, 0.0);
  const head = bone('head', neck, 0, 0.1, 0.02);

  // ================= Quadril: tassets, tabardo comprido =================
  P(hips, rbox(0.56, 0.26, 0.38, 0.1), M.under, 0, -0.02, 0);
  for (const s of [-1, 1]) {
    // placas laterais (tassets) em duas camadas
    for (let k = 0; k < 2; k++) {
      const t = P(hips, rbox(0.24, 0.2, 0.05, 0.02), M.steel, s * (0.27 + k * 0.02), -0.1 - k * 0.15, 0.03, 0.05, s * 0.45, s * (0.2 + k * 0.05));
      P(t, rbox(0.25, 0.03, 0.06, 0.012), M.gold, 0, -0.09, 0);
    }
  }
  const backT = P(hips, rbox(0.4, 0.26, 0.05, 0.02), M.steel, 0, -0.14, -0.19, -0.15);
  P(backT, rbox(0.41, 0.03, 0.06, 0.012), M.gold, 0, -0.12, 0);
  // tabardo da frente: azul com borda e cruz dourada, ponta dourada
  const tab = new THREE.Group(); tab.position.set(0, -0.08, 0.21); tab.rotation.x = 0.05; hips.add(tab);
  P(tab, rbox(0.3, 0.84, 0.03, 0.012), M.blue, 0, -0.38, 0);
  for (const s of [-1, 1]) P(tab, rbox(0.03, 0.84, 0.035, 0.01), M.gold, s * 0.155, -0.38, 0);
  P(tab, new THREE.ConeGeometry(0.16, 0.16, 4), M.blue, 0, -0.86, 0, Math.PI, Math.PI / 4, 0, 1, 1, 0.12);
  P(tab, new THREE.OctahedronGeometry(0.045, 0), M.gold, 0, -0.95, 0.0, 0, 0, 0, 1, 1.4, 0.4);
  P(tab, rbox(0.035, 0.34, 0.02, 0.008), M.gold, 0, -0.42, 0.018);
  P(tab, rbox(0.2, 0.035, 0.02, 0.008), M.gold, 0, -0.34, 0.018);
  gemSet(tab, 0, -0.34, 0.025, 0.028);

  // ================= Abdômen e cinto =================
  P(spine, rbox(0.5, 0.32, 0.34, 0.1), M.under, 0, 0.12, 0);
  P(spine, new THREE.CylinderGeometry(0.31, 0.32, 0.13, 20), M.leather, 0, -0.02, 0, 0, 0, 0, 1, 1, 0.7);
  P(spine, new THREE.CylinderGeometry(0.315, 0.325, 0.025, 20), M.leatherDark, 0, -0.08, 0, 0, 0, 0, 1, 1, 0.7);
  // fivela: losango dourado com gema azul
  P(spine, rbox(0.15, 0.15, 0.05, 0.02), M.gold, 0, -0.02, 0.23, 0, 0, Math.PI / 4);
  P(spine, rbox(0.1, 0.1, 0.055, 0.015), M.goldDark, 0, -0.02, 0.235, 0, 0, Math.PI / 4);
  P(spine, new THREE.OctahedronGeometry(0.035, 0), M.gem, 0, -0.02, 0.265, 0, 0, 0, 1, 1, 0.6);
  // bolsinha no cinto
  P(spine, rbox(0.1, 0.13, 0.07, 0.02), M.leather, -0.24, -0.08, 0.13, 0, -0.6);

  // ================= Peito =================
  P(chest, new THREE.SphereGeometry(0.42, 24, 16), M.steel, 0, 0.13, 0, 0, 0, 0, 1.0, 0.72, 0.68);
  P(chest, rbox(0.62, 0.22, 0.4, 0.09), M.steel, 0, -0.1, 0.0);
  for (let k = 0; k < 2; k++) P(chest, new THREE.CylinderGeometry(0.3 - k * 0.01, 0.29 - k * 0.01, 0.03, 20), M.gold, 0, -0.03 - k * 0.09, 0.0, 0, 0, 0, 1, 1, 0.7);
  // painel azul com o leão dourado
  const pan = new THREE.Group(); pan.position.set(0, 0.12, 0.25); pan.rotation.x = -0.12; chest.add(pan);
  P(pan, rbox(0.4, 0.36, 0.06, 0.03), M.blue, 0, 0, 0);
  for (const s of [-1, 1]) {
    P(pan, rbox(0.035, 0.38, 0.07, 0.012), M.gold, s * 0.2, 0, 0);
    gemSet(chest, s * 0.27, 0.3, 0.2, 0.045, -0.4, s * 0.5);
  }
  P(pan, rbox(0.44, 0.035, 0.07, 0.012), M.gold, 0, 0.185, 0);
  P(pan, rbox(0.44, 0.035, 0.07, 0.012), M.gold, 0, -0.185, 0);
  // leão: juba de raios + rosto
  const lion = new THREE.Group(); lion.position.set(0, 0.0, 0.04); pan.add(lion);
  P(lion, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), M.goldDark, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    P(lion, new THREE.ConeGeometry(0.03, 0.08, 4), M.gold, Math.sin(a) * 0.11, Math.cos(a) * 0.11, 0.01, 0, 0, -a, 1, 1, 0.5);
  }
  P(lion, new THREE.SphereGeometry(0.065, 12, 10), M.gold, 0, 0.0, 0.02, 0, 0, 0, 0.95, 1.05, 0.6);
  P(lion, rbox(0.06, 0.05, 0.05, 0.02), M.gold, 0, -0.035, 0.05);
  for (const s of [-1, 1]) P(lion, new THREE.SphereGeometry(0.018, 6, 4), M.gold, s * 0.05, 0.06, 0.02);
  // gola e gorjal
  P(chest, new THREE.CylinderGeometry(0.17, 0.22, 0.12, 16), M.steelDark, 0, 0.36, 0);
  P(chest, new THREE.TorusGeometry(0.2, 0.03, 8, 20), M.gold, 0, 0.32, 0, Math.PI / 2);
  P(chest, new THREE.TorusGeometry(0.16, 0.022, 8, 20), M.gold, 0, 0.43, 0, Math.PI / 2);

  // ================= Cabeça =================
  P(neck, new THREE.CylinderGeometry(0.1, 0.11, 0.16, 12), M.skin, 0, 0.0, 0);
  P(head, new THREE.SphereGeometry(0.2, 20, 16), M.skin, 0, 0.17, 0, 0, 0, 0, 0.92, 1.05, 1.0);
  P(head, rbox(0.25, 0.16, 0.21, 0.07), M.skin, 0, 0.05, 0.04);                    // mandíbula quadrada
  P(head, new THREE.SphereGeometry(0.06, 10, 8), M.skin, 0, 0.0, 0.12, 0, 0, 0, 1.1, 0.8, 0.9); // queixo
  P(head, rbox(0.04, 0.085, 0.05, 0.018), M.skin, 0, 0.13, 0.185, -0.25);              // nariz
  P(head, new THREE.SphereGeometry(0.021, 8, 6), M.skin, 0, 0.095, 0.205);
  for (const s of [-1, 1]) {
    P(head, new THREE.SphereGeometry(0.03, 10, 8), M.white, s * 0.072, 0.17, 0.165, 0, 0, 0, 1.2, 0.8, 0.6);
    P(head, new THREE.SphereGeometry(0.019, 8, 6), M.iris, s * 0.07, 0.168, 0.184);
    P(head, rbox(0.08, 0.022, 0.03, 0.008), M.hairDark, s * 0.075, 0.222, 0.178, 0.1, 0, s * -0.18);   // sobrancelha
    P(head, new THREE.SphereGeometry(0.04, 8, 6), M.skin, s * 0.19, 0.14, 0.0, 0, 0, 0, 0.5, 1, 0.8);   // orelha
  }
  // sorriso, bigode leve e cavanhaque
  P(head, new THREE.TorusGeometry(0.045, 0.008, 4, 10, Math.PI * 0.8), M.dark, 0, 0.05, 0.16, 0, 0, Math.PI * 1.1);
  P(head, rbox(0.07, 0.07, 0.05, 0.02), M.beard, 0, -0.015, 0.145);
  P(head, rbox(0.03, 0.04, 0.03, 0.01), M.beard, 0, 0.025, 0.165);
  // cabelo: calota, franja jogada para o lado e mechas longas até os ombros
  P(head, new THREE.SphereGeometry(0.225, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), M.hair, 0, 0.18, -0.01, -0.45, 0, 0, 1.0, 1.1, 1.08);
  // franja jogada para o lado
  P(head, new THREE.SphereGeometry(0.12, 12, 8), M.hair, 0.07, 0.31, 0.1, 0.4, 0, -0.3, 1.5, 0.45, 0.9);
  P(head, new THREE.SphereGeometry(0.09, 10, 8), M.hairDark, -0.1, 0.3, 0.1, 0.3, 0, 0.5, 1.3, 0.45, 0.9);
  // mechas longas: leque das laterais até as costas
  const NS = 13;
  for (let i = 0; i < NS; i++) {
    const a = -2.1 + (i / (NS - 1)) * 4.2;            // ângulo em volta da cabeça (0 = nuca)
    const len = 0.46 + ((i * 7) % 3) * 0.05 - Math.abs(a) * 0.04;
    const x = Math.sin(a) * 0.2, z = -Math.cos(a) * 0.19;
    const g = new THREE.CapsuleGeometry(0.055, len, 3, 8).translate(0, -len / 2, 0);
    P(head, g, i % 2 ? M.hair : M.hairDark, x, 0.22, z - 0.01, -0.12 * Math.cos(a) - 0.05, 0, Math.sin(a) * 0.22, 1.15, 1, 0.6).rotation.y = a;
  }
  head.scale.setScalar(1.12);

  // ================= Braços =================
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const ua = bone('upperArm' + side, chest, s * 0.47, 0.25, 0);
    P(ua, new THREE.CapsuleGeometry(0.13, 0.22, 6, 12), M.under, 0, -0.17, 0);
    P(ua, new THREE.CylinderGeometry(0.15, 0.14, 0.18, 14), M.steel, 0, -0.24, 0);
    P(ua, new THREE.TorusGeometry(0.15, 0.018, 6, 16), M.gold, 0, -0.15, 0, Math.PI / 2);
    // ombreira em 3 camadas com borda dourada e gema azul
    const pd = new THREE.Group(); pd.position.set(s * 0.03, 0.0, 0); pd.rotation.z = -s * 0.32; ua.add(pd);
    P(pd, new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), M.steel, 0, 0.02, 0, 0, 0, 0, 1.12, 0.82, 1.1);
    P(pd, new THREE.TorusGeometry(0.27, 0.03, 8, 24), M.gold, 0, 0.02, 0, Math.PI / 2, 0, 0, 1.12, 1.1, 1);
    P(pd, new THREE.TorusGeometry(0.17, 0.022, 8, 20), M.gold, 0, 0.17, 0, Math.PI / 2, 0, 0, 1.12, 1.1, 1);
    for (let k = 0; k < 2; k++) {
      const r = 0.29 + k * 0.015;
      P(pd, new THREE.CylinderGeometry(r, r + 0.02, 0.08, 22), M.steel, 0, -0.04 - k * 0.075, 0, 0, 0, 0, 1.12, 1, 1.1);
      P(pd, new THREE.TorusGeometry(r + 0.02, 0.016, 6, 22), M.gold, 0, -0.08 - k * 0.075, 0, Math.PI / 2, 0, 0, 1.12, 1.1, 1);
    }
    gemSet(pd, 0, 0.12, 0.25, 0.05, -0.55);
    // antebraço: cotoveleira, braçal com faixas e punho
    const fa = bone('foreArm' + side, ua, 0, -0.36, 0);
    P(fa, new THREE.SphereGeometry(0.12, 12, 10), M.steel, 0, 0.0, -0.02);
    P(fa, new THREE.ConeGeometry(0.07, 0.12, 4), M.gold, 0, 0.0, -0.13, -Math.PI / 2, 0, 0, 1, 1, 0.5);
    P(fa, new THREE.CylinderGeometry(0.12, 0.14, 0.28, 14), M.steel, 0, -0.16, 0);
    P(fa, new THREE.TorusGeometry(0.125, 0.02, 6, 16), M.gold, 0, -0.06, 0, Math.PI / 2);
    P(fa, new THREE.TorusGeometry(0.145, 0.022, 6, 16), M.gold, 0, -0.28, 0, Math.PI / 2);
    P(fa, rbox(0.06, 0.14, 0.02, 0.008), M.gold, s * 0.0, -0.17, 0.13);
    const hd = bone('hand' + side, fa, 0, -0.33, 0);
    P(hd, rbox(0.13, 0.14, 0.14, 0.05), M.leather, 0, -0.05, 0);
    P(hd, rbox(0.05, 0.08, 0.05, 0.02), M.leather, s * 0.07, -0.03, 0.04, 0, 0, s * 0.4);
  }

  // ================= Pernas =================
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const th = bone('thigh' + side, hips, s * 0.16, -0.08, 0);
    P(th, new THREE.CapsuleGeometry(0.16, 0.26, 6, 12), M.under, 0, -0.2, 0);
    P(th, rbox(0.27, 0.28, 0.2, 0.06), M.steel, 0, -0.22, 0.06);
    P(th, rbox(0.28, 0.03, 0.21, 0.01), M.gold, 0, -0.08, 0.06);
    const sh = bone('shin' + side, th, 0, -0.44, 0);
    // joelheira dourada com asa
    P(sh, new THREE.SphereGeometry(0.12, 12, 10), M.steel, 0, 0.0, 0.07, 0, 0, 0, 1, 1, 0.8);
    P(sh, new THREE.TorusGeometry(0.1, 0.02, 6, 14), M.gold, 0, 0.0, 0.13);
    P(sh, new THREE.OctahedronGeometry(0.1, 0), M.gold, s * 0.11, 0.02, 0.06, 0, 0, 0, 0.6, 1.3, 0.3);
    P(sh, new THREE.CylinderGeometry(0.15, 0.12, 0.38, 14), M.steel, 0, -0.21, 0.01);
    P(sh, rbox(0.06, 0.3, 0.03, 0.01), M.gold, 0, -0.2, 0.15);
    P(sh, new THREE.TorusGeometry(0.125, 0.018, 6, 14), M.gold, 0, -0.38, 0.01, Math.PI / 2);
    const ft = bone('foot' + side, sh, 0, -0.42, 0);
    P(ft, rbox(0.22, 0.14, 0.34, 0.06), M.steel, 0, -0.02, 0.06);
    P(ft, rbox(0.2, 0.09, 0.14, 0.04), M.steelDark, 0, -0.03, 0.22);
    P(ft, rbox(0.23, 0.04, 0.36, 0.015), M.leatherDark, 0, -0.09, 0.06);
    P(ft, rbox(0.225, 0.025, 0.05, 0.01), M.gold, 0, 0.04, 0.12);
  }

  // ================= Capa (3 segmentos) =================
  const c1 = bone('cape1', chest, 0, 0.3, -0.27);
  P(c1, rbox(0.95, 0.52, 0.03, 0.012), M.blue, 0, -0.25, 0);
  P(c1, rbox(1.0, 0.07, 0.06, 0.03), M.blueDark, 0, 0.0, 0.02);
  const c2 = bone('cape2', c1, 0, -0.5, 0);
  P(c2, rbox(1.03, 0.52, 0.03, 0.012), M.blue, 0, -0.25, 0);
  P(c2, rbox(0.07, 0.46, 0.02, 0.01), M.gold, 0, -0.2, -0.02);
  P(c2, rbox(0.36, 0.07, 0.02, 0.01), M.gold, 0, -0.08, -0.02);
  gemSet(c2, 0, -0.08, -0.03, 0.035, 0, Math.PI);
  const c3 = bone('cape3', c2, 0, -0.5, 0);
  P(c3, rbox(1.12, 0.46, 0.03, 0.012), M.blue, 0, -0.22, 0);
  P(c3, rbox(1.13, 0.06, 0.04, 0.012), M.gold, 0, -0.43, 0);
  for (let i = 0; i < 7; i++) P(c3, new THREE.ConeGeometry(0.05, 0.1, 4), M.gold, -0.48 + i * 0.16, -0.36, -0.005, 0, Math.PI / 4, 0, 1, 1, 0.3);

  // ================= Martelo sagrado =================
  const right = new THREE.Group();
  const wood = std(0x5e3a22);
  const cyl = (r, l, seg = 10) => new THREE.CylinderGeometry(r, r, l, seg).rotateX(Math.PI / 2);
  P(right, cyl(0.036, 1.28), wood, 0, -0.05, 0.38);
  for (let i = 0; i < 6; i++) P(right, new THREE.TorusGeometry(0.04, 0.011, 4, 10), M.leatherDark, 0, -0.05, -0.12 + i * 0.065, 0, 0, i * 0.3);
  P(right, new THREE.ConeGeometry(0.055, 0.18, 6), M.gold, 0, -0.05, -0.33, -Math.PI / 2);
  P(right, new THREE.SphereGeometry(0.05, 8, 6), M.gold, 0, -0.05, -0.23);
  for (const z of [0.55, 0.7, 0.86]) P(right, new THREE.TorusGeometry(0.048, 0.016, 6, 10), M.gold, 0, -0.05, z);
  const hh = new THREE.Group(); hh.position.set(0, -0.05, 1.1); right.add(hh);
  P(hh, rbox(0.64, 0.38, 0.38, 0.08), M.steel);
  P(hh, rbox(0.4, 0.42, 0.42, 0.04), M.steelDark);
  for (const s of [-1, 1]) {
    P(hh, rbox(0.07, 0.44, 0.44, 0.03), M.gold, s * 0.24, 0, 0);
    P(hh, rbox(0.05, 0.3, 0.3, 0.04), M.steel, s * 0.34, 0, 0);
    // estrela de 4 pontas em cada face larga
    const st = new THREE.Group(); st.position.set(0, s * 0.215, 0); st.rotation.x = s * Math.PI / 2; hh.add(st);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      P(st, new THREE.ConeGeometry(0.06, 0.2, 4), M.gold, Math.sin(a) * 0.09, Math.cos(a) * 0.09, 0, 0, 0, -a, 1, 1, 0.35);
    }
    P(st, new THREE.OctahedronGeometry(0.045, 0), M.gem, 0, 0, 0.02, 0, 0, 0, 1, 1, 0.6);
  }
  P(hh, new THREE.ConeGeometry(0.05, 0.16, 6), M.gold, 0, 0, 0.26, Math.PI / 2);
  bones.handR.add(right);

  for (const n in bones) bones[n].userData.rest = bones[n].position.clone();
  return { root, bones, weapon: { right, left: null, tipo: 'martelo' }, materials: M, style: { build: 'pesado' } };
}
