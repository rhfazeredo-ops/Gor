#!/usr/bin/env python3
"""
Importa uma folha com o herói desenhado em 8 direções (uma pose por direção)
e gera as folhas de animação do jogo (mesmo formato do tools/bake-sprites).

  python3 tools/import-sprite-sheet.py <imagem> <saida> --order NE,S,SE,E,N,NW,SW,W --height 76

--order: direção de cada figura na imagem, da esquerda para a direita e de cima
para baixo. Direções: S, SE, E, NE, N, NW, W, SW.

O fundo é removido por preenchimento a partir das bordas (fundos lisos ou em
degradê). As animações são feitas por movimento da pose desenhada (respirar,
passo, golpe, conjurar...). Quando houver quadros desenhados de verdade, é só
trocar os PNG gerados.
"""
import sys, json, argparse
from collections import deque
import numpy as np
from PIL import Image

DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
# direção na tela de cada uma (para o avanço do golpe e o recuo do dano)
SCREEN_VEC = {'S': (0, 1), 'SE': (0.9, 0.45), 'E': (1, 0), 'NE': (0.9, -0.45), 'N': (0, -1), 'NW': (-0.9, -0.45), 'W': (-1, 0), 'SW': (-0.9, 0.45)}
OUTLINE = (26, 16, 32)


