// Tela de carregamento pintada (arte do usuário, tools/import-loading.py):
// fundo 16:9 inteiro na tela (laterais desfocadas) e a barra dourada com listras andando.
import fundo from '../assets/loading/fundo.webp';
import moldura from '../assets/loading/moldura.webp';
import tile from '../assets/loading/fill-tile.webp';
import M from '../assets/loading/barra.json';

// baixa as imagens já na tela inicial, para a tela de carregamento abrir pronta
export const loadingReady = Promise.all([fundo, moldura, tile].map((u) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = u; })));
const css = `
#loading { position: fixed; inset: 0; z-index: 30; background: #0d0a16; overflow: hidden; }
#loading .blur { position: absolute; inset: -30px; background: url(${fundo}) center / cover; filter: blur(16px) brightness(.55); }
#loading .stage { position: absolute; background: url(${fundo}) 0 0 / 100% 100%; }
#loading .stage::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 38%; background: linear-gradient(transparent, rgba(8,6,14,.75)); }
#loading .lbar { position: absolute; left: 50%; bottom: 6%; width: 56%; transform: translateX(-50%); aspect-ratio: ${M.w} / ${M.h}; z-index: 1; }
#loading .lchan { position: absolute; background: #3a2418; border-radius: 6px; overflow: hidden; }
#loading .lfill { height: 100%; width: 0; background: url(${tile}) 0 0 / auto 100% repeat-x; transition: width .25s; animation: gor-stripes 1.2s linear infinite; }
@keyframes gor-stripes { to { background-position-x: ${M.periodo * (M.h / (M.chan[3] * 2))}px; } }
#loading .frame { position: absolute; inset: 0; background: url(${moldura}) 0 0 / 100% 100%; }
#loading .txt { position: absolute; left: 0; right: 0; bottom: 100%; margin-bottom: -2%; text-align: center; font: 700 1em Georgia, serif;
  color: #fff3d8; text-shadow: 0 2px 0 #000, 0 0 8px #000; }
`;

export function showLoading(texto = 'Carregando o Desfiladeiro do Sol…') {
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);
  const el = document.createElement('div'); el.id = 'loading';
  const [cx, cy, cw, ch] = M.chan, pc = (v, t) => `${(100 * v) / t}%`;
  el.innerHTML = `<div class="blur"></div><div class="stage"><div class="lbar">
    <div class="lchan" style="left:${pc(cx, M.w)};top:${pc(cy, M.h)};width:${pc(cw, M.w)};height:${pc(ch, M.h)}"><div class="lfill"></div></div>
    <div class="frame"></div><div class="txt">${texto} <span class="pct"></span></div></div></div>`;
  document.body.append(el);
  const stage = el.querySelector('.stage'), fill = el.querySelector(".lfill"), pct = el.querySelector('.pct');
  const layout = () => {
    const s = Math.min(innerWidth / 16, innerHeight / 9), w = s * 16, h = s * 9;
    Object.assign(stage.style, { width: w + 'px', height: h + 'px', left: (innerWidth - w) / 2 + 'px', top: (innerHeight - h) / 2 + 'px', fontSize: h * 0.035 + 'px' });
  };
  layout(); addEventListener('resize', layout);
  return {
    set(f) { fill.style.width = (f * 100).toFixed(1) + '%'; pct.textContent = Math.round(f * 100) + '%'; },
    remove() { removeEventListener('resize', layout); el.remove(); st.remove(); },
  };
}
