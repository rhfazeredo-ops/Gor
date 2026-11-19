import { loadBigDesert, buildBigDesert, hitsCollider } from '../src/iso/bigdesert.js';
// Confere se a trilha, as clareiras e as plantas do mapa ficam livres das rochas.
(async () => {
  await loadBigDesert();
  const out = {};
  for (const v of ['canion', 'ninho']) {
    const m = buildBigDesert(v), bloq = [];
    const P = m.path;
    for (let k = 0; k < P.length - 1; k++) for (let t = 0; t <= 1; t += 0.05) {
      const x = P[k][0] + (P[k + 1][0] - P[k][0]) * t, y = P[k][1] + (P[k + 1][1] - P[k][1]) * t;
      if (hitsCollider(m, x, y, 0.32)) bloq.push([+x.toFixed(1), +y.toFixed(1)]);
    }
    const clar = m.clareiras.filter(([x, y]) => hitsCollider(m, x, y, 0.32)).map(([x, y]) => [x, y]);
    const flores = m.props.filter((p) => p.kind === 'flor');
    const florBloq = flores.filter((p) => hitsCollider(m, p.i + 0.5, p.j + 0.5, 0.32)).map((p) => [p.i, p.j]);
    const quem = (x, y) => { const r = []; m.colliders.forEach((c, i) => { const mm = { colliders: [c] }; if (hitsCollider(mm, x, y, 0.32)) r.push(i); }); return r; };
    const ex = bloq.slice(0, 3).map(([x, y]) => quem(x, y).map((i) => { const c = m.colliders[i]; const xs = c.pts ? c.pts.map((p) => p[0]) : [c.x]; const ys = c.pts ? c.pts.map((p) => p[1]) : [c.y];
      return { t: c.t, cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, wx: Math.max(...xs) - Math.min(...xs), wy: Math.max(...ys) - Math.min(...ys) }; }));
    out[v + '_ex'] = ex;
    out[v] = { decos: m.decos.length, rochas: m.decos.filter((d) => /rochedo|pico/.test(d.key)).length, bloq, clar, flores: flores.length, florBloq };
  }
  window.__r = JSON.stringify(out); window.done = 1;
})().catch((e) => { window.__r = String(e.stack); window.done = 1; });