def remove_bg(a, thr):
    h, w, _ = a.shape
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        c = a[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and np.abs(a[ny, nx] - c).sum() < thr:
                bg[ny, nx] = True; q.append((ny, nx))
    return ~bg


def components(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    comps = []
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if not mask[y0, x0] or lab[y0, x0]:
                continue
            n += 1
            q = deque([(y0, x0)]); lab[y0, x0] = n
            pts = []
            while q:
                y, x = q.popleft(); pts.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
            comps.append((n, pts))
    return lab, comps


def quantize_outline(img, pal):
    """img RGBA float (0..255). Paleta fixa + contorno externo."""
    h, w, _ = img.shape
    out = np.zeros((h, w, 4), np.uint8)
    solid = img[..., 3] >= 128
    rgb = img[..., :3]
    d = ((rgb[:, :, None, :] - pal[None, None, :, :]) ** 2 * np.array([0.3, 0.59, 0.11])).sum(-1)
    idx = d.argmin(-1)
    out[..., :3] = pal[idx]
    out[..., 3] = np.where(solid, 255, 0)
    edge = np.zeros_like(solid)
    edge[1:] |= solid[:-1]; edge[:-1] |= solid[1:]; edge[:, 1:] |= solid[:, :-1]; edge[:, :-1] |= solid[:, 1:]
    edge &= ~solid
    out[edge] = (*OUTLINE, 255)
    return out


def palette(imgs, n):
    pts = np.concatenate([i[..., :3][i[..., 3] >= 128] for i in imgs])
    boxes = [pts]
    while len(boxes) < n:
        boxes.sort(key=lambda b: (b.max(0) - b.min(0)).max() * np.log(len(b) + 1), reverse=True)
        b = boxes.pop(0)
        if len(b) < 2:
            boxes.append(b); break
        ch = (b.max(0) - b.min(0)).argmax()
        b = b[b[:, ch].argsort()]
        m = len(b) // 2
        boxes += [b[:m], b[m:]]
    return np.array([b.mean(0) for b in boxes if len(b)])


def place(canvas, spr, ax, ay, fx, fy, sx=1.0, sy=1.0, tint=None, alpha=1.0):
    """cola a pose (spr RGBA float, âncora nos pés ax, ay) no quadro, com
    deslocamento (fx, fy) e escala (sx, sy) a partir dos pés."""
    H, W, _ = canvas.shape
    h, w, _ = spr.shape
    nw, nh = max(1, round(w * sx)), max(1, round(h * sy))
    im = Image.fromarray(spr.astype(np.uint8), 'RGBA').resize((nw, nh), Image.NEAREST)
    s = np.asarray(im).astype(np.float32)
    if tint is not None:
        t, k = tint
        s[..., :3] = s[..., :3] * (1 - k) + np.array(t) * k
    s[..., 3] *= alpha
    ox = round(W / 2 - ax * sx + fx)
    oy = round(ANCHOR_Y - ay * sy + fy)
    y0, x0 = max(0, oy), max(0, ox)
    y1, x1 = min(H, oy + nh), min(W, ox + nw)
    if y1 <= y0 or x1 <= x0:
        return
    sub = s[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    m = sub[..., 3:4] / 255
    canvas[y0:y1, x0:x1, :3] = canvas[y0:y1, x0:x1, :3] * (1 - m) + sub[..., :3] * m
    canvas[y0:y1, x0:x1, 3] = np.maximum(canvas[y0:y1, x0:x1, 3], sub[..., 3])


ANCHOR_Y = 0


def main():
    global ANCHOR_Y
    ap = argparse.ArgumentParser()
    ap.add_argument('image'); ap.add_argument('out')
    ap.add_argument('--order', default='NE,S,SE,E,N,NW,SW,W')
    ap.add_argument('--height', type=int, default=76)
    ap.add_argument('--frame', type=int, default=128)
    ap.add_argument('--thr', type=float, default=18)
    ap.add_argument('--colors', type=int, default=48)
    args = ap.parse_args()
    order = args.order.split(',')
    F = args.frame
    ANCHOR_Y = F - 14

    im = Image.open(args.image).convert('RGB')
    W0, H0 = im.size
    a = np.asarray(im.resize((W0 // 2, H0 // 2), Image.BOX)).astype(np.float32)
    mask = remove_bg(a, args.thr)
    lab, comps = components(mask)
    comps.sort(key=lambda c: -len(c[1]))
    figs = comps[:len(order)]
    # ordem de leitura: linhas (de cima para baixo), depois colunas
    info = []
    for n, pts in figs:
        ys = np.array([p[0] for p in pts]); xs = np.array([p[1] for p in pts])
        info.append((n, ys, xs))
    info.sort(key=lambda t: (round(t[1].mean() / (a.shape[0] / 2.2)), t[2].mean()))
    poses = {}
    heights = []
    for (n, ys, xs), d in zip(info, order):
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        crop = a[y0:y1, x0:x1]
        m = (lab[y0:y1, x0:x1] == n)
        # pés: ponto mais baixo na faixa central (ignora o martelo nas laterais)
        cx = int(np.median(xs)) - x0
        band = m[:, max(0, cx - (x1 - x0) // 5): cx + (x1 - x0) // 5]
        rows = np.where(band.any(1))[0]
        foot = rows.max() if len(rows) else m.shape[0] - 1
        # topo da cabeça na mesma faixa
        top = rows.min() if len(rows) else 0
        heights.append(foot - top)
        poses[d] = (crop, m, cx, foot)
    scale = args.height / np.median(heights)

    # reduz cada pose (média com alfa) e guarda RGBA float + âncora
    small = {}
    for d, (crop, m, cx, foot) in poses.items():
        h, w = m.shape
        nh, nw = max(1, round(h * scale)), max(1, round(w * scale))
        rgba = np.dstack([crop * m[..., None], m * 255.0]).astype(np.float32)
        # pré-multiplicado → reduz → divide
        img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA')
        pre = np.asarray(img.resize((nw, nh), Image.BOX)).astype(np.float32)
        al = pre[..., 3:4] / 255
        col = np.where(al > 0, pre[..., :3] / np.maximum(al, 1e-3), 0)
        # deixa as cores um pouco mais vivas e contrastadas (pixel art)
        col = np.clip((col - 128) * 1.08 + 128 + 4, 0, 255)
        small[d] = (np.dstack([col, np.where(al[..., 0] > 0.45, 255, 0)]), cx * scale, foot * scale)

    pal = palette([s[0] for s in small.values()], args.colors)
    # poses já com paleta (sem contorno; o contorno é aplicado em cada quadro final)
    clean = {}
    for d, (img, ax, ay) in small.items():
        q = quantize_outline(img, pal).astype(np.float32)
        q[..., 3] = np.where(img[..., 3] >= 128, 255, 0)
        q[q[..., 3] == 0] = 0
        clean[d] = (q, ax, ay)

    # ---------------- animações por movimento da pose ----------------
    import math
    def frames_for(name, d):
        vx, vy = SCREEN_VEC[d]
        out = []
        def fr(**k):
            c = np.zeros((F, F, 4), np.float32)
            img, ax, ay = clean[d]
            place(c, img, ax, ay, **k)
            out.append(c)
        if name == 'idle':
            for i in range(6):
                b = math.sin(i / 6 * math.pi * 2)
                fr(fx=0, fy=0, sx=1.0, sy=1.0 + 0.012 * b)
        elif name == 'walk':
            for i in range(8):
                p = i / 8 * math.pi * 2
                fr(fx=round(math.sin(p) * 0.8), fy=-round(abs(math.sin(p)) * 3), sx=1.0, sy=1.0 - 0.02 * abs(math.cos(p)))
        elif name in ('ataque', 'ataque2'):
            seq = [(-2, 0, 1.0, 1.0, None), (-3, -1, 0.98, 1.03, None), (4, 0, 1.03, 0.96, ((255, 240, 190), 0.35)),
                   (6, 1, 1.04, 0.95, ((255, 240, 190), 0.2)), (3, 0, 1.0, 0.98, None), (1, 0, 1.0, 1.0, None)]
            for k, up, sx, sy, tint in seq:
                fr(fx=vx * k, fy=vy * k * 0.5 - up, sx=sx, sy=sy, tint=tint)
        elif name == 'consagracao':
            seq = [(0, 1, 1), (-2, 0.98, 1.04), (-5, 0.97, 1.07), (-7, 0.96, 1.08), (-6, 0.97, 1.06), (0, 1.08, 0.88),
                   (0, 1.08, 0.86), (0, 1.05, 0.92), (0, 1.02, 0.97), (0, 1, 1)]
            for i, (up, sx, sy) in enumerate(seq):
                fr(fx=0, fy=up, sx=sx, sy=sy, tint=((255, 230, 140), 0.45) if i in (5, 6) else ((255, 230, 140), 0.15) if 2 <= i <= 4 else None)
        elif name == 'protecao':
            for i in range(6):
                k = math.sin(i / 5 * math.pi)
                fr(fx=0, fy=0, sx=1.0, sy=1.0 - 0.04 * k, tint=((255, 225, 120), 0.4 * k))
        elif name == 'esquiva':
            for i in range(4):
                k = math.sin((i + 0.5) / 4 * math.pi)
                fr(fx=vx * 3 * k, fy=vy * 1.5 * k + 2 * k, sx=1.0 + 0.06 * k, sy=1.0 - 0.12 * k, alpha=1.0)
        elif name == 'dano':
            for i, k in enumerate((1, 0.6, 0.2)):
                fr(fx=-vx * 3 * k, fy=-vy * 1.5 * k, sx=1, sy=1, tint=((255, 80, 60), 0.55 * k))
        return out

    ANIMS = {'idle': (6, 4, True), 'walk': (8, 12, True), 'ataque': (6, 14.3, False), 'ataque2': (6, 14.3, False),
             'consagracao': (10, 11.1, False), 'protecao': (6, 10.9, False), 'esquiva': (4, 18.2, False), 'dano': (3, 12, False)}
    import os
    os.makedirs(args.out, exist_ok=True)
    meta = {'frame': F, 'anchor': [F // 2, ANCHOR_Y], 'dirs': DIRS, 'anims': {}, 'source': 'desenho'}
    for name, (n, fps, loop) in ANIMS.items():
        sheet = np.zeros((F * 8, F * n, 4), np.uint8)
        for di, d in enumerate(DIRS):
            for fi, fr_ in enumerate(frames_for(name, d)):
                q = quantize_outline(fr_, pal)
                sheet[di * F:(di + 1) * F, fi * F:(fi + 1) * F] = q
        Image.fromarray(sheet, 'RGBA').save(f'{args.out}/{name}.png')
        meta['anims'][name] = {'frames': n, 'fps': fps, 'loop': loop}
    json.dump(meta, open(f'{args.out}/sprites.json', 'w'), indent=2)
    print('ok', args.out, 'escala', round(scale, 3), 'cores', len(pal))


if __name__ == '__main__':
    main()
