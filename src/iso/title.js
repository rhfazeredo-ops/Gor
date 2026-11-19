// Tela inicial pintada (arte do usuário, tools/import-title.py): menu de verdade
// por cima da arte, com o pincel vermelho seguindo a opção selecionada.
import bg from '../assets/title/tela-inicial.webp';
import brush from '../assets/title/pincel.webp';
import T from '../assets/title/title.json';

const css = `
#title { position: fixed; inset: 0; z-index: 20; background: #120a0a url(${bg}) center / cover no-repeat; display: block; }
#title.hide { opacity: 0; pointer-events: none; transition: opacity .5s; }
#title .menu { position: absolute; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
#title .it { position: relative; width: 100%; text-align: center; font: 700 1em Georgia, 'Times New Roman', serif; color: #f6e7cf;
  text-shadow: 0 2px 0 #000, 0 0 6px #000; cursor: pointer; padding: .22em 0; user-select: none; -webkit-tap-highlight-color: transparent; }
#title .it + .it::before { content: ''; position: absolute; top: 0; left: 18%; right: 18%; height: 1px;
  background: linear-gradient(90deg, transparent, #c9a24a 30%, #f3d27a 50%, #c9a24a 70%, transparent); }
#title .it.sel { color: #fff3d8; }
#title .it.sel::after { content: ''; position: absolute; inset: -.05em -12%; background: url(${brush}) center / 100% 100% no-repeat; z-index: -1; }
#title .it.off { opacity: .45; }
#title .pop { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); background: rgba(20,10,10,.9); border: 2px solid #c9a24a;
  color: #f6e7cf; font: 15px Georgia, serif; padding: 18px 26px; border-radius: 4px; text-align: center; max-width: 80vw; line-height: 1.5; }
#title .pop b { color: #ffd86b; }
`;

export function showTitle(onStart) {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const el = document.createElement('div'); el.id = 'title'; document.body.append(el);
  const menu = document.createElement('div'); menu.className = 'menu'; el.append(menu);
  const temSave = !!localStorage.getItem('gor-save');
  const items = [
    ['Iniciar', () => go()],
    ['Carregar', () => (temSave ? go() : pop('Nenhum jogo salvo ainda.'))],
    ['Opções', () => pop('<b>Opções</b><br>Tela cheia: botão ⛶ no jogo.<br>Som e controles: em breve.')],
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
  function pop(html) { popEl?.remove(); popEl = document.createElement('div'); popEl.className = 'pop'; popEl.innerHTML = html; el.append(popEl); popEl.onclick = (e) => { e.stopPropagation(); popEl.remove(); popEl = null; }; }
  // posiciona o menu no mesmo lugar da arte (a imagem cobre a tela: "cover")
  function layout() {
    const vw = innerWidth, vh = innerHeight, s = Math.max(vw / T.w, vh / T.h);
    const ox = (vw - T.w * s) / 2, oy = (vh - T.h * s) / 2, ys = T.menu.ys, step = (ys[1] - ys[0]) * s;
    Object.assign(menu.style, { left: `${ox + T.menu.cx * s}px`, top: `${oy + ys[0] * s - step / 2}px`, width: `${T.brush[0] * s * 0.62}px`, fontSize: `${step * 0.5}px` });
    els.forEach((e) => { e.style.height = `${step}px`; e.style.padding = '0'; e.style.lineHeight = `${step}px`; });
    // se o menu sairia por baixo da tela, sobe
    const bottom = oy + ys[0] * s - step / 2 + step * items.length;
    if (bottom > vh - 8) menu.style.top = `${vh - 8 - step * items.length}px`;
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
    el.classList.add('hide'); setTimeout(() => el.remove(), 550);
    onStart();
  }
}
