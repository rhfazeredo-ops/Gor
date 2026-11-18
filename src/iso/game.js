import { TW, TH, WALL_H } from './art.js';
import { RES } from './art-hd.js';
import { SpriteAnim, dirFromTileVec } from './sprites.js';
import { ABILITIES } from '../data/abilities.js';

// 1 tile ≈ 1,8 m (o losango de 64 px corresponde a 1,81 m nos sprites)
export const METERS_PER_TILE = 1.81;
const HALF_W = TW / 2, HALF_H = TH / 2;

// ---------------- mundo ----------------
export class World {
  constructor(map, art, fx) {
    this.map = map; this.art = art; this.fx = fx;
    this.enemies = []; this.areas = [];
    this.kills = 0; this.spawnTimer = 2;
    this.cam = { x: 0, y: 0 };
  }
  solidAt(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= this.map.w || j >= this.map.h) return true;
    return this.map.solid[j * this.map.w + i];
  }
  blocked(x, y, r) {
    return this.solidAt(x - r, y - r) || this.solidAt(x + r, y - r) || this.solidAt(x - r, y + r) || this.solidAt(x + r, y + r);
  }
  // move com colisão separada por eixo (desliza nas paredes)
  move(e, dx, dy) {
    if (!this.blocked(e.x + dx, e.y, e.r)) e.x += dx;
    if (!this.blocked(e.x, e.y + dy, e.r)) e.y += dy;
  }
  toScreen(x, y, z = 0) { return [(x - y) * HALF_W - this.cam.x, (x + y) * HALF_H - z - this.cam.y]; }
  toTile(sx, sy) {
    const X = sx + this.cam.x, Y = sy + this.cam.y;
    return { x: X / TW + Y / TH, y: Y / TH - X / TW };
  }
}

// direção na tela (joystick/teclado) → direção no chão em tiles
export function screenToTileDir(sx, sy) {
  let dx = sx / 2 + sy, dy = sy - sx / 2;
  const l = Math.hypot(dx, dy);
  return l > 0 ? { x: dx / l, y: dy / l } : { x: 0, y: 0 };
}

// ---------------- herói ----------------
export class Hero {
  constructor(world, sprites, def) {
    this.world = world; this.def = def;
    this.ab = ABILITIES[def.id];
    this.x = world.map.start.x; this.y = world.map.start.y; this.r = 0.28;
    this.anim = new SpriteAnim(sprites);
    this.speed = 4.3; this.atk = 20;
    this.maxHp = 200; this.hp = this.maxHp;
    this.cd = { atk: 0, q: 0, e: 0, dash: 0 };
    this.action = null; this.combo = 0;
    this.invuln = 0; this.dashT = 0; this.dashDir = { x: 0, y: 0 };
    this.flash = 0; this.dead = 0; this.alive = true;
    this.face = { x: 1, y: 1 };
  }
  get dirAngle() { return this.anim.dir * Math.PI / 4; }
  faceTo(dx, dy) {
    if (Math.abs(dx) + Math.abs(dy) < 1e-4) return;
    const l = Math.hypot(dx, dy); this.face = { x: dx / l, y: dy / l };
    this.anim.dir = dirFromTileVec(dx, dy);
    this.anim.yawTarget = Math.atan2(dx - dy, dx + dy);
  }
  start(type, anim, dur) {
    this.action = { type, t: 0, dur, fired: false, swung: false };
    this.anim.play(anim, { restart: true });
  }

  update(dt, input, aimAt) {
    const W = this.world, fx = W.fx;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt * 4);
    this.respawnBlink = Math.max(0, (this.respawnBlink || 0) - dt);

    if (!this.alive) {
      this.dead -= dt;
      if (this.dead <= 0) { this.alive = true; this.hp = this.maxHp; this.x = W.map.start.x; this.y = W.map.start.y; this.invuln = 2; this.respawnBlink = 2; this.anim.play('idle'); }
      return;
    }

