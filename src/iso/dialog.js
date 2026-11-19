// Interface de diálogo pintada (kit do usuário, importado por tools/import-ui-kit.py):
// fala com retrato, escolhas, faixa de nova missão, dica e janela de informação.
// Painéis em HTML por cima do jogo; os textos são escritos nas caixas medidas na arte.
import kit from '../assets/ui-kit/kit.json';
const URLS = import.meta.glob('../assets/ui-kit/*.webp', { eager: true, query: '?url', import: 'default' });
const url = (n) => URLS[`../assets/ui-kit/${n}.webp`];

const css = `
.ui-layer { position: fixed; inset: 0; z-index: 6; pointer-events: none; }
.ui-panel { position: absolute; background-size: 100% 100%; pointer-events: auto; opacity: 0; transition: opacity .2s, transform .25s; }
.ui-panel.show { opacity: 1; }
.ui-txt { position: absolute; display: flex; align-items: center; font-family: Georgia, 'Times New Roman', serif; font-weight: 700; line-height: 1.22; }
.ui-dark { color: #2a1608; }
.ui-light { color: #fff6e0; text-shadow: 0 0 2px #000, 0 2px 0 #000, 1px 0 0 #000, -1px 0 0 #000; }
.ui-opt { display: block; padding: .18em .6em .18em 1.4em; position: relative; cursor: pointer; border-bottom: 1px solid rgba(90,50,20,.25); }
.ui-opt:last-child { border-bottom: 0; }
.ui-opt.sel { background: linear-gradient(90deg, #f7c62c, #ffdf5e 70%, rgba(255,223,94,0)); }
.ui-opt.sel::before { content: '▶'; position: absolute; left: .35em; font-size: .8em; top: .3em; }
.ui-dim { position: absolute; inset: 0; background: rgba(10,5,15,.35); pointer-events: auto; opacity: 0; transition: opacity .2s; }
.ui-dim.show { opacity: 1; }
.ui-hint { position: absolute; right: 4%; bottom: 6%; font-size: .7em; opacity: .55; }
`;

