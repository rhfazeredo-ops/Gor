// Seleção de heróis pintada (arte do usuário, tools/import-select.py).
// As cartas são recortes da arte; a escolhida ganha brilho e cresce, as outras escurecem.
// O painel de baixo mostra nome, descrição, emblema e atributos do herói selecionado.
import M from '../assets/select/select.json';
import fundo from '../assets/select/fundo.webp';
import { ROSTER } from '../data/roster.js';
import { HEROES } from '../data/heroes.js';
const IMGS = import.meta.glob('../assets/select/*-retrato.webp', { eager: true, query: '?url', import: 'default' });
const retrato = (n) => IMGS[`../assets/select/${n}.webp`];

const css = `
#hsel { position: fixed; inset: 0; z-index: 19; background: #140b08; overflow: hidden; }
#hsel .blur { position: absolute; inset: -30px; background: url(${fundo}) center / cover; filter: blur(14px) brightness(.55); }
#hsel .stage { position: absolute; left: 50%; top: 50%; transform-origin: 0 0; }
#hsel .bg { position: absolute; inset: 0; background: url(${fundo}) 0 0 / 100% 100%; }
#hsel .card { position: absolute; background: linear-gradient(160deg, #f7d77a, #b7801f 45%, #f3c75a 70%, #8a5a14); cursor: pointer; transition: transform .18s, filter .18s; filter: brightness(.6) saturate(.75); -webkit-tap-highlight-color: transparent; }
#hsel .card.sel { transform: scale(1.04); transform-origin: 50% 100%; filter: brightness(1.12) drop-shadow(0 0 6px #ffcf4a) drop-shadow(0 0 16px #ff9a1a); z-index: 2; }
#hsel .card .in { position: absolute; inset: 0; }
#hsel .card.vazia { filter: brightness(.5) saturate(.4); cursor: default; }
#hsel .card .in.vazia { background: radial-gradient(#2a1d17, #120b08); }
#hsel .card .in.heroi { background-repeat: no-repeat; }
#hsel .card .cnome { position: absolute; left: 0; right: 0; bottom: 13%; text-align: center; font: 700 34px Georgia, serif; color: #fff4dc;
  text-shadow: 0 3px 0 #000, 0 0 8px #000, 2px 0 0 #000, -2px 0 0 #000; }
#hsel .card .lock { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); font: 700 15px Georgia, serif; color: #f6e7cf;
  background: rgba(20,10,10,.8); border: 1px solid #c9a24a; padding: 2px 10px; border-radius: 3px; white-space: nowrap; }
#hsel .txt { position: absolute; font-family: Georgia, 'Times New Roman', serif; color: #f6e7cf; text-shadow: 0 2px 0 #000; }
#hsel .nome { font-weight: 700; font-size: 38px; color: #ffe2a0; line-height: 50px; }
#hsel .desc { font-size: 21px; line-height: 1.4; }
#hsel .emb { position: absolute; border-radius: 4px; background-repeat: no-repeat; box-shadow: inset 0 0 0 2px #8a6a2a, inset 0 0 18px #000; background-color: #1e1410; }
#hsel .bars { position: absolute; background: #1c120d; border-radius: 3px; }
#hsel .bar { position: absolute; left: 0; height: 16px; width: 100%; display: flex; gap: 3px; transform: translateY(-50%); }
#hsel .bar i { flex: 1; background: #3a2a20; border: 1px solid #120a06; transform: skewX(-20deg); }
#hsel .bar i.on { background: linear-gradient(#ffd56a, #e08a1a); }
#hsel .bar i.half { background: linear-gradient(90deg, #f5b13a 50%, #3a2a20 50%); }
#hsel .hit { position: absolute; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#hsel .msg { position: absolute; left: 50%; top: 54%; transform: translate(-50%, -50%); background: rgba(20,10,10,.92); border: 2px solid #c9a24a;
  color: #f6e7cf; font: 22px Georgia, serif; padding: 14px 26px; border-radius: 4px; pointer-events: none; opacity: 0; transition: opacity .2s; z-index: 5; }
#hsel .msg.show { opacity: 1; }
`;

