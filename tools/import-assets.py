#!/usr/bin/env python3
"""
Importa assets pintados por IA (fundo verde) para o jogo, sem perder resolução.

  python3 tools/import-assets.py docs/assets-ia/deserto src/assets/deserto

Para cada PNG da pasta: remove o verde (borda suave, sem reflexo verde),
separa as peças (folhas com vários itens), recorta cada uma, acha o ponto de
apoio (centro da base) e grava <nome>-<n>.webp + manifest.json.
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
MAXW = 1000                                  # limite de largura gravada (px)
man = {}
for f in sorted(os.listdir(src)):
    if not f.endswith(('.png', '.webp')): continue
    name = f.rsplit('.', 1)[0].split('@')[0]
    a = np.asarray(Image.open(os.path.join(src, f)).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b)
    al = np.clip(1 - (green - 40) / 60, 0, 1)
    # tira o reflexo verde nas bordas
    rgb = a.copy(); rgb[..., 1] = np.minimum(g, np.maximum(r, b) * 1.05 + 4)
    solid = al > 0.5
    # agrupa partes próximas (pedrinhas em volta de um item)
    H, W = solid.shape
    # distância de agrupamento: padrão 2,2% da imagem; folhas densas usam "nome@d8.png" (8 px)
    d = int(f.split('@d')[1].split('.')[0]) if '@d' in f else max(6, int(min(H, W) * 0.022))
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=d))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    big = sizes.max() if n else 0
    items = []
    for k, sl in enumerate(ndimage.find_objects(lab)):
        if sizes[k] < big * 0.04 or sizes[k] < 600: continue
        m = (lab[sl] == k + 1) & solid[sl]
        ys, xs = np.where(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        sub_a = (al[sl][y0:y1, x0:x1] * (lab[sl][y0:y1, x0:x1] == k + 1))
        sub = np.dstack([rgb[sl][y0:y1, x0:x1], sub_a * 255]).clip(0, 255).astype(np.uint8)
        top = sl[0].start + y0; left = sl[1].start + x0
        items.append((top // (H // 4), left, sub))
    items.sort(key=lambda t: (t[0], t[1]))
    man[name] = []
    for i, (_, _, sub) in enumerate(items):
        im = Image.fromarray(sub, 'RGBA')
        if im.width > MAXW: im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
        A = np.asarray(im)[..., 3] > 128
        rows = np.where(A.any(1))[0]; foot = int(rows.max())
        band = A[max(0, foot - max(4, A.shape[0] // 12)):foot + 1]
        xs = np.where(band.any(0))[0]
        fn = f'{name}-{i + 1}.webp'
        im.save(os.path.join(out, fn), 'WEBP', quality=88, method=6)
        man[name].append({'file': fn, 'w': im.width, 'h': im.height, 'ax': int((xs.min() + xs.max()) / 2), 'ay': foot, 'base': int(xs.max() - xs.min())})
    print(name, len(items), 'peças')
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
