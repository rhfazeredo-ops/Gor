import { buildArt, paintGround, RES } from './art-hd.js';
import { ROOMS, parseMap } from './maps.js';
import { createLiveHero } from '../char2d/live.js';
import { Input } from './input.js';
import { Fx } from './fx.js';
import { World, Hero, Slime, drawWorld, drawObjects, mapLights } from './game.js';
import { HEROES } from '../data/heroes.js';
import { ABILITIES } from '../data/abilities.js';
import { showHeroSelect } from '../select.js';

const UI = import.meta.glob('../assets/ui/*.png', { query: '?url', import: 'default', eager: true });
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
const VIEW_H = innerHeight < 520 ? 360 : 310;   // câmera próxima, como nos roguelikes de ação
let zoom = 3, VW = 320, VH = 180, DPR = 1, camZoom = 1;

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
const toLow = (cx, cy) => [cx * DPR / (zoom * camZoom), cy * DPR / (zoom * camZoom)];

// ---------------- salas (estilo Hades) ----------------
// Cada sala é uma arena: entra, vence as ondas, a porta abre com a
// recompensa, atravessa e vai para a próxima.
let sprites = null, heroDef = null, roomIndex = 0, wave = 0, waveTimer = 0, roomState = 'luta', fade = 0, power = 0;
async function start(def) {
  heroDef = def;
  sprites = await createLiveHero({ res: 2, height: 92 });
  setupHud(def);
  enterRoom(0);
}
function enterRoom(n) {
  roomIndex = n;
  const map = parseMap(ROOMS[n]);
  const prev = hero;
  world = new World(map, art, fx);
  world.ground = paintGround(map);
  world.doorOpen = false; world.reward = map.recompensa; world.hitstop = 0; world.punch = 0;
  hero = new Hero(world, null, heroDef);
  hero.anim = sprites;
  if (prev) { hero.hp = prev.hp; hero.cd = prev.cd; }
  hero.atk = 20 * (1 + power * 0.25);
  // começa perto da borda de baixo, entrando na sala
  hero.x = map.start.x + 2.5; hero.y = map.start.y + 2.5;
  while (world.blocked(hero.x, hero.y, hero.r)) { hero.x -= 0.5; hero.y -= 0.5; }
  hero.faceTo(-1, -1);
  // limites da câmera: caixa do chão na tela
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) if (map.floor[j * map.w + i]) {
    const sx = (i - j) * 32, sy = (i + j) * 16;
    x0 = Math.min(x0, sx - 32); x1 = Math.max(x1, sx + 32); y0 = Math.min(y0, sy - 60); y1 = Math.max(y1, sy + 32);
  }
  world.bounds = { x0, x1, y0, y1: y1 + 70 };
  wave = 0; waveTimer = 1.2; roomState = 'luta'; fade = 1;
  world.cam.fx = undefined;
  banner(`${map.nome}`, 2200);
}
function banner(text, ms = 2500) {
  const b = $('banner'); b.textContent = text; b.classList.add('show');
  clearTimeout(banner.t); banner.t = setTimeout(() => b.classList.remove('show'), ms);
}
// ondas: inimigos surgem com um círculo de invocação; próxima onda quando todos caem
function rooms(dt) {
  world.enemies = world.enemies.filter((e) => e.alive);
  const map = world.map;
  if (roomState === 'luta') {
    if (world.enemies.length === 0) {
      if (wave >= map.ondas.length) { roomState = 'limpa'; world.doorOpen = true; banner('Sala limpa! A porta se abriu'); fx.shake = 0.4; return; }
      waveTimer -= dt;
      if (waveTimer <= 0) {
        for (const kind of map.ondas[wave]) {
          let p, tries = 0;
          do { p = map.open[(Math.random() * map.open.length) | 0]; tries++; } while (tries < 50 && Math.hypot(p.x - hero.x, p.y - hero.y) < 4);
          const e = new Slime(world, p.x, p.y, kind === 'r' ? 'roxa' : 'verde');
          e.spawnT = 0.9; world.enemies.push(e);
          fx.ring(p.x, p.y, 0.9, 0.9, [200, 120, 255]);
          fx.sparks(p.x, p.y, 4, { n: 10, c1: '#e0b0ff', c2: '#8040c0', up: 60 });
        }
        wave++; waveTimer = 1.0;
      }
    }
  } else if (roomState === 'limpa') {
    const d = map.door;
    if (Math.hypot(hero.x - (d.i + 0.5), hero.y - (d.j + 1.4)) < 0.9) {
      // recompensa da porta
      if (world.reward === 'cura') { hero.hp = Math.min(hero.maxHp, hero.hp + 80); banner('Bênção: +80 de vida'); }
      if (world.reward === 'poder') { power++; banner('Bênção: +25% de dano'); }
      if (world.reward === 'fim') { roomState = 'vitoria'; banner('Vitória! O Santuário da Luz foi purificado', 6000); return; }
      enterRoom((roomIndex + 1) % ROOMS.length);
    }
  }
}