    const sm = input.screenMove();
    const mv = screenToTileDir(sm.x, sm.y);
    const mag = Math.min(1, Math.hypot(sm.x, sm.y));
    const busy = !!this.action;
    // guarda o último comando por um instante (apertar Q no meio de um golpe não se perde)
    for (const k of input.pressed) this.buffer = { k, t: 0.45 };
    if (this.buffer) { this.buffer.t -= dt; if (this.buffer.t <= 0) this.buffer = null; }
    const P = new Set(this.buffer ? [this.buffer.k] : []);
    const use = () => { this.buffer = null; };

    // ---- comandos ----
    if (P.has('dash') && this.cd.dash <= 0 && this.dashT <= 0) {
      const d = mag > 0.1 ? mv : this.face;
      this.dashDir = { x: d.x, y: d.y }; this.dashT = 0.2; this.cd.dash = 0.8; this.invuln = Math.max(this.invuln, 0.22);
      this.faceTo(d.x, d.y); this.action = null;
      this.anim.play('esquiva', { restart: true });
      fx.puff(this.x, this.y); use();
    } else if (!busy && this.dashT <= 0) {
      const aimFace = () => {
        const a = aimAt();
        let d = a ? { x: a.x - this.x, y: a.y - this.y } : mag > 0.1 ? mv : this.face;
        const l = Math.hypot(d.x, d.y) || 1; d = { x: d.x / l, y: d.y / l };
        // trava no inimigo mais próximo nessa metade da tela
        let best = null, bd = 2.2;
        for (const e of W.enemies) {
          if (!e.alive) continue;
          const ex = e.x - this.x, ey = e.y - this.y, ed = Math.hypot(ex, ey);
          if (ed < bd && (ex * d.x + ey * d.y) / (ed || 1) > -0.1) { bd = ed; best = e; }
        }
        if (best) this.faceTo(best.x - this.x, best.y - this.y); else this.faceTo(d.x, d.y);
      };
      if (P.has('q') && this.cd.q <= 0) {
        this.cd.q = this.ab.q.recarga; this.start('q', 'consagracao', 0.9); use();
      } else if (P.has('e') && this.cd.e <= 0) {
        this.cd.e = this.ab.e.recarga; this.start('e', 'protecao', 0.55); use();
      } else if ((P.has('atk') || input.holdingAttack()) && this.cd.atk <= 0) {
        aimFace();
        this.cd.atk = this.ab.basico.recarga; this.combo ^= 1;
        this.start('atk', this.combo ? 'ataque' : 'ataque2', 0.42); if (P.has('atk')) use();
      }
    }

    // ---- movimento ----
    if (this.dashT > 0) {
      this.dashT -= dt;
      W.move(this, this.dashDir.x * 11 * dt, this.dashDir.y * 11 * dt);
      if (this.dashT <= 0 && !this.action) this.anim.play('idle');
    } else {
      const locked = this.action && (this.action.type === 'q' || this.action.type === 'e');
      if (mag > 0.1 && !locked) {
        const sp = this.speed * mag * (this.action ? 0.35 : 1);
        W.move(this, mv.x * sp * dt, mv.y * sp * dt);
        if (!this.action) this.faceTo(mv.x, mv.y);
      }
      if (!this.action) this.anim.play(mag > 0.1 ? 'corrida' : 'idle');
    }

