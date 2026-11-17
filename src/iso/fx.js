// =====================================================================
// Efeitos em pixel art (Luz Sagrada do Dalárian e o resto).
// Posições no chão em tiles (x, y) + altura em pixels (z).
// Cada efeito: update(dt) → false quando acabou; draw(ctx, view, camada).
// camada 'chao' (antes dos personagens) ou 'ar' (depois).
// =====================================================================
const GOLD = '#ffb83a', LIGHT = '#fff1a8', WHITE = '#ffffff';
const R2 = Math.SQRT2;
const ellipse = (ctx, cx, cy, rTiles, color, thick = 1, from = 0, to = Math.PI * 2, step = 0.02) => {
  // círculo no chão → elipse na tela; desenhado ponto a ponto (pixels nítidos)
  const rx = rTiles * 32 * R2, ry = rTiles * 16 * R2;
  ctx.fillStyle = color;
  for (let a = from; a < to; a += step / Math.max(0.5, rTiles)) {
    const x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry);
    ctx.fillRect(x, y, thick, thick);
  }
};

// fonte 3x5 para os números de dano
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001010010', '111101111101111', '111101111001111'];
export function drawNumber(ctx, n, x, y, color, scale = 1) {
  const s = String(Math.round(n));
  const w = s.length * 4 * scale;
  let px = Math.round(x - w / 2);
  for (const ch of s) {
    const g = DIGITS[+ch];
    for (let k = 0; k < 15; k++) if (g[k] === '1') {
      const gx = px + (k % 3) * scale, gy = Math.round(y) + Math.floor(k / 3) * scale;
      ctx.fillStyle = '#1a1020'; ctx.fillRect(gx + scale, gy + scale, scale, scale);
      ctx.fillStyle = color; ctx.fillRect(gx, gy, scale, scale);
    }
    px += 4 * scale;
  }
}

