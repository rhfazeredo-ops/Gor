#!/usr/bin/env node
// Convert a glTF / GLB model into splats.
//   node tools/convert-model.mjs <model.glb> <name> [--count 110000] [--tex 128]
//
// Scatters points evenly over the model's triangles; each becomes a surfel
// with a position, the surface normal and the texture colour at that point.
// A skinned model also keeps four joint weights per surfel, and its skeleton
// and animation clips are saved to <name>.rig.glb (no meshes, no textures).
// Writes public/models/<name>.psf.

import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";
import { prune } from "@gltf-transform/functions";
import { addToManifest, MODELS } from "./lib/files.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? Number(args.splice(i, 2)[1]) : def; };
const TARGET = opt("count", 110000), TEX = opt("tex", 128);
const [input, name] = args;
if (!input || !name) { console.error("usage: convert-model.mjs <model.glb> <name> [--count N] [--tex N]"); process.exit(1); }
const output = `${MODELS}/${name}.psf.bin`;

let seed = 12345;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const toSrgb = (v) => Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2);

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "draco3d.decoder": await draco3d.createDecoderModule(),
  "meshopt.decoder": MeshoptDecoder,
});
console.log("reading", input);
const doc = await io.read(input);
const root = doc.getRoot();

// ---- textures (decoded lazily, downsized: pixel art needs little detail) ---
const texCache = new Map();
async function loadTex(tex) {
  if (!tex) return null;
  if (texCache.has(tex)) return texCache.get(tex);
  let out = null;
  try {
    const { data, info } = await sharp(Buffer.from(tex.getImage()))
      .resize(TEX, TEX, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    out = { data, w: info.width, h: info.height };
  } catch (e) { console.warn("  texture skipped:", tex.getName() || tex.getURI(), e.message); }
  texCache.set(tex, out);
  return out;
}
function sampleTex(t, u, v, xf) {
  if (xf) {
    const c = Math.cos(xf.rot), s = Math.sin(xf.rot);
    const x = u * xf.scale[0], y = v * xf.scale[1];
    u = c * x + s * y + xf.offset[0];
    v = -s * x + c * y + xf.offset[1];
  }
  u -= Math.floor(u); v -= Math.floor(v);
  const i = (Math.min(t.h - 1, Math.floor(v * t.h)) * t.w + Math.min(t.w - 1, Math.floor(u * t.w))) * 4;
  return [t.data[i] / 255, t.data[i + 1] / 255, t.data[i + 2] / 255, t.data[i + 3] / 255];
}
function texXform(info) {
  const x = info?.getExtension("KHR_texture_transform");
  return x ? { offset: x.getOffset(), scale: x.getScale(), rot: x.getRotation() } : null;
}

// ---- pass 1: gather primitives in world space ------------------------------
const prims = [];
let totalArea = 0;
const scene = root.getDefaultScene() || root.listScenes()[0];
const nodes = [];
scene.traverse((n) => n.getMesh() && nodes.push(n));
// skinned meshes: vertices stay in bind space (the skeleton moves them at
// runtime) and every surfel carries up to four joint weights
const skins = root.listSkins();
const skinOffset = new Map();
let jointCount = 0;
for (const sk of skins) { skinOffset.set(sk, jointCount); jointCount += sk.listJoints().length; }
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const node of nodes) {
  const skin = node.getSkin();
  const m = skin ? IDENT : node.getWorldMatrix();
  // cofactor matrix transforms normals correctly under non-uniform scale
  const nm = [
    m[5] * m[10] - m[6] * m[9], m[6] * m[8] - m[4] * m[10], m[4] * m[9] - m[5] * m[8],
    m[2] * m[9] - m[1] * m[10], m[0] * m[10] - m[2] * m[8], m[1] * m[8] - m[0] * m[9],
    m[1] * m[6] - m[2] * m[5], m[2] * m[4] - m[0] * m[6], m[0] * m[5] - m[1] * m[4],
  ];
  for (const prim of node.getMesh().listPrimitives()) {
    if (prim.getMode() !== 4) continue;
    const P = prim.getAttribute("POSITION");
    if (!P) continue;
    const N = prim.getAttribute("NORMAL"), UV = prim.getAttribute("TEXCOORD_0"), C = prim.getAttribute("COLOR_0");
    const nv = P.getCount(), e = [];
    const pos = new Float32Array(nv * 3), nor = N ? new Float32Array(nv * 3) : null;
    const uv = UV ? new Float32Array(nv * 2) : null, vc = C ? new Float32Array(nv * 3) : null;
    for (let i = 0; i < nv; i++) {
      P.getElement(i, e);
      pos[i * 3] = m[0] * e[0] + m[4] * e[1] + m[8] * e[2] + m[12];
      pos[i * 3 + 1] = m[1] * e[0] + m[5] * e[1] + m[9] * e[2] + m[13];
      pos[i * 3 + 2] = m[2] * e[0] + m[6] * e[1] + m[10] * e[2] + m[14];
      if (N) {
        N.getElement(i, e);
        nor[i * 3] = nm[0] * e[0] + nm[3] * e[1] + nm[6] * e[2];
        nor[i * 3 + 1] = nm[1] * e[0] + nm[4] * e[1] + nm[7] * e[2];
        nor[i * 3 + 2] = nm[2] * e[0] + nm[5] * e[1] + nm[8] * e[2];
      }
      if (UV) { UV.getElement(i, e); uv[i * 2] = e[0]; uv[i * 2 + 1] = e[1]; }
      if (C) { C.getElement(i, e); vc[i * 3] = e[0]; vc[i * 3 + 1] = e[1]; vc[i * 3 + 2] = e[2]; }
    }
    let jn = null, jw = null;
    const J = prim.getAttribute("JOINTS_0"), W = prim.getAttribute("WEIGHTS_0");
    if (skin && J && W) {
      const off = skinOffset.get(skin);
      jn = new Uint16Array(nv * 4); jw = new Float32Array(nv * 4);
      for (let i = 0; i < nv; i++) {
        J.getElement(i, e); for (let k = 0; k < 4; k++) jn[i * 4 + k] = e[k] + off;
        W.getElement(i, e); for (let k = 0; k < 4; k++) jw[i * 4 + k] = e[k];
      }
    }
    const I = prim.getIndices();
    const idx = I ? I.getArray() : Uint32Array.from({ length: nv }, (_, i) => i);
    let area = 0;
    for (let t = 0; t < idx.length; t += 3) area += triArea(pos, idx[t], idx[t + 1], idx[t + 2]);
    totalArea += area;
    prims.push({ pos, nor, uv, vc, idx, jn, jw, mat: prim.getMaterial() });
  }
}
function triArea(p, a, b, c) {
  const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
  const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}
