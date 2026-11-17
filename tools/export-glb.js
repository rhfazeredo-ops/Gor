import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildCharacter, Animator } from '../src/rig.js';
import { HEROES } from '../src/data/heroes.js';

// Exporta um herói (modelo + esqueleto + animações) como .glb com skin,
// para usar em outras ferramentas (Blender, conversor de splats etc.).
// Uso: abra tools/export-glb.html?hero=dalarian com o npm run dev rodando.
const FPS = 30;
const CLIPS = [
  ['idle', null, 2.86, 0], ['walk', null, 0.66, 1],
  ['ataque', 'ataque', 0.42, 0], ['ataque2', 'ataque', 0.42, 0], ['consagracao', 'consagracao', 0.9, 0],
  ['protecao', 'protecao', 0.55, 0], ['esquiva', 'esquiva', 0.22, 0], ['dano', 'dano', 0.25, 0],
];

export async function exportHero(id) {
  const def = HEROES.find((h) => h.id === id);
  const rig = buildCharacter(def, { outline: false });
  rig.root.updateMatrixWorld(true);

  // ---- ossos (THREE.Bone) com a mesma hierarquia e posição de descanso ----
  const groups = Object.entries(rig.bones).filter(([, g]) => g.isGroup && g.parent);
  const boneOf = new Map();
  const bones = [];
  const rootBone = new THREE.Bone(); rootBone.name = 'root';
  bones.push(rootBone);
  boneOf.set(rig.root, rootBone);
  const make = (g) => {
    if (boneOf.has(g)) return boneOf.get(g);
    const parent = make(g.parent);
    const b = new THREE.Bone(); b.name = g.name || 'b' + bones.length;
    // posição de descanso no espaço do pai, sem escala (o skinning não usa escala)
    const pw = new THREE.Vector3().setFromMatrixPosition(g.parent.matrixWorld);
    const gw = new THREE.Vector3().setFromMatrixPosition(g.matrixWorld);
    b.position.copy(gw.sub(pw));
    parent.add(b); bones.push(b); boneOf.set(g, b);
    return b;
  };
  for (const [, g] of groups) make(g);
  const boneIndex = new Map(bones.map((b, i) => [b, i]));

  // ---- uma malha com skin: cada vértice 100% preso ao seu osso ----
  const parts = { base: [], glow: [] };
  for (const [, g] of groups) {
    for (const m of g.children) {
      if (!m.isMesh) continue;
      const geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      const n = geo.attributes.position.count;
      const bi = boneIndex.get(boneOf.get(g));
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      // separa gemas (brilham) do resto
      const surf = geo.attributes.aSurf.array;
      const pick = (want) => {
        const idx = [];
        for (let i = 0; i < n; i += 3) if ((surf[i] > 1.5) === want) idx.push(i, i + 1, i + 2);
        if (!idx.length) return null;
        const out = new THREE.BufferGeometry();
        for (const k of ['position', 'normal', 'color', 'skinIndex', 'skinWeight']) {
          const a = geo.attributes[k], sz = a.itemSize;
          const arr = new a.array.constructor(idx.length * sz);
          idx.forEach((v, j) => { for (let c = 0; c < sz; c++) arr[j * sz + c] = a.array[v * sz + c]; });
          out.setAttribute(k, new THREE.BufferAttribute(arr, sz));
        }
        return out;
      };
      const a = pick(false), b = pick(true);
      if (a) parts.base.push(a); if (b) parts.glow.push(b);
    }
  }
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
  const scene = new THREE.Scene();
  const armature = new THREE.Group(); armature.name = def.id;
  armature.add(rootBone);
  scene.add(armature);
  const skeleton = new THREE.Skeleton(bones);
  const meshes = [];
  for (const [k, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const mat = k === 'glow'
      ? new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x3a8bff, emissiveIntensity: 1, name: 'gema' })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, name: 'corpo' });
    const sm = new THREE.SkinnedMesh(mergeGeometries(list), mat);
    sm.name = def.id + '_' + k;
    armature.add(sm);
    meshes.push(sm);
  }
  armature.updateMatrixWorld(true);
  skeleton.calculateInverses();   // inversas no pose de descanso (depois de montar a hierarquia)
  for (const sm of meshes) sm.bind(skeleton, new THREE.Matrix4());

  // ---- animações: amostra o Animator procedural quadro a quadro ----
  const groupsByName = Object.fromEntries(groups.map(([n, g]) => [n, g]));
  const clips = [];
  for (const [clipName, action, dur, speed] of CLIPS) {
    const anim = new Animator(rig, def.arma);
    anim.speed = speed;
    const frames = Math.max(2, Math.round(dur * FPS) + 1);
    const times = [], q = {}, hipsPos = [];
    for (const n in groupsByName) q[n] = [];
    for (let f = 0; f < frames; f++) {
      const t = f / FPS;
      if (action) { anim.action = { name: action, n: Math.min(0.999, t / dur), dur, variante: clipName === 'ataque2' ? 1 : 0 }; anim.prevAction = null; anim.update(0, speed); }
      else { anim.t = t; anim.update(0, speed); }
      times.push(t);
      for (const n in groupsByName) { const r = groupsByName[n].quaternion; q[n].push(r.x, r.y, r.z, r.w); }
      const h = groupsByName.hips, hb = boneOf.get(h);
      hipsPos.push(hb.position.x, hb.position.y + (h.position.y - h.userData.rest.y), hb.position.z + (h.position.z - h.userData.rest.z));
    }
    const tracks = Object.keys(q).map((n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, times, q[n]));
    tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, hipsPos));
    clips.push(new THREE.AnimationClip(clipName, -1, tracks));
  }

  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations: clips });
  return glb;
}

// modo página: exporta e deixa o resultado em base64 para o script de build
const id = new URLSearchParams(location.search).get('hero') || 'dalarian';
exportHero(id).then((buf) => {
  const bytes = new Uint8Array(buf);
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  window.__glb = btoa(s);
  document.getElementById('log').textContent = `pronto: ${id}.glb (${(bytes.length / 1024).toFixed(0)} KB)`;
  // download quando aberto à mão
  if (!navigator.webdriver) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf])); a.download = id + '.glb'; a.click();
  }
}).catch((e) => { document.getElementById('log').textContent = 'erro: ' + e.stack; window.__glbErr = String(e.stack); });
