// Dá a um personagem SEM esqueleto o esqueleto de outro já rigado (mesmo corpo base do Tripo): alinha os dois
// (pés no chão, mesma altura, centralizados), e cada vértice do novo copia os ossos e pesos dos 4 vértices mais
// próximos do rigado (média pela distância). Grava um GLB com o esqueleto do base e a malha/textura do novo.
// Uso: node tools/transferir-esqueleto.mjs base_rigado.glb novo_sem_esqueleto.glb saida.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [,, fBase, fNovo, fSai] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base = await io.read(fBase), novo = await io.read(fNovo);
const pb = base.getRoot().listMeshes()[0].listPrimitives()[0];
const pn = novo.getRoot().listMeshes()[0].listPrimitives()[0];
const nodeNovo = novo.getRoot().listNodes().find((n) => n.getMesh());
const M = nodeNovo.getWorldMatrix();
const posB = pb.getAttribute('POSITION'), jB = pb.getAttribute('JOINTS_0'), wB = pb.getAttribute('WEIGHTS_0');
const caixa = (acc, mat) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], v = [0, 0, 0], out = [];
  for (let i = 0; i < acc.getCount(); i++) { acc.getElement(i, v); let p = v.slice();
    if (mat) p = [mat[0]*v[0]+mat[4]*v[1]+mat[8]*v[2]+mat[12], mat[1]*v[0]+mat[5]*v[1]+mat[9]*v[2]+mat[13], mat[2]*v[0]+mat[6]*v[1]+mat[10]*v[2]+mat[14]];
    out.push(p); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } } return { mn, mx, out }; };
const cb = caixa(posB), cn = caixa(pn.getAttribute('POSITION'), M);
const s = (cb.mx[1] - cb.mn[1]) / (cn.mx[1] - cn.mn[1]);
const alinhar = (p) => [(p[0] - (cn.mn[0] + cn.mx[0]) / 2) * s + (cb.mn[0] + cb.mx[0]) / 2, (p[1] - cn.mn[1]) * s + cb.mn[1], (p[2] - (cn.mn[2] + cn.mx[2]) / 2) * s + (cb.mn[2] + cb.mx[2]) / 2];
const novas = cn.out.map(alinhar);
const jv = [0, 0, 0, 0], wv = [0, 0, 0, 0];
const J = new Uint16Array(novas.length * 4), W = new Float32Array(novas.length * 4);
for (let i = 0; i < novas.length; i++) {
  const p = novas[i]; const melhores = [];
  for (let k = 0; k < cb.out.length; k++) { const q = cb.out[k]; const d = (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2;
    if (melhores.length < 4 || d < melhores[3][0]) { melhores.push([d, k]); melhores.sort((a, b) => a[0] - b[0]); if (melhores.length > 4) melhores.pop(); } }
  const acum = new Map();
  for (const [d, k] of melhores) { const f = 1 / (Math.sqrt(d) + 1e-4); jB.getElement(k, jv); wB.getElement(k, wv);
    for (let t = 0; t < 4; t++) if (wv[t] > 0) acum.set(jv[t], (acum.get(jv[t]) || 0) + wv[t] * f); }
  const top = [...acum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const soma = top.reduce((a, b) => a + b[1], 0);
  top.forEach(([j, w], t) => { J[i * 4 + t] = j; W[i * 4 + t] = w / soma; });
}
// troca a malha do base pela do novo (posições alinhadas, normais, UV, índices) e a textura
const buf = base.getRoot().listBuffers()[0];
const acc = (arr, tipo) => base.createAccessor().setArray(arr).setType(tipo).setBuffer(buf);
const P = new Float32Array(novas.flat());
const nrmN = pn.getAttribute('NORMAL'), uvN = pn.getAttribute('TEXCOORD_0');
pb.setAttribute('POSITION', acc(P, 'VEC3'));
if (nrmN) pb.setAttribute('NORMAL', acc(nrmN.getArray().slice(), 'VEC3'));
pb.setAttribute('TEXCOORD_0', acc(uvN.getArray().slice(), 'VEC2'));
pb.setAttribute('JOINTS_0', acc(J, 'VEC4')); pb.setAttribute('WEIGHTS_0', acc(W, 'VEC4'));
pb.setIndices(acc(new Uint32Array(pn.getIndices().getArray()), 'SCALAR'));
const texN = novo.getRoot().listTextures()[0];
const texB = base.getRoot().listTextures()[0];
texB.setImage(texN.getImage()).setMimeType(texN.getMimeType());
await io.write(fSai, base);
console.log('ok: vértices', novas.length, 'escala', s.toFixed(3));