    // ---- tempo das ações ----
    const a = this.action;
    if (a) {
      a.t += dt;
      if (a.type === 'atk') {
        if (!a.swung && a.t > 0.12) { a.swung = true; fx.swing(this, this.combo === 0); }
        if (!a.fired && a.t > 0.21) { a.fired = true; this.basicHit(); }
      } else if (a.type === 'q') {
        if (!a.fired && a.t > 0.18) { a.fired = true; this.castConsecration(); }
      } else if (a.type === 'e') {
        if (!a.fired && a.t > 0.14) {
          a.fired = true; this.invuln = this.ab.e.duracao;
          fx.bubble(this, this.ab.e.duracao); fx.sparks(this.x, this.y, 30, { n: 24, speed: 1.6, up: 40, g: 40 });
        }
      }
      if (a.t >= a.dur) { this.action = null; this.anim.play('idle'); }
    }
    this.anim.update(dt);
  }

  basicHit() {
    const W = this.world, ab = this.ab.basico, fx = W.fx;
    const reach = ab.alcance / METERS_PER_TILE + 0.4;
    const hits = [];
    for (const e of W.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.x, dy = e.y - this.y, d = Math.hypot(dx, dy);
      if (d > reach + e.r) continue;
      if (d > 0.35 && (dx * this.face.x + dy * this.face.y) / d < 0.25) continue;
      hits.push([d, e]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    hits.forEach(([, e], i) => {
      const dmg = Math.round(this.atk * ab.dano * (i ? 0.6 : 1) * (0.9 + Math.random() * 0.2));
      e.hurt(dmg, this);
      fx.burst(e.x, e.y, 14, i ? 7 : 12); fx.sparks(e.x, e.y, 14, { n: i ? 6 : 16 });
      fx.number(e.x, e.y, dmg, '#ffffff');
    });
    if (hits.length) { fx.shake = Math.max(fx.shake, 0.25); W.hitstop = 0.055; }
    else fx.sparks(this.x + this.face.x * 0.8, this.y + this.face.y * 0.8, 6, { n: 5, speed: 1.2, up: 30 });
  }

  castConsecration() {
    const W = this.world, q = this.ab.q, fx = W.fx;
    const x = this.x, y = this.y, R = q.raio / METERS_PER_TILE;
    fx.lightHammer(x, y, () => {
      fx.shake = 1; W.hitstop = 0.1; W.punch = 1;
      fx.ring(x, y, R + 0.9, 0.5);
      fx.burst(x, y, 10, 24);
      fx.sparks(x, y, 6, { n: 50, speed: 3.5, up: 90 });
      fx.consecration(x, y, R, q.duracao);
      // impacto: dano e empurrão
      for (const e of W.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < R + e.r) { const dmg = Math.round(this.atk * 1.2); e.hurt(dmg, { x, y }, 4); fx.number(e.x, e.y, dmg, '#ffe066'); }
      }
      W.areas.push({ x, y, R, dps: this.atk * q.danoPorSeg * 5, left: q.duracao, tick: 0.5 });
    });
  }

  hurt(dmg, from) {
    if (!this.alive || this.invuln > 0) return false;
    this.hp -= dmg; this.flash = 1;
    this.world.fx.number(this.x, this.y, dmg, '#ff5a4a');
    if (from) { const dx = this.x - from.x, dy = this.y - from.y, l = Math.hypot(dx, dy) || 1; this.world.move(this, dx / l * 0.25, dy / l * 0.25); }
    if (this.hp <= 0) {
      this.hp = 0; this.alive = false; this.dead = 3; this.action = null;
      this.world.fx.sparks(this.x, this.y, 20, { n: 30, c1: '#ffffff', c2: '#8888aa' });
    } else if (!this.action && this.dashT <= 0) this.anim.play('dano', { restart: true, onEnd: () => this.anim.play('idle') });
    return true;
  }

  draw(ctx) {
    const W = this.world;
    const [sx, sy] = W.toScreen(this.x, this.y);
    shadow(ctx, sx, sy, 22);
    if (!this.alive) return;
    if (this.respawnBlink > 0 && Math.floor(this.respawnBlink * 12) % 2) return;
    this.anim.draw(ctx, sx, sy, this.flash);
  }
}

