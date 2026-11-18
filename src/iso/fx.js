// =====================================================================
// Efeitos pintados (Luz Sagrada do Dalárian e o resto), em Canvas 2D:
// gradientes, brilho aditivo e partículas suaves. Posições no chão em
// tiles (x, y) + altura (z). Camada 'chao' (antes dos personagens) ou 'ar'.
// Cada efeito pode emitir luz (lights) para o mapa de iluminação.
// =====================================================================
const R2 = Math.SQRT2;
const GOLD = [255, 184, 58], LIGHT = [255, 241, 168];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function glowDot(ctx, x, y, r, c, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba([255, 255, 240], a)); g.addColorStop(0.35, rgba(c, a * 0.9)); g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
const groundEllipse = (ctx, cx, cy, rTiles) => { ctx.beginPath(); ctx.ellipse(cx, cy, rTiles * 32 * R2, rTiles * 16 * R2, 0, 0, Math.PI * 2); };

export class Fx {
  constructor() { this.list = []; this.parts = []; this.shake = 0; this.lights = []; }
  add(e) { this.list.push(e); return e; }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const cur = this.list; this.list = [];
    const keep = cur.filter((e) => e.update(dt) !== false);
    this.list = keep.concat(this.list);
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.g * dt;
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }
  // luzes ativas dos efeitos: { x, y, z, r (px), c, a }
  collectLights(out) { for (const e of this.list) if (e.light) { const l = e.light(); if (l) out.push(l); } }
  draw(ctx, view, layer) {
    for (const e of this.list) if ((e.layer || 'ar') === layer) e.draw(ctx, view);
    if (layer !== 'ar') return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      const [sx, sy] = view(p.x, p.y, p.z);
      const k = p.life / p.max;
      glowDot(ctx, sx, sy, p.size * (0.6 + k), k > 0.5 ? p.c1 : p.c2, Math.min(1, k * 1.6));
    }
    ctx.restore();
  }

  sparks(x, y, z, { n = 14, speed = 2.5, up = 60, c1 = LIGHT, c2 = GOLD, life = 0.5, g = 260, size = 2.2 } = {}) {
    if (typeof c1 === 'string') c1 = hexToRgb(c1); if (typeof c2 === 'string') c2 = hexToRgb(c2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
      const l = life * (0.6 + Math.random() * 0.6);
      this.parts.push({ x, y, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: up * (0.4 + Math.random()), g, life: l, max: l, c1, c2, size });
    }
  }

  number(x, y, value, color = '#fff') {
    let t = 0; const ox = (Math.random() - 0.5) * 12;
    return this.add({
      update: (dt) => (t += dt) < 0.9,
      draw: (ctx, view) => {
        const [sx, sy] = view(x, y, 56 + t * 34);
        const s = t < 0.1 ? 1.5 - t * 4 : 1.1;
        ctx.save(); ctx.globalAlpha = Math.min(1, (0.9 - t) * 4);
        ctx.font = `800 ${Math.round(11 * s)}px system-ui, sans-serif`; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,12,10,0.9)'; ctx.strokeText(String(Math.round(value)), sx + ox, sy);
        ctx.fillStyle = color; ctx.fillText(String(Math.round(value)), sx + ox, sy);
        ctx.restore();
      },
    });
  }

  // arco de luz do golpe
  swing(hero, mirror) {
    let t = 0; const dur = 0.24, yaw = hero.dirAngle;
    const pt = (view, ang, r) => { const dx = Math.sin(ang) * r, dy = Math.cos(ang) * r; return view(hero.x + (dx + dy) / 2, hero.y + (dy - dx) / 2, 22); };
    return this.add({
      update: (dt) => (t += dt) < dur,
      light: () => { const [x, y] = [hero.x, hero.y]; return { x, y, z: 20, r: 90, c: GOLD, a: 0.6 * (1 - t / dur) }; },
      draw: (ctx, view) => {
        const k = t / dur, span = 2.3, from = -span / 2, head = from + span * Math.min(1, k * 1.7);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [r, w, c, a] of [[1.25, 9, GOLD, 0.35], [1.3, 4, LIGHT, 0.8], [1.33, 1.5, [255, 255, 255], 1]]) {
          ctx.beginPath();
          let first = true;
          for (let s = Math.max(from, head - 1.3); s <= head; s += 0.05) {
            const [x, y] = pt(view, yaw + (mirror ? -s : s), r);
            first ? ctx.moveTo(x, y) : ctx.lineTo(x, y); first = false;
          }
          ctx.strokeStyle = rgba(c, a * (1 - k * 0.8)); ctx.lineWidth = w; ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  burst(x, y, z = 26, size = 10) {
    let t = 0; const dur = 0.2;
    return this.add({
      update: (dt) => (t += dt) < dur,
      light: () => ({ x, y, z, r: size * 7, c: LIGHT, a: 0.8 * (1 - t / dur) }),
      draw: (ctx, view) => {
        const [sx, sy] = view(x, y, z); const k = 1 - t / dur, s = size * (0.6 + k);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, sx, sy, s * 1.6, GOLD, k);
        ctx.fillStyle = rgba([255, 250, 220], k);
        ctx.beginPath(); ctx.moveTo(sx - s * 2.2, sy); ctx.lineTo(sx, sy - s * 0.25); ctx.lineTo(sx + s * 2.2, sy); ctx.lineTo(sx, sy + s * 0.25); ctx.fill();
        ctx.beginPath(); ctx.moveTo(sx, sy - s * 2.2); ctx.lineTo(sx + s * 0.25, sy); ctx.lineTo(sx, sy + s * 2.2); ctx.lineTo(sx - s * 0.25, sy); ctx.fill();
        ctx.restore();
      },
    });
  }

  ring(x, y, radius, dur = 0.45, color = GOLD) {
    let t = 0;
    return this.add({
      layer: 'chao',
      update: (dt) => (t += dt) < dur,
      draw: (ctx, view) => {
        const k = t / dur, [sx, sy] = view(x, y, 0);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        groundEllipse(ctx, sx, sy, radius * (0.2 + 0.8 * Math.sqrt(k)));
        ctx.strokeStyle = rgba(color, 1 - k); ctx.lineWidth = 6 * (1 - k) + 1; ctx.stroke();
        ctx.strokeStyle = rgba(LIGHT, 1 - k); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      },
    });
  }

  consecration(x, y, radius, dur) {
    let t = 0;
    return this.add({
      layer: 'chao',
      update: (dt) => (t += dt) < dur,
      light: () => ({ x, y, z: 4, r: radius * 64, c: GOLD, a: 0.75 * Math.min(1, t * 4, (dur - t) * 2) }),
      draw: (ctx, view) => {
        const [sx, sy] = view(x, y, 0);
        const fade = Math.min(1, t * 4, (dur - t) * 2), pulse = 0.85 + 0.15 * Math.sin(t * 7);
        const rx = radius * 32 * R2, ry = radius * 16 * R2;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.translate(sx, sy); ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, rx * 0.1, 0, 0, rx);
        g.addColorStop(0, rgba(GOLD, 0.1 * fade)); g.addColorStop(0.75, rgba(GOLD, 0.28 * fade * pulse)); g.addColorStop(1, rgba(LIGHT, 0.55 * fade));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(LIGHT, 0.9 * fade); ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(GOLD, 0.8 * fade); ctx.beginPath(); ctx.arc(0, 0, rx * 0.72, 0, Math.PI * 2); ctx.stroke();
        // runas girando
        ctx.font = `bold ${Math.round(rx * 0.16)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(LIGHT, 0.9 * fade);
        const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾ';
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + t * 0.7;
          ctx.save(); ctx.translate(Math.cos(a) * rx * 0.86, Math.sin(a) * rx * 0.86); ctx.rotate(a + Math.PI / 2); ctx.fillText(runes[i], 0, 0); ctx.restore();
        }
        // cruz no centro
        ctx.fillStyle = rgba(LIGHT, 0.5 * fade); ctx.fillRect(-rx * 0.04, -rx * 0.32, rx * 0.08, rx * 0.64); ctx.fillRect(-rx * 0.2, -rx * 0.12, rx * 0.4, rx * 0.08);
        ctx.restore();
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
          this.parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: 0, vx: 0, vy: 0, vz: 25 + Math.random() * 30, g: 0, life: 0.9, max: 0.9, c1: LIGHT, c2: GOLD, size: 2 });
        }
      },
    });
  }

  lightHammer(x, y, onImpact) {
    let t = 0, hit = false; const FALL = 0.3, HOLD = 0.75;
    return this.add({
      update: (dt) => { t += dt; if (!hit && t >= FALL) { hit = true; onImpact?.(); } return t < FALL + HOLD; },
      light: () => ({ x, y, z: 30, r: t < FALL ? 120 : 260 * (1 - (t - FALL) / HOLD), c: LIGHT, a: 0.9 }),
      draw: (ctx, view) => {
        const k = Math.min(1, t / FALL);
        const z = t < FALL ? 240 * (1 - k * k) + 18 : 18 + (t - FALL) * 24;
        const [X, Y] = view(x, y, z);
        const a = t < FALL ? 1 : 1 - (t - FALL) / HOLD;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        if (t >= FALL) {     // coluna de luz
          const w = 26 * a + 4;
          const g = ctx.createLinearGradient(X - w, 0, X + w, 0);
          g.addColorStop(0, rgba(GOLD, 0)); g.addColorStop(0.5, rgba(LIGHT, 0.7)); g.addColorStop(1, rgba(GOLD, 0));
          ctx.fillStyle = g; ctx.fillRect(X - w, Y - 320, w * 2, 320);
        }
        // martelo de luz: cabo + cabeça com estrela
        const g2 = ctx.createLinearGradient(X - 26, Y - 70, X + 26, Y + 14);
        g2.addColorStop(0, rgba(LIGHT, 0.95)); g2.addColorStop(1, rgba(GOLD, 0.7));
        ctx.fillStyle = g2;
        ctx.fillRect(X - 3, Y - 74, 6, 60);
        roundRect(ctx, X - 26, Y - 16, 52, 30, 6); ctx.fill();
        glowDot(ctx, X, Y, 26, GOLD, 0.8);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath(); ctx.moveTo(X, Y - 13); ctx.lineTo(X + 3, Y - 2); ctx.lineTo(X + 13, Y); ctx.lineTo(X + 3, Y + 2); ctx.lineTo(X, Y + 12); ctx.lineTo(X - 3, Y + 2); ctx.lineTo(X - 13, Y); ctx.lineTo(X - 3, Y - 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      },
    });
  }

  bubble(target, dur) {
    let t = 0;
    return this.add({
      update: (dt) => (t += dt) < dur && target.alive !== false,
      light: () => ({ x: target.x, y: target.y, z: 30, r: 110, c: GOLD, a: 0.55 }),
      draw: (ctx, view) => {
        const [sx, sy] = view(target.x, target.y, 34);
        const fade = Math.min(1, t * 6, (dur - t) * 3);
        if (dur - t < 0.8 && Math.floor(t * 12) % 2) return;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const R = 40;
        const g = ctx.createRadialGradient(sx - R * 0.3, sy - R * 0.4, R * 0.1, sx, sy, R);
        g.addColorStop(0, rgba(LIGHT, 0.05 * fade)); g.addColorStop(0.8, rgba(GOLD, 0.18 * fade)); g.addColorStop(1, rgba(LIGHT, 0.6 * fade));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, R * 0.9, R, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba(LIGHT, 0.7 * fade); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.strokeStyle = rgba([255, 255, 255], 0.8 * fade); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(sx, sy, R * 0.78, R * 0.88, 0, -2.6, -1.7); ctx.stroke();
        ctx.restore();
      },
    });
  }

  puff(x, y, color = '#c8b8a0', n = 10) {
    const c = hexToRgb(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random();
      this.parts.push({ x, y, z: 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 10 + Math.random() * 20, g: 30, life: 0.45, max: 0.45, c1: c, c2: c, size: 4 });
    }
  }
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function hexToRgb(h) { if (Array.isArray(h)) return h; const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
