// Tela inicial (arte do usuário): a imagem inteira cabe na tela (proporção 16:9, como o jogo)
// e o menu fica embaixo, no centro, sobre a vila e o rio.
import bg from '../assets/title/tela-inicial.webp';
// a arte começa a baixar já (o resto do jogo espera por ela)
export const titleReady = new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = bg; });

const css = `
#title { position: fixed; inset: 0; z-index: 20; background: #0d0a16; overflow: hidden; }
#title .blur { position: absolute; inset: -30px; background: url(${bg}) center / cover; filter: blur(16px) brightness(.6); }
#title .stage { position: absolute; background: url(${bg}) 0 0 / 100% 100%; box-shadow: 0 0 40px #000; }
#title.hide { opacity: 0; pointer-events: none; transition: opacity .5s; }
#title .menu { position: absolute; left: 50%; top: 59%; transform: translateX(-50%); width: 25%; padding: 1.2% 0;
  display: flex; flex-direction: column; align-items: stretch;
  background: radial-gradient(ellipse at center, rgba(10,14,34,.78) 30%, rgba(10,14,34,.55) 62%, rgba(10,14,34,0) 75%); }
#title .it { position: relative; text-align: center; font-family: Georgia, 'Times New Roman', serif; font-weight: 700; color: #f6ecd4;
  text-shadow: 0 2px 0 #000, 0 0 6px #000; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
#title .it + .it::before { content: ''; position: absolute; top: 0; left: 22%; right: 22%; height: 1px;
  background: linear-gradient(90deg, transparent, #c9a24a 30%, #f3d27a 50%, #c9a24a 70%, transparent); }
#title .it.sel { color: #fff; }
#title .it.sel::after { content: ''; position: absolute; inset: 6% 4%; z-index: -1; border-radius: 3px;
  background: linear-gradient(90deg, rgba(42,61,143,0), #2a3d8f 18%, #3550b8 50%, #2a3d8f 82%, rgba(42,61,143,0));
  box-shadow: inset 0 1px 0 #f3d27a, inset 0 -1px 0 #f3d27a; }
#title .it.off { opacity: .45; }
#title .pop { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(12,16,36,.92); border: 2px solid #c9a24a;
  color: #f6ecd4; font: 1em Georgia, serif; padding: 1.1em 1.6em; border-radius: 4px; text-align: center; max-width: 80vw; line-height: 1.5; z-index: 2; }
#title .pop b { color: #ffd86b; }
`;

export function showTitle(onStart) {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const el = document.createElement('div'); el.id = 'title'; el.innerHTML = '<div class="blur"></div>'; document.body.append(el);
  const stage = document.createElement('div'); stage.className = 'stage'; el.append(stage);
  const menu = document.createElement('div'); menu.className = 'menu'; stage.append(menu);
  const temSave = !!localStorage.getItem('gor-save');
  const items = [
    ['Iniciar', () => go()],
    ['Carregar', () => (temSave ? go() : pop('Nenhum jogo salvo ainda.'))],
    ['Opções', () => pop('<b>Opções</b><br>Som e controles: em breve.')],
    ['Créditos', () => pop('<b>Terra de Gor</b><br>Criação e arte: você<br>Animações: Universal Animation Library (Quaternius, CC0)')],
    ['Sair', () => { window.close(); pop('Para sair, feche a aba do navegador.'); }],
  ];
  let sel = 0;
  const els = items.map(([t, fn], k) => {
    const d = document.createElement('div'); d.className = 'it' + (k === 1 && !temSave ? ' off' : ''); d.textContent = t;
    d.onpointerenter = () => mark(k); d.onclick = () => { mark(k); fn(); };
    menu.append(d); return d;
  });
  const mark = (k) => { sel = k; els.forEach((e, j) => e.classList.toggle('sel', j === k)); };
  mark(0);
  let popEl = null;
  function pop(html) { popEl?.remove(); popEl = document.createElement('div'); popEl.className = 'pop'; popEl.innerHTML = html; stage.append(popEl); popEl.onclick = (e) => { e.stopPropagation(); popEl.remove(); popEl = null; }; }
  // mesma regra do jogo: 16:9 inteiro na tela
  function layout() {
    const s = Math.min(innerWidth / 16, innerHeight / 9), w = s * 16, h = s * 9;
    Object.assign(stage.style, { width: w + 'px', height: h + 'px', left: (innerWidth - w) / 2 + 'px', top: (innerHeight - h) / 2 + 'px' });
    const step = h * 0.064;
    menu.style.fontSize = step * 0.5 + 'px'; stage.style.fontSize = h * 0.03 + 'px';
    els.forEach((e) => { e.style.height = step + 'px'; e.style.lineHeight = step + 'px'; });
  }
  layout(); addEventListener('resize', layout);
  const key = (e) => {
    if (popEl) { if (['Enter', 'Escape', ' '].includes(e.key)) { popEl.remove(); popEl = null; } return; }
    if (e.key === 'ArrowDown' || e.key === 's') mark((sel + 1) % items.length);
    else if (e.key === 'ArrowUp' || e.key === 'w') mark((sel + items.length - 1) % items.length);
    else if (e.key === 'Enter' || e.key === ' ') items[sel][1]();
  };
  addEventListener('keydown', key);
  function go() {
    removeEventListener('keydown', key); removeEventListener('resize', layout);
    el.classList.add('hide'); setTimeout(() => { el.remove(); st.remove(); }, 550);
    onStart();
  }
}
