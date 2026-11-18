import * as DES from './deserto.js';
const REFS = import.meta.glob('./refs/*.jpg', { query: '?url', import: 'default', eager: true });
const TEMAS = { deserto: DES };
const $ = (id) => document.getElementById(id);
const st = { tema: 'deserto', asset: null, seed: 1, p: {} };

function fillAssets() {
  const cat = TEMAS[st.tema].CATALOG; $('asset').innerHTML = Object.keys(cat).map((k) => `<option>${k}</option>`).join('');
  st.asset = st.asset && cat[st.asset] ? st.asset : Object.keys(cat)[0]; $('asset').value = st.asset; params();
}
function params() {
  const def = TEMAS[st.tema].CATALOG[st.asset]; st.p = {};
  $('params').innerHTML = '';
  for (const [k, [a, b, v]] of Object.entries(def.params)) {
    st.p[k] = v;
    const l = document.createElement('label'); const step = Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(v) ? 1 : 0.01;
    l.innerHTML = `${k} <input type=range min=${a} max=${b} step=${step} value=${v}> <span>${v}</span>`;
    const inp = l.querySelector('input'); inp.oninput = () => { st.p[k] = +inp.value; l.querySelector('span').textContent = inp.value; draw(); };
    $('params').append(l);
  }
  $('ref').src = REFS[`./refs/${def.ref}.jpg`];
  draw();
}
function bg(g, W, H) { const t = DES.chaoTextura(3); g.fillStyle = g.createPattern(t, 'repeat'); g.fillRect(0, 0, W, H); }
// recorta a área transparente em volta (para mostrar grande)
function trim(a) {
  const c = a.img, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let i = 0; i < c.width; i += 2) if (d[(y * c.width + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0) return a;
  const R = c.width / a.w, o = document.createElement('canvas'); o.width = x1 - x0 + 8; o.height = y1 - y0 + 8;
  o.getContext('2d').drawImage(c, x0 - 4, y0 - 4, o.width, o.height, 0, 0, o.width, o.height);
  return { img: o, w: o.width / R, h: o.height / R, ax: a.ax - (x0 - 4) / R, ay: a.ay - (y0 - 4) / R };
}
function draw() {
  const def = TEMAS[st.tema].CATALOG[st.asset];
  const a = trim(def.fn(st.seed, { ...st.p }));
  const cv = $('stage'), g = cv.getContext('2d');
  bg(g, cv.width, cv.height);
  const k = Math.min(cv.width * 0.85 / a.w, cv.height * 0.85 / a.h, 5);
  g.drawImage(a.img, (cv.width - a.w * k) / 2, (cv.height - a.h * k) / 2, a.w * k, a.h * k);
  window.__asset = a;
  const grid = $('grid'); grid.innerHTML = '';
  for (let s = 1; s <= 8; s++) {
    const b = trim(def.fn(st.seed + s * 17, { ...st.p })), c = document.createElement('canvas'); c.width = c.height = 320;
    const gg = c.getContext('2d'); bg(gg, 320, 320); const kk = Math.min(290 / b.w, 290 / b.h, 4);
    gg.drawImage(b.img, (320 - b.w * kk) / 2, (320 - b.h * kk) / 2, b.w * kk, b.h * kk); grid.append(c);
  }
}
$('asset').onchange = () => { st.asset = $('asset').value; params(); };
$('seed').oninput = () => { st.seed = +$('seed').value || 1; draw(); };
$('rnd').onclick = () => { st.seed = 1 + ((Math.random() * 9999) | 0); $('seed').value = st.seed; draw(); };
$('png').onclick = () => { const a = document.createElement('a'); a.href = window.__asset.img.toDataURL('image/png'); a.download = `${st.asset}-${st.seed}.png`; a.click(); };
const q = new URLSearchParams(location.search); if (q.get('asset')) st.asset = q.get('asset'); if (q.get('seed')) { st.seed = +q.get('seed'); $('seed').value = st.seed; }
fillAssets();
window.__ready = true;
