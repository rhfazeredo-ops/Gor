// Tela "Seleção de Herói" (botão Heróis do lobby) — arte do usuário (tools/import-herois.py).
// Esquerda: 5 vagas (herói ou "+"); meio: estandarte da raça + arte do herói; direita: dados.
import fundo from '../assets/herois/fundo.webp';
import atributos from '../assets/herois/atributos.webp';
import T from '../assets/herois/telas.json';
import { HEROIS } from '../data/herois.js';
const IMG = import.meta.glob('../assets/herois/*.webp', { eager: true, query: '?url', import: 'default' });
const img = (n) => IMG[`../assets/herois/${n}.webp`];
export const heroisReady = Promise.all(Object.values(IMG).map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; })));

const W = 1672, H = 941, SLOTS = [175, 316, 444, 572, 700];
const pc = (v, t) => (100 * v) / t + '%';
const box = (x, y, w, h) => `left:${pc(x, W)};top:${pc(y, H)};width:${pc(w, W)};height:${pc(h, H)}`;
const css = `
#herois { position: fixed; inset: 0; z-index: 21; background: #0a1017; overflow: hidden; }
#herois .stage { position: absolute; background: url(${fundo}) 0 0 / 100% 100%; font-family: Georgia, 'Times New Roman', serif; }
#herois .abs { position: absolute; }
#herois .hit { position: absolute; cursor: pointer; -webkit-tap-highlight-color: transparent; }
#herois .slot { position: absolute; cursor: pointer; border-radius: .35em; -webkit-tap-highlight-color: transparent; }
#herois .lista { overflow-y: auto; overflow-x: hidden; padding: .3em .45em; background: #0b1119; scrollbar-width: none; }
#herois .lista::-webkit-scrollbar { display: none; }
#herois .slot { height: auto !important; aspect-ratio: 430 / 114; }
#herois .slot.vazio { border: .12em solid #8a6a2a; background: linear-gradient(90deg, #161b26, #10141d); border-radius: .35em; }
#herois .slot .mais { position: absolute; inset: 0; display: grid; place-items: center; font: 700 2.4em Georgia, serif; color: #e9b44c; }
#herois .slot.cheio { background: linear-gradient(90deg, #1a1f2c, #141925); border: .12em solid #b98a3a; overflow: hidden; }
#herois .slot.sel { border-color: #ffcf5a; box-shadow: 0 0 .5em #ffb92a, 0 0 1.2em rgba(255,170,30,.7), inset 0 0 .6em rgba(255,190,60,.35); }
#herois .slot img { position: absolute; }
#herois .slot .n { position: absolute; left: 57%; top: 18%; font-weight: 700; font-size: 1.25em; color: #f6e7cf; text-shadow: 0 2px 0 #000; }
#herois .slot .c { position: absolute; left: 57%; top: 55%; right: 3%; font-size: .9em; color: #e8d7b5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#herois .nome { font-weight: 700; font-size: 2.1em; color: #f3e3b8; text-shadow: 0 2px 0 #000; white-space: nowrap; }
#herois .classe { font-size: 1.15em; color: #e9b44c; }
#herois .desc { font-size: .98em; line-height: 1.32; color: #efe6d6; }
#herois .linha { height: 1px; background: linear-gradient(90deg, transparent, #b98a3a 15%, #b98a3a 85%, transparent); }
#herois .barra { position: absolute; border-radius: 1em; background: #1d2230; box-shadow: inset 0 0 0 1px #3c4252; overflow: hidden; }
#herois .barra i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 1em; transition: width .3s;
  background: repeating-linear-gradient(110deg, #f7c84a 0 18%, #e9a52a 18% 20%), linear-gradient(#ffd96b, #e0961f); }
#herois .arte, #herois .band { transition: opacity .25s, transform .25s; }
#herois .slot.bloq > img, #herois .slot.bloq .n, #herois .slot.bloq .c { filter: brightness(.42) grayscale(.35); }
#herois .slot .cad { position: absolute; left: 25%; bottom: 7%; width: 10%; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(#3a2a1a, #140c06); border: .1em solid #c9a24a; display: grid; place-items: center; font-size: .85em; }
#herois.bloqueado .arte { filter: brightness(.6) saturate(.75); }
#herois .selbtn { overflow: hidden; }
#herois .selbtn.off { background: linear-gradient(#262b38, #161a24); border: .14em solid #6d5a36; border-radius: .9em; box-shadow: inset 0 0 1em #000; }
#herois .selbtn .lk { position: absolute; inset: 0; display: grid; place-items: center; font: 700 1.35em Georgia, serif; color: #f6e7cf; text-shadow: 0 2px 0 #000; }
#herois .toast { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%); background: rgba(14,18,30,.92); border: 2px solid #c9a24a; color: #f6e7cf;
  font-size: 1em; padding: .45em 1.1em; border-radius: 4px; opacity: 0; transition: opacity .2s; pointer-events: none; white-space: nowrap; }
#herois .toast.show { opacity: 1; }
`;
let style = null;