// ---------------- gosma ----------------
const SLIMES = {
  verde: { hp: 60, speed: 1.5, dmg: 6, r: 0.25, xp: 5 },
  roxa: { hp: 170, speed: 1.05, dmg: 12, r: 0.36, xp: 15 },
};
export class Slime {
  constructor(world, x, y, kind) {
    Object.assign(this, SLIMES[kind]);
    this.world = world; this.kind = kind; this.x = x; this.y = y;
    this.maxHp = this.hp; this.alive = true;
    this.t = Math.random() * 3; this.state = 'idle'; this.st = 0;
    this.vx = 0; this.vy = 0; this.hurtT = 0; this.cool = 0; this.spawnT = 0.5;
    this.wander = { x: 0, y: 0, t: 0 };
  }
  hurt(dmg, from, push = 2.5) {
    if (!this.alive) return;
    this.hp -= dmg; this.hurtT = 0.15;
    const dx = this.x - from.x, dy = this.y - from.y, l = Math.hypot(dx, dy) || 1;
    this.vx = dx / l * push; this.vy = dy / l * push;
    if (this.state === 'windup') this.state = 'idle';
    if (this.hp <= 0) {
      this.alive = false; this.world.kills++;
      const c = this.kind === 'verde' ? '#7ad85a' : '#b86af0';
      this.world.fx.puff(this.x, this.y, c, 18);
      this.world.fx.sparks(this.x, this.y, 8, { n: 10, c1: c, c2: c, g: 200, up: 50 });
    }
  }
  update(dt, hero) {
    const W = this.world;
    this.t += dt; this.hurtT -= dt; this.cool -= dt; this.spawnT -= dt;
    // empurrão
    if (Math.abs(this.vx) + Math.abs(this.vy) > 0.01) {
      W.move(this, this.vx * dt, this.vy * dt);
      this.vx *= Math.pow(0.002, dt); this.vy *= Math.pow(0.002, dt);
    }
    if (this.spawnT > 0) return;
    const dx = hero.x - this.x, dy = hero.y - this.y, d = Math.hypot(dx, dy);
    const sees = hero.alive && d < 6.5;
    if (this.state === 'windup') {
      this.st -= dt;
      if (this.st <= 0) {
        // bote
        this.state = 'lunge'; this.st = 0.18;
        const l = d || 1; this.vx = dx / l * 6; this.vy = dy / l * 6;
      }
      return;
    }
    if (this.state === 'lunge') {
      this.st -= dt;
      if (Math.hypot(hero.x - this.x, hero.y - this.y) < this.r + hero.r + 0.15 && !this.hitDone) {
        this.hitDone = true;
        hero.hurt(this.dmg, this);
      }
      if (this.st <= 0) { this.state = 'idle'; this.cool = 1.5 + Math.random() * 0.6; this.hitDone = false; }
      return;
    }
    if (sees && d < 0.95 + this.r && this.cool <= 0) { this.state = 'windup'; this.st = 0.45; return; }
    // pulinhos: anda só no meio do pulo
    const hop = (this.t * (this.kind === 'verde' ? 2.2 : 1.6)) % 1;
    const moving = hop > 0.25 && hop < 0.75;
    let mx = 0, my = 0;
    if (sees) { mx = dx / d; my = dy / d; }
    else {
      this.wander.t -= dt;
      if (this.wander.t <= 0) { const a = Math.random() * Math.PI * 2; this.wander = { x: Math.cos(a), y: Math.sin(a), t: 1 + Math.random() * 2 }; if (Math.random() < 0.4) this.wander.x = this.wander.y = 0; }
      mx = this.wander.x * 0.5; my = this.wander.y * 0.5;
    }
    if (moving && d > 0.6) W.move(this, mx * this.speed * dt * 2, my * this.speed * dt * 2);
    // não se empilham
    for (const o of W.enemies) {
      if (o === this || !o.alive) continue;
      const ox = this.x - o.x, oy = this.y - o.y, od = Math.hypot(ox, oy), min = this.r + o.r;
      if (od < min && od > 0.001) W.move(this, ox / od * (min - od) * 0.5, oy / od * (min - od) * 0.5);
    }
  }
  draw(ctx) {
    const W = this.world, art = W.art.slimes[this.kind];
    const [sx, sy] = W.toScreen(this.x, this.y);
    let f, z = 0;
    if (this.hurtT > 0) f = 5;
    else if (this.state === 'windup') f = 4;
    else {
      const hop = (this.t * (this.kind === 'verde' ? 2.2 : 1.6)) % 1;
      f = hop < 0.2 ? 1 : hop < 0.8 ? 2 : 0;
      if (hop >= 0.2 && hop < 0.8) z = Math.sin((hop - 0.2) / 0.6 * Math.PI) * 8;
      if (this.state === 'lunge') { f = 2; z = 6; }
    }
    shadow(ctx, sx, sy, 14 * (this.kind === 'roxa' ? 1.5 : 1));
    if (this.spawnT > 0) { ctx.globalAlpha = 1 - this.spawnT / 0.5; }
    ctx.drawImage(art.frames[f], sx - art.ax, sy - art.ay - z, art.w, art.h);
    ctx.globalAlpha = 1;
    // barra de vida
    if (this.hp < this.maxHp) {
      const w = Math.round(22 * (this.kind === 'roxa' ? 1.4 : 1)), x0 = sx - w / 2, y0 = sy - art.ay - 4;
      ctx.fillStyle = '#1a1020'; ctx.fillRect(x0 - 1, y0 - 1, w + 2, 4);
      ctx.fillStyle = '#5a1a1a'; ctx.fillRect(x0, y0, w, 2);
      ctx.fillStyle = '#e04a3a'; ctx.fillRect(x0, y0, Math.max(0, Math.round(w * this.hp / this.maxHp)), 2);
    }
  }
}

