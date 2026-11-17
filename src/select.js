import { HEROES, FACTIONS } from './data/heroes.js';

// Tela de seleção: mostra todos os heróis; só os jogáveis podem ser escolhidos.
export function showHeroSelect(onPick) {
  const el = document.getElementById('select');
  const grid = el.querySelector('.grid');
  grid.innerHTML = '';
  for (const [fid, f] of Object.entries(FACTIONS)) {
    const col = document.createElement('div');
    col.className = 'faction';
    col.innerHTML = `<h3 style="border-color:${f.cor}">${f.nome}</h3>`;
    for (const h of HEROES.filter((x) => x.faccao === fid)) {
      const card = document.createElement('button');
      card.className = 'card' + (h.playable ? '' : ' locked');
      card.style.backgroundImage = `url(./concept-art/${h.concept})`;
      card.innerHTML = `<div class="info"><b>${h.nome}</b><small>${h.titulo}</small><em>${h.playable ? h.papel : '🔒 Em breve'}</em></div>`;
      if (h.playable) card.onclick = () => { el.classList.add('hidden'); onPick(h); };
      col.append(card);
    }
    grid.append(col);
  }
  el.classList.remove('hidden');
}