// abre a tela; onPick(herói) ao tocar em Selecionar; onBack ao tocar na seta
export function showHerois({ atual, onPick, onBack }) {
  if (!style) { style = document.createElement('style'); style.textContent = css; document.head.append(style); }
  const el = document.createElement('div'); el.id = 'herois';
  const st = document.createElement('div'); st.className = 'stage'; el.append(st);
  const add = (cls, b, html = '') => { const d = document.createElement('div'); d.className = cls; d.style.cssText = box(...b); d.innerHTML = html; st.append(d); return d; };
  // meio: estandarte e arte
  const band = add('abs band', [478, 0, 650, 941]); band.style.background = 'center / 100% 100% no-repeat';
  const arte = add('abs arte', [0, 0, 0, 0]); arte.style.background = 'center / 100% 100% no-repeat';
  // esquerda: vagas
  const lista = add('abs lista', [14, 160, 462, 680]);
  const N = Math.max(5, HEROIS.length + 1);          // sempre uma vaga "+" no fim
  const slots = Array.from({ length: N }, (_, k) => {
    const h = HEROIS[k], d = document.createElement('div'); d.className = 'slot' + (h ? ' cheio' : ' vazio');
    d.style.cssText = `position:relative;margin:0 0 ${(12 / 680) * 100}% 0;height:${(114 / 462) * 100 * 462 / 462}%;`;
    lista.append(d);
    const ic = img(h ? h.id + '-classe' : '') || img(h ? h.id + '-emblema' : '');
    if (h) d.innerHTML = `<img src="${img(h.id + '-slot')}" style="left:0;top:0;width:37%;height:100%;object-fit:cover">
      ${ic ? `<img src="${ic}" style="left:40%;top:16%;width:15%;height:66%;object-fit:contain">` : ''}<div class="n">${h.nome}</div><div class="c">${h.classe}</div>`;
    else d.innerHTML = '<div class="mais">+</div>';
    if (h && !h.jogavel) { d.classList.add('bloq'); d.insertAdjacentHTML('beforeend', '<div class="cad">🔒</div>'); }
    d.onclick = () => (h ? mark(k) : say('Novo herói em breve'));
    return d;
  });
  // direita: dados
  const emb = add('abs', [1164, 133, 112, 124]); emb.style.background = 'center / contain no-repeat';
  const nome = add('abs nome', [1300, 138, 330, 70]);
  const classe = add('abs classe', [1302, 210, 300, 40]);
  add('abs linha', [1300, 203, 290, 2]);
  const desc = add('abs desc', [1180, 262, 430, 130]);
  add('abs linha', [1168, 398, 455, 2]);
  const at = add('abs', [1170, 418, 192, 160]); at.style.background = `url(${atributos}) 0 0 / 100% 100%`;
  const barras = ['ataque', 'defesa', 'vida', 'mobilidade'].map((k, i) => { const b = add('barra', [1380, 426 + i * 40, 232, 22], '<i></i>'); return [k, b.firstChild]; });
  const habs = [1195, 1339, 1482].map((x) => { const d = add('abs', [x, 600, 116, 118]); d.style.background = 'center / 100% 100% no-repeat'; return d; });
  // botões
  add('hit', [0, 18, 150, 92]).onclick = () => { close(); onBack && onBack(); };
  // botão Selecionar: escurece e mostra cadeado quando o herói ainda não é jogável
  const selbtn = add('abs selbtn', [1175, 745, 445, 100]); selbtn.style.cursor = 'pointer';
  selbtn.onclick = () => { const h = HEROIS[sel]; if (!h.jogavel) return say(`${h.nome}: em breve`); close(); onPick(h); };
  const toast = add('toast', [0, 0, 0, 0]); toast.style.cssText = '';
  let tt = 0; const say = (t) => { toast.textContent = t; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 1500); };

  let sel = Math.max(0, HEROIS.findIndex((h) => h.jogavel && h.jogavel === atual));
  function mark(k) {
    sel = k; const h = HEROIS[k];
    el.classList.toggle('bloqueado', !h.jogavel);
    // o botão pintado fica no fundo: escurece por cima com um recorte da própria arte
    selbtn.classList.toggle('off', !h.jogavel);
    selbtn.innerHTML = h.jogavel ? '' : '<div class="lk">🔒 Em breve</div>';
    slots.forEach((s, j) => s.classList.toggle('sel', j === k));
    band.style.backgroundImage = `url(${img('estandarte-' + h.raca)})`;
    const [x, y, w, hh] = T.arte[h.id]; arte.style.cssText = box(x, y, w, hh); arte.style.background = `url(${img(h.id + '-arte')}) center / 100% 100% no-repeat`;
    const e = img(h.id + '-emblema'); emb.style.backgroundImage = e ? `url(${e})` : 'none';
    nome.textContent = h.nome; classe.textContent = h.classe; desc.textContent = h.desc;
    for (const [key, bar] of barras) bar.style.width = (h.stats[key] * 100).toFixed(0) + '%';
    habs.forEach((d, i) => { const u = img(h.id + '-hab' + (i + 1)); d.style.backgroundImage = u ? `url(${u})` : 'none'; d.style.visibility = u ? '' : 'hidden'; });
    slots[k].scrollIntoView({ block: 'nearest' });
  }
  document.body.append(el);
  // a arte inteira cabe na tela; as sobras têm a mesma cor do fundo (fica contínuo)
  const layout = () => {
    const s = Math.min(innerWidth / W, innerHeight / H), w = W * s, h = H * s;
    Object.assign(st.style, { width: w + 'px', height: h + 'px', left: (innerWidth - w) / 2 + 'px', top: (innerHeight - h) / 2 + 'px', fontSize: h * 0.026 + 'px' });
  };
  layout(); addEventListener('resize', layout); mark(sel);
  function close() { removeEventListener('resize', layout); el.remove(); }
}
