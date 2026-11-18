#!/usr/bin/env python3
"""
Monta os sprites pintados (alta resolução) do Dalárian a partir de:
  - folhas feitas na IA sobre o esqueleto (docs/poses/ia-dalarian), fundo verde;
  - vista de costas do concept + martelo (para N, NE, NW), animada pelo
    esqueleto 2D (tools/rig2d.py).
Todas as poses são recortadas, igualadas em altura e alinhadas pelo tronco
(horizontal) e pelos pés (vertical). Ações que a IA ainda não desenhou são
feitas por movimento das poses (avanço, tinta de luz...).

  python3 tools/build-hd-sprites.py <pasta-saida> [--back back.png]
Saída: <anim>.webp (linhas = S, SE, E, NE, N, NW, W, SW) + sprites.json
"""
import sys, os, json, math, argparse
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import rig2d

DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW']
FW, FH = 220, 250            # quadro
AX, AY = 110, 236            # âncora (pés)
BODY = 196                   # altura do corpo (topo da cabeça → pé)
IA = 'docs/poses/ia-dalarian/ia-%s.png'
SHEETS = {1: 'c218f929', 2: '0b39fb3f', 3: 'ba955288', 4: 'b366685a', 5: '9d1f74de',
          6: 'fb3718b9', 7: '77d3c760', 8: '57651d00', 9: '93fee1fa', 10: 'e0fd4901'}


def chroma(a):
    g = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    al = np.clip(1 - (g - 22) / 40, 0, 1)
    rgb = a.copy(); rgb[..., 1] = np.minimum(a[..., 1], np.maximum(a[..., 0], a[..., 2]) + 6)
    return rgb, al


def cut_figures(path):
    """recorta as figuras de uma folha verde, em ordem de leitura → lista RGBA float"""
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    rgb, al = chroma(a)
    mask = al > 0.5
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=8))
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = [i + 1 for i in np.argsort(sizes)[::-1][:8] if sizes[i] > 3000]
    objs = ndimage.find_objects(lab)
    figs = []
    H = a.shape[0]
    for k in keep:
        sl = objs[k - 1]
        m = lab[sl] == k
        c = np.dstack([rgb[sl], al[sl] * 255 * m])
        figs.append((sl[0].start > H * 0.45, sl[1].start, c))
    figs.sort(key=lambda t: (t[0], t[1]))
    return [f[2] for f in figs]


def measure(c):
    al = c[..., 3] > 128
    rows = np.where(al.any(1))[0]
    top, foot = rows.min(), rows.max()
    h = foot - top
    # centro do tronco: pixels entre 15% e 50% da altura
    band = al[top + int(h * 0.15): top + int(h * 0.5)]
    cx = np.where(band.any(0))[0]
    xs = np.nonzero(band)[1]
    return top, foot, (xs.mean() if len(xs) else c.shape[1] / 2)


def to_frame(c, scale=None, ref_h=None):
    top, foot, cx = measure(c)
    s = scale if scale else BODY / (ref_h if ref_h else (foot - top))
    pre = c.copy(); pre[..., :3] *= pre[..., 3:4] / 255
    img = Image.fromarray(np.clip(pre, 0, 255).astype(np.uint8), 'RGBA')
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    arr = np.asarray(img).astype(np.float32)
    al = arr[..., 3:4] / 255
    arr[..., :3] = np.where(al > 0.01, arr[..., :3] / np.maximum(al, 1e-3), 0)
    out = np.zeros((FH, FW, 4), np.float32)
    ox, oy = round(AX - cx * s), round(AY - foot * s)
    paste(out, arr, ox, oy)
    return out


