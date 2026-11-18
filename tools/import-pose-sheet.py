#!/usr/bin/env python3
"""
Traz de volta para o jogo a imagem que a IA desenhou em cima de uma folha de
pose (tools/pose-sheets), com fundo verde liso.

Modo pintado (padrão, alta resolução, como no vídeo):
  python3 tools/import-pose-sheet.py desenho.png walk SE public/sprites/dalarian
    → grade 4x2 de quadros 384x512 (docs/poses/<heroi>-hd), uma direção por imagem

Modo pixel art (folhas antigas de 8 linhas, 192 px):
  python3 tools/import-pose-sheet.py desenho.png walk ALL public/sprites/dalarian --pixel --frames 8

Remove o verde (chroma key com borda suave e sem reflexo verde), recorta cada
quadro alinhando os pés e grava public/sprites/<heroi>/<anim>.png (linhas = 8
direções S, SE, E, NE, N, NW, W, SW) + sprites.json. Direções que ainda não
vieram ficam com o quadro de antes (ou vazias).
Com --mirror, gera a direção espelhada (E→W, SE→SW, NE→NW) se ela não existir.
"""
import argparse, json, os
import numpy as np
from PIL import Image

DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
MIRROR = {'E': 'W', 'SE': 'SW', 'NE': 'NW', 'W': 'E', 'SW': 'SE', 'NW': 'NE'}
FRAMES = {'idle': 6, 'walk': 8, 'ataque': 6, 'ataque2': 6, 'consagracao': 8, 'protecao': 6, 'esquiva': 4, 'dano': 3}
FPS = {'idle': 5, 'walk': 12, 'ataque': 14.3, 'ataque2': 14.3, 'consagracao': 9, 'protecao': 10.9, 'esquiva': 18, 'dano': 12}
OUTLINE = (26, 16, 32)


def chroma(rgb):
    """alfa suave pelo quanto o pixel é 'verde de fundo'; tira o reflexo verde."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = g - np.maximum(r, b)                 # >0 = esverdeado
    a = np.clip(1 - (green - 25) / 45, 0, 1)     # 25..70 → 1..0
    out = rgb.copy()
    out[..., 1] = np.minimum(g, np.maximum(r, b) + 8)   # despill
    return out, a * 255


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image'); ap.add_argument('anim'); ap.add_argument('dir'); ap.add_argument('out')
    ap.add_argument('--pixel', action='store_true', help='modo pixel art (folhas antigas)')
    ap.add_argument('--frames', type=int, default=0)
    ap.add_argument('--cw', type=int, default=384); ap.add_argument('--ch', type=int, default=512)
    ap.add_argument('--cols', type=int, default=4)
    ap.add_argument('--ppu', type=float, default=100); ap.add_argument('--feet', type=float, default=400)
    ap.add_argument('--height', type=int, default=0, help='altura do herói no jogo (px)')
    ap.add_argument('--mirror', action='store_true')
    args = ap.parse_args()
    n = args.frames or FRAMES[args.anim]
    if args.pixel:
        args.cw = args.ch = 192; args.ppu = 58; args.feet = 168; args.cols = n
    height = args.height or (76 if args.pixel else 190)
    scale = height / (2.2 * args.ppu)                # herói ~2,2 m de altura nas poses
    rows = 8 if args.dir == 'ALL' else -(-n // args.cols)
    dirs = DIRS if args.dir == 'ALL' else [args.dir]

    meta_path = f'{args.out}/sprites.json'
    os.makedirs(args.out, exist_ok=True)
    if os.path.exists(meta_path):
        meta = json.load(open(meta_path))
    else:
        meta = {'dirs': DIRS, 'anims': {}}
    if args.pixel:
        FW, FH, AX, AY = 128, 128, 64, 114
    else:
        FW, FH = round(args.cw * scale), round(args.ch * scale)
        AX, AY = FW // 2, round(args.feet * scale)
        meta.update({'style': 'pintado'})
    meta.update({'frame': FW, 'frameW': FW, 'frameH': FH, 'anchor': [AX, AY]})

    im = Image.open(args.image).convert('RGB')
    cols = args.cols if args.dir != 'ALL' else n
    im = im.resize((args.cw * cols, args.ch * rows), Image.LANCZOS)   # a IA pode devolver em outro tamanho
    rgb = np.asarray(im).astype(np.float32)
    rgb, alpha = chroma(rgb)

    path = f'{args.out}/{args.anim}.png'
    sheet = np.zeros((FH * 8, FW * n, 4), np.uint8)
    if os.path.exists(path):
        old = np.asarray(Image.open(path).convert('RGBA'))
        if old.shape == sheet.shape: sheet[:] = old

    def cell(r, f):
        cx, cy = (f % args.cols, f // args.cols) if args.dir != 'ALL' else (f, r)
        ys, xs = cy * args.ch, cx * args.cw
        c = np.dstack([rgb[ys:ys + args.ch, xs:xs + args.cw], alpha[ys:ys + args.ch, xs:xs + args.cw]])
        pre = c.copy(); pre[..., :3] *= pre[..., 3:4] / 255
        img = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA').resize((FW, FH) if not args.pixel else (round(args.cw * scale),) * 2, Image.LANCZOS if not args.pixel else Image.BOX)
        s = np.asarray(img).astype(np.float32)
        al = s[..., 3:4] / 255
        col = np.where(al > 0.01, s[..., :3] / np.maximum(al, 1e-3), 0)
        return np.dstack([np.clip(col, 0, 255), s[..., 3]])

    done = []
    for ri, d in enumerate(dirs):
        di = DIRS.index(d)
        frames = [cell(ri, f) for f in range(n)]
        for f, fr in enumerate(frames):
            if args.pixel:
                out = np.zeros((FH, FW, 4), np.uint8)
                k = fr.shape[0]; ox, oy = round(AX - k / 2), round(AY - args.feet * scale)
                solid = fr[..., 3] > 127
                for y in range(k):
                    for x in range(k):
                        if solid[y, x] and 0 <= oy + y < FH and 0 <= ox + x < FW:
                            out[oy + y, ox + x] = (*fr[y, x, :3].astype(np.uint8), 255)
                s = out[..., 3] > 0; e = np.zeros_like(s)
                e[1:] |= s[:-1]; e[:-1] |= s[1:]; e[:, 1:] |= s[:, :-1]; e[:, :-1] |= s[:, 1:]
                out[e & ~s] = (*OUTLINE, 255)
            else:
                out = fr.astype(np.uint8)
            sheet[di * FH:(di + 1) * FH, f * FW:(f + 1) * FW] = out
        done.append(d)
        if args.mirror and d in MIRROR:
            m = MIRROR[d]; mi = DIRS.index(m)
            for f in range(n):
                sheet[mi * FH:(mi + 1) * FH, f * FW:(f + 1) * FW] = sheet[di * FH:(di + 1) * FH, f * FW:(f + 1) * FW][:, ::-1]
            done.append(m + ' (espelho)')

    Image.fromarray(sheet, 'RGBA').save(path)
    meta['anims'][args.anim] = {'frames': n, 'fps': FPS.get(args.anim, 12), 'loop': args.anim in ('idle', 'walk')}
    json.dump(meta, open(meta_path, 'w'), indent=2)
    print('ok', path, 'direções:', ', '.join(done), f'quadro {FW}x{FH}')


if __name__ == '__main__':
    main()
