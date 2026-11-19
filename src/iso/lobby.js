// Lobby (taverna) e quadro de missões — arte do usuário.
// Lobby: imagem 16:9 inteira na tela com áreas de toque sobre os ícones pintados.
// Quadro: abre por cima do lobby; cada papel é uma missão (toque → entra no mapa).
import lobbyImg from '../assets/lobby/lobby.webp';
import quadroImg from '../assets/lobby/quadro.webp';
import { MISSIONS } from '../data/missions.js';
const PAPEIS = import.meta.glob('../assets/lobby/missao-*.webp', { eager: true, query: '?url', import: 'default' });
const papel = (n) => PAPEIS[`../assets/lobby/${n}.webp`];
export const lobbyReady = Promise.all([lobbyImg, quadroImg, ...Object.values(PAPEIS)].map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; })));

// áreas de toque na arte do lobby (px na imagem de 1670x941)
const LW = 1670, LH = 941;
const SPOTS = [
  { id: 'missoes', box: [22, 165, 112, 110] },
  { id: 'missoes', box: [985, 355, 140, 110] },
  { id: 'inventario', box: [22, 285, 112, 105], txt: 'Inventário' },
  { id: 'herois', box: [22, 395, 112, 100], txt: 'Heróis' },
  { id: 'estalajadeiro', box: [500, 255, 175, 115], txt: 'Estalajadeiro' },
  { id: 'eventos', box: [1470, 385, 150, 110], txt: 'Eventos' },
  { id: 'correio', box: [1515, 12, 60, 55], txt: 'Mensagens' },
  { id: 'config', box: [1590, 12, 65, 55], txt: 'Configurações' },
];

const css = `
#lobby, #quadro { position: fixed; inset: 0; z-index: 18; background: #0d0a16; overflow: hidden; }
#quadro { z-index: 19; background: rgba(8,6,14,.6); opacity: 0; transition: opacity .2s; }
#quadro.show { opacity: 1; }
#lobby .blur { position: absolute; inset: -30px; background: url(${lobbyImg}) center / cover; filter: blur(16px) brightness(.55); }
#lobby .stage, #quadro .stage { position: absolute; }
#lobby .stage { background: url(${lobbyImg}) 0 0 / 100% 100%; }
#lobby .spot { position: absolute; cursor: pointer; border-radius: 14px; -webkit-tap-highlight-color: transparent; }
#lobby .spot:active { background: rgba(255,220,140,.18); }
#lobby .toast, #quadro .toast { position: fixed; left: 50%; bottom: 8%; transform: translateX(-50%); background: rgba(20,12,8,.9); border: 2px solid #c9a24a;
  color: #f6e7cf; font: 700 1em Georgia, serif; padding: .5em 1.2em; border-radius: 4px; opacity: 0; transition: opacity .2s; pointer-events: none; white-space: nowrap; }
#lobby .toast.show, #quadro .toast.show { opacity: 1; }
#quadro .board { position: absolute; background: url(${quadroImg}) 0 0 / 100% 100%; transform: scale(.94); transition: transform .2s; }
#quadro.show .board { transform: scale(1); }
#quadro .papeis { position: absolute; left: 13.5%; top: 26%; width: 73%; height: 54%; display: flex; gap: 4%; justify-content: center; align-items: center; }
#quadro .papel { height: 100%; aspect-ratio: 1060 / 1484; background: 0 0 / 100% 100% no-repeat; cursor: pointer; box-shadow: 0 .4em .8em rgba(0,0,0,.6);
  transition: transform .15s; -webkit-tap-highlight-color: transparent; }
#quadro .papel { transform: rotate(var(--rot)); }
#quadro .papel.sel { transform: scale(1.06) rotate(0deg); box-shadow: 0 0 0 .16em #ffd45a, 0 0 .7em .25em #ffb92a, 0 0 1.8em .4em rgba(255,170,30,.6); }
#quadro .iniciar { position: absolute; left: 50%; bottom: 3.5%; transform: translateX(-50%); padding: .45em 2.6em; border-radius: .5em; cursor: pointer;
  font: 700 1.6em Georgia, serif; color: #fff4dc; text-shadow: 0 2px 0 #000; letter-spacing: .04em;
  background: linear-gradient(#3a59c8, #1d2f86); border: .14em solid #f3c75a; box-shadow: 0 .25em .6em rgba(0,0,0,.6), inset 0 1px 0 #8aa4ff;
  filter: grayscale(.9) brightness(.55); pointer-events: none; transition: filter .2s; -webkit-tap-highlight-color: transparent; }
#quadro .iniciar.on { filter: none; pointer-events: auto; }
#quadro .iniciar.on:active { transform: translateX(-50%) scale(.95); }
#quadro .fechar { position: absolute; right: 2.5%; top: 2.5%; width: 7%; aspect-ratio: 1; border-radius: 50%; cursor: pointer; display: grid; place-items: center;
  background: radial-gradient(#3a2414, #1c100a); border: .18em solid #c9a24a; color: #f6e7cf; font: 700 2.2em Georgia, serif; line-height: 1; }
`;

