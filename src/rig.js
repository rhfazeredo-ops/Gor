import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// =====================================================================
// Rig de personagem feito por código.
// Esqueleto de "ossos" (Groups) com peças rígidas presas a eles, no estilo
// low-poly estilizado. O personagem olha para +Z; o lado esquerdo dele é +X.
// Convenções de rotação dos membros (pendurados para baixo):
//   rotation.x < 0  → leva o membro para a frente
//   rotation.z      → abre para o lado (use o sinal do lado: s = +1 esq., -1 dir.)
// =====================================================================

const BONES = ['hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR', 'cape1', 'cape2', 'cape3'];

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const rbox = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99);

// Corpo por tipo: proporções para heróis pesados, médios e leves.
const BUILDS = {
  pesado: { ombro: 0.48, peito: 0.8, cintura: 0.6, braco: 0.15, perna: 0.17, altura: 1.0, pauldron: 0.25 },
  medio: { ombro: 0.42, peito: 0.68, cintura: 0.5, braco: 0.12, perna: 0.14, altura: 0.97, pauldron: 0.2 },
  leve: { ombro: 0.36, peito: 0.58, cintura: 0.42, braco: 0.1, perna: 0.12, altura: 0.94, pauldron: 0.14 },
};

// Estilo de cada herói (o que muda além das cores).
const STYLE = {
  dalarian: { build: 'pesado', tabardo: true, capa: true, cabeloLongo: true, cavanhaque: true, gema: 0x3a7bff },
  aelina: { build: 'leve', manto: true, capa: true, cabeloLongo: true, gema: 0xffd060 },
  ignara: { build: 'leve', manto: true, capa: false, cabeloLongo: true, gema: 0xff6a20 },
  ladino: { build: 'medio', capuz: true, capa: true },
  kaedrion: { build: 'pesado', tabardo: true, capa: true, orelhas: true, elmo: true, gema: 0xb070ff },
  nyxara: { build: 'leve', capuz: true, orelhas: true, capa: true },
  vaelyra: { build: 'leve', manto: true, orelhas: true, cabeloLongo: true, capa: true, gema: 0xb070ff },
  drakhar: { build: 'pesado', chifres: true, presas: true, capa: false, tanga: true },
  karisha: { build: 'medio', chifres: true, presas: true, cabeloLongo: true, tanga: true },
  xama: { build: 'medio', chifres: true, presas: true, manto: true, capa: false, gema: 0x40b0ff },
};

