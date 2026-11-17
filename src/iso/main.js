import { buildArt } from './art.js';
import { MAPS, parseMap } from './maps.js';
import { loadHeroSprites } from './sprites.js';
import { Input } from './input.js';
import { Fx } from './fx.js';
import { World, Hero, Slime, drawWorld, drawObjects } from './game.js';
import { HEROES } from '../data/heroes.js';
import { ABILITIES } from '../data/abilities.js';
import { showHeroSelect } from '../select.js';

// =====================================================================
// Terra de Gor 2D: pixel art isométrico.
// Desenha tudo num canvas pequeno (resolução de pixel art) e amplia
// com número inteiro, para os pixels ficarem nítidos.
// =====================================================================
const cv = document.getElementById('game');
const sctx = cv.getContext('2d');
const low = document.createElement('canvas');
const ctx = low.getContext('2d');
let scale = 3, VW = 320, VH = 180;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 3);
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  cv.width = w; cv.height = h;
  scale = Math.max(2, Math.round(h / 300));
  VW = Math.ceil(w / scale); VH = Math.ceil(h / scale);
  low.width = VW; low.height = VH;
  sctx.imageSmoothingEnabled = false; ctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resize);
resize();

const art = buildArt();
const fx = new Fx();
const input = new Input(cv);
let world = null, hero = null;

// número inteiro da tela → coordenada do canvas pequeno
const toLow = (cx, cy) => {
  const dpr = Math.min(devicePixelRatio || 1, 3);
  return [cx * dpr / scale, cy * dpr / scale];
};

async function start(def) {
  const sprites = await loadHeroSprites(def.id);
  const map = parseMap(MAPS.treino);
  world = new World(map, art, fx);
  hero = new Hero(world, sprites, def);
  for (const s of map.spawns) world.enemies.push(new Slime(world, s.x, s.y, s.kind));
  setupHud(def, map);
  world.cam.x = (hero.x - hero.y) * 32 - VW / 2;
  world.cam.y = (hero.x + hero.y) * 16 - VH / 2;
}

// ---------------- HUD ----------------
const $ = (id) => document.getElementById(id);
function setupHud(def, map) {
  $('hero-name').textContent = `${def.nome} · ${def.titulo}`;
  $('objective').textContent = map.objetivo.texto;
  const ab = ABILITIES[def.id];
  for (const [k, id] of [['basico', 'btn-attack'], ['q', 'btn-q'], ['e', 'btn-e']]) {
    const el = $(id);
    if (ab[k]) { el.style.backgroundImage = `url(./ui/${ab[k].icone})`; el.title = ab[k].nome; }
  }
  $('hud').classList.remove('hidden');
  $('buttons').classList.remove('hidden');
}
let missionDone = false;
function updateHud() {
  $('hp-fill').style.width = (100 * hero.hp / hero.maxHp) + '%';
  $('hp-fill').classList.toggle('shield', hero.invuln > 0.3 && hero.alive);
  $('hp-text').textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
  const obj = world.map.objetivo;
  const n = Math.min(obj.alvo, world.kills);
  $('objective').textContent = missionDone ? 'Missão completa! Continue treinando' : `${obj.texto}: ${n}/${obj.alvo}`;
  if (!missionDone && n >= obj.alvo) {
    missionDone = true;
    const b = $('banner'); b.textContent = 'Missão completa! +120 ouro · +80 XP'; b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 3500);
  }
  const ab = hero.ab;
  for (const [k, id, max] of [['q', 'btn-q', ab.q.recarga], ['e', 'btn-e', ab.e.recarga], ['dash', 'btn-dash', 0.8]]) {
    const el = $(id), c = hero.cd[k];
    el.style.setProperty('--cd', (c / max).toFixed(3));
    el.dataset.cd = c > 0 && k !== 'dash' ? Math.ceil(c) : '';
  }
  $('dead').classList.toggle('show', !hero.alive);
}

// ---------------- mira ----------------
// PC: mira no mouse. Celular: inimigo mais próximo (ou nada → direção do movimento).
function aimAt() {
  if (!input.touch && input.mouse.inside) {
    const [lx, ly] = toLow(input.mouse.x, input.mouse.y);
    return world.toTile(lx, ly + 14);
  }
  let best = null, bd = 3.2;
  for (const e of world.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - hero.x, e.y - hero.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------------- monstros: reaparecem ----------------
function spawner(dt) {
  world.enemies = world.enemies.filter((e) => e.alive);
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.enemies.length < 9) {
    world.spawnTimer = 3.5;
    const sp = world.map.spawns[Math.floor(Math.random() * world.map.spawns.length)];
    if (Math.hypot(sp.x - hero.x, sp.y - hero.y) > 4) world.enemies.push(new Slime(world, sp.x, sp.y, Math.random() < 0.25 ? 'roxa' : 'verde'));
  }
}

function updateAreas(dt) {
  for (const a of world.areas) {
    a.left -= dt; a.tick -= dt;
    if (a.tick <= 0) {
      a.tick = 0.5;
      for (const e of world.enemies) if (e.alive && Math.hypot(e.x - a.x, e.y - a.y) < a.R + e.r) {
        const dmg = Math.round(a.dps * 0.5); e.hurt(dmg, a, 0.3); fx.number(e.x, e.y, dmg, '#ffe066');
      }
    }
  }
  world.areas = world.areas.filter((a) => a.left > 0);
}

// ---------------- laço ----------------
let last = performance.now(), time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  ctx.fillStyle = '#14101c'; ctx.fillRect(0, 0, VW, VH);
  if (world) {
    hero.update(dt, input, aimAt);
    for (const e of world.enemies) e.update(dt, hero);
    updateAreas(dt);
    spawner(dt);
    fx.update(dt);
    // câmera segue o herói (suave, mas sempre em pixel inteiro)
    const tx = (hero.x - hero.y) * 32 - VW / 2, ty = (hero.x + hero.y) * 16 - VH / 2 - 16;
    const k = 1 - Math.pow(0.0005, dt);
    world.cam.fx = (world.cam.fx ?? tx) + (tx - (world.cam.fx ?? tx)) * k;
    world.cam.fy = (world.cam.fy ?? ty) + (ty - (world.cam.fy ?? ty)) * k;
    const sh = fx.shake * 4;
    world.cam.x = Math.round(world.cam.fx + (Math.random() - 0.5) * sh);
    world.cam.y = Math.round(world.cam.fy + (Math.random() - 0.5) * sh);

    const view = (x, y, z) => world.toScreen(x, y, z);
    drawWorld(ctx, world, hero, null, VW, VH, time);
    fx.draw(ctx, view, 'chao');
    drawObjects(ctx, world, hero, [hero, ...world.enemies], VW, VH, time);
    fx.draw(ctx, view, 'ar');
    // marcador da mira (PC)
    if (!input.touch && input.mouse.inside) {
      const [lx, ly] = toLow(input.mouse.x, input.mouse.y);
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(Math.round(lx) - 3, Math.round(ly), 7, 1); ctx.fillRect(Math.round(lx), Math.round(ly) - 3, 1, 7);
    }
    updateHud();
  }
  input.consume();
  sctx.drawImage(low, 0, 0, VW * scale, VH * scale);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Tela cheia + horizontal (Android)
$('btn-full').addEventListener('click', async () => {
  try { await document.documentElement.requestFullscreen(); await window.screen.orientation?.lock?.('landscape'); } catch { /* iPhone */ }
});

window.__game = { get hero() { return hero; }, get world() { return world; } };
showHeroSelect((def) => start(def));
