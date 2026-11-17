// Writing the viewer's files. The layouts are described at the top of
// src/viewer/world.js (.dio) and src/viewer/model.js (.psf).

import fs from "node:fs";

export const MODELS = new URL("../../../public/models", import.meta.url).pathname;

// baked: result of bake() · free: free splats [x,y,z, sx,sy,sz, qx,qy,qz,qw, r,g,b, kind, opacity]
export function writeWorld(name, baked, free = [], extra = {}) {
  const n = baked.count;
  const normals = new Int8Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) normals[i * 4 + k] = Math.round(baked.n[i * 3 + k] * 127);
    normals[i * 4 + 3] = baked.col[i * 4 + 3]; // emissive flag
  }
  const freeGeom = new Float32Array(free.length * 10), freeRgba = new Uint8Array(free.length * 4);
  free.forEach((f, i) => {
    freeGeom.set(f.slice(0, 10), i * 10);
    freeRgba[i * 4] = f[10] * 255; freeRgba[i * 4 + 1] = f[11] * 255; freeRgba[i * 4 + 2] = f[12] * 255;
    freeRgba[i * 4 + 3] = f[13] | (Math.round(f[14] * 63) << 2);
  });
  const meta = { count: n, free: free.length, h: baked.h, R: baked.R, top: baked.top, bottom: baked.bottom, lights: baked.lights, particles: baked.particles, ...extra };
  let json = Buffer.from(JSON.stringify(meta));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]); // keep the arrays 4-byte aligned
  const head = Buffer.alloc(8);
  head.write("PSD1", 0, "ascii");
  head.writeUInt32LE(json.length, 4);
  fs.mkdirSync(MODELS, { recursive: true });
  fs.writeFileSync(`${MODELS}/${name}.dio.bin`, Buffer.concat([head, json, Buffer.from(baked.p.buffer), Buffer.from(normals.buffer), Buffer.from(baked.col.buffer), Buffer.from(freeGeom.buffer), Buffer.from(freeRgba.buffer)]));
}

// models.json lists what the viewer's panel offers. Scenes first; hand-added
// fields (label, query) survive.
export function addToManifest(entry) {
  const file = `${MODELS}/models.json`;
  const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const i = list.findIndex((m) => m.name === entry.name);
  if (i >= 0) list[i] = { ...list[i], ...entry, label: list[i].label || entry.label };
  else if (entry.scene) {
    const firstModel = list.findIndex((m) => !m.scene);
    list.splice(firstModel < 0 ? list.length : firstModel, 0, entry);
  } else list.push(entry);
  fs.writeFileSync(file, JSON.stringify(list, null, 2) + "\n");
}