// ---------------- HUD ----------------
const $ = (id) => document.getElementById(id);
function setupHud(def) {
  $('hero-name').textContent = `${def.nome} · ${def.titulo}`;
  const ab = ABILITIES[def.id];
  for (const [k, id] of [['basico', 'btn-attack'], ['q', 'btn-q'], ['e', 'btn-e']]) {
    const el = $(id);
    if (ab[k]) { el.style.backgroundImage = `url(${UI['../assets/ui/' + ab[k].icone]})`; el.title = ab[k].nome; }
  }
  $('hud').classList.remove('hidden');
  $('buttons').classList.remove('hidden');
}
function updateHud() {
  $('hp-fill').style.width = (100 * hero.hp / hero.maxHp) + '%';
  $('hp-fill').classList.toggle('shield', hero.invuln > 0.3 && hero.alive);
  $('hp-text').textContent = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
  const map = world.map;
  $('objective').textContent = roomState === 'vitoria' ? 'Vitória!' : roomState === 'limpa' ? `${map.nome} · vá até a porta` :
    `${map.nome} · Sala ${roomIndex + 1}/${ROOMS.length} · Onda ${Math.max(1, wave)}/${map.ondas.length}`;
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
const AMBIENT = 'rgba(18,8,30,0.5)';
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
    ctx.save(); ctx.fillStyle = g; ctx.translate(x, y); ctx.scale(1, 0.62); ctx.translate(-x, -y);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  // vinheta
  const v = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,4,14,0.7)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
}

