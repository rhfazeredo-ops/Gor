// Prepara um modelo do Tripo para o estilo PS1: descompacta, tira peças soltas pequenas (ex.: o "bastão" que o
// Tripo às vezes cria), reduz os triângulos e a textura. Grava GLB comum (sem compressão), pronto para o Godot.
// Uso: node tools/tripo-ps1.mjs entrada.glb saida.glb <triângulos> <textura_px> [tirar_pecas_menores_que] [só_a_peça_N]
// (só_a_peça_N: quando o Tripo junta vários objetos num modelo, fica só a N-ésima peça, da maior para a menor)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, prune, dedup, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
const [,, ent, sai, alvo = '2500', px = '512', minimo = '0.05', so = '0'] = process.argv;
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(ent);
for (const e of doc.getRoot().listExtensionsUsed()) if (/meshopt|quantization/.test(e.extensionName)) e.dispose();
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const tris = () => prim.getIndices().getCount() / 3;
console.log('triângulos no começo:', tris());
// 1) peças soltas: mantém só as que têm pelo menos "minimo" da maior
{
  const pos = prim.getAttribute('POSITION'), ind = prim.getIndices(), idx = ind.getArray();
  const key = new Map(), id = new Int32Array(pos.getCount()); const v = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, v); const k = v.map((a) => Math.round(a * 1e5)).join(','); if (!key.has(k)) key.set(k, key.size); id[i] = key.get(k); }
  const par = new Int32Array(key.size).map((_, i) => i);
  const f = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = f(id[idx[t]]); par[f(id[idx[t + 1]])] = a; par[f(id[idx[t + 2]])] = a; }
  const cont = new Map();
  for (let t = 0; t < idx.length; t += 3) { const r = f(id[idx[t]]); cont.set(r, (cont.get(r) || 0) + 1); }
  const maior = Math.max(...cont.values());
  const ordem = [...cont.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  const escolhida = +so > 0 ? ordem[+so - 1] : null;
  const novo = [];
  for (let t = 0; t < idx.length; t += 3) {
    const r = f(id[idx[t]]);
    if (escolhida !== null ? r === escolhida : cont.get(r) >= maior * +minimo) novo.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const removidas = [...cont.values()].filter((c) => c < maior * +minimo);
  console.log('peças removidas:', removidas.length, removidas.join(', '), 'triângulos');
  ind.setArray(new Uint32Array(novo));
}
// 2) reduzir triângulos
await doc.transform(weld({ tolerance: 0.0005 }));
const ratio = +alvo / tris();
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02, lockBorder: false }), prune(), dedup());
console.log('triângulos no fim:', tris());
// 3) textura menor (PNG)
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'png', resize: [+px, +px] }));
await io.write(sai, doc);
