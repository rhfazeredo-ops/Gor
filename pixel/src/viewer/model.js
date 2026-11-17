// Load a converted model (.psf, written by tools/convert-model.mjs).
//
//   header  40 bytes   "PSF1", count, spacing, bounding box (6 floats), flags
//   count × 3 float32  position
//   count × 4 int8     normal xyz (×127), material flags (1 emissive, 2 two-sided)
//   count × 4 uint8    colour rgb
//   if flags & 1:      count × 4 uint8 joint indices, count × 4 uint8 joint weights
//
// The model is recentred and scaled so its longest side is 2 units.

import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import { shadeFx } from "../render/shade.js";
import { fetchBin } from "./fetch-bin.js";

export async function loadModel(name) {
  const buf = await fetchBin(`./models/${name}.psf.bin`);
  const dv = new DataView(buf);
  if (buf.byteLength < 40 || dv.getUint32(0, true) !== 0x31465350) throw new Error(`models/${name}.psf not found. Convert a model with tools/convert-model.mjs`);
  const count = dv.getUint32(4, true), spacing = dv.getFloat32(8, true);
  const box = Array.from({ length: 6 }, (_, i) => dv.getFloat32(12 + i * 4, true));
  const skinned = (dv.getUint32(36, true) & 1) === 1;
  const pos = new Float32Array(buf, 40, count * 3);
  const nor = new Int8Array(buf, 40 + count * 12, count * 4);
  const rgba = new Uint8Array(buf, 40 + count * 16, count * 4);

  const center = new THREE.Vector3((box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2);
  const extent = [box[3] - box[0], box[4] - box[1], box[5] - box[2]];
  const unit = 2 / Math.max(...extent);
  const h = spacing * unit;

  const Z = new THREE.Vector3(0, 0, 1), p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Quaternion(), color = new THREE.Color();
  // a surfel: wide enough to overlap its neighbours, thin along the normal
  const scale = new THREE.Vector3(0.66 * h, 0.66 * h, 0.3 * h);
  const mesh = new SplatMesh({
    constructSplats: (splats) => {
      for (let i = 0; i < count; i++) {
        p.set((pos[i * 3] - center.x) * unit, (pos[i * 3 + 1] - center.y) * unit, (pos[i * 3 + 2] - center.z) * unit);
        q.setFromUnitVectors(Z, n.set(nor[i * 4], nor[i * 4 + 1], nor[i * 4 + 2]).normalize());
        color.setRGB(rgba[i * 4] / 255, rgba[i * 4 + 1] / 255, rgba[i * 4 + 2] / 255);
        const flags = nor[i * 4 + 3];
        splats.pushSplat(p, scale, q, 1 - 0.1 * (flags & 1) - 0.2 * ((flags >> 1) & 1), color);
      }
    },
  });
  mesh.worldModifier = shadeFx();
  mesh.updateGenerator();

  return {
    mesh, count, rgba, center, unit,
    size: extent.map((v) => v * unit), // in viewer units
    skin: skinned ? new Uint8Array(buf, 40 + count * 20, count * 8) : null,
  };
}