export function createDialogUI() {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const layer = document.createElement('div'); layer.className = 'ui-layer'; document.body.append(layer);
  const ui = { paused: false };
  // painel na largura dada (vw / px máx) e posição; caixas de texto em % da arte
  const panel = (name, style) => {
    const K = kit[name], el = document.createElement('div');
    el.className = 'ui-panel'; el.style.backgroundImage = `url(${url(name)})`;
    Object.assign(el.style, style); el.style.aspectRatio = `${K.w} / ${K.h}`;
    const box = (key, cls) => {
      const [x, y, w, h] = K.text[key], t = document.createElement('div');
      t.className = 'ui-txt ' + (cls || '');
      Object.assign(t.style, { left: `${(100 * x) / K.w}%`, top: `${(100 * y) / K.h}%`, width: `${(100 * w) / K.w}%`, height: `${(100 * h) / K.h}%` });
      el.append(t); return t;
    };
    layer.append(el); requestAnimationFrame(() => el.classList.add('show'));
    // tamanho da letra proporcional ao painel
    const fit = () => { el.style.fontSize = `${el.getBoundingClientRect().width / K.w * 34}px`; };
    requestAnimationFrame(fit);
    return { el, box, close: () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); } };
  };
  const dim = () => { const d = document.createElement('div'); d.className = 'ui-dim'; layer.append(d); requestAnimationFrame(() => d.classList.add('show')); return () => { d.classList.remove('show'); setTimeout(() => d.remove(), 250); }; };
  const wide = { left: '50%', transform: 'translateX(-50%)', width: 'min(720px, 70vw)' };

  // fala com retrato: texto aparece letra a letra; toque completa / avança
  ui.say = (nome, texto) => new Promise((done) => {
    ui.paused = true;
    const P = panel('dialogo', { ...wide, bottom: '3%' });
    P.box('nome', 'ui-light').textContent = nome;
    const f = P.box('fala', 'ui-dark'); f.style.alignItems = 'flex-start'; f.style.paddingTop = '.4em';
    let i = 0, timer = setInterval(() => { i++; f.textContent = texto.slice(0, i); if (i >= texto.length) clearInterval(timer); }, 22);
    const next = (ev) => {
      ev && ev.preventDefault();
      if (i < texto.length) { i = texto.length; f.textContent = texto; clearInterval(timer); return; }
      window.removeEventListener('pointerdown', next); window.removeEventListener('keydown', key);
      P.close(); ui.paused = false; done();
    };
    const key = (e) => { if (['Enter', ' ', 'e', 'E'].includes(e.key)) next(e); };
    setTimeout(() => window.addEventListener('pointerdown', next), 50); window.addEventListener('keydown', key);
  });

  // escolhas: toque numa opção (ou setas + Enter); devolve o índice
  ui.choose = (opcoes) => new Promise((done) => {
    ui.paused = true;
    const P = panel('escolhas', { ...wide, width: 'min(700px, 72vw)', bottom: '4%' });
    const box = P.box('opcoes', 'ui-dark'); box.style.flexDirection = 'column'; box.style.alignItems = 'stretch'; box.style.justifyContent = 'center';
    let sel = 0;
    const items = opcoes.map((t, k) => { const o = document.createElement('div'); o.className = 'ui-opt'; o.textContent = t; o.onpointerdown = (e) => { e.preventDefault(); pick(k); }; o.onpointerenter = () => mark(k); box.append(o); return o; });
    const mark = (k) => { sel = k; items.forEach((o, j) => o.classList.toggle('sel', j === k)); };
    const pick = (k) => { window.removeEventListener('keydown', key); P.close(); ui.paused = false; done(k); };
    const key = (e) => {
      if (e.key === 'ArrowDown' || e.key === 's') mark((sel + 1) % items.length);
      else if (e.key === 'ArrowUp' || e.key === 'w') mark((sel + items.length - 1) % items.length);
      else if (e.key === 'Enter' || e.key === ' ') pick(sel);
      e.preventDefault();
    };
    window.addEventListener('keydown', key); mark(0);
  });

  // faixa de nova missão (some sozinha)
  ui.mission = (titulo, ms = 3800) => {
    const P = panel('missao', { left: '50%', top: '17%', width: 'min(620px, 64vw)', transform: 'translate(-50%, -12px)' });
    requestAnimationFrame(() => (P.el.style.transform = 'translate(-50%, 0)'));
    P.el.style.pointerEvents = 'none';
    const t = P.box('titulo', 'ui-light'); t.style.justifyContent = 'center'; t.style.fontSize = '1.25em'; t.textContent = titulo;
    setTimeout(P.close, ms);
  };

  // dica no canto (some sozinha)
  ui.tip = (texto, ms = 6000) => {
    const P = panel('dica', { left: '1.5%', bottom: '3%', width: 'min(400px, 42vw)' });
    P.el.style.pointerEvents = 'none';
    const t = P.box('texto', 'ui-dark'); t.style.fontSize = '0.9em';
    const span = document.createElement('span'); span.innerHTML = texto; t.append(span);
    setTimeout(P.close, ms);
  };

  // janela de informação com OK
  ui.info = (titulo, texto) => new Promise((done) => {
    ui.paused = true;
    const undim = dim();
    const P = panel('info', { left: '50%', top: '50%', width: 'min(400px, 72vh)', transform: 'translate(-50%, -50%)' });
    const t = P.box('titulo', 'ui-dark'); t.style.justifyContent = 'center'; t.style.fontSize = '1.3em'; t.textContent = titulo;
    const x = P.box('texto', 'ui-dark'); x.style.justifyContent = 'center'; x.style.textAlign = 'center'; x.style.fontSize = '0.82em'; x.textContent = texto;
    const ok = P.box('ok', 'ui-ok'); ok.style.cursor = 'pointer';
    const close = (e) => { e && e.preventDefault(); window.removeEventListener('keydown', key); P.close(); undim(); ui.paused = false; done(); };
    const key = (e) => { if (e.key === 'Enter' || e.key === ' ') close(e); };
    ok.onpointerdown = close; window.addEventListener('keydown', key);
  });
  window.__ui = ui;
  return ui;
}