def paste(dst, src, ox, oy):
    H, W = dst.shape[:2]; h, w = src.shape[:2]
    y0, x0 = max(0, oy), max(0, ox); y1, x1 = min(H, oy + h), min(W, ox + w)
    if y1 <= y0 or x1 <= x0: return
    s = src[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    m = s[..., 3:4] / 255
    dst[y0:y1, x0:x1, :3] = dst[y0:y1, x0:x1, :3] * (1 - m) + s[..., :3] * m
    dst[y0:y1, x0:x1, 3] = np.maximum(dst[y0:y1, x0:x1, 3], s[..., 3])


def sheet_frames(i, ref='median'):
    figs = cut_figures(IA % SHEETS[i])
    hs = [measure(c)[1] - measure(c)[0] for c in figs]
    href = float(np.median(hs))        # mesma escala para a folha toda (agachar continua agachado)
    return [to_frame(c, ref_h=href) for c in figs]


def mirror(frames):
    out = []
    for f in frames:
        g = f[:, ::-1].copy()
        # recentra: âncora é o centro do quadro, então espelhar mantém AX se AX = FW/2
        out.append(g)
    return out


def resample(frames, n):
    return [frames[int(i * len(frames) / n)] for i in range(n)]


def xform(f, dx=0, dy=0, sx=1.0, sy=1.0, tint=None, alpha=1.0):
    """move/escala um quadro a partir da âncora; tint = (rgb, força)"""
    img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8), 'RGBA')
    w, h = round(FW * sx), round(FH * sy)
    img = img.resize((w, h), Image.LANCZOS)
    a = np.asarray(img).astype(np.float32)
    if tint is not None:
        col, k = tint
        a[..., :3] = a[..., :3] * (1 - k) + np.array(col) * k
    a[..., 3] *= alpha
    out = np.zeros((FH, FW, 4), np.float32)
    paste(out, a, round(AX - AX * sx + dx), round(AY - AY * sy + dy))
    return out


SCREEN = {'S': (0, 1), 'SE': (0.9, 0.45), 'E': (1, 0), 'NE': (0.9, -0.45), 'N': (0, -1), 'NW': (-0.9, -0.45), 'W': (-1, 0), 'SW': (-0.9, 0.45)}


