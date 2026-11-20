import { loadBigDesert, buildBigDesert } from '../src/iso/bigdesert.js';
// Galeria de depuração: cada peça sólida com o contorno do colisor (ciano) e a âncora (vermelho).
(async () => {
  await loadBigDesert();
  const seen = new Map();
  for (const v of ['canion', 'ninho']) for (const d of buildBigDesert(v).decos) if (d.col && !seen.has(d.key + d.flip)) seen.set(d.key + d.flip, d);
  const list = [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
  const CW = 300, CH = 300, COLS = 8, Z = 1.0;
  const cv = document.getElementById('c'); cv.width = CW * COLS; cv.height = CH * Math.ceil(list.length / COLS);
  const g = cv.getContext('2d'); g.font = '14px sans-serif';
  const scr = (tx, ty) => [(tx - ty) * 32, (tx + ty) * 16];
  list.forEach((d, i) => {
    const ox = (i % COLS) * CW + CW / 2, oy = Math.floor(i / COLS) * CH + CH - 50;
    const k = Math.min(1, 230 / d.spr.h, 280 / d.spr.w);
    g.save(); g.translate(ox, oy); g.scale(k, k);
    g.save(); if (d.flip) g.scale(-1, 1);
    g.drawImage(d.spr.img, -(d.flip ? d.spr.w - d.spr.ax : d.spr.ax), -d.spr.ay, d.spr.w, d.spr.h); g.restore();
    g.strokeStyle = '#0ff'; g.lineWidth = 2 / k; g.fillStyle = 'rgba(0,255,255,0.25)';
    for (const c of d.col) {
      g.beginPath();
      if (c.t === 'p') c.pts.forEach(([x, y], j) => { const [X, Y] = scr(x - d.x, y - d.y); j ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      else if (c.t === 'c') for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2; const [X, Y] = scr(c.x - d.x + Math.cos(t) * c.r, c.y - d.y + Math.sin(t) * c.r); a ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      else [[c.x0, c.y0], [c.x1, c.y0], [c.x1, c.y1], [c.x0, c.y1]].forEach(([x, y], j) => { const [X, Y] = scr(x - d.x, y - d.y); j ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.closePath(); g.fill(); g.stroke();
    }
    g.fillStyle = 'red'; g.fillRect(-3 / k, -3 / k, 6 / k, 6 / k);
    g.restore();
    g.fillStyle = '#000'; g.fillText(`${d.key}${d.flip ? ' (esp)' : ''} ${d.phys}`, ox - CW / 2 + 6, oy + 40);
  });
  window.done = 1;
})().catch((e) => { window.__err = String(e.stack); window.done = 1; });
