#!/usr/bin/env python3
"""Tela inicial: apaga o menu pintado na arte (textos, pincel vermelho, divisórias)
e guarda o pincel separado, para o jogo desenhar um menu de verdade por cima.
  python3 tools/import-title.py docs/assets-ia/ui/tela-inicial.png src/assets/title"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
k = W / 1672
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = im.mean(2)
X0, Y0, X1, Y1 = [round(v * k) for v in (585, 598, 1090, 900)]       # área do menu
red = (r > 110) & (g < 0.55 * r) & (b < 0.55 * r)
redL = (r > 60) & (g < 0.5 * r) & (b < 0.5 * r)          # vermelho escuro/esfumado (só na faixa do pincel)
# pincel: só o vermelho em volta do primeiro item
bx0, by0, bx1, by1 = [round(v * k) for v in (590, 600, 1080, 668)]
sub = ndimage.binary_closing(redL[by0:by1, bx0:bx1], iterations=3)
sub = ndimage.binary_fill_holes(sub)
col = im[by0:by1, bx0:bx1].copy()
txt = sub & ~redL[by0:by1, bx0:bx1]                     # letras do "Iniciar": pinta com o vermelho em volta
wr = redL[by0:by1, bx0:bx1].astype(np.float32)
for c in range(3):
    fillc = ndimage.gaussian_filter(col[..., c] * wr, 8) / np.maximum(ndimage.gaussian_filter(wr, 8), 1e-4)
    col[..., c][txt] = fillc[txt]
a = ndimage.gaussian_filter(sub.astype(np.float32), 1.2)
brush = np.dstack([col, np.clip(a * 255, 0, 255)]).astype(np.uint8)
Image.fromarray(brush, 'RGBA').save(os.path.join(out, 'pincel.webp'), 'WEBP', quality=90)
# apaga o menu: texto claro, pincel vermelho, divisórias douradas
m = np.zeros((H, W), bool)
reg = np.s_[Y0:Y1, X0:X1]
m[reg] = (lum[reg] > 120) | red[reg] | ((r[reg] > 120) & (r[reg] > b[reg] * 1.6) & (lum[reg] > 90))
bb = np.s_[by0:by1, bx0:bx1]
m[bb] |= ndimage.binary_fill_holes(ndimage.binary_closing(redL[bb], iterations=3))
m = ndimage.binary_dilation(m, iterations=4)
w = (~m).astype(np.float32); out_im = im.copy()
for s in (6, 14, 30, 60):
    num = np.stack([ndimage.gaussian_filter(out_im[..., c] * w, s) for c in range(3)], 2)
    den = ndimage.gaussian_filter(w, s)[..., None]
    ok = (den[..., 0] > 0.2) & m
    out_im[ok] = (num / np.maximum(den, 1e-4))[ok]
    m &= ~ok; w = (~m).astype(np.float32)
    if not m.any(): break
# um pouco de grão para não ficar liso demais onde foi preenchido
rng = np.random.default_rng(1)
filled = ndimage.binary_dilation((lum > 0), iterations=0)
Image.fromarray(out_im.clip(0, 255).astype(np.uint8)).save(os.path.join(out, 'tela-inicial.webp'), 'WEBP', quality=86, method=6)
json.dump({'w': W, 'h': H, 'menu': {'cx': round(836 * k), 'ys': [round(v * k) for v in (635, 693, 752, 810, 869)]}, 'brush': [bx1 - bx0, by1 - by0]},
          open(os.path.join(out, 'title.json'), 'w'))
print('ok')
