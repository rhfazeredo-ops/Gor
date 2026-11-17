#!/usr/bin/env node
// Build the island a converted model stands on.
//   node tools/build-island.mjs <name> <theme>
//
// Reads public/models/<name>.psf (and .rig.glb), plays every animation clip
// and records how far the creature reaches in each direction and where its
// feet touch down. Props are then placed outside that reach, the middle is
// kept flat, and the result is written to public/models/<name>.dio.

import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildIsland, THEME_NAMES } from "../src/authoring/themes.js";
import { writeWorld, MODELS as dir } from "./lib/files.mjs";

const [name, theme] = process.argv.slice(2);
if (!name || !THEME_NAMES.includes(theme)) { console.error(`usage: build-island.mjs <name> <${THEME_NAMES.join(" | ")}>`); process.exit(1); }
const buf = fs.readFileSync(`${dir}/${name}.psf.bin`);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const dv = new DataView(ab);
const count = dv.getUint32(4, true), skinned = (dv.getUint32(36, true) & 1) === 1;
const bb = Array.from({ length: 6 }, (_, i) => dv.getFloat32(12 + i * 4, true));
const pos = new Float32Array(ab, 40, count * 3), col = new Uint8Array(ab, 40 + count * 16, count * 4);
const skin = skinned ? new Uint8Array(ab, 40 + count * 20, count * 8) : null;
const center = new THREE.Vector3((bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2);
const size = [bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]];
const unit = 2 / Math.max(...size), feetY = (-size[1] / 2) * unit;

// every k-th surfel, in the viewer's normalised space
const stride = Math.max(1, Math.ceil(count / 5000));
const sub = [];
for (let i = 0; i < count; i += stride) sub.push(i);
const rest = sub.map((i) => [(pos[i * 3] - center.x) * unit, (pos[i * 3 + 1] - center.y) * unit, (pos[i * 3 + 2] - center.z) * unit]);

const SECT = 32;
const tall = new Float32Array(SECT), lowR = Array.from({ length: SECT }, () => []), contact = [];
function record(points, feet) {
  // ground level of this pose: low percentile, so a sword tip or tail that
  // dips below the feet doesn't count as standing
  const ys = Float32Array.from(points, (p) => p[1]).sort();
  const minY = ys[Math.floor(ys.length * 0.02)];
  for (const p of points) {
    const s = Math.floor(((Math.atan2(p[2], p[0]) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SECT) % SECT, r = Math.hypot(p[0], p[2]);
    if (r > tall[s]) tall[s] = r;
    if (feet && p[1] < minY + 0.3) lowR[s].push(r);
    if (feet && p[1] < minY + 0.05 && p[1] > minY - 0.04) contact.push(r);
  }
}
const pct = (a, q) => (a.length ? a.sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))] : 0);

let clips = [];
if (skinned) {
  const glb = fs.readFileSync(`${dir}/${name}.rig.glb`);
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "", res, rej));
  const skeletons = await Promise.all((gltf.parser.json.skins || []).map((_, i) => gltf.parser.getDependency("skin", i)));
  const bones = skeletons.flatMap((s) => s.bones), inverses = skeletons.flatMap((s) => s.boneInverses);
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), M = new THREE.Matrix4(), T = new THREE.Vector3(), V = new THREE.Vector3();
  const restPose = bones.map((_, i) => { M.copy(inverses[i]).invert().decompose(P, Q, S); return { inv: Q.clone().invert(), pos: P.clone().sub(center).multiplyScalar(unit) }; });
  const rot = bones.map(() => new THREE.Quaternion()), tr = bones.map(() => new THREE.Vector3());
  const mixer = new THREE.AnimationMixer(gltf.scene);
  clips = gltf.animations.map((c) => c.name);
  for (const clip of gltf.animations) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset().play();
    for (let f = 0; f < 20; f++) {
      mixer.setTime((clip.duration * f) / 20);
      gltf.scene.updateMatrixWorld(true);
      bones.forEach((b, i) => {
        b.matrixWorld.decompose(P, Q, S);
        rot[i].copy(Q).multiply(restPose[i].inv);
        tr[i].copy(P).sub(center).multiplyScalar(unit).sub(T.copy(restPose[i].pos).applyQuaternion(rot[i]));
      });
      const pts = sub.map((si, k) => {
        const out = [0, 0, 0];
        for (let j = 0; j < 4; j++) {
          const w = skin[count * 4 + si * 4 + j] / 255;
          if (!w) continue;
          const b = skin[si * 4 + j];
          V.fromArray(rest[k]).applyQuaternion(rot[b]).add(tr[b]);
          out[0] += V.x * w; out[1] += V.y * w; out[2] += V.z * w;
        }
        return out;
      });
      record(pts, !/die|down|dead|death/i.test(clip.name));
    }
  }
} else record(rest, true);

// widen each sector to its neighbours' reach, so nothing sits right at an edge
const widen = (a) => a.map((_, i) => Math.max(a[(i + SECT - 1) % SECT], a[i], a[(i + 1) % SECT]));
const tallW = widen(Array.from(tall)), lowW = widen(lowR.map((a) => pct(a, 0.97)));
const clear = (a, isTall) => {
  const f = (((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SECT, i = Math.floor(f) % SECT, j = (i + 1) % SECT, t = f - Math.floor(f), arr = isTall ? tallW : lowW;
  return arr[i] * (1 - t) + arr[j] * t;
};
// flat patch: where the feet actually touch down; island: typical reach plus room for props
const rFlat = Math.min(1.0, Math.max(0.45, pct(contact, 0.92) + 0.14));
const R = Math.min(1.9, Math.max(1.4, pct([...tallW], 0.5) + 0.8, rFlat + 0.8));
const clearMax = Math.max(...tallW);

let tint = [0, 0, 0], n = 0, seed = 7;
for (let i = 0; i < count; i += 97) { tint[0] += col[i * 4]; tint[1] += col[i * 4 + 1]; tint[2] += col[i * 4 + 2]; n++; }
tint = tint.map((v) => v / n / 255);
for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;

const t0 = Date.now();
const island = buildIsland(theme, { R, rFlat, clear, seed, tint });
writeWorld(name, island, [], { theme, rFlat });
console.log(`${name}: ${theme}, reach ${clearMax.toFixed(2)}, flat ${rFlat.toFixed(2)}, R ${island.R.toFixed(2)}, ${island.count} surfels, ${clips.length} clips, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