export function buildCharacter(def) {
  const c = def.cores;
  const st = STYLE[def.id] || { build: 'medio' };
  const B = BUILDS[st.build];

  const M = {
    skin: mat(c.pele, { roughness: 0.75 }),
    steel: mat(c.armadura, { metalness: 0.55, roughness: 0.38, flatShading: true }),
    gold: mat(c.detalhe, { metalness: 0.85, roughness: 0.28, flatShading: true }),
    cloth: mat(c.tecido, { roughness: 0.9, side: THREE.DoubleSide }),
    hair: mat(c.cabelo, { roughness: 0.75, flatShading: true }),
    leather: mat(0x4a2e1e, { roughness: 0.85 }),
    under: mat(0x3a3440, { roughness: 0.9 }),
    dark: mat(0x1a1418, { roughness: 0.6 }),
    gem: mat(st.gema || 0x3a7bff, { emissive: st.gema || 0x3a7bff, emissiveIntensity: 0.8, roughness: 0.2, flatShading: true }),
  };

  const bones = {};
  const bone = (name, parent, x, y, z) => {
    const g = new THREE.Group(); g.name = name; g.position.set(x, y, z);
    parent.add(g); bones[name] = g; return g;
  };
  const part = (parent, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; parent.add(mesh); return mesh;
  };

  const root = new THREE.Group();
  const H = B.altura;               // altura do quadril
  const hips = bone('hips', root, 0, H, 0);
  const spine = bone('spine', hips, 0, 0.12, 0);
  const chest = bone('chest', spine, 0, 0.28, 0);
  const neck = bone('neck', chest, 0, 0.36, 0.02);
  const head = bone('head', neck, 0, 0.1, 0);

  // ---------------- Tronco ----------------
  part(hips, rbox(B.cintura + 0.06, 0.26, 0.36, 0.08), st.manto ? M.cloth : M.under, 0, 0, 0);
  part(spine, rbox(B.cintura, 0.3, 0.34, 0.08), st.manto ? M.cloth : M.steel, 0, 0.12, 0);
  // cinto
  part(spine, new THREE.CylinderGeometry(B.cintura * 0.6, B.cintura * 0.6, 0.09, 12), M.leather, 0, -0.04, 0).scale.z = 0.62;
  part(spine, new THREE.OctahedronGeometry(0.075, 0), M.gold, 0, -0.04, 0.2).scale.set(1, 1, 0.5);
  part(spine, new THREE.OctahedronGeometry(0.035, 0), M.gem, 0, -0.04, 0.24);
  // peito
  const peito = part(chest, rbox(B.peito, 0.52, 0.44, 0.12), st.manto ? M.cloth : M.steel, 0, 0.1, 0);
  peito.scale.set(1, 1, 1);
  part(chest, rbox(B.peito * 0.7, 0.2, 0.3, 0.06), st.manto ? M.cloth : M.steel, 0, -0.14, 0.02);
  // gola dourada
  part(chest, new THREE.TorusGeometry(0.17, 0.035, 6, 14), M.gold, 0, 0.36, 0.02, Math.PI / 2);

  if (st.tabardo) {
    // tabardo azul com a cruz dourada na frente e o emblema no peito
    part(chest, rbox(B.peito * 0.55, 0.4, 0.02, 0.01), M.cloth, 0, 0.1, 0.225);
    part(chest, new THREE.IcosahedronGeometry(0.09, 0), M.gold, 0, 0.14, 0.24).scale.set(1, 1.1, 0.4);
    const aba = part(hips, rbox(0.3, 0.75, 0.02, 0.01), M.cloth, 0, -0.38, 0.2, 0.06);
    part(aba, rbox(0.04, 0.3, 0.012, 0.005), M.gold, 0, 0.02, 0.012);
    part(aba, rbox(0.18, 0.04, 0.012, 0.005), M.gold, 0, 0.08, 0.012);
    part(aba, new THREE.OctahedronGeometry(0.03, 0), M.gem, 0, 0.08, 0.02);
    part(aba, rbox(0.3, 0.05, 0.03, 0.01), M.gold, 0, -0.36, 0.005);
    bones.aba = aba;
  }
  if (st.manto) {
    // saia longa de manto
    const saia = part(hips, new THREE.CylinderGeometry(B.cintura * 0.55, B.cintura * 0.95, 0.85, 12, 1, true), M.cloth, 0, -0.45, 0);
    saia.scale.z = 0.8;
    part(hips, new THREE.TorusGeometry(B.cintura * 0.95, 0.03, 5, 16), M.gold, 0, -0.86, 0, Math.PI / 2).scale.set(1, 0.8, 1);
    bones.saia = saia;
  }
  if (st.tanga) {
    part(hips, rbox(0.34, 0.5, 0.03, 0.01), M.cloth, 0, -0.3, 0.19, 0.05);
    part(hips, rbox(0.34, 0.5, 0.03, 0.01), M.cloth, 0, -0.3, -0.19, -0.05);
  }

  // ---------------- Cabeça ----------------
  const cabeca = part(head, new THREE.SphereGeometry(0.21, 16, 12), M.skin, 0, 0.14, 0.01);
  cabeca.scale.set(0.95, 1.08, 1);
  part(head, rbox(0.26, 0.14, 0.2, 0.06), M.skin, 0, 0.04, 0.05);              // mandíbula
  part(head, new THREE.SphereGeometry(0.035, 8, 6), M.skin, 0, 0.12, 0.2);     // nariz
  for (const s of [-1, 1]) {
    part(head, new THREE.SphereGeometry(0.026, 8, 6), M.dark, s * 0.075, 0.17, 0.175);
    part(head, rbox(0.07, 0.018, 0.02, 0.005), M.hair, s * 0.075, 0.215, 0.18, 0, 0, s * -0.15);
  }
  if (st.cavanhaque) part(head, rbox(0.08, 0.08, 0.05, 0.02), mat(0x7a5428), 0, -0.01, 0.15);
  if (st.orelhas) for (const s of [-1, 1]) part(head, new THREE.ConeGeometry(0.04, 0.2, 5), M.skin, s * 0.21, 0.17, -0.02, 0, 0, -s * 1.25);
  if (st.chifres) for (const s of [-1, 1]) {
    const ch = part(head, new THREE.ConeGeometry(0.055, 0.32, 6), mat(0xf0e6d0, { roughness: 0.5, flatShading: true }), s * 0.14, 0.32, -0.04, -0.4, 0, -s * 0.5);
    ch.scale.set(1, 1, 0.8);
  }
  if (st.presas) for (const s of [-1, 1]) part(head, new THREE.ConeGeometry(0.018, 0.08, 4), mat(0xf6f0e0), s * 0.06, 0.04, 0.17, 0.2);

  if (st.capuz) {
    const cap = part(head, new THREE.SphereGeometry(0.25, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), M.cloth, 0, 0.15, -0.02);
    cap.rotation.x = -0.25;
    part(head, new THREE.ConeGeometry(0.2, 0.32, 10, 1, true), M.cloth, 0, 0.02, -0.12, -2.4).scale.z = 0.7;
    part(head, rbox(0.24, 0.08, 0.04, 0.02), M.dark, 0, 0.04, 0.18);       // máscara
  } else if (st.elmo) {
    part(head, new THREE.SphereGeometry(0.23, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.steel, 0, 0.16, 0);
    part(head, rbox(0.05, 0.22, 0.05, 0.02), M.gold, 0, 0.36, 0.0);
    part(head, new THREE.TorusGeometry(0.22, 0.02, 5, 16), M.gold, 0, 0.18, 0, Math.PI / 2);
  } else {
    // cabelo: calota + franja + mechas
    const cal = part(head, new THREE.SphereGeometry(0.215, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair, 0, 0.17, -0.01);
    cal.scale.set(1, 1.05, 1.06); cal.rotation.x = -0.18;
    part(head, rbox(0.3, 0.07, 0.12, 0.03), M.hair, 0.03, 0.29, 0.13, 0.3, 0, -0.2);
    if (st.cabeloLongo) {
      part(head, rbox(0.38, 0.48, 0.12, 0.05), M.hair, 0, -0.05, -0.15, 0.12);
      for (const s of [-1, 1]) part(head, rbox(0.08, 0.36, 0.12, 0.03), M.hair, s * 0.19, 0.02, -0.02, 0.1, 0, s * 0.12);
    } else {
      part(head, rbox(0.34, 0.2, 0.1, 0.04), M.hair, 0, 0.1, -0.15);
    }
  }

  // ---------------- Braços ----------------
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const ua = bone('upperArm' + side, chest, s * B.ombro, 0.26, 0);
    part(ua, new THREE.CapsuleGeometry(B.braco, 0.22, 4, 8), st.manto ? M.cloth : M.under, 0, -0.17, 0);
    if (!st.manto) part(ua, new THREE.CylinderGeometry(B.braco * 1.12, B.braco * 1.0, 0.16, 8), M.steel, 0, -0.22, 0);
    // ombreira
    const pr = B.pauldron;
    const pd = part(ua, new THREE.SphereGeometry(pr, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), st.manto ? M.cloth : M.steel, s * 0.02, -0.02, 0);
    pd.scale.set(1.1, 0.8, 1.05); pd.rotation.z = -s * 0.3;
    if (pr > 0.15) {
      part(pd, new THREE.TorusGeometry(pr, 0.028, 5, 16), M.gold, 0, 0, 0, Math.PI / 2);
      part(pd, new THREE.TorusGeometry(pr * 0.62, 0.02, 5, 14), M.gold, 0, pr * 0.78, 0, Math.PI / 2);
      part(pd, new THREE.OctahedronGeometry(0.05, 0), M.gem, 0, pr * 0.55, pr * 0.8).scale.set(1, 1.3, 0.6);
    }
    const fa = bone('foreArm' + side, ua, 0, -0.36, 0);
    part(fa, new THREE.CylinderGeometry(B.braco * 1.05, B.braco * 0.85, 0.3, 8), st.manto ? M.cloth : M.steel, 0, -0.15, 0);
    part(fa, new THREE.TorusGeometry(B.braco * 1.05, 0.022, 5, 12), M.gold, 0, -0.04, 0, Math.PI / 2);
    part(fa, new THREE.TorusGeometry(B.braco * 0.9, 0.02, 5, 12), M.gold, 0, -0.26, 0, Math.PI / 2);
    const hd = bone('hand' + side, fa, 0, -0.32, 0);
    part(hd, rbox(0.12, 0.13, 0.13, 0.04), st.manto ? M.skin : M.leather, 0, -0.04, 0.0);
  }

  // ---------------- Pernas ----------------
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const th = bone('thigh' + side, hips, s * 0.17, -0.06, 0);
    part(th, new THREE.CapsuleGeometry(B.perna, 0.26, 4, 8), M.under, 0, -0.2, 0);
    if (!st.manto) part(th, rbox(B.perna * 2.1, 0.24, B.perna * 2.2, 0.05), M.steel, 0, -0.2, 0.01);
    const sh = bone('shin' + side, th, 0, -0.44, 0);
    part(sh, new THREE.CylinderGeometry(B.perna * 0.95, B.perna * 0.8, 0.38, 8), st.manto ? M.under : M.steel, 0, -0.2, 0);
    // joelheira
    const kn = part(sh, new THREE.OctahedronGeometry(0.1, 0), M.gold, 0, 0.0, B.perna * 0.9);
    kn.scale.set(1, 1.1, 0.6);
    const ft = bone('foot' + side, sh, 0, -0.42, 0);
    part(ft, rbox(B.perna * 1.6, 0.13, 0.32, 0.05), st.manto ? M.leather : M.steel, 0, -0.03, 0.06);
    part(ft, rbox(B.perna * 1.65, 0.035, 0.33, 0.01), M.leather, 0, -0.09, 0.06);
  }

  // ---------------- Capa (3 segmentos que balançam) ----------------
  if (st.capa) {
    const w = B.peito * 1.15;
    const c1 = bone('cape1', chest, 0, 0.3, -0.24);
    part(c1, new THREE.PlaneGeometry(w, 0.5), M.cloth, 0, -0.25, 0);
    const c2 = bone('cape2', c1, 0, -0.5, 0);
    part(c2, new THREE.PlaneGeometry(w * 1.08, 0.5), M.cloth, 0, -0.25, 0);
    const c3 = bone('cape3', c2, 0, -0.5, 0);
    part(c3, new THREE.PlaneGeometry(w * 1.16, 0.45), M.cloth, 0, -0.22, 0);
    part(c3, rbox(w * 1.16, 0.06, 0.02, 0.01), M.gold, 0, -0.43, 0);
    if (st.tabardo) {
      // cruz dourada nas costas
      part(c2, rbox(0.06, 0.4, 0.01, 0.004), M.gold, 0, -0.15, -0.01);
      part(c2, rbox(0.28, 0.05, 0.01, 0.004), M.gold, 0, -0.06, -0.01);
    }
  }

  // ---------------- Arma(s) ----------------
  const weapon = buildWeapon(def.arma, M);
  bones.handR.add(weapon.right);
  if (weapon.left) bones.handL.add(weapon.left);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  for (const n of BONES) if (!bones[n]) bones[n] = new THREE.Group();
  for (const n in bones) bones[n].userData.rest = bones[n].position.clone();
  return { root, bones, weapon, materials: M, style: st };
}

