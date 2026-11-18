#!/usr/bin/env python3
"""
Traz de volta para o jogo uma folha desenhada por IA em cima das folhas de pose
(tools/pose-sheets): mesma grade (linhas = 8 direções S, SE, E, NE, N, NW, W, SW;
colunas = quadros), fundo verde liso.

  python3 tools/import-pose-sheet.py desenhado.png walk public/sprites/dalarian [--frames 8] [--rows 8] [--fps 12]

Remove o verde (chroma key), reduz para o tamanho do jogo, aplica paleta e
contorno e grava public/sprites/<heroi>/<anim>.png + atualiza sprites.json.
Também aceita só algumas linhas (ex.: --rows 1 --dirs S) e preenche o resto
com as direções que já existiam.
"""
import argparse, json, os
import numpy as np
from PIL import Image

POSE_CELL, POSE_FEET = 192, 168       # tools/pose-sheets.js
DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
OUTLINE = (26, 16, 32)


def chroma(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = (g > r + 35) & (g > b + 35)
    a = np.where(green, 0, 255).astype(np.float32)
    # tira o reflexo verde das bordas
    spill = np.minimum(g, np.maximum(r, b) + 10)
    out = rgb.copy(); out[..., 1] = np.where(green, g, spill)
    return out, a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image'); ap.add_argument('anim'); ap.add_argument('out')
    ap.add_argument('--frames', type=int, required=True)
    ap.add_argument('--rows', type=int, default=8)
    ap.add_argument('--dirs', default=','.join(DIRS))
    ap.add_argument('--fps', type=float, default=12)
    ap.add_argument('--loop', action='store_true')
    ap.add_argument('--height', type=int, default=76, help='altura do herói no jogo (px)')
    args = ap.parse_args()
    dirs = args.dirs.split(',')[:args.rows]

    meta_path = f'{args.out}/sprites.json'
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {'frame': 128, 'anchor': [64, 114], 'dirs': DIRS, 'anims': {}}
    F, (AX, AY) = meta['frame'], meta['anchor']

    im = Image.open(args.image).convert('RGB')
    # a IA pode devolver em outro tamanho: normaliza para a grade das poses
    im = im.resize((POSE_CELL * args.frames, POSE_CELL * args.rows), Image.LANCZOS)
    rgb = np.asarray(im).astype(np.float32)
    rgb, alpha = chroma(rgb)
    scale = args.height / (2.2 * 58)          # herói ~2,2 m na folha de pose (58 px/m)

    # folha existente (para manter direções que não vieram)
    path = f'{args.out}/{args.anim}.png'
    sheet = np.zeros((F * 8, F * args.frames, 4), np.uint8)
    if os.path.exists(path):
        old = np.asarray(Image.open(path).convert('RGBA'))
        if old.shape[1] == sheet.shape[1]: sheet[:] = old

    cells = []
    for r, d in enumerate(dirs):
        for f in range(args.frames):
            ys, xs = r * POSE_CELL, f * POSE_CELL
            c = np.dstack([rgb[ys:ys + POSE_CELL, xs:xs + POSE_CELL], alpha[ys:ys + POSE_CELL, xs:xs + POSE_CELL]])
            pre = c.copy(); pre[..., :3] *= pre[..., 3:4] / 255
            n = round(POSE_CELL * scale)
            small = np.asarray(Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA').resize((n, n), Image.BOX)).astype(np.float32)
            al = small[..., 3:4] / 255
            col = np.where(al > 0, small[..., :3] / np.maximum(al, 1e-3), 0)
            cells.append((DIRS.index(d), f, np.dstack([col, np.where(al[..., 0] > 0.5, 255, 0)]), n))

    # paleta comum (corte pela mediana)
    pts = np.concatenate([c[2][..., :3][c[2][..., 3] > 0] for c in cells])
    boxes = [pts]
    while len(boxes) < 48:
        boxes.sort(key=lambda b: (b.max(0) - b.min(0)).max() * np.log(len(b) + 1), reverse=True)
        b = boxes.pop(0)
        if len(b) < 2: boxes.append(b); break
        ch = (b.max(0) - b.min(0)).argmax(); b = b[b[:, ch].argsort()]; m = len(b) // 2
        boxes += [b[:m], b[m:]]
    pal = np.array([b.mean(0) for b in boxes if len(b)])

    for di, f, img, n in cells:
        out = np.zeros((F, F, 4), np.uint8)
        # pés da pose → âncora do quadro do jogo
        ox, oy = round(AX - n / 2), round(AY - POSE_FEET * scale)
        solid = img[..., 3] > 0
        d = ((img[..., :3][:, :, None, :] - pal[None, None]) ** 2).sum(-1)
        q = pal[d.argmin(-1)].astype(np.uint8)
        for y in range(n):
            for x in range(n):
                if solid[y, x] and 0 <= oy + y < F and 0 <= ox + x < F:
                    out[oy + y, ox + x] = (*q[y, x], 255)
        s = out[..., 3] > 0
        e = np.zeros_like(s)
        e[1:] |= s[:-1]; e[:-1] |= s[1:]; e[:, 1:] |= s[:, :-1]; e[:, :-1] |= s[:, 1:]
        out[e & ~s] = (*OUTLINE, 255)
        sheet[di * F:(di + 1) * F, f * F:(f + 1) * F] = out

    Image.fromarray(sheet, 'RGBA').save(path)
    meta['anims'][args.anim] = {'frames': args.frames, 'fps': args.fps, 'loop': args.loop or args.anim in ('idle', 'walk')}
    json.dump(meta, open(meta_path, 'w'), indent=2)
    print('ok', path, 'direções:', ','.join(dirs))


if __name__ == '__main__':
    main()
