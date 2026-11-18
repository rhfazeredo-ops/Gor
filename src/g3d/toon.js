import * as THREE from 'three';

// =====================================================================
// Visual "cel-shading" com contorno marcante (estilo ilustrado):
//  - MeshToonMaterial com rampa de 3 faixas (luz chapada, sem degradê);
//  - contorno por "casco invertido": cópia da malha com faces de trás,
//    empurrada para fora pela normal, em cor escura.
// =====================================================================
function ramp(steps) {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
export const RAMP = ramp([70, 150, 230, 255]);

const toonCache = new Map();
export function toon(color, { emissive = 0x000000, emissiveIntensity = 0, flat = true } = {}) {
  const key = `${color}|${emissive}|${emissiveIntensity}|${flat}`;
  if (toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP, emissive, emissiveIntensity });
  m.flatShading = flat;
  toonCache.set(key, m);
  return m;
}

// converte materiais quaisquer para toon, mantendo a cor
export function toToon(m, remap = {}) {
  const c = m.color ? m.color.getHex() : 0xffffff;
  const col = remap[c] ?? c;
  const e = m.emissive && m.emissiveIntensity > 0.3 ? m.emissive.getHex() : 0;
  return toon(col, { emissive: e, emissiveIntensity: e ? 1.2 : 0 });
}

const outlineMats = new Map();
function outlineMaterial(thick, skinned) {
  const key = thick + (skinned ? 's' : '');
  if (outlineMats.has(key)) return outlineMats.get(key);
  const m = new THREE.MeshBasicMaterial({ color: 0x120a16, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${thick.toFixed(4)};`);
  };
  outlineMats.set(key, m);
  return m;
}

// adiciona contorno a todas as malhas dentro de obj
export function addOutlines(obj, thick = 0.018) {
  const list = [];
  obj.traverse((o) => { if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) list.push(o); });
  for (const o of list) {
    let line;
    if (o.isSkinnedMesh) {
      line = new THREE.SkinnedMesh(o.geometry, outlineMaterial(thick, true));
      line.bind(o.skeleton, o.bindMatrix);
    } else {
      line = new THREE.Mesh(o.geometry, outlineMaterial(thick / Math.max(0.2, avgScale(o)), false));
    }
    line.userData.isOutline = true;
    line.castShadow = false; line.receiveShadow = false;
    line.position.copy(o.position); line.quaternion.copy(o.quaternion); line.scale.copy(o.scale);
    line.matrixAutoUpdate = o.matrixAutoUpdate;
    o.parent.add(line);
    if (o.isSkinnedMesh) line.frustumCulled = false;
  }
}
function avgScale(o) { const w = new THREE.Vector3(); o.getWorldScale(w); return (w.x + w.y + w.z) / 3; }