let style = null;
// preenche a tela inteira (corta um pouco em cima/embaixo em telas mais compridas que 16:9)
function cover16x9(stage) {
  const s = Math.max(innerWidth / 16, innerHeight / 9), w = s * 16, h = s * 9;
  Object.assign(stage.style, { width: w + 'px', height: h + 'px', left: (innerWidth - w) / 2 + 'px', top: (innerHeight - h) / 2 + 'px', fontSize: Math.min(h, innerHeight * 16 / 9 * 9 / 16) * 0.03 + 'px' });
}
function fit16x9(stage) {
  const s = Math.min(innerWidth / 16, innerHeight / 9), w = s * 16, h = s * 9;
  Object.assign(stage.style, { width: w + 'px', height: h + 'px', left: (innerWidth - w) / 2 + 'px', top: (innerHeight - h) / 2 + 'px', fontSize: h * 0.03 + 'px' });
}

// abre o lobby; onMission(missão) é chamado quando um papel é escolhido
export function showLobby({ onMission, onHeroes }) {
  if (!style) { style = document.createElement('style'); style.textContent = css; document.head.append(style); }
  const el = document.createElement('div'); el.id = 'lobby'; el.innerHTML = '<div class="blur"></div>';
  const stage = document.createElement('div'); stage.className = 'stage'; el.append(stage);
  const toast = document.createElement('div'); toast.className = 'toast'; stage.append(toast);
  let tt = 0;
  const say = (t) => { toast.textContent = t; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 1600); };
  for (const sp of SPOTS) {
    const [x, y, w, h] = sp.box, d = document.createElement('div'); d.className = 'spot';
    Object.assign(d.style, { left: (100 * x) / LW + '%', top: (100 * y) / LH + '%', width: (100 * w) / LW + '%', height: (100 * h) / LH + '%' });
    d.onclick = () => (sp.id === 'missoes' ? openBoard() : sp.id === 'herois' && onHeroes ? onHeroes() : say(`${sp.txt}: em breve`));
    stage.append(d);
  }
  document.body.append(el);
  const layout = () => cover16x9(stage);
  layout(); addEventListener('resize', layout);

  function openBoard() {
    const q = document.createElement('div'); q.id = 'quadro';
    const qs = document.createElement('div'); qs.className = 'stage'; q.append(qs);
    const board = document.createElement('div'); board.className = 'board'; qs.append(board);
    const list = document.createElement('div'); list.className = 'papeis'; board.append(list);
    // tocar num papel seleciona (contorno dourado); o botão Iniciar começa a missão escolhida
    let escolhida = null;
    const papeis = MISSIONS.map((m, k) => {
      const p = document.createElement('div'); p.className = 'papel'; p.title = m.nome;
      p.style.backgroundImage = `url(${papel(m.papel)})`;
      p.style.setProperty('--rot', `${[-2.5, 2, -1.5, 3][k % 4]}deg`);
      p.onclick = (e) => { e.stopPropagation(); escolhida = m; papeis.forEach((q) => q.classList.toggle('sel', q === p)); iniciar.classList.add('on'); };
      list.append(p); return p;
    });
    const iniciar = document.createElement('div'); iniciar.className = 'iniciar'; iniciar.textContent = 'Iniciar';
    iniciar.onclick = (e) => { e.stopPropagation(); if (!escolhida) return; close(); closeLobby(); onMission(escolhida); };
    board.append(iniciar);
    const x = document.createElement('div'); x.className = 'fechar'; x.textContent = '×'; board.append(x);
    const close = () => { q.classList.remove('show'); removeEventListener('resize', lay); setTimeout(() => q.remove(), 200); };
    x.onclick = close;
    q.onclick = (e) => { if (e.target === q || e.target === qs) close(); };
    // quadro 3:2 o maior possível dentro da área 16:9
    const lay = () => {
      fit16x9(qs); const W = parseFloat(qs.style.width), H = parseFloat(qs.style.height);
      const bh = Math.min(H * 0.96, (W * 0.96) / 1.5), bw = bh * 1.5;
      Object.assign(board.style, { width: bw + 'px', height: bh + 'px', left: (W - bw) / 2 + 'px', top: (H - bh) / 2 + 'px' });
    };
    lay(); addEventListener('resize', lay);
    document.body.append(q); requestAnimationFrame(() => q.classList.add('show'));
  }
  function closeLobby() { removeEventListener('resize', layout); el.remove(); }
  return { close: closeLobby };
}
