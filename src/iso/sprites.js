// Folhas de sprites dos heróis (geradas por tools/bake-sprites):
// uma imagem por animação; linhas = 8 direções, colunas = quadros.
export async function loadHeroSprites(id) {
  const base = `./sprites/${id}/`;
  const meta = await (await fetch(base + 'sprites.json')).json();
  const sheets = {};
  await Promise.all(Object.keys(meta.anims).map((name) => new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => { sheets[name] = img; ok(); };
    img.onerror = fail;
    img.src = base + name + '.png';
  })));
  return { meta, sheets };
}

// Direção (0..7: S, SE, E, NE, N, NW, W, SW) a partir de um vetor no chão (tiles).
export function dirFromTileVec(dx, dy) {
  const gx = dx - dy, gz = dx + dy;          // eixo do chão como na câmera dos sprites
  const yaw = Math.atan2(gx, gz);
  return ((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8;
}

export class SpriteAnim {
  constructor(sprites) { this.s = sprites; this.name = 'idle'; this.t = 0; this.dir = 0; this.onEnd = null; }
  play(name, { restart = false, onEnd = null } = {}) {
    if (this.name === name && !restart) return;
    this.name = name; this.t = 0; this.onEnd = onEnd;
  }
  get info() { return this.s.meta.anims[this.name]; }
  get done() { const a = this.info; return !a.loop && this.t * a.fps >= a.frames; }
  update(dt) {
    this.t += dt;
    if (this.done && this.onEnd) { const f = this.onEnd; this.onEnd = null; f(); }
  }
  draw(ctx, sx, sy, flash = 0) {
    const a = this.info, F = this.s.meta.frame, [ax, ay] = this.s.meta.anchor;
    let f = Math.floor(this.t * a.fps);
    f = a.loop ? f % a.frames : Math.min(a.frames - 1, f);
    const img = this.s.sheets[this.name];
    ctx.drawImage(img, f * F, this.dir * F, F, F, Math.round(sx - ax), Math.round(sy - ay), F, F);
    if (flash > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, flash); ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, f * F, this.dir * F, F, F, Math.round(sx - ax), Math.round(sy - ay), F, F);
      ctx.restore();
    }
  }
}
