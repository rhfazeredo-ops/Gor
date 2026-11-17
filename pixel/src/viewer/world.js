// Load a world (.dio): either the island a model stands on (written by
// tools/build-island.mjs) or a stand-alone scene (tools/build-scene.mjs).
//
//   "PSD1", json length, json (meta: lights, particles, palette, sizes …)
//   count × 3 float32   surfel position
//   count × 4 int8      surfel normal xyz (×127), emissive flag
//   count × 4 uint8     surfel colour rgb
//   free × 10 float32   free splat: position, scale, quaternion
//   free × 4 uint8      free splat: rgb, kind (2 bits) | opacity (6 bits)
//
// Free splats are emitted one by one by the scene's code instead of being
// sampled from a surface: a grass blade is a single stretched splat.

import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import { shadeFx } from "../render/shade.js";
import { motionFx } from "../render/particles.js";
import { fetchBin } from "./fetch-bin.js";

const KIND = { lit: 0, emissive: 1, sway: 2, glow: 3 };

// groundY: height the world's y = 0 is placed at (the model's feet)
export async function loadWorld(name, groundY = 0) {
  const buf = await fetchBin(`./models/${name}.dio.bin`);
  if (buf.byteLength < 8) return null;
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x31445350) return null;
  const jsonLen = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, jsonLen)));
  const off = 8 + jsonLen, n = meta.count, nFree = meta.free || 0;
  const pos = new Float32Array(buf, off, n * 3), nor = new Int8Array(buf, off + n * 12, n * 4), rgba = new Uint8Array(buf, off + n * 16, n * 4);
  const free = new Float32Array(buf, off + n * 20, nFree * 10), freeRgba = new Uint8Array(buf, off + n * 20 + nFree * 40, nFree * 4);

  const meshes = [];
  const Z = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3(), v = new THREE.Vector3(), q = new THREE.Quaternion(), color = new THREE.Color();
  const add = (build, setup) => {
    const mesh = new SplatMesh({ constructSplats: build });
    setup(mesh);
    mesh.updateGenerator();
    meshes.push(mesh);
  };

  // 1. surfels sampled from the SDF scene
  const scale = new THREE.Vector3(0.66 * meta.h, 0.66 * meta.h, 0.3 * meta.h);
  add((splats) => {
    for (let i = 0; i < n; i++) {
      p.set(pos[i * 3], pos[i * 3 + 1] + groundY, pos[i * 3 + 2]);
      q.setFromUnitVectors(Z, v.set(nor[i * 4], nor[i * 4 + 1], nor[i * 4 + 2]).normalize());
      color.setRGB(rgba[i * 4] / 255, rgba[i * 4 + 1] / 255, rgba[i * 4 + 2] / 255);
      splats.pushSplat(p, scale, q, nor[i * 4 + 3] ? 0.9 : 1, color);
    }
  }, (mesh) => (mesh.worldModifier = shadeFx({ world: true, baked: !!meta.baked })));

  // 2. free splats, grouped by how they are drawn
  const freeGroup = (kinds, setup) => add((splats) => {
    for (let i = 0; i < nFree; i++) {
      const kind = freeRgba[i * 4 + 3] & 3;
      if (!kinds.includes(kind)) continue;
      p.set(free[i * 10], free[i * 10 + 1] + groundY, free[i * 10 + 2]);
      v.set(free[i * 10 + 3], free[i * 10 + 4], free[i * 10 + 5]);
      q.set(free[i * 10 + 6], free[i * 10 + 7], free[i * 10 + 8], free[i * 10 + 9]);
      color.setRGB(freeRgba[i * 4] / 255, freeRgba[i * 4 + 1] / 255, freeRgba[i * 4 + 2] / 255);
      splats.pushSplat(p, v, q, kind === KIND.glow ? (freeRgba[i * 4 + 3] >> 2) / 63 : kind === KIND.emissive ? 0.9 : 1, color);
    }
  }, setup);
  if (nFree) {
    freeGroup([KIND.lit, KIND.emissive], (m) => (m.worldModifier = shadeFx({ world: true, baked: !!meta.baked })));
    freeGroup([KIND.sway], (m) => { m.worldModifier = shadeFx({ world: true, upNormal: true, baked: !!meta.baked }); m.objectModifier = motionFx("sway"); });
    freeGroup([KIND.glow], (m) => (m.objectModifier = motionFx("pulse"))); // halos keep their own colour and opacity
  }

  // 3. particles
  let seed = 99;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.3)), rot = new THREE.Quaternion();
  const particleColors = [];
  for (const ps of meta.particles) {
    const mode = ps.still ? "twinkle" : ps.mode, c = ps.center || [0, 0, 0];
    if (mode !== "fog" && mode !== "shaft" && mode !== "ray") particleColors.push(...ps.colors);
    add((splats) => {
      const put = (x, y, z, sx, sy, sz, alpha, rot) => {
        p.set(x, y + groundY, z);
        color.set(ps.colors[Math.floor(rnd() * ps.colors.length)]);
        splats.pushSplat(p, v.set(sx, sy, sz), rot || q.identity(), alpha, color);
      };
      // explicit shapes, relative to the centre (the lighthouse beam)
      if (ps.splats) return ps.splats.forEach((b) => put(c[0] + b[0], c[1] + b[1], c[2] + b[2], b[3], b[4], b[5], b[6], b.length > 7 ? rot.set(b[7], b[8], b[9], b[10]) : null));
      const spots = ps.points || (ps.origins ? ps.origins.flatMap((o) => Array.from({ length: ps.n }, () => o)) : Array.from({ length: ps.n }, () => {
        if (ps.spread) return [c[0] + (rnd() - 0.5) * 2 * ps.spread[0], c[1] + rnd() * ps.spread[1], c[2] + (rnd() - 0.5) * 2 * ps.spread[2]];
        const a = rnd() * 6.28, r = Math.sqrt(rnd()) * meta.R * (mode === "shaft" ? 0.7 : 1);
        return [Math.cos(a) * r, mode === "fog" ? 0.05 + rnd() * 0.22 : mode === "shaft" ? meta.top * 0.55 : 0.06 + rnd() * (meta.top + 0.3), Math.sin(a) * r];
      }));
      for (const o of spots) {
        if (mode === "fog") put(o[0], o[1], o[2], 0.3 + rnd() * 0.25, 0.035, 0.3 + rnd() * 0.25, ps.alpha ?? 0.95);
        else if (mode === "shaft") put(o[0], o[1], o[2], 0.07 + rnd() * 0.06, meta.top * 0.75, 0.07 + rnd() * 0.06, ps.alpha ?? 0.95, tilt);
        else {
          const k = meta.h * (mode === "smoke" ? 0.9 : mode === "leaf" ? 0.5 : 0.28 + rnd() * 0.14);
          put(o[0], o[1], o[2], k, mode === "leaf" ? k * 0.6 : k, k, ps.alpha ?? 0.95);
          if (ps.halo) put(o[0], o[1], o[2], k * 5.5, k * 5.5, k * 5.5, 0.18);
        }
      }
    }, (mesh) => (mesh.objectModifier = motionFx(mode, new THREE.Vector3(meta.R, ps.spread ? ps.spread[1] : ps.height || 0.6, 0), new THREE.Vector3(c[0], c[1] + groundY, c[2]), !!ps.halo)));
  }

  return {
    meta, meshes, rgba, particleColors,
    count: n + nFree,
    lights: meta.lights.map((l) => ({ ...l, pos: new THREE.Vector3(l.pos[0], l.pos[1] + groundY, l.pos[2]) })),
  };
}