// Armas presas à mão: o cabo passa pelo punho ao longo do eixo Z local da mão.
function buildWeapon(tipo, M) {
  const right = new THREE.Group();
  let left = null;
  const wood = mat(0x5a3a24, { roughness: 0.85, flatShading: true });
  const add = (g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
  };
  const cyl = (r, l) => new THREE.CylinderGeometry(r, r, l, 8).rotateX(Math.PI / 2);
  const star = (size, depth) => {
    const s = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = i % 2 ? size * 0.32 : size;
      s[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 }).translate(0, 0, -depth / 2);
  };

  if (tipo === 'martelo') {
    // martelo sagrado: cabo com empunhadura, cabeça de aço e estrela dourada
    add(right, cyl(0.035, 1.25), wood, 0, -0.04, 0.38);
    for (let i = 0; i < 5; i++) add(right, new THREE.TorusGeometry(0.038, 0.01, 4, 8), M.leather, 0, -0.04, -0.1 + i * 0.07);
    add(right, new THREE.ConeGeometry(0.05, 0.16, 6), M.gold, 0, -0.04, -0.3, -Math.PI / 2);
    add(right, new THREE.TorusGeometry(0.05, 0.018, 5, 8), M.gold, 0, -0.04, 0.72);
    add(right, new THREE.TorusGeometry(0.05, 0.018, 5, 8), M.gold, 0, -0.04, 0.84);
    const head = new THREE.Group(); head.position.set(0, -0.04, 1.08); right.add(head);
    add(head, rbox(0.66, 0.36, 0.36, 0.06), M.steel);
    for (const s of [-1, 1]) {
      add(head, rbox(0.06, 0.4, 0.4, 0.02), M.gold, s * 0.22, 0, 0);
      add(head, rbox(0.04, 0.3, 0.3, 0.02), M.steel, s * 0.355, 0, 0);
      add(head, star(0.15, 0.04), M.gold, 0, s * 0.19, 0, Math.PI / 2);
    }
    add(head, new THREE.OctahedronGeometry(0.05, 0), M.gem, 0, 0.23, 0);
    add(head, new THREE.ConeGeometry(0.06, 0.18, 6), M.gold, 0, 0, 0.26, Math.PI / 2);
    right.userData.tip = head;
  } else if (tipo === 'cetro' || tipo === 'cajado') {
    const long = tipo === 'cajado';
    add(right, cyl(0.03, long ? 1.7 : 0.9), wood, 0, -0.04, long ? 0.45 : 0.25);
    const top = new THREE.Group(); top.position.set(0, -0.04, long ? 1.32 : 0.72); right.add(top);
    add(top, new THREE.TorusGeometry(0.12, 0.025, 6, 16, Math.PI * 1.5), M.gold, 0, 0, 0, 0, Math.PI / 2, Math.PI * 0.75);
    add(top, new THREE.OctahedronGeometry(0.08, 0), M.gem, 0, 0, 0.02);
    right.userData.tip = top;
  } else if (tipo === 'magia') {
    const orb = add(right, new THREE.IcosahedronGeometry(0.12, 1), mat(0xff7a20, { emissive: 0xff5a10, emissiveIntensity: 1.5 }), 0, -0.12, 0.08);
    right.userData.tip = orb;
    left = new THREE.Group();
    add(left, rbox(0.26, 0.06, 0.32, 0.02), mat(0x6a1e1a, { roughness: 0.7 }), 0, -0.1, 0.06);
    add(left, rbox(0.1, 0.07, 0.1, 0.02), M.gold, 0, -0.1, 0.06);
  } else if (tipo === 'adagas' || tipo === 'glaives') {
    const one = () => {
      const g = new THREE.Group();
      if (tipo === 'adagas') {
        add(g, cyl(0.025, 0.16), M.leather, 0, -0.04, 0);
        add(g, rbox(0.16, 0.03, 0.04, 0.01), M.gold, 0, -0.04, 0.09);
        const bl = add(g, new THREE.ConeGeometry(0.05, 0.55, 4), M.steel, 0, -0.04, 0.38, Math.PI / 2);
        bl.scale.set(1, 1, 0.3);
      } else {
        add(g, new THREE.TorusGeometry(0.28, 0.035, 4, 24), M.steel, 0, -0.04, 0.22, 0, 0, 0).rotation.x = Math.PI / 2;
        for (let i = 0; i < 4; i++) add(g, new THREE.ConeGeometry(0.05, 0.18, 4), M.gold, Math.sin(i * 1.57) * 0.33, -0.04, 0.22 + Math.cos(i * 1.57) * 0.33, Math.PI / 2, 0, -i * 1.57);
      }
      return g;
    };
    right.add(one()); left = one();
  } else if (tipo === 'espada-escudo' || tipo === 'cutelo') {
    add(right, cyl(0.03, 0.24), M.leather, 0, -0.04, 0);
    add(right, rbox(0.3, 0.05, 0.06, 0.02), M.gold, 0, -0.04, 0.14);
    if (tipo === 'cutelo') {
      add(right, rbox(0.04, 0.34, 1.0, 0.03), mat(0xe8dcc0, { roughness: 0.5, flatShading: true }), 0, 0.06, 0.66);
    } else {
      const bl = add(right, rbox(0.03, 0.12, 0.95, 0.02), M.steel, 0, -0.04, 0.64);
      add(right, rbox(0.035, 0.04, 0.8, 0.01), M.gold, 0, 0.01, 0.6);
      bl.scale.y = 1;
      left = new THREE.Group();
      add(left, new THREE.CylinderGeometry(0.34, 0.34, 0.06, 6), M.steel, 0, -0.06, 0.12, 0, 0, Math.PI / 2);
      add(left, new THREE.OctahedronGeometry(0.1, 0), M.gem, 0.05, -0.06, 0.12);
      add(left, new THREE.TorusGeometry(0.34, 0.03, 4, 6), M.gold, 0.02, -0.06, 0.12, 0, Math.PI / 2, 0);
    }
  }
  right.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  if (left) left.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { right, left, tipo };
}