def back_frames(path):
    """vista de costas do concept + martelo, andando pelo esqueleto 2D"""
    im = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32)
    m = im[..., 3] > 128
    rows = np.where(m.any(1))[0]; top, foot = rows.min(), rows.max()
    rgb = im[..., :3]
    rig = rig2d.build_rig(rgb, m, foot, top, 'N')
    walk = []
    for i in range(8):
        fr = rig2d.walk_frame(im, rig, 'N', i / 8 * 2 * math.pi, 30)
        walk.append(fr)
    # escala igual para todos: altura do corpo parado
    href = foot - top
    idle = to_frame(im, ref_h=href)
    walk = [to_frame(f, ref_h=href) for f in walk]
    # o quadro do esqueleto tem margem (pad): to_frame mede de novo e realinha
    return idle, walk


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('--back', required=True)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    print('lendo folhas da IA...')
    F = {i: sheet_frames(i) for i in SHEETS}
    back_idle, back_walk = back_frames(args.back)

    # ---------------- locomoção ----------------
    walk = {
        'S': F[1], 'SE': F[7], 'E': resample(F[8], 8), 'SW': resample(F[9], 8),
        'N': back_walk, 'NE': back_walk, 'NW': mirror(back_walk),
    }
    walk['W'] = mirror(walk['E'])
    base = {'S': F[10][0], 'SE': F[7][0], 'E': F[8][0], 'SW': F[9][0], 'N': back_idle, 'NE': back_idle, 'NW': mirror([back_idle])[0]}
    base['W'] = mirror([base['E']])[0]

    def breathe(f):
        return [xform(f, sy=1 + 0.012 * math.sin(i / 6 * 2 * math.pi), sx=1 - 0.004 * math.sin(i / 6 * 2 * math.pi)) for i in range(6)]
    idle = {d: breathe(base[d]) for d in DIRS}
    idle['S'] = resample(F[10], 6)          # parado de frente desenhado pela IA

    # ---------------- golpe ----------------
    atk_se = F[3]                             # folha da IA: prepara, avança, recolhe
    def lunge(d):
        vx, vy = SCREEN[d]; f = base[d]
        seq = [(-4, 0, 1, 1, None), (-7, -2, 0.98, 1.03, None), (8, 2, 1.04, 0.96, ((255, 236, 170), 0.35)),
               (12, 3, 1.05, 0.95, ((255, 236, 170), 0.2)), (9, 2, 1.03, 0.97, None), (5, 1, 1.01, 0.99, None), (2, 0, 1, 1, None), (0, 0, 1, 1, None)]
        return [xform(f, dx=vx * k, dy=vy * k * 0.5 - up, sx=sx, sy=sy, tint=t) for k, up, sx, sy, t in seq]
    ataque = {d: lunge(d) for d in DIRS}
    ataque['SE'] = atk_se; ataque['E'] = atk_se
    ataque['SW'] = mirror(atk_se); ataque['W'] = mirror(atk_se)

    # ---------------- habilidades e reações (movimento das poses) ----------------
    def consag(d):
        f = base[d]; out = []
        seq = [(0, 1, 1, None), (-6, 0.98, 1.04, 0.1), (-14, 0.97, 1.07, 0.2), (-18, 0.96, 1.08, 0.3), (-16, 0.97, 1.06, 0.35),
               (6, 1.08, 0.86, 0.6), (6, 1.08, 0.86, 0.5), (3, 1.05, 0.92, 0.3), (1, 1.02, 0.97, 0.15), (0, 1, 1, None)]
        for up, sx, sy, k in seq:
            out.append(xform(f, dy=up, sx=sx, sy=sy, tint=((255, 226, 140), k) if k else None))
        return out
    def protec(d):
        return [xform(base[d], sy=1 - 0.04 * math.sin(i / 5 * math.pi), tint=((255, 222, 120), 0.45 * math.sin(i / 5 * math.pi))) for i in range(6)]
    def dodge(d):
        vx, vy = SCREEN[d]
        src = walk[d][2]
        return [xform(src, dx=vx * 10 * math.sin((i + .5) / 4 * math.pi), dy=vy * 5 * math.sin((i + .5) / 4 * math.pi) + 6 * math.sin((i + .5) / 4 * math.pi),
                      sx=1 + 0.05 * math.sin((i + .5) / 4 * math.pi), sy=1 - 0.12 * math.sin((i + .5) / 4 * math.pi)) for i in range(4)]
    def hurt(d):
        vx, vy = SCREEN[d]
        return [xform(base[d], dx=-vx * 8 * k, dy=-vy * 4 * k, tint=((255, 70, 50), 0.55 * k)) for k in (1, 0.6, 0.2)]

    anims = {
        'idle': (idle, 5, True), 'walk': (walk, 11, True),
        'ataque': (ataque, 19, False), 'ataque2': (ataque, 19, False),
        'consagracao': ({d: consag(d) for d in DIRS}, 11, False),
        'protecao': ({d: protec(d) for d in DIRS}, 11, False),
        'esquiva': ({d: dodge(d) for d in DIRS}, 18, False),
        'dano': ({d: hurt(d) for d in DIRS}, 12, False),
    }
    meta = {'frame': FW, 'frameW': FW, 'frameH': FH, 'anchor': [AX, AY], 'dirs': DIRS, 'style': 'pintado', 'anims': {}}
    for name, (per_dir, fps, loop) in anims.items():
        n = max(len(v) for v in per_dir.values())
        sheet = np.zeros((FH * 8, FW * n, 4), np.uint8)
        for di, d in enumerate(DIRS):
            fr = resample(per_dir[d], n) if len(per_dir[d]) != n else per_dir[d]
            for k, f in enumerate(fr):
                sheet[di * FH:(di + 1) * FH, k * FW:(k + 1) * FW] = np.clip(f, 0, 255).astype(np.uint8)
        Image.fromarray(sheet, 'RGBA').save(f'{args.out}/{name}.webp', 'WEBP', quality=86, method=6)
        meta['anims'][name] = {'frames': n, 'fps': fps, 'loop': loop}
        print(name, n, 'quadros')
    json.dump(meta, open(f'{args.out}/sprites.json', 'w'), indent=2)


if __name__ == '__main__':
    main()