export function shadow(ctx, sx, sy, r) {
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
  g.addColorStop(0, 'rgba(10,6,20,0.5)'); g.addColorStop(1, 'rgba(10,6,20,0)');
  ctx.save(); ctx.translate(sx, sy); ctx.scale(1, 0.5); ctx.translate(-sx, -sy);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

// ---------------- cenário ----------------
export function drawWorld(ctx, W, hero, entities, vw, vh, time) {
  // chão inteiro pintado num canvas grande: desenha só o pedaço visível
  const G = W.ground;
  const gx = W.cam.x - (-G.ox), gy = W.cam.y;       // canto da tela dentro do chão
  const sx = Math.max(0, gx), sy = Math.max(0, gy);
  const sw = Math.min(G.W - sx, vw - (sx - gx)), sh = Math.min(G.H - sy, vh - (sy - gy));
  if (sw > 0 && sh > 0) ctx.drawImage(G.canvas, sx * RES, sy * RES, sw * RES, sh * RES, sx - gx, sy - gy, sw, sh);
}

const drawProp = (ctx, pr, x, y, alpha = 1) => {
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(pr.img, x - pr.ax, y - pr.ay, pr.w, pr.h);
  ctx.globalAlpha = 1;
};

export function drawObjects(ctx, W, hero, entities, vw, vh, time) {
  const m = W.map, art = W.art;
  const list = [];
  const heroKey = hero.x + hero.y;
  const [hsx, hsy] = W.toScreen(hero.x, hero.y);
  for (const w of m.walls) list.push({ key: w.i + w.j + 1, draw: () => {
    const [sx, sy] = W.toScreen(w.i, w.j);
    const x = sx - HALF_W, y = sy - WALL_H;
    if (x > vw || x < -TW || y > vh || y < -TH - WALL_H) return;
    const img = (w.wood ? art.wallsWood : art.walls)[(w.i * 3 + w.j) % (w.wood ? 2 : 4)];
    const front = w.i + w.j + 1 > heroKey && Math.abs(sx - hsx) < 44 && sy - hsy > -8 && sy - hsy < 70;
    if (front) ctx.globalAlpha = 0.4;
    ctx.drawImage(img, x, y, TW, TH + WALL_H);
    ctx.globalAlpha = 1;
    if (w.door) drawDoor(ctx, sx, sy, W.doorOpen, time, W.reward);
  } });
  for (const p of m.props) list.push({ key: p.i + p.j + 1, draw: () => {
    const pr = art.props[p.kind];
    const [sx, sy] = W.toScreen(p.i + 0.5, p.j + 0.5);
    if (sx < -120 || sx > vw + 120 || sy < -20 || sy > vh + 200) return;
    const tall = pr.h > 60;
    const front = tall && p.i + p.j + 1 > heroKey && Math.abs(sx - hsx) < pr.w * 0.5 + 26 && sy - hsy > -10 && sy - hsy < pr.h + 20;
    if (p.kind !== 'tocha' && p.kind !== 'braseiro') shadow(ctx, sx + 4, sy + 2, pr.w * 0.42);
    drawProp(ctx, pr, sx, sy, front ? 0.35 : 1);
    if (p.kind === 'tocha' || p.kind === 'braseiro') {
      const big = p.kind === 'braseiro' ? 1.8 : 1;
      const f = big * (0.85 + Math.sin(time * 11 + p.i) * 0.1 + Math.sin(time * 23 + p.j) * 0.06);
      const fx = sx - pr.ax + pr.flame.x, fy = sy - pr.ay + pr.flame.y;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(fx, fy - 4, 0, fx, fy - 4, 16 * f);
      g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.3, 'rgba(255,190,70,0.9)'); g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(fx, fy - 5, 7 * f, 12 * f, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  } });
  for (const e of entities) list.push({ key: e.x + e.y, draw: () => e.draw(ctx) });
  list.sort((a, b) => a.key - b.key);
  for (const o of list) o.draw();
}

// luzes fixas do mapa (tochas) para o mapa de iluminação
export function mapLights(W, time, out) {
  for (const p of W.map.props) if (p.kind === 'tocha' || p.kind === 'braseiro') {
    const big = p.kind === 'braseiro' ? 1.35 : 1;
    const f = 0.88 + Math.sin(time * 9 + p.i) * 0.08 + Math.sin(time * 23 + p.j) * 0.04;
    out.push({ x: p.i + 0.5, y: p.j + 0.5, z: 50, r: 150 * f * big, c: [255, 160, 70], a: 0.95 });
  }
  if (W.map.door && W.doorOpen) {
    const d = W.map.door; out.push({ x: d.i + 0.5, y: d.j + 1, z: 30, r: 200, c: [255, 220, 140], a: 0.9 });
  }
}

// porta de saída: arco de pedra; fechada = grade escura, aberta = portal de luz
function drawDoor(ctx, sx, sy, open, time, reward) {
  const x = sx, y = sy + 8;
  ctx.save();
  // arco
  ctx.fillStyle = '#2a2026'; ctx.strokeStyle = 'rgba(14,8,16,0.95)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 20, y + 10); ctx.lineTo(x - 20, y - 34); ctx.quadraticCurveTo(x, y - 58, x + 20, y - 34); ctx.lineTo(x + 20, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (open) {
    const g = ctx.createLinearGradient(0, y - 50, 0, y + 10);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(1, 'rgba(255,170,60,0.9)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 15, y + 8); ctx.lineTo(x - 15, y - 32); ctx.quadraticCurveTo(x, y - 51, x + 15, y - 32); ctx.lineTo(x + 15, y + 8); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { const yy = y - ((time * 30 + k * 18) % 54); ctx.fillStyle = 'rgba(255,240,180,0.5)'; ctx.fillRect(x - 12, yy, 24, 1.5); }
  } else {
    ctx.strokeStyle = '#5a4a50'; ctx.lineWidth = 2.5;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 6, y + 8); ctx.lineTo(x + k * 6, y - 40 + Math.abs(k) * 4); ctx.stroke(); }
  }
  // símbolo da recompensa em cima da porta
  ctx.globalCompositeOperation = 'source-over';
  const iy = y - 72 + Math.sin(time * 3) * 2;
  ctx.fillStyle = 'rgba(14,8,16,0.9)'; ctx.beginPath(); ctx.arc(x, iy, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = open ? '#f0c060' : '#8a7060'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = reward === 'cura' ? '#ff5a5a' : reward === 'poder' ? '#ffd24a' : '#ffffff';
  ctx.font = 'bold 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(reward === 'cura' ? '♥' : reward === 'poder' ? '✦' : '☀', x, iy + 1);
  ctx.restore();
}