// =====================================================================
// Animações (poses procedurais). Cada pose devolve rotações [x, y, z] por osso
// e deslocamentos opcionais do quadril (hipsY, hipsZ). O Animator mistura:
//   camada base: idle ↔ corrida (pela velocidade)
//   camada de ação: ataque, habilidades, esquiva (sobrepõe os ossos que define)
// =====================================================================
const sin = Math.sin, cos = Math.cos, PI = Math.PI;
const ease = (t) => t * t * (3 - 2 * t);
const outBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const L = (a, b, k) => a + (b - a) * k;
const LV = (a, b, k) => a.map((v, i) => L(v, b[i], k));

// Pose segurando o martelo apoiado (descanso).
function restArms(p, t, wpn) {
  const br = sin(t * 2.2) * 0.03;
  p.upperArmL = [0.05 + br, 0, 0.14]; p.foreArmL = [-0.25, 0, 0]; p.handL = [0, 0, 0];
  if (wpn === 'martelo') { p.upperArmR = [-0.15 + br, 0, -0.18]; p.foreArmR = [-0.35, 0, 0]; p.handR = [1.35, 0.25, 0]; }
  else if (wpn === 'cajado' || wpn === 'cetro') { p.upperArmR = [-0.1, 0, -0.15]; p.foreArmR = [-1.0, 0, 0]; p.handR = [-0.55, 0, 0]; }
  else { p.upperArmR = [0.0 + br, 0, -0.14]; p.foreArmR = [-0.4, 0, 0]; p.handR = [0.9, 0, 0]; p.upperArmL = [0.0 + br, 0, 0.14]; p.foreArmL = [-0.4, 0, 0]; p.handL = [0.9, 0, 0]; }
}