const H = Math.sqrt(totalArea / TARGET);
console.log(`${nodes.length} mesh nodes, ${prims.length} primitives, area ${totalArea.toFixed(2)}, surfel spacing ${H.toFixed(4)}`);

// ---- pass 2: sample -------------------------------------------------------
const outP = [], outN = [], outC = [], outJ = [], outW = [];
const acc = new Map();
const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
for (const pr of prims) {
  const mat = pr.mat;
  let base = [1, 1, 1, 1], tex = null, xf = null, emis = null, etex = null, exf = null, flags = 0, cutoff = 0.3;
  if (mat) {
    if (mat.getExtension("KHR_materials_transmission")?.getTransmissionFactor() > 0.5) continue; // glass
    base = mat.getBaseColorFactor();
    tex = await loadTex(mat.getBaseColorTexture());
    xf = texXform(mat.getBaseColorTextureInfo());
    const ef = mat.getEmissiveFactor(), es = mat.getExtension("KHR_materials_emissive_strength")?.getEmissiveStrength() ?? 1;
    if (Math.max(...ef) * es > 0.2) {
      emis = ef.map((v) => toSrgb(Math.min(1, v * es)));
      etex = await loadTex(mat.getEmissiveTexture());
      exf = texXform(mat.getEmissiveTextureInfo());
      flags |= 1;
    }
    if (mat.getDoubleSided()) flags |= 2;
    if (mat.getAlphaMode() === "MASK") cutoff = mat.getAlphaCutoff();
    else if (mat.getAlphaMode() === "OPAQUE") cutoff = -1;
  }
  const bs = [toSrgb(base[0]), toSrgb(base[1]), toSrgb(base[2])];
  const { pos, nor, uv, vc, idx, jn, jw } = pr;

  const emit = (a, b, c, wa, wb, wc) => {
    const x = wa * pos[a * 3] + wb * pos[b * 3] + wc * pos[c * 3];
    const y = wa * pos[a * 3 + 1] + wb * pos[b * 3 + 1] + wc * pos[c * 3 + 1];
    const z = wa * pos[a * 3 + 2] + wb * pos[b * 3 + 2] + wc * pos[c * 3 + 2];
    let nx, ny, nz;
    if (nor) {
      nx = wa * nor[a * 3] + wb * nor[b * 3] + wc * nor[c * 3];
      ny = wa * nor[a * 3 + 1] + wb * nor[b * 3 + 1] + wc * nor[c * 3 + 1];
      nz = wa * nor[a * 3 + 2] + wb * nor[b * 3 + 2] + wc * nor[c * 3 + 2];
    }
    if (!nor || nx * nx + ny * ny + nz * nz < 1e-12) {
      const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
      const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
      nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    let r = bs[0], g = bs[1], bl = bs[2], al = base[3];
    let u = 0, v = 0;
    if (uv) { u = wa * uv[a * 2] + wb * uv[b * 2] + wc * uv[c * 2]; v = wa * uv[a * 2 + 1] + wb * uv[b * 2 + 1] + wc * uv[c * 2 + 1]; }
    if (tex && uv) { const t = sampleTex(tex, u, v, xf); r *= t[0]; g *= t[1]; bl *= t[2]; al *= t[3]; }
    if (vc) {
      r *= toSrgb(wa * vc[a * 3] + wb * vc[b * 3] + wc * vc[c * 3]);
      g *= toSrgb(wa * vc[a * 3 + 1] + wb * vc[b * 3 + 1] + wc * vc[c * 3 + 1]);
      bl *= toSrgb(wa * vc[a * 3 + 2] + wb * vc[b * 3 + 2] + wc * vc[c * 3 + 2]);
    }
    if (al < cutoff) return;
    let f = flags;
    if (emis) {
      let er = emis[0], eg = emis[1], eb = emis[2];
      if (etex && uv) { const t = sampleTex(etex, u, v, exf); er *= t[0]; eg *= t[1]; eb *= t[2]; }
      if (Math.max(er, eg, eb) > 0.25) { r = Math.max(r, er); g = Math.max(g, eg); bl = Math.max(bl, eb); } else f &= ~1;
    }
    if (jointCount) {
      // blend the three corners' influences, keep the strongest four
      acc.clear();
      if (jn) for (const [v, w] of [[a, wa], [b, wb], [c, wc]])
        for (let k = 0; k < 4; k++) { const j = jn[v * 4 + k], ww = jw[v * 4 + k] * w; if (ww > 0) acc.set(j, (acc.get(j) || 0) + ww); }
      const top = [...acc.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4);
      const sum = top.reduce((t, e) => t + e[1], 0) || 1;
      let left = 255;
      for (let k = 0; k < 4; k++) {
        const wq = k < top.length ? (k === top.length - 1 ? left : Math.min(left, Math.round((top[k][1] / sum) * 255))) : 0;
        left -= wq;
        outJ.push(k < top.length ? Math.min(255, top[k][0]) : 0);
        outW.push(top.length ? wq : k === 0 ? 255 : 0);
      }
    }
    outP.push(x, y, z);
    outN.push(Math.round((nx / nl) * 127), Math.round((ny / nl) * 127), Math.round((nz / nl) * 127), f);
    outC.push(Math.round(r * 255), Math.round(g * 255), Math.round(bl * 255), 255);
    if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (z < bb[2]) bb[2] = z;
    if (x > bb[3]) bb[3] = x; if (y > bb[4]) bb[4] = y; if (z > bb[5]) bb[5] = z;
  };

  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const n = triArea(pos, a, b, c) / (H * H);
    if (n > 3) {
      // big triangle: jittered lattice so walls and floors are evenly covered
      const k = Math.ceil(Math.sqrt(2 * n));
      for (let i = 0; i < k; i++)
        for (let j = 0; j < k - i; j++) {
          let u = (i + 0.2 + 0.6 * rnd()) / k, v = (j + 0.2 + 0.6 * rnd()) / k;
          if (u + v > 1) { u = 1 - u; v = 1 - v; }
          emit(a, b, c, 1 - u - v, u, v);
        }
    } else {
      // small triangle: probabilistic, slightly oversampled to avoid pinholes
      let cnt = n * 1.35;
      cnt = Math.floor(cnt) + (rnd() < cnt % 1 ? 1 : 0);
      for (let s = 0; s < cnt; s++) {
        let u = rnd(), v = rnd();
        if (u + v > 1) { u = 1 - u; v = 1 - v; }
        emit(a, b, c, 1 - u - v, u, v);
      }
    }
  }
}

