import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildDalarian } from '../src/models/dalarian.js';

// =====================================================================
// Rig automático do modelo do Tripo 3D (malha estática em T-pose).
// 1. Clona o esqueleto da Universal Animation Library (Quaternius, CC0)
//    em T-pose e move cada articulação para o ponto medido na malha
//    (as rotações de repouso ficam iguais → as animações servem direto).
// 2. Pesos da pele por distância aos ossos, com regras por região
//    (lado esquerdo/direito, pernas, braços, capa, tabardo) e suavização
//    pela vizinhança da malha.
// 3. Capa com 3 ossos próprios, movidos à mão (levanta com a corrida).
// =====================================================================

// articulações medidas na malha (metros do modelo; frente = +Z, esquerda = +X)
const J = {
  'DEF-hips': [0, 0.45, 0.02], 'DEF-spine001': [0, 0.5, 0.02], 'DEF-spine002': [0, 0.56, 0.02], 'DEF-spine003': [0, 0.62, 0.02],
  'DEF-neck': [0, 0.705, 0.025], 'DEF-head': [0, 0.745, 0.03],
  'DEF-shoulderL': [0.03, 0.7, 0.04], 'DEF-upper_armL': [0.13, 0.67, 0.03], 'DEF-forearmL': [0.265, 0.645, 0.035], 'DEF-handL': [0.385, 0.635, 0.045],
  'DEF-thighL': [0.075, 0.43, 0.02], 'DEF-shinL': [0.09, 0.26, 0.03], 'DEF-footL': [0.105, 0.075, 0.02], 'DEF-toeL': [0.105, 0.018, 0.11],
};
for (const [k, v] of Object.entries({ ...J })) if (k.endsWith('L')) J[k.slice(0, -1) + 'R'] = [-v[0], v[1], v[2]];
const END = { 'DEF-head': [0, 0.86, 0.04], 'DEF-handL': [0.48, 0.63, 0.05], 'DEF-handR': [-0.48, 0.63, 0.05], 'DEF-toeL': [0.105, 0.015, 0.16], 'DEF-toeR': [-0.105, 0.015, 0.16] };
const CAPE = [[0, 0.66, -0.06], [0, 0.42, -0.1], [0, 0.24, -0.13], [0, 0.12, -0.16]];

const V = (a) => new THREE.Vector3(...a);
// joias vermelhas que o Tripo inventou → azuis, como na arte do martelo
function recolorRedToBlue(tex) {
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    if (r > 140 && gg < 0.38 * r && b < 0.5 * r) { p[i] = r * 0.15; p[i + 1] = r * 0.55; p[i + 2] = Math.min(255, r * 1.05); }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = tex.flipY; t.colorSpace = tex.colorSpace; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  return t;
}
const wp = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

