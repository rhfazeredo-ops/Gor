import { loadBigDesert, buildBigDesert } from '../src/iso/bigdesert.js';
// Exporta os layouts do deserto (peças, tamanhos, colisores, trilha) para o projeto Godot.
(async () => {
  await loadBigDesert();
  const out = {};
  for (const v of ['canion', 'ninho']) {
    const m = buildBigDesert(v);
    out[v] = {
      nome: m.nome, w: m.w, h: m.h, start: m.start, path: m.path, door: m.door, largura: m.largura, clareiras: m.clareiras,
      flores: m.props.filter((p) => p.kind === 'flor').map((p) => [p.i + 0.5, p.j + 0.5]),
      decos: m.decos.map((d) => ({ key: d.key, x: +d.x.toFixed(3), y: +d.y.toFixed(3), flip: d.flip, z: d.z || 0, phys: d.phys,
        w: +d.spr.w.toFixed(2), h: +d.spr.h.toFixed(2), ax: +d.spr.ax.toFixed(2), ay: +d.spr.ay.toFixed(2), flat: !!d.flat })),
      colliders: m.colliders.map((c) => c.t === 'p' ? { t: 'p', pts: c.pts.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]) }
        : c.t === 'c' ? { t: 'c', x: +c.x.toFixed(3), y: +c.y.toFixed(3), r: +c.r.toFixed(3) } : { t: 'b', x0: c.x0, x1: c.x1, y0: c.y0, y1: c.y1 }),
    };
  }
  window.__mapa = JSON.stringify(out); window.done = 1;
})().catch((e) => { window.__err = String(e.stack); window.done = 1; });
