// HUD pintado (arte do usuário, importada por tools/import-hud.py):
// moldura + retrato, barras de vida/mana/energia preenchidas pela porcentagem,
// nível no círculo e recarga das 4 habilidades. Desenhado num canvas próprio.
import info from '../assets/hud/hud.json';
const URLS = import.meta.glob('../assets/hud/*.webp', { eager: true, query: '?url', import: 'default' });
const img = {};
for (const [p, u] of Object.entries(URLS)) { const i = new Image(); i.src = u; img[p.split('/').pop().replace('.webp', '')] = i; }

export function createHud(parent) {
  const k = info.scale, W = Math.round(info.w * k), H = Math.round(info.h * k);
  const c = document.createElement('canvas'); c.id = 'hud-canvas'; c.width = W; c.height = H;
  parent.prepend(c);
  const g = c.getContext('2d');
  const shown = { hp: 1, mp: 1, en: 1 }, trail = { hp: 1, mp: 1, en: 1 };
  let last = '';
  const text = (s, x, y, size) => {
    g.font = `700 ${size}px Georgia, 'Times New Roman', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.22; g.strokeStyle = '#140a06'; g.strokeText(s, x, y);
    g.fillStyle = '#fff8ea'; g.fillText(s, x, y);
  };
  return {
    // v = { hp, maxHp, mp, maxMp, en, maxEn, level, cds: [0..1 ×4], shield }
    draw(v, dt) {
      if (!img.base.complete) return;
      for (const b of ['hp', 'mp', 'en']) {
        const f = Math.max(0, Math.min(1, v[b] / v['max' + b[0].toUpperCase() + b.slice(1)]));
        shown[b] += (f - shown[b]) * Math.min(1, dt * 14);
        trail[b] = f > trail[b] ? f : trail[b] + (f - trail[b]) * Math.min(1, dt * 2.5);
      }
      const key = JSON.stringify([v.hp | 0, v.mp | 0, v.en | 0, v.level, v.cds.map((x) => x.toFixed(2)), v.shield, Object.values(shown).map((x) => x.toFixed(3)), Object.values(trail).map((x) => x.toFixed(3))]);
      if (key === last) return; last = key;
      g.clearRect(0, 0, W, H);
      g.drawImage(img.base, 0, 0, W, H);
      for (const b of ['hp', 'mp', 'en']) {
        const B = info.bars[b], x0 = B.x * k, bw = B.w * k;
        const cut = (f) => x0 + bw * f;
        // rastro claro do que acabou de ser perdido
        if (trail[b] > shown[b] + 0.003) {
          g.save(); g.globalAlpha = 0.55; g.filter = 'brightness(1.8) saturate(0.4)';
          g.drawImage(img[b], 0, 0, cut(trail[b]), H, 0, 0, cut(trail[b]), H); g.restore();
        }
        const w = cut(shown[b]);
        if (w > 0) g.drawImage(img[b], 0, 0, w, H, 0, 0, w, H);
        if (b === 'hp' && v.shield) { g.save(); g.globalAlpha = 0.45; g.globalCompositeOperation = 'lighter'; g.filter = 'sepia(1) saturate(3) hue-rotate(5deg)'; g.drawImage(img.hp, 0, 0, w, H, 0, 0, w, H); g.restore(); }
        const val = b === 'hp' ? [v.hp, v.maxHp] : b === 'mp' ? [v.mp, v.maxMp] : [v.en, v.maxEn];
        text(`${Math.ceil(val[0])} / ${val[1]}`, (B.x + B.w * 0.47) * k, (B.y + B.h / 2 + 2) * k, B.h * k * 0.62);
      }
      const L = info.level;
      text(String(v.level), L.x * k, (L.y + 3) * k, L.r * k * 1.15);
      info.slots.forEach((S, i) => {
        const f = v.cds[i] || 0;
        if (f <= 0) return;
        const cx = (S.x + S.w / 2) * k, cy = (S.y + S.h / 2) * k, rr = Math.max(S.w, S.h) * k;
        g.save(); g.beginPath(); g.rect(S.x * k + 2, S.y * k + 2, S.w * k - 4, S.h * k - 4); g.clip();
        g.fillStyle = 'rgba(10,6,14,0.68)';
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f); g.closePath(); g.fill();
        g.restore();
      });
    },
  };
}
