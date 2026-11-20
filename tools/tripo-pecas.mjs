// Lista as peças soltas (componentes conectados) de um GLB do Tripo: triângulos, caixa e centro de cada uma.
// Uso: node tools/tripo-pecas.mjs modelo.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
// conectividade só pela posição (ignora costuras de UV)
const pos = prim.getAttribute('POSITION'), idx = prim.getIndices().getArray();
const key = new Map(), id = new Int32Array(pos.getCount()); const v = [0, 0, 0];
for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); const k = v.map((a) => Math.round(a * 1e5)).join(','); if (!key.has(k)) key.set(k, key.size); id[i] = key.get(k); }
const par = new Int32Array(key.size).map((_, i) => i);
const f = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
for (let t = 0; t < idx.length; t += 3) { const a = f(id[idx[t]]), b = f(id[idx[t + 1]]), c = f(id[idx[t + 2]]); par[b] = a; par[f(c)] = a; }
const comp = new Map();
for (let t = 0; t < idx.length; t += 3) {
  const r = f(id[idx[t]]); let c = comp.get(r);
  if (!c) comp.set(r, (c = { tris: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }));
  c.tris++; for (let j = 0; j < 3; j++) { pos.getElement(idx[t + j], v); for (let k = 0; k < 3; k++) { c.min[k] = Math.min(c.min[k], v[k]); c.max[k] = Math.max(c.max[k], v[k]); } }
}
const lista = [...comp.values()].sort((a, b) => b.tris - a.tris);
console.log('peças:', lista.length);
for (const c of lista.slice(0, 25)) console.log(c.tris, 'tris  min', c.min.map((a) => a.toFixed(3)).join(' '), ' max', c.max.map((a) => a.toFixed(3)).join(' '));