export const POSES = {
  idle(t, wpn) {
    const b = sin(t * 2.2);
    const p = {
      hipsY: -0.02 + b * 0.012, spine: [0.02, 0, 0], chest: [-0.03 + b * 0.02, 0, 0], neck: [0.04, 0, 0], head: [-0.05 - b * 0.02, 0, 0],
      thighL: [0.02, 0, 0.06], shinL: [0.06, 0, 0], footL: [-0.06, 0, 0],
      thighR: [-0.05, 0, -0.08], shinR: [0.1, 0, 0], footR: [-0.05, 0, 0],
      cape1: [0.12, 0, 0], cape2: [0.04 + b * 0.02, 0, 0], cape3: [0.03, 0, 0],
    };
    restArms(p, t, wpn);
    return p;
  },
  run(t, wpn) {
    const f = t * 9.5;               // fase da passada
    const s = sin(f), c2 = cos(f * 2);
    const p = {
      hipsY: -0.06 + Math.abs(cos(f)) * 0.09, hipsZ: 0, hips: [0, s * 0.18, 0],
      spine: [0.18, -s * 0.12, 0], chest: [0.08, -s * 0.12, 0], neck: [-0.1, 0, 0], head: [-0.12, s * 0.12, 0],
      thighL: [-s * 0.85 - 0.1, 0, 0.04], shinL: [Math.max(0, s) * 1.25 + 0.25, 0, 0], footL: [-s * 0.3, 0, 0],
      thighR: [s * 0.85 - 0.1, 0, -0.04], shinR: [Math.max(0, -s) * 1.25 + 0.25, 0, 0], footR: [s * 0.3, 0, 0],
      upperArmL: [s * 0.7, 0, 0.18], foreArmL: [-0.9, 0, 0], handL: [0, 0, 0],
      cape1: [0.38 + c2 * 0.04, 0, 0], cape2: [0.12 + sin(f * 2 + 1) * 0.1, 0, 0], cape3: [0.1 + sin(f * 2 + 2) * 0.12, 0, 0],
    };
    if (wpn === 'martelo') { p.upperArmR = [0.25 - s * 0.15, 0, -0.22]; p.foreArmR = [-0.35, 0, 0]; p.handR = [2.25, 0.2, 0]; }
    else if (wpn === 'cajado' || wpn === 'cetro') { p.upperArmR = [-0.2 - s * 0.3, 0, -0.18]; p.foreArmR = [-1.1, 0, 0]; p.handR = [-0.3, 0, 0]; }
    else { p.upperArmR = [-s * 0.7, 0, -0.18]; p.foreArmR = [-0.9, 0, 0]; p.handR = [0.7, 0, 0]; p.handL = [0.7, 0, 0]; }
    return p;
  },

  // Ataque básico: golpe diagonal com as duas mãos (da direita-alta para a esquerda-baixa).
  // n = 0..1 (fase normalizada). O impacto acontece em ~0.55.
  ataque(n, wpn, variante = 0) {
    const wind = ease(seg(n, 0, 0.32));
    const hit = outBack(seg(n, 0.32, 0.6));
    const rec = ease(seg(n, 0.7, 1));
    const m = variante ? -1 : 1;
    // pose de preparação (martelo atrás do ombro direito)
    const A = {
      spine: [-0.1, -0.55 * m, 0], chest: [-0.15, -0.45 * m, 0], hipsY: -0.04,
      upperArmR: [-2.5, 0, -0.5], foreArmR: [-0.9, 0, 0], handR: [0.2, 0, 0],
      upperArmL: [-2.2, 0, 0.5], foreArmL: [-1.2, 0, 0], handL: [0, 0, 0],
      thighL: [-0.35, 0, 0.1], shinL: [0.35, 0, 0], thighR: [0.25, 0, -0.1], shinR: [0.3, 0, 0],
      head: [0.05, 0.3 * m, 0],
    };
    // pose de impacto (martelo lá embaixo, à esquerda-frente)
    const Bp = {
      spine: [0.35, 0.45 * m, 0], chest: [0.3, 0.4 * m, 0], hipsY: -0.14,
      upperArmR: [-1.1, 0, 0.35], foreArmR: [-0.15, 0, 0], handR: [0.6, 0, 0],
      upperArmL: [-0.9, 0, -0.25], foreArmL: [-0.5, 0, 0], handL: [0, 0, 0],
      thighL: [-0.7, 0, 0.12], shinL: [0.7, 0, 0], thighR: [0.45, 0, -0.12], shinR: [0.45, 0, 0],
      head: [0.15, -0.2 * m, 0],
    };
    const p = {};
    for (const k of Object.keys(A)) p[k] = Array.isArray(A[k]) ? LV(A[k], Bp[k], hit) : L(A[k], Bp[k], hit);
    // entrada: o Animator sobe o peso com _in; saída: relaxa com _weight
    p._weight = 1 - rec;
    p._in = wind;
    return p;
  },

  // Q: ergue o martelo aos céus e crava no chão.
  consagracao(n) {
    const up = ease(seg(n, 0, 0.35));
    const slam = outBack(seg(n, 0.42, 0.62));
    const rec = ease(seg(n, 0.8, 1));
    const p = {
      hipsY: L(L(0, 0.04, up), -0.32, slam),
      spine: [L(L(0, -0.25, up), 0.5, slam), 0, 0], chest: [L(L(0, -0.2, up), 0.35, slam), 0, 0],
      neck: [L(-0.2 * up, 0.1, slam), 0, 0], head: [L(-0.4 * up, 0.0, slam), 0, 0],
      upperArmR: [L(L(-0.3, -3.0, up), -1.2, slam), 0, L(-0.2, 0.15, up)], foreArmR: [L(-0.4, -0.15, up), 0, 0], handR: [L(1.0, -0.1, up) + slam * 0.9, 0, 0],
      upperArmL: [L(L(0, -2.9, up), -1.1, slam), 0, L(0.15, -0.2, up)], foreArmL: [L(-0.3, -0.3, up), 0, 0], handL: [0, 0, 0],
      thighL: [L(-0.1, -1.0, slam), 0, 0.1], shinL: [L(0.1, 1.3, slam), 0, 0], footL: [L(0, -0.3, slam), 0, 0],
      thighR: [L(0.1, 0.2, slam), 0, -0.1], shinR: [L(0.1, 1.6, slam), 0, 0], footR: [L(0, 0.4, slam), 0, 0],
      cape1: [L(0.1, 0.3, slam), 0, 0], cape2: [0.1 * slam, 0, 0],
    };
    p._weight = 1 - rec;
    return p;
  },

  // E: martelo junto ao peito, cabeça baixa (oração de proteção).
  protecao(n) {
    const k = ease(seg(n, 0, 0.3));
    const rec = ease(seg(n, 0.75, 1));
    return {
      _weight: 1 - rec,
      hipsY: -0.08 * k, spine: [0.1 * k, 0, 0], chest: [0.05 * k, 0, 0], neck: [0.3 * k, 0, 0], head: [0.25 * k, 0, 0],
      upperArmR: [-0.9 * k, 0, 0.35 * k], foreArmR: [-1.5 * k, 0, 0], handR: [1.3 - 2.4 * k, 0, 0],
      upperArmL: [-0.8 * k, 0, -0.4 * k], foreArmL: [-1.6 * k, 0, 0], handL: [0, 0, 0],
      thighL: [-0.2 * k, 0, 0.1], shinL: [0.3 * k, 0, 0], thighR: [0.1 * k, 0, -0.1], shinR: [0.3 * k, 0, 0],
    };
  },

  // Esquiva: investida abaixada para frente.
  esquiva(n) {
    const k = sin(PI * Math.min(1, n));
    return {
      _weight: k,
      hipsY: -0.22 * k, spine: [0.55, 0, 0], chest: [0.3, 0, 0], head: [-0.4, 0, 0],
      thighL: [-1.1, 0, 0.1], shinL: [1.2, 0, 0], thighR: [0.6, 0, -0.1], shinR: [0.9, 0, 0],
      upperArmL: [0.6, 0, 0.5], foreArmL: [-0.6, 0, 0], upperArmR: [0.5, 0, -0.5], foreArmR: [-0.5, 0, 0], handR: [1.2, 0, 0],
      cape1: [0.6, 0, 0], cape2: [0.2, 0, 0], cape3: [0.15, 0, 0],
    };
  },

  // Levou dano: tranco para trás.
  dano(n) {
    const k = sin(PI * Math.min(1, n));
    return { _weight: k * 0.8, spine: [-0.35, 0, 0.1], chest: [-0.2, 0, 0], head: [-0.3, 0, 0] };
  },
};

