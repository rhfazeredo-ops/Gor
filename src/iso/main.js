import { buildArt, paintGround } from './art-hd.js';
import { MAPS, parseMap } from './maps.js';
import heroMeta from '../assets/sprites/dalarian-hd/sprites.json';
import { Input } from './input.js';
import { Fx } from './fx.js';
import { World, Hero, Slime, drawWorld, drawObjects, mapLights } from './game.js';
import { HEROES } from '../data/heroes.js';
import { ABILITIES } from '../data/abilities.js';
import { showHeroSelect } from '../select.js';

const UI = import.meta.glob('../assets/ui/*.png', { query: '?url', import: 'default', eager: true });
// sprites pintados do herói embutidos no pacote (funciona num HTML único)
const sheetUrls = import.meta.glob('../assets/sprites/dalarian-hd/*.webp', { query: '?url', import: 'default', eager: true });
async function loadHeroSprites() {
  const meta = { ...heroMeta, urls: {} };
  for (const [path, url] of Object.entries(sheetUrls)) meta.urls[path.split('/').pop().replace('.webp', '')] = url;
  const sheets = {};
  await Promise.all(Object.keys(meta.anims).map((name) => new Promise((ok, fail) => {
    const img = new Image(); img.onload = () => { sheets[name] = img; ok(); }; img.onerror = fail; img.src = meta.urls[name];
  })));
  return { meta, sheets };
}

// =====================================================================
// Terra de Gor: isométrico pintado, tudo desenhado por código em Canvas 2D.
// O mundo usa unidades fixas (tile 64x32); a tela aplica zoom para caber
// ~VIEW_H unidades de altura. Depois do cenário vem a iluminação:
// escuridão por cima e as luzes (tochas, magias, herói) abrindo o escuro.
// =====================================================================
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
const VIEW_H = innerHeight < 520 ? 400 : 340;
let zoom = 3, VW = 320, VH = 180, DPR = 1;

function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2.5);
  const w = Math.round(innerWidth * DPR), h = Math.round(innerHeight * DPR);
  cv.width = w; cv.height = h;
  zoom = h / VIEW_H;
  VW = w / zoom; VH = h / zoom;
  lightCv.width = Math.ceil(w / 3); lightCv.height = Math.ceil(h / 3);
}
addEventListener('resize', resize);
resize();

const art = buildArt();
const fx = new Fx();
const input = new Input(cv);
let world = null, hero = null;

// tela (CSS px) → unidades do mundo na tela
const toLow = (cx, cy) => [cx * DPR / zoom, cy * DPR / zoom];

async function start(def) {
  const sprites = await loadHeroSprites(def.id);
  const map = parseMap(MAPS.treino);
  world = new World(map, art, fx);
  world.ground = paintGround(map);
  hero = new Hero(world, sprites, def);
  hero.anim.scale = 92 / 196;           // corpo do sprite (196 px) → ~92 unidades
  for (const s of map.spawns) world.enemies.push(new Slime(world, s.x, s.y, s.kind));
  setupHud(def, map);

}

// ---------------- HUD ----------------
const $ = (id) => document.getElementById(id);
function setupHud(def, map) {
  $('hero-name').textContent = `${def.nome} · ${def.titulo}`;
  $('objective').textContent = map.objetivo.texto;
  const ab = ABILITIES[def.id];
  for (const [k, id] of [['basico', 'btn-attack'], ['q', 'btn-q'], ['e', 'btn-e']]) {
    const el = $(id);
    if (ab[k]) { el.style.backgroundImage = `url(${UI['../assets/ui/' + ab[k].icone]})`; el.title = ab[k].nome; }
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
    return world.toTile(lx, ly);
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

// ---------------- iluminação ----------------
// Escuridão azulada por cima de tudo; cada luz "apaga" o escuro em volta
// (destination-out) e depois soma um brilho quente (lighter). Vinheta nas bordas.
const AMBIENT = 'rgba(14,10,34,0.44)';
function drawLighting(time) {
  const lights = [];
  mapLights(world, time, lights);
  fx.collectLights(lights);
  // herói carrega uma luz fraca (paladino)
  if (hero.alive) lights.push({ x: hero.x, y: hero.y, z: 30, r: 190, c: [255, 220, 160], a: 0.6 });
  for (const ar of world.areas) lights.push({ x: ar.x, y: ar.y, z: 2, r: ar.R * 70, c: [255, 190, 80], a: 0.6 });
  const W = lightCv.width, H = lightCv.height, s = W / VW;
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = AMBIENT; lctx.fillRect(0, 0, W, H);
  lctx.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const [x, y] = world.toScreen(l.x, l.y, l.z * 0.5);
    const r = l.r * s, X = x * s, Y = y * s;
    const g = lctx.createRadialGradient(X, Y, 0, X, Y, r);
    g.addColorStop(0, `rgba(0,0,0,${l.a})`); g.addColorStop(0.5, `rgba(0,0,0,${l.a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.save(); lctx.translate(X, Y); lctx.scale(1, 0.6); lctx.translate(-X, -Y);
    lctx.beginPath(); lctx.arc(X, Y, r, 0, Math.PI * 2); lctx.fill(); lctx.restore();
  }
  ctx.drawImage(lightCv, 0, 0, VW, VH);
  // brilho colorido das luzes
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const [x, y] = world.toScreen(l.x, l.y, l.z * 0.5);
    const r = l.r * 0.75;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${l.c[0]},${l.c[1]},${l.c[2]},${0.16 * l.a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.translate(x, y); ctx.scale(1, 0.62); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
  }
  ctx.restore();
  // vinheta
  const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,4,14,0.7)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
}

// ---------------- laço ----------------
let last = performance.now(), time = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0a16'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (world) {
    hero.update(dt, input, aimAt);
    for (const e of world.enemies) e.update(dt, hero);
    updateAreas(dt);
    spawner(dt);
    fx.update(dt);
    // câmera segue o herói, suave
    const tx = (hero.x - hero.y) * 32 - VW / 2, ty = (hero.x + hero.y) * 16 - VH / 2 - 24;
    const k = 1 - Math.pow(0.0008, dt);
    world.cam.fx = (world.cam.fx ?? tx) + (tx - (world.cam.fx ?? tx)) * k;
    world.cam.fy = (world.cam.fy ?? ty) + (ty - (world.cam.fy ?? ty)) * k;
    const sh = fx.shake * 5;
    world.cam.x = world.cam.fx + (Math.random() - 0.5) * sh;
    world.cam.y = world.cam.fy + (Math.random() - 0.5) * sh;

    const view = (x, y, z) => world.toScreen(x, y, z);
    drawWorld(ctx, world, hero, null, VW, VH, time);
    fx.draw(ctx, view, 'chao');
    drawObjects(ctx, world, hero, [hero, ...world.enemies], VW, VH, time);
    drawLighting(time);
    fx.draw(ctx, view, 'ar');
    if (!input.touch && input.mouse.inside) {
      const [lx, ly] = toLow(input.mouse.x, input.mouse.y);
      ctx.strokeStyle = 'rgba(255,215,130,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(lx, ly, 7, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    updateHud();
  }
  input.consume();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Tela cheia + horizontal (Android)
$('btn-full').addEventListener('click', async () => {
  try { await document.documentElement.requestFullscreen(); await window.screen.orientation?.lock?.('landscape'); } catch { /* iPhone */ }
});

window.__game = { get hero() { return hero; }, get world() { return world; } };
showHeroSelect((def) => start(def));