export function showHeroSelectArt(onPick, onBack) {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const el = document.createElement('div'); el.id = 'hsel'; document.body.append(el);
  el.innerHTML = '<div class="blur"></div>';
  const stage = document.createElement('div'); stage.className = 'stage'; el.append(stage);
  Object.assign(stage.style, { width: M.w + 'px', height: M.h + 'px' });
  stage.innerHTML = '<div class="bg"></div>';
  const at = (cls, [x, y, w, h], tag = 'div') => { const d = document.createElement(tag); d.className = cls; Object.assign(d.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }); stage.append(d); return d; };
  const cards = M.cards.map((c, k) => {
    const d = at('card', [c.x, c.y, c.w, c.h]), R = ROSTER[k];
    const pts = (k0) => { const cx = c.w / 2, cy = c.h / 2; return `polygon(${c.poly.map(([x, y]) => `${cx + (x - cx) * k0}px ${cy + (y - cy) * k0}px`).join(',')})`; };
    d.style.clipPath = pts(1);
    const inn = document.createElement('div'); inn.className = 'in ' + (R ? 'heroi' : 'vazia'); inn.style.clipPath = pts(0.955); d.append(inn);
    if (R) {
      inn.style.backgroundImage = `url(${retrato(R.retrato)}), linear-gradient(170deg, ${R.fundo[0]}, ${R.fundo[1]})`;
      inn.style.backgroundSize = 'auto 92%, 100% 100%'; inn.style.backgroundPosition = '38% 100%, 0 0';
      const n = document.createElement('div'); n.className = 'cnome'; n.textContent = R.nome; inn.append(n);
      d.onclick = () => (sel === k ? confirm() : mark(k));
    } else d.classList.add('vazia');
    return d;
  });
  const nome = at('txt nome', M.nome), desc = at('txt desc', M.desc);
  const emb = at('emb', [M.emblema[0] + 4, M.emblema[1] + 10, M.emblema[2] - 8, M.emblema[3] - 20]);
  const bars = at('bars', [M.barras[0] - 6, M.barras[1] - 4, M.barras[2] + 12, M.barras[3] + 8]);
  const barEls = M.stats.map(([x, y]) => { const b = document.createElement('div'); b.className = 'bar'; b.style.top = (y - M.barras[1] + 4) + 'px'; b.innerHTML = '<i></i>'.repeat(5); bars.append(b); return b; });
  const msg = document.createElement('div'); msg.className = 'msg'; stage.append(msg);
  const step = (dir) => { for (let k = 1; k <= 5; k++) { const j = (sel + dir * k + 25) % 5; if (ROSTER[j]) return mark(j); } };
  at('hit', M.setas[0]).onclick = () => step(-1);
  at('hit', M.setas[1]).onclick = () => step(1);
  at('hit', M.confirmar).onclick = () => confirm();
  at('hit', M.voltar).onclick = () => back();

  function playable(k) { if (!ROSTER[k]) return false; const id = ROSTER[k].id; return !!(id && HEROES.find((h) => h.id === id && h.playable)); }
  let sel = ROSTER.findIndex(Boolean);
  function mark(k) {
    sel = k; const R = ROSTER[k], c = M.cards[k];
    cards.forEach((d, j) => d.classList.toggle('sel', j === k));
    nome.textContent = R.nome; desc.textContent = R.desc;
    // emblema: recorte do símbolo da própria carta
    emb.style.backgroundImage = `url(${retrato(R.retrato)}), linear-gradient(170deg, ${R.fundo[0]}, ${R.fundo[1]})`;
    emb.style.backgroundSize = '260% auto, 100% 100%'; emb.style.backgroundPosition = '62% 30%, 0 0';
    R.stats.forEach((v, i) => [...barEls[i].children].forEach((s, j) => { s.className = v >= j + 1 ? 'on' : v > j ? 'half' : ''; }));
  }
  let msgT = 0;
  function confirm() {
    if (!playable(sel)) { msg.textContent = `${ROSTER[sel].nome} chega em breve. Escolha o Dalárian.`; msg.classList.add('show'); clearTimeout(msgT); msgT = setTimeout(() => msg.classList.remove('show'), 1800); return; }
    close(); onPick(HEROES.find((h) => h.id === ROSTER[sel].id));
  }
  function back() { close(); onBack && onBack(); }
  function close() { removeEventListener('keydown', key); removeEventListener('resize', fit); el.remove(); st.remove(); }
  const key = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') step(-1);
    else if (e.key === 'ArrowRight' || e.key === 'd') step(1);
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'A') confirm();
    else if (e.key === 'Escape') back();
  };
  // a arte inteira cabe na tela ("contain"); as sobras mostram o fundo desfocado
  function fit() { const s = Math.min(innerWidth / M.w, innerHeight / M.h); stage.style.transform = `scale(${s}) translate(-50%, -50%)`; }
  addEventListener('keydown', key); addEventListener('resize', fit); fit(); mark(ROSTER.findIndex(Boolean));
}