// ---- write ----------------------------------------------------------------
const count = outP.length / 3;
const head = Buffer.alloc(40);
head.writeUInt32LE(jointCount ? 1 : 0, 36); // flags: bit0 = has skin weights
head.write("PSF1", 0, "ascii");
head.writeUInt32LE(count, 4);
head.writeFloatLE(H, 8);
bb.forEach((v, i) => head.writeFloatLE(v, 12 + i * 4));
fs.mkdirSync(MODELS, { recursive: true });
fs.writeFileSync(output, Buffer.concat([head, Buffer.from(new Float32Array(outP).buffer), Buffer.from(new Int8Array(outN).buffer), Buffer.from(new Uint8Array(outC).buffer), Buffer.from(new Uint8Array(outJ).buffer), Buffer.from(new Uint8Array(outW).buffer)]));
console.log(`wrote ${output}: ${count} surfels, ${(fs.statSync(output).size / 1e6).toFixed(1)} MB`);

if (jointCount) {
  // keep the skeleton and its clips, drop every mesh, material and texture
  for (const channel of root.listAnimations().flatMap((a) => a.listChannels())) if (channel.getTargetPath() === "weights") channel.dispose();
  for (const node of root.listNodes()) node.setMesh(null);
  for (const x of [...root.listMeshes(), ...root.listMaterials(), ...root.listTextures()]) x.dispose();
  await doc.transform(prune({ keepLeaves: true, keepAttributes: true }));
  await io.write(`${MODELS}/${name}.rig.glb`, doc);
  console.log(`wrote ${MODELS}/${name}.rig.glb: ${jointCount} joints, clips: ${root.listAnimations().map((a) => a.getName()).join(", ")}`);
}
addToManifest({ name, count });
