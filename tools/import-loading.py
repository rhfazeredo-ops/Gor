#!/usr/bin/env python3
"""Barra de carregamento pintada: separa a moldura (com a estrela por cima) do canal da barra.
Grava moldura.webp (canal transparente), fill.webp (faixa dourada listrada na largura do canal,
feita repetindo um trecho da arte) e barra.json (caixa do canal). Também copia o fundo.
  python3 tools/import-loading.py barra.png fundo.png src/assets/loading"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
bar, bg, out = sys.argv[1:4]
a = np.asarray(Image.open(bar).convert('RGB')).astype(np.float32)
H, W, _ = a.shape
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = a.mean(2)
alpha = np.clip(1 - ((g - np.maximum(r, b)) - 40) / 60, 0, 1)
rgb = a.copy(); rgb[..., 1] = np.minimum(g, np.maximum(r, b) * 1.05 + 4)
X0, X1, Y0, Y1 = 272, 1894, 349, 458                      # canal (medido)
rect = np.zeros((H, W), bool); rect[Y0:Y1, X0:X1] = True
# estrela: partes claras ligadas ao que está acima do canal, perto do centro
light = lum > 55
lab, n = ndimage.label(light)
cx = (X0 + X1) // 2
star_ids = set(np.unique(lab[Y0 - 3, cx - 160:cx + 160])) - {0}
star = np.isin(lab, list(star_ids)) & rect & (np.abs(np.arange(W) - cx) < 170)[None, :]
star = ndimage.binary_dilation(star, iterations=2) & rect
chan = rect & ~star
# canto arredondado: só o que não é contorno preto vira canal
chan &= lum > 22
fa = alpha.copy(); fa[chan] = 0
k = 0.5
frame = Image.fromarray(np.dstack([rgb, fa * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
frame = frame.resize((int(W * k), int(H * k)), Image.LANCZOS)
frame.save(os.path.join(out, 'moldura.webp'), 'WEBP', quality=90)
# faixa dourada: trecho listrado repetido (período achado por autocorrelação)
row = lum[Y0 + 30, 400:1300] - lum[Y0 + 30, 400:1300].mean()
ac = np.correlate(row, row, 'full')[len(row):]
P = int(np.argmax(ac[80:400]) + 80)
seg = rgb[Y0:Y1, 420:420 + P]
reps = (X1 - X0) // P + 2
strip = np.concatenate([seg] * reps, axis=1)[:, :X1 - X0]

Image.fromarray(seg.clip(0, 255).astype(np.uint8)).save(os.path.join(out, 'fill-tile.webp'), 'WEBP', quality=90)   # um período, para repetir/animar
json.dump({'w': int(W * k), 'h': int(H * k), 'chan': [round(X0 * k), round(Y0 * k), round((X1 - X0) * k), round((Y1 - Y0) * k)], 'periodo': P},
          open(os.path.join(out, 'barra.json'), 'w'))
Image.open(bg).convert('RGB').save(os.path.join(out, 'fundo.webp'), 'WEBP', quality=86, method=6)
print('ok periodo', P)
