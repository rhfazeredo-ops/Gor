// Monstros com sprites pintados de modelos 3D (tools/bake-<monstro>.*).
// Carregam como o herói: folhas WebP por animação × 8 direções, embutidas pelo Vite.
import { SpriteAnim } from './sprites.js';
import { track } from './progress.js';
import escMeta from '../assets/sprites/escorpiao/sprites.json';
const ESC = import.meta.glob('../assets/sprites/escorpiao/*.webp', { eager: true, query: '?url', import: 'default' });

const sheets = {};
function load(meta, urls, base) {
  const out = {};
  return Promise.all(Object.keys(meta.anims).map((name) => track(new Promise((ok) => {
    const i = new Image(); i.onload = () => { out[name] = i; ok(); }; i.onerror = ok; i.src = urls[`${base}${name}.webp`];
  })))).then(() => ({ meta, sheets: out }));
}
let loading = null;
export function loadMonstros() {
  return (loading ??= load(escMeta, ESC, '../assets/sprites/escorpiao/').then((s) => { sheets.escorpiao = s; }));
}
// animação nova (cada monstro tem a sua: tempo e direção próprios)
export function monsterAnim(kind) { const a = new SpriteAnim(sheets[kind]); a.scale = sheets[kind].meta.scale; a.play('idle'); return a; }