const DURACAO = { ataque: 0.42, consagracao: 0.9, protecao: 0.55, esquiva: 0.22, dano: 0.25 };

export class Animator {
  constructor(rig, arma) {
    this.rig = rig; this.arma = arma;
    this.t = 0; this.speed = 0;           // 0..1 (parado → correndo)
    this.action = null;                   // { name, n, dur, variante }
    this.prevAction = null;               // ação anterior para cruzar suavemente
    this.cape = { x: 0, v: 0 };
  }

  play(name, { dur, variante = 0 } = {}) {
    if (this.action) this.prevAction = { ...this.action, fade: 0 };
    this.action = { name, n: 0, dur: dur || DURACAO[name], variante };
  }
  get busy() { return !!this.action; }

  update(dt, speed01) {
    this.t += dt;
    this.speed += (speed01 - this.speed) * Math.min(1, dt * 10);
    const idle = POSES.idle(this.t, this.arma);
    const run = POSES.run(this.t, this.arma);
    const w = ease(Math.min(1, this.speed));
    const pose = {};
    for (const k of new Set([...Object.keys(idle), ...Object.keys(run)])) {
      const a = idle[k] ?? (Array.isArray(run[k]) ? [0, 0, 0] : 0);
      const b = run[k] ?? (Array.isArray(a) ? [0, 0, 0] : 0);
      pose[k] = Array.isArray(a) ? LV(a, b, w) : L(a, b, w);
    }

    const applyAction = (act, mul) => {
      const ap = POSES[act.name](act.n, this.arma, act.variante);
      let wgt = (ap._weight ?? 1) * mul;
      if (ap._in !== undefined) wgt *= Math.min(1, 0.35 + ap._in);
      // ao correr, a ação domina só o tronco; pernas seguem a corrida (menos nos golpes pesados)
      const legsW = act.name === 'ataque' ? 1 - w * 0.75 : 1;
      for (const k in ap) {
        if (k[0] === '_') continue;
        const legs = /thigh|shin|foot/.test(k);
        const ww = wgt * (legs ? legsW : 1);
        const base = pose[k] ?? (Array.isArray(ap[k]) ? [0, 0, 0] : 0);
        pose[k] = Array.isArray(ap[k]) ? LV(base, ap[k], ww) : L(base, ap[k], ww);
      }
    };

    if (this.prevAction) {
      this.prevAction.fade += dt / 0.08;
      if (this.prevAction.fade >= 1) this.prevAction = null;
      else applyAction(this.prevAction, 1 - this.prevAction.fade);
    }
    if (this.action) {
      const a = this.action;
      a.n += dt / a.dur;
      applyAction(a, 1);
      if (a.n >= 1) this.action = null;
    }

    // aplica nos ossos
    const B = this.rig.bones;
    for (const k in B) {
      const r = pose[k];
      if (r) B[k].rotation.set(r[0], r[1], r[2]);
      else B[k].rotation.set(0, 0, 0);
    }
    const rest = B.hips.userData.rest;
    B.hips.position.set(rest.x, rest.y + (pose.hipsY || 0), rest.z + (pose.hipsZ || 0));
    return pose;
  }
}
