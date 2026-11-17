import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// =====================================================================
// Visual "pintado à mão" (hand-painted), no estilo dos jogos de fantasia
// estilizados: luz em faixas suaves, sombras puxadas para o azul/roxo,
// gradiente escuro embaixo e claro em cima (como se o artista tivesse
// pintado a luz na textura), pinceladas na cor, brilho pintado no metal,
// borda clara de contraluz e contorno escuro fino.
//
// Os personagens são feitos de muitas peças; aqui juntamos todas as peças
// de cada osso numa malha só (cor por vértice) para ficar leve no celular.
// =====================================================================

const SURF = { matte: 0, metal: 1, glow: 2 };

// rampa de luz (3 faixas com transição macia)
function rampTexture() {
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
const RAMP = rampTexture();

const NOISE_GLSL = /* glsl */`
  float ph(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float pnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(ph(i), ph(i + vec3(1,0,0)), f.x), mix(ph(i + vec3(0,1,0)), ph(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(ph(i + vec3(0,0,1)), ph(i + vec3(1,0,1)), f.x), mix(ph(i + vec3(0,1,1)), ph(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

let shared = null;
export function paintMaterial() {
  if (shared) return shared;
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aSurf; varying float vSurf; varying vec3 vPO; varying vec3 vPW;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vSurf = aSurf; vPO = position; vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vSurf; varying vec3 vPO; varying vec3 vPW;
        ${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        // pinceladas: ruído esticado na vertical + manchas grandes
        float stroke = pnoise(vPO * vec3(22.0, 6.0, 22.0)) * 0.6 + pnoise(vPO * 7.0) * 0.4;
        diffuseColor.rgb *= 0.86 + stroke * 0.26;
        // luz pintada: escuro nos pés, claro na cabeça
        diffuseColor.rgb *= mix(0.62, 1.12, smoothstep(0.0, 2.1, vPW.y));`)
      .replace('#include <opaque_fragment>', `
        vec3 V = normalize(vViewPosition);
        vec3 N = normalize(normal);
        float fr = 1.0 - clamp(dot(N, V), 0.0, 1.0);
        // sombras frias (roxo/azul) e luzes quentes
        float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
        outgoingLight = mix(outgoingLight * vec3(0.8, 0.8, 1.05), outgoingLight * vec3(1.04, 1.0, 0.94), smoothstep(0.08, 0.45, lum));
        float metal = step(0.5, vSurf) * (1.0 - step(1.5, vSurf));
        #if NUM_DIR_LIGHTS > 0
          vec3 Ld = directionalLights[0].direction;
          float spec = pow(max(dot(N, normalize(Ld + V)), 0.0), 24.0);
          // brilho do metal pintado: mancha nítida + borda clara
          outgoingLight += metal * (smoothstep(0.4, 0.6, spec) * 0.4 + spec * 0.25) * (diffuseColor.rgb + 0.35);
        #endif
        outgoingLight += metal * smoothstep(0.55, 0.85, fr) * 0.35 * (diffuseColor.rgb + 0.2);
        // contraluz suave em tudo
        outgoingLight += pow(fr, 3.0) * vec3(0.32, 0.3, 0.42) * (0.4 + lum);
        // gemas e magia brilham sozinhas
        outgoingLight = mix(outgoingLight, diffuseColor.rgb * (1.5 + fr), step(1.5, vSurf));
        #include <opaque_fragment>`);
  };
  shared = m;
  return m;
}

// Contorno escuro (casca invertida).
let outlineMat = null;
export function outlineMaterial() {
  if (outlineMat) return outlineMat;
  const m = new THREE.MeshBasicMaterial({ color: 0x1a1020, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed += normal * 0.014;`);
  };
  outlineMat = m;
  return m;
}

function surfOf(material) {
  if (material.emissiveIntensity > 0.3 && material.emissive && material.emissive.getHex() !== 0) return SURF.glow;
  if ((material.metalness ?? 0) >= 0.5) return SURF.metal;
  return SURF.matte;
}

// Junta as peças de cada osso numa malha só, com cor por vértice.
export function bakeCharacter(root, boneList, { outline = true } = {}) {
  root.updateMatrixWorld(true);
  const isBone = new Set(boneList);
  const inv = new THREE.Matrix4(), rel = new THREE.Matrix4();
  const linear = new THREE.Color();
  for (const bone of boneList) {
    const meshes = [];
    const walk = (o) => {
      for (const c of o.children) {
        if (isBone.has(c)) continue;
        if (c.isMesh) meshes.push(c);
        walk(c);
      }
    };
    walk(bone);
    if (!meshes.length) continue;
    inv.copy(bone.matrixWorld).invert();
    const geos = [];
    for (const m of meshes) {
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      g.clearGroups();
      rel.multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(rel);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3), surf = new Float32Array(n);
      linear.copy(m.material.color);
      const s = surfOf(m.material);
      if (s === SURF.glow) linear.copy(m.material.emissive).lerp(m.material.color, 0.4);
      for (let i = 0; i < n; i++) { col[i * 3] = linear.r; col[i * 3 + 1] = linear.g; col[i * 3 + 2] = linear.b; surf[i] = s; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aSurf', new THREE.BufferAttribute(surf, 1));
      geos.push(g);
    }
    for (const m of meshes) m.parent.remove(m);
    // grupos vazios (ex.: arma) continuam presos, sem malhas
    const merged = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, paintMaterial());
    mesh.castShadow = true;
    bone.add(mesh);
    if (outline) {
      const o = new THREE.Mesh(merged, outlineMaterial());
      bone.add(o);
    }
  }
}
