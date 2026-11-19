// Grava cores por vértice (float32 RGB, de tools/pintar-modelo.py) num GLB: node tools/cores-no-glb.mjs entrada.glb cores.bin saida.glb
import { NodeIO } from '@gltf-transform/core';
import fs from 'node:fs';
const [, , inp, bin, out] = process.argv;
const io = new NodeIO(); const doc = await io.read(inp);
const cores = new Float32Array(fs.readFileSync(bin).buffer.slice(0));
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const n = prim.getAttribute('POSITION').getCount();
if (cores.length !== n * 3) throw new Error(`cores ${cores.length / 3} != vértices ${n}`);
// glTF guarda COLOR_0 em espaço linear
const lin = cores.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(lin).setBuffer(doc.getRoot().listBuffers()[0]));
const m = prim.getMaterial() || doc.createMaterial(); m.setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.85); prim.setMaterial(m);
await io.write(out, doc);
console.log('ok', out);