export async function buildTripoHero({ model = './tripo/dalarian.glb', hammer = true, hammerModel = './tripo/martelo.glb' } = {}) {
  const L = new GLTFLoader();
  const [mg, lg] = await Promise.all([L.loadAsync(model), L.loadAsync('./anim-lib/AnimationLibrary_Godot_Standard.gltf')]);
  let src; mg.scene.traverse((o) => { if (o.isMesh) src = o; });
  const lib = lg.scene;
  let libSkin; lib.traverse((o) => { if (o.isSkinnedMesh) { libSkin = o; o.visible = false; } });
  const rigObj = lib.getObjectByName('Rig');
  const bone = (n) => lib.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(n));

  // T-pose de repouso
  const tpose = lg.animations.find((a) => a.name === 'A_TPose');
  const m0 = new THREE.AnimationMixer(lib); m0.clipAction(tpose).play(); m0.setTime(0); m0.stopAllAction();
  lib.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(libSkin);
  const s = 0.871 / (box.max.y - box.min.y);
  rigObj.scale.multiplyScalar(s); lib.updateMatrixWorld(true);
  const libHipsRest = bone('DEF-hips').position.clone();

  // move as articulações para os pontos medidos (de cima para baixo na hierarquia)
  const bones = libSkin.skeleton.bones;
  const target = new Map();
  const old = new Map(bones.map((b) => [b, wp(b)]));
  const visit = (b) => {
    if (J[b.name]) target.set(b, V(J[b.name]));
    else if (b.parent && b.parent.isBone && target.has(b.parent)) {
      // dedos etc.: mesmo deslocamento relativo ao pai, escalado
      const p = b.parent, k = p.name.includes('hand') || p.name.includes('f_') || p.name.includes('thumb') ? 1.1 : 1;
      target.set(b, target.get(p).clone().add(old.get(b).clone().sub(old.get(p)).multiplyScalar(k)));
    } else target.set(b, old.get(b));
    for (const c of b.children) if (c.isBone) visit(c);
  };
  visit(bone('root'));
  const place = (b) => {
    if (b.parent) { b.parent.updateMatrixWorld(true); b.position.copy(b.parent.worldToLocal(target.get(b).clone())); }
    b.updateMatrixWorld(true);
    for (const c of b.children) if (c.isBone) place(c);
  };
  place(bone('root'));
  const hipsRest = bone('DEF-hips').position.clone();
  const hipsRestW = wp(bone('DEF-hips'));
  const hipK = 0.45 / old.get(bone('DEF-hips')).y;
  // posição de repouso do quadril da biblioteca, no mundo (para medir o quanto a animação sobe/desce)
  const libRestLocal = libHipsRest.clone();

  // ossos da capa (filhos do peito)
  const chest = bone('DEF-spine003');
  const cape = [];
  let par = chest;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Bone(); b.name = 'cape' + i;
    par.updateMatrixWorld(true);
    b.position.copy(par.worldToLocal(V(CAPE[i])));
    // orientação neutra no mundo (para girar em X = levantar para trás)
    const pq = par.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(pq.invert());
    par.add(b); b.updateMatrixWorld(true); cape.push(b); par = b;
  }
  const capeRest = cape.map((b) => b.quaternion.clone());

  // segmentos para os pesos
  const segs = [];
  const seg = (b, a, e, region) => segs.push({ b, a: V(a), e: V(e), region });
  const kids = { 'DEF-hips': 'DEF-spine001', 'DEF-spine001': 'DEF-spine002', 'DEF-spine002': 'DEF-spine003', 'DEF-spine003': 'DEF-neck', 'DEF-neck': 'DEF-head' };
  for (const [a, e] of Object.entries(kids)) seg(bone(a), J[a], J[e], 'tronco');
  seg(bone('DEF-head'), J['DEF-head'], END['DEF-head'], 'cabeca');
  for (const S of ['L', 'R']) {
    const n = (x) => 'DEF-' + x + S;
    seg(bone(n('shoulder')), J[n('shoulder')], J[n('upper_arm')], 'ombro' + S);
    seg(bone(n('upper_arm')), J[n('upper_arm')], J[n('forearm')], 'braco' + S);
    seg(bone(n('forearm')), J[n('forearm')], J[n('hand')], 'braco' + S);
    seg(bone(n('hand')), J[n('hand')], END[n('hand')], 'braco' + S);
    seg(bone(n('thigh')), J[n('thigh')], J[n('shin')], 'perna' + S);
    seg(bone(n('shin')), J[n('shin')], J[n('foot')], 'perna' + S);
    seg(bone(n('foot')), J[n('foot')], J[n('toe')], 'perna' + S);
    seg(bone(n('toe')), J[n('toe')], END[n('toe')], 'perna' + S);
  }

  const skelBones = [...bones, ...cape];
  const idx = new Map(skelBones.map((b, i) => [b, i]));
  const geo = src.geometry.clone();
  const pos = geo.attributes.position, N = pos.count;
  const W = Array.from({ length: N }, () => new Map());
  const p = new THREE.Vector3(), q = new THREE.Vector3(), ab = new THREE.Vector3();
  const dseg = (sg) => { ab.subVectors(sg.e, sg.a); const t = THREE.MathUtils.clamp(q.subVectors(p, sg.a).dot(ab) / ab.lengthSq(), 0, 1); return p.distanceTo(q.copy(sg.a).addScaledVector(ab, t)); };
  const H = (b) => idx.get(bone(b));
  const capeW = (m, y) => {
    // ao longo da capa: peito → cape0 → cape1 → cape2
    const ys = [0.66, 0.42, 0.24, 0.12], ids = [idx.get(chest), idx.get(cape[0]), idx.get(cape[1]), idx.get(cape[2])];
    if (y >= ys[0]) { m.set(ids[0], 1); return; }
    for (let i = 0; i < 3; i++) if (y >= ys[i + 1] || i === 2) {
      const t = THREE.MathUtils.clamp((ys[i] - y) / (ys[i] - ys[i + 1]), 0, 1);
      m.set(ids[i], (m.get(ids[i]) || 0) + 1 - t); m.set(ids[i + 1], (m.get(ids[i + 1]) || 0) + t); return;
    }
  };
  const kind = new Uint8Array(N);   // 0 corpo, 1 capa, 2 tabardo
  for (let v = 0; v < N; v++) {
    p.fromBufferAttribute(pos, v);
    const { x, y, z } = p, ax = Math.abs(x);
    const isCape = y < 0.64 && y > 0.1 && ax < 0.26 && (z < -0.05 - Math.max(0, 0.5 - y) * 0.05 || (y < 0.45 && ax > 0.165 && z < 0.06));
    const isFlap = !isCape && ax < 0.07 && y < 0.46 && y > 0.12 && z > 0.035;
    const m = W[v];
    if (isCape) { kind[v] = 1; capeW(m, y); continue; }
    if (isFlap) {
      kind[v] = 2; const t = THREE.MathUtils.clamp((0.46 - y) / 0.3, 0, 1);
      m.set(H('DEF-hips'), 1 - t * 0.55);
      m.set(H('DEF-thighL'), t * 0.55 * THREE.MathUtils.clamp(0.5 + x / 0.12, 0, 1));
      m.set(H('DEF-thighR'), t * 0.55 * THREE.MathUtils.clamp(0.5 - x / 0.12, 0, 1));
      continue;
    }
    const cand = [];
    for (const sg of segs) {
      const r = sg.region;
      if (r.endsWith('L') && x < -0.015) continue;
      if (r.endsWith('R') && x > 0.015) continue;
      if (r.startsWith('perna') && y > 0.5) continue;
      if (r.startsWith('braco') && (ax < 0.1 || y < 0.52)) continue;
      if (r.startsWith('ombro') && y < 0.55) continue;
      if (r === 'cabeca' && y < 0.69) continue;
      if (r === 'tronco' && y < 0.3) continue;
      cand.push([idx.get(sg.b), dseg(sg)]);
    }
    cand.sort((a, b) => a[1] - b[1]);
    for (const [i, d] of cand.slice(0, 3)) m.set(i, (m.get(i) || 0) + 1 / Math.pow(d + 0.006, 4));
  }
  // suavização pela vizinhança (vértices soldados por posição)
  const key = (v) => `${pos.getX(v).toFixed(4)},${pos.getY(v).toFixed(4)},${pos.getZ(v).toFixed(4)}`;
  const weld = new Map(), wid = new Int32Array(N);
  for (let v = 0; v < N; v++) { const k = key(v); if (!weld.has(k)) weld.set(k, weld.size); wid[v] = weld.get(k); }
  const norm = (m) => { let t = 0; for (const w of m.values()) t += w; for (const [i, w] of m) m.set(i, w / t); return m; };
  W.forEach(norm);
  const nb = Array.from({ length: weld.size }, () => new Set());
  const ind = geo.index.array;
  for (let t = 0; t < ind.length; t += 3) for (let a = 0; a < 3; a++) { const u = wid[ind[t + a]], w = wid[ind[t + (a + 1) % 3]]; nb[u].add(w); nb[w].add(u); }
  let G = Array.from({ length: weld.size }, () => new Map());
  for (let v = 0; v < N; v++) G[wid[v]] = W[v];
  const gk = new Uint8Array(weld.size); for (let v = 0; v < N; v++) gk[wid[v]] = kind[v];
  for (let it = 0; it < 4; it++) {
    G = G.map((m, g) => {
      const o = new Map(); const add = (mm, f) => { for (const [i, w] of mm) o.set(i, (o.get(i) || 0) + w * f); };
      add(m, 1);
      const ns = [...nb[g]].filter((h) => gk[h] === gk[g]);
      for (const h of ns) add(G[h], 1 / Math.max(1, ns.length));
      return norm(o);
    });
  }
  const si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
  for (let v = 0; v < N; v++) {
    const top = [...G[wid[v]]].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const t = top.reduce((a, b) => a + b[1], 0);
    top.forEach(([i, w], k) => { si[v * 4 + k] = i; sw[v * 4 + k] = w / t; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));

  lib.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(skelBones);
  const mat = src.material.clone();
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.frustumCulled = false;
  lib.add(mesh);
  mesh.bind(skeleton, new THREE.Matrix4());

  // martelo do modelo antigo, preso na mão direita
  let weapon = null;
  if (hammer) {
    weapon = new THREE.Group();
    if (hammerModel) {
      // martelo do Tripo: em pé (+Y, cabeça em cima) → deitado para a frente (+Z), empunhado a 28% do comprimento
      const hm = (await L.loadAsync(hammerModel)).scene;
      hm.traverse((o) => { if (o.isMesh && o.material.map) o.material.map = recolorRedToBlue(o.material.map); });
      const hb = new THREE.Box3().setFromObject(hm), len = hb.max.y - hb.min.y;
      const k = 0.46 / (0.27 * len), grip = hb.min.y + len * 0.28;
      const inner = new THREE.Group(); inner.add(hm);
      hm.position.y = -grip; inner.rotation.x = Math.PI / 2; inner.scale.setScalar(k);
      weapon.add(inner);
    } else {
      const old = buildDalarian();
      const w = old.weapon.right; w.removeFromParent(); w.position.set(0, 0, 0); weapon.add(w);
    }
    const hr = bone('DEF-handR');
    hr.add(weapon);
    hr.updateMatrixWorld(true);
    const inv = 1 / hr.getWorldScale(new THREE.Vector3()).x;
    weapon.scale.setScalar(0.27 * inv);
    // em T-pose: cabo apontando para a frente (+Z), cabeça do martelo para cima
    weapon.quaternion.copy(hr.getWorldQuaternion(new THREE.Quaternion()).invert());
    weapon.position.copy(hr.worldToLocal(V(END['DEF-handR']).lerp(V(J['DEF-handR']), 0.55).add(V([0, -0.012, 0]))));
  }

  // clipes: só rotações + posição do quadril (o resto viria do esqueleto original)
  const clips = {};
  for (const c of lg.animations) {
    const k = c.clone();
    k.tracks = k.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'DEF-hips.position');
    clips[c.name] = k;
  }
  const mixer = new THREE.AnimationMixer(lib);
  const hips = bone('DEF-hips');
  const holder = new THREE.Group(); holder.add(lib);
  return {
    holder, lib, mesh, mixer, clips, bone, cape, capeRest, weapon, skeleton,
    // depois de mixer.setTime: quadril no lugar (sem andar) e na escala do modelo
    fixHips() {
      // deslocamento animado do quadril, convertido para o mundo; só o vertical conta
      const par = hips.parent; par.updateMatrixWorld(true);
      const d = hips.position.clone().sub(libRestLocal).applyMatrix3(new THREE.Matrix3().setFromMatrix4(par.matrixWorld));
      const hq = holder.quaternion.clone(); d.applyQuaternion(hq.invert());
      hips.position.copy(hipsRest);
      par.updateMatrixWorld(true);
      const w = hipsRestW.clone().add(new THREE.Vector3(0, d.y * hipK, 0)).applyMatrix4(holder.matrixWorld);
      hips.position.copy(par.worldToLocal(w));
    },
    setCape(lift, phase = 0) {
      // capa pende na vertical do mundo e levanta para trás
      const up = holder.quaternion;
      for (let i = 0; i < 3; i++) {
        const b = cape[i], P = b.parent.getWorldQuaternion(new THREE.Quaternion());
        const a = (i === 0 ? lift * 0.7 : lift * 0.35) + Math.sin(phase + i) * 0.06 * (0.3 + lift);
        const want = up.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a));
        if (i === 0) b.quaternion.copy(P.invert().multiply(want));
        else b.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (lift * 0.3 + Math.sin(phase + i) * 0.08 * lift));
        b.updateMatrixWorld(true);
      }
    },
  };
}
