// Sprites do Dalárian feitos a partir do modelo do Tripo 3D (tools/bake-tripo.*):
// uma folha WebP por animação (linhas = 8 direções, colunas = quadros).
// As imagens entram no pacote pelo Vite (sem fetch, funciona com CSP).
import { SpriteAnim } from './sprites.js';
import meta from '../assets/sprites/dalarian-3d/sprites.json';
const URLS = import.meta.glob('../assets/sprites/dalarian-3d/*.webp', { eager: true, query: '?url', import: 'default' });

export async function loadHero3D() {
  const byName = {};
  for (const [p, url] of Object.entries(URLS)) byName[p.split('/').pop().replace('.webp', '')] = url;
  const sheets = {};
  await Promise.all(Object.entries(meta.anims).map(([name, a]) => new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => { sheets[name] = img; ok(); };
    img.onerror = () => fail(new Error('sprite ' + name));
    img.src = byName[a.sheet || name];
  })));
  const anim = new SpriteAnim({ meta, sheets });
  anim.scale = meta.scale;
  anim.play('idle');
  return anim;
}