// ---------------- abismo (fundo) ----------------
// Gradiente escuro com névoa que se move devagar e brasas subindo, com
// parallax: dá a sensação de que a arena flutua sobre o vazio.
const embers = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random() * 0.7, p: Math.random() * 6 }));
function drawAbyss(time) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#1a0f22'); g.addColorStop(0.6, '#120a1a'); g.addColorStop(1, '#2a0f14');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  const cx = world ? world.cam.x : 0, cy = world ? world.cam.y : 0;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 6; k++) {   // névoa
    const x = ((k * 173 - cx * 0.3 + time * 6 * (k % 2 ? 1 : -1)) % (VW + 300) + VW + 300) % (VW + 300) - 150;
    const y = ((k * 97 - cy * 0.3) % (VH + 200) + VH + 200) % (VH + 200) - 100;
    const m = ctx.createRadialGradient(x, y, 0, x, y, 140);
    m.addColorStop(0, k % 2 ? 'rgba(120,40,40,0.09)' : 'rgba(70,40,110,0.09)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = m; ctx.fillRect(x - 140, y - 140, 280, 280);
  }
  for (const e of embers) {   // brasas
    const x = ((e.x * VW * 1.3 - cx * 0.5 * e.s) % VW + VW) % VW;
    const y = (((e.y * VH * 1.3 - cy * 0.5 * e.s - time * 14 * e.s) % VH) + VH) % VH;
    ctx.fillStyle = `rgba(255,${120 + 80 * e.s | 0},60,${0.25 + 0.35 * Math.sin(time * 2 + e.p) ** 2})`;
    ctx.beginPath(); ctx.arc(x, y, 0.8 + e.s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------------- laço ----------------
let last = performance.now(), time = 0;
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0a16'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (world) {
    // pausa de impacto (hit-stop): o mundo congela por um instante a cada golpe
    let wdt = dt;
    if (world.hitstop > 0) { world.hitstop -= dt; wdt = dt * 0.05; }
    hero.update(wdt, input, aimAt);
    for (const e of world.enemies) e.update(wdt, hero);
    updateAreas(wdt);
    rooms(dt);
    fx.update(wdt);

    // câmera: segue o herói olhando um pouco à frente (movimento/mira),
    // presa aos limites da sala, com zoom de impacto
    world.punch = Math.max(0, (world.punch || 0) - dt * 2.5);
    const wantZoom = 1 + 0.12 * Math.sin(Math.min(1, world.punch) * Math.PI);
    camZoom += (wantZoom - camZoom) * Math.min(1, dt * 12);
    const Z = zoom * camZoom, vw = cv.width / Z, vh = cv.height / Z;
    const sm = input.screenMove();
    const look = { x: hero.face.x * 0.9 + 0, y: hero.face.y * 0.9 };
    const lx = (hero.x + look.x - hero.y - look.y) * 32 + sm.x * 30, ly = (hero.x + look.x + hero.y + look.y) * 16 + sm.y * 20;
    let tx = lx - vw / 2, ty = ly - vh / 2 - 24;
    const B = world.bounds, m = 40;
    tx = B.x1 - B.x0 + 2 * m < vw ? (B.x0 + B.x1) / 2 - vw / 2 : Math.max(B.x0 - m, Math.min(B.x1 + m - vw, tx));
    ty = B.y1 - B.y0 + 2 * m < vh ? (B.y0 + B.y1) / 2 - vh / 2 : Math.max(B.y0 - m, Math.min(B.y1 + m - vh, ty));
    if (world.cam.fx === undefined) { world.cam.fx = tx; world.cam.fy = ty; }
    const k = 1 - Math.pow(0.004, dt);
    world.cam.fx += (tx - world.cam.fx) * k; world.cam.fy += (ty - world.cam.fy) * k;
    const sh = fx.shake * 6;
    world.cam.x = world.cam.fx + (Math.random() - 0.5) * sh;
    world.cam.y = world.cam.fy + (Math.random() - 0.5) * sh;
    const VW0 = VW, VH0 = VH; VW = vw; VH = vh;

    ctx.setTransform(Z, 0, 0, Z, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const view = (x, y, z) => world.toScreen(x, y, z);
    drawAbyss(time);
    drawWorld(ctx, world, hero, null, VW, VH, time);
    fx.draw(ctx, view, 'chao');
    drawObjects(ctx, world, hero, [hero, ...world.enemies], VW, VH, time);
    drawLighting(time);
    fx.draw(ctx, view, 'ar');
    if (!input.touch && input.mouse.inside) {
      const [mx, my] = toLow(input.mouse.x, input.mouse.y);
      ctx.strokeStyle = 'rgba(255,215,130,0.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(mx, my, 7, 3.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // escurece ao trocar de sala
    if (fade > 0) { fade = Math.max(0, fade - dt * 1.6); ctx.fillStyle = `rgba(8,4,12,${fade})`; ctx.fillRect(0, 0, VW, VH); }
    VW = VW0; VH = VH0;
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

window.__game = { get hero() { return hero; }, get world() { return world; }, get state() { return roomState; }, get room() { return roomIndex; }, get zoom() { return zoom * camZoom / DPR; } };
showHeroSelect((def) => start(def));