export class Fx {
  constructor() { this.list = []; this.parts = []; this.shake = 0; }
  add(e) { this.list.push(e); return e; }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.5);
    // (efeitos criados durante o update entram na lista sem se perder)
    const cur = this.list; this.list = [];
    const keep = cur.filter((e) => e.update(dt) !== false);
    this.list = keep.concat(this.list);
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }
  draw(ctx, view, layer) {
    for (const e of this.list) if ((e.layer || 'ar') === layer) e.draw(ctx, view);
    if (layer !== 'ar') return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const [sx, sy] = view(p.x, p.y, p.z);
      ctx.fillStyle = p.life > p.max * 0.5 ? p.c1 : p.c2;
      const s = p.life > p.max * 0.6 ? p.size : 1;
      ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
    }
    ctx.restore();
  }

  // ---------- partículas ----------
  sparks(x, y, z, { n = 14, speed = 2.5, up = 60, c1 = LIGHT, c2 = GOLD, life = 0.5, g = 260, size = 2 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      const l = life * (0.6 + Math.random() * 0.6);
      this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: up * (0.4 + Math.random()), g, life: l, max: l, c1, c2, size });
    }
  }

  // ---------- números ----------
  number(x, y, value, color = '#fff') {
    let t = 0; const ox = (Math.random() - 0.5) * 10;
    return this.add({
      update: (dt) => (t += dt) < 0.8,
      draw: (ctx, view) => {
        const [sx, sy] = view(x, y, 50 + t * 30);
        if (t > 0.6 && Math.floor(t * 30) % 2) return;
        drawNumber(ctx, value, sx + ox, sy, color, t < 0.12 ? 2 : 1);
      },
    });
  }

  // ---------- golpe: arco de luz na frente do herói ----------
  swing(hero, mirror) {
    let t = 0; const dur = 0.2;
    const yaw = hero.dirAngle;
    return this.add({
      update: (dt) => (t += dt) < dur,
      draw: (ctx, view) => {
        const k = t / dur;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const span = 2.2, from = -span / 2, head = from + span * Math.min(1, k * 1.6);
        for (let a = from; a < head; a += 0.04) {
          const aa = mirror ? -a : a;
          const ang = yaw + aa;
          for (const [r, col] of [[1.05, GOLD], [1.25, LIGHT], [1.4, WHITE]]) {
            if (head - a > 0.9 && col === WHITE) continue;
            const dx = Math.sin(ang) * r, dy = Math.cos(ang) * r;      // no chão (sprite yaw)
            const tx = (dx + dy) / 2, ty = (dy - dx) / 2;              // de volta para tiles
            const [sx, sy] = view(hero.x + tx * 1.0, hero.y + ty * 1.0, 22);
            ctx.fillStyle = col; ctx.globalAlpha = 1 - k * 0.7;
            ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
          }
        }
        ctx.restore();
      },
    });
  }

  // ---------- estrela de impacto ----------
  burst(x, y, z = 26, size = 10) {
    let t = 0; const dur = 0.18;
    return this.add({
      update: (dt) => (t += dt) < dur,
      draw: (ctx, view) => {
        const [sx, sy] = view(x, y, z); const s = Math.round(size * (1 - t / dur) + 2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = LIGHT; ctx.fillRect(Math.round(sx) - s, Math.round(sy), s * 2 + 1, 1); ctx.fillRect(Math.round(sx), Math.round(sy) - s, 1, s * 2 + 1);
        ctx.fillStyle = WHITE; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3);
        ctx.fillStyle = GOLD; const d = Math.round(s * 0.6);
        for (let k = 1; k < d; k++) { for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ctx.fillRect(Math.round(sx) + a * k, Math.round(sy) + b * k, 1, 1); }
        ctx.restore();
      },
    });
  }

  // ---------- onda de choque no chão ----------
  ring(x, y, radius, dur = 0.45, color = GOLD) {
    let t = 0;
    return this.add({
      layer: 'chao',
      update: (dt) => (t += dt) < dur,
      draw: (ctx, view) => {
        const k = t / dur, [sx, sy] = view(x, y, 0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k;
        ellipse(ctx, sx, sy, radius * (0.2 + 0.8 * Math.sqrt(k)), color, 2);
        ellipse(ctx, sx, sy, radius * (0.1 + 0.8 * Math.sqrt(k)), LIGHT, 1);
        ctx.restore();
      },
    });
  }

  // ---------- Consagração: círculo dourado com runas ----------
  consecration(x, y, radius, dur) {
    let t = 0;
    const runes = Array.from({ length: 10 }, (_, i) => i);
    return this.add({
      layer: 'chao',
      update: (dt) => (t += dt) < dur,
      draw: (ctx, view) => {
        const [sx, sy] = view(x, y, 0);
        const fade = Math.min(1, t * 4, (dur - t) * 2);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        // preenchimento pontilhado (padrão xadrez esparso)
        const rx = radius * 32 * R2, ry = radius * 16 * R2;
        ctx.globalAlpha = 0.28 * fade;
        ctx.fillStyle = GOLD;
        for (let yy = -ry; yy <= ry; yy += 2) for (let xx = -rx; xx <= rx; xx += 2) {
          if ((xx * xx) / (rx * rx) + (yy * yy) / (ry * ry) > 1) continue;
          if ((Math.round(xx + yy + t * 8) & 3) !== 0) continue;
          ctx.fillRect(Math.round(sx + xx), Math.round(sy + yy), 1, 1);
        }
        ctx.globalAlpha = fade * (0.75 + 0.25 * Math.sin(t * 8));
        ellipse(ctx, sx, sy, radius, GOLD, 2);
        ellipse(ctx, sx, sy, radius * 0.72, LIGHT, 1);
        // runas girando
        for (const i of runes) {
          const a = (i / runes.length) * Math.PI * 2 + t * 0.8;
          const px = Math.round(sx + Math.cos(a) * rx * 0.86), py = Math.round(sy + Math.sin(a) * ry * 0.86);
          ctx.fillStyle = LIGHT;
          if (i % 2) { ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 2, 1, 4); }
          else { ctx.fillRect(px - 1, py - 1, 3, 1); ctx.fillRect(px - 1, py + 1, 3, 1); ctx.fillRect(px, py - 1, 1, 3); }
        }
        ctx.restore();
        // faíscas subindo
        if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
          this.parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: 0, vx: 0, vy: 0, vz: 25 + Math.random() * 25, g: 0, life: 0.8, max: 0.8, c1: LIGHT, c2: GOLD, size: 1 });
        }
      },
    });
  }

  // ---------- martelo de luz que cai do céu ----------
  lightHammer(x, y, onImpact) {
    let t = 0, hit = false; const FALL = 0.3, HOLD = 0.7;
    return this.add({
      update: (dt) => {
        t += dt;
        if (!hit && t >= FALL) { hit = true; onImpact?.(); }
        return t < FALL + HOLD;
      },
      draw: (ctx, view) => {
        const k = Math.min(1, t / FALL);
        const z = t < FALL ? 220 * (1 - k * k) + 16 : 16 + (t - FALL) * 20;
        const [sx, sy] = view(x, y, z);
        const a = t < FALL ? 1 : 1 - (t - FALL) / HOLD;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        const X = Math.round(sx), Y = Math.round(sy);
        // cabo
        ctx.fillStyle = GOLD; ctx.fillRect(X - 2, Y - 64, 5, 52);
        ctx.fillStyle = LIGHT; ctx.fillRect(X - 1, Y - 64, 2, 52);
        // cabeça
        ctx.fillStyle = GOLD; ctx.fillRect(X - 20, Y - 14, 41, 24);
        ctx.fillStyle = LIGHT; ctx.fillRect(X - 17, Y - 11, 35, 18);
        ctx.fillStyle = WHITE; ctx.fillRect(X - 3, Y - 8, 7, 12); ctx.fillRect(X - 7, Y - 4, 15, 4);
        // coluna de luz depois do impacto
        if (t >= FALL) {
          const w = Math.round(14 * a) + 2;
          ctx.globalAlpha = a * 0.6;
          ctx.fillStyle = GOLD; ctx.fillRect(X - w, Y - 240, w * 2 + 1, 240);
          ctx.fillStyle = LIGHT; ctx.fillRect(X - Math.ceil(w / 2), Y - 240, w + 1, 240);
        }
        ctx.restore();
      },
    });
  }

  // ---------- bolha da Proteção de Luz ----------
  bubble(target, dur) {
    let t = 0;
    return this.add({
      update: (dt) => (t += dt) < dur && target.alive !== false,
      draw: (ctx, view) => {
        const [sx, sy] = view(target.x, target.y, 28);
        const fade = Math.min(1, t * 6, (dur - t) * 3);
        if (dur - t < 0.8 && Math.floor(t * 12) % 2) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * fade;
        const R = 30;
        ctx.fillStyle = GOLD;
        for (let a = 0; a < Math.PI * 2; a += 0.03) ctx.fillRect(Math.round(sx + Math.cos(a) * R * 0.9), Math.round(sy + Math.sin(a) * R), 1, 1);
        ctx.fillStyle = LIGHT;
        for (let a = -2.6; a < -1.6; a += 0.04) ctx.fillRect(Math.round(sx + Math.cos(a) * (R - 4) * 0.9), Math.round(sy + Math.sin(a) * (R - 4)), 2, 1);
        // brilho girando
        const a = t * 3;
        ctx.fillStyle = WHITE; ctx.fillRect(Math.round(sx + Math.cos(a) * R * 0.9), Math.round(sy + Math.sin(a) * R), 2, 2);
        ctx.restore();
      },
    });
  }

  // ---------- poeira da esquiva / morte de monstro ----------
  puff(x, y, color = '#c8b8a0', n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random();
      this.parts.push({ x, y, z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 10 + Math.random() * 20, g: 30, life: 0.45, max: 0.45, c1: color, c2: color, size: 2 });
    }
  }
}
