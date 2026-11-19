#!/usr/bin/env python3
"""Seleção de heróis: recorta cada carta (hexágono) para o jogo destacar a escolhida,
apaga do painel de baixo o nome, a descrição, o estandarte e as barras pintadas,
e grava as caixas onde o jogo escreve.
  python3 tools/import-select.py docs/assets-ia/ui/selecao-herois.png src/assets/select [--check out.png]"""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
img = Image.open(src).convert('RGB'); W, H = img.size
im = np.asarray(img).astype(np.float32)
# cartas: (esquerda, direita, ponta de cima, ponta de baixo); ombros a 11% da altura
CARDS = [(262, 498, 140, 692), (514, 731, 166, 686), (747, 962, 172, 686), (976, 1186, 172, 686), (1199, 1424, 165, 690)]
def poly(c, pad=0):
    l, r, t, b = c; cx = (l + r) / 2; h = b - t; s = h * 0.115
    return [(cx, t - pad), (r + pad, t + s), (r + pad, b - s), (cx, b + pad), (l - pad, b - s), (l - pad, t + s)]
def fill_holes(arr, m, sig=(5, 12, 30, 70)):
    w = (~m).astype(np.float32)
    for s in sig:
        num = np.stack([ndimage.gaussian_filter(arr[..., c] * w, s) for c in range(3)], 2)
        den = ndimage.gaussian_filter(w, s)[..., None]
        ok = (den[..., 0] > 0.2) & m
        arr[ok] = (num / np.maximum(den, 1e-4))[ok]
        m = m & ~ok; w = (~m).astype(np.float32)
        if not m.any(): break
# 1) brilho laranja em volta da carta do Bra'kar (vira neutro; o jogo desenha o brilho na escolhida)
mask_cards = Image.new('L', (W, H), 0); d = ImageDraw.Draw(mask_cards)
for c in CARDS: d.polygon(poly(c, 2), fill=255)
inside = np.asarray(mask_cards) > 0
r, g, b = im[..., 0], im[..., 1], im[..., 2]
glow = np.zeros((H, W), bool)
l, rr, t, bb = CARDS[0]
reg = np.s_[t - 30:bb + 30, l - 30:rr + 30]
glow[reg] = (r[reg] > 150) & (g[reg] > 70) & (b[reg] < 0.6 * g[reg]) & (r[reg] > b[reg] + 90)
glow &= ~inside
glow = ndimage.binary_dilation(glow, iterations=3) & ~inside
fill_holes(im, glow)
# 2) cartas recortadas (com a moldura), cada uma num arquivo
meta = {'w': W, 'h': H, 'cards': []}
for k, c in enumerate(CARDS):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).polygon(poly(c, 3), fill=255)
    box = (int(c[0] - 6), int(c[2] - 6), int(c[1] + 6), int(c[3] + 6))
    rgba = Image.fromarray(np.dstack([np.asarray(img), np.asarray(m)]).astype(np.uint8), 'RGBA').crop(box)
    if k == 0:   # carta do Bra'kar: tira o brilho pintado dentro da moldura também? mantém (é a arte da carta)
        pass
    rgba.save(os.path.join(out, f'carta-{k + 1}.webp'), 'WEBP', quality=90, method=6)
    meta['cards'].append({'x': box[0], 'y': box[1], 'w': box[2] - box[0], 'h': box[3] - box[1], 'poly': [[round(x - box[0], 1), round(y - box[1], 1)] for x, y in poly(c, 3)]})
# 3) painel: apaga nome, descrição, estandarte e barras
lum = im.mean(2)
er = np.zeros((H, W), bool)
for (x0, y0, x1, y1) in [(392, 700, 760, 752), (392, 762, 1010, 830)]:
    er[y0:y1, x0:x1] = lum[y0:y1, x0:x1] > 105
er[690:840, 282:372] = True                     # estandarte vermelho
er[708:830, 1228:1370] = True                   # barras
er = ndimage.binary_dilation(er, iterations=3)
fill_holes(im, er, (4, 10, 24, 50))
Image.fromarray(im.clip(0, 255).astype(np.uint8)).save(os.path.join(out, 'fundo.webp'), 'WEBP', quality=86, method=6)
meta.update({'nome': [398, 702, 600, 50], 'desc': [398, 764, 600, 64], 'emblema': [285, 692, 84, 140],
             'barras': [1232, 712, 132, 116], 'stats': [[1232, 724], [1232, 754], [1232, 784], [1232, 814]],
             'setas': [[178, 372, 60, 90], [1440, 372, 60, 90]], 'confirmar': [585, 860, 252, 62], 'voltar': [860, 860, 228, 62]})
json.dump(meta, open(os.path.join(out, 'select.json'), 'w'), indent=1)
if '--check' in sys.argv:
    chk = Image.open(os.path.join(out, 'fundo.webp')).convert('RGB'); dd = ImageDraw.Draw(chk)
    for c in CARDS: dd.polygon(poly(c, 3), outline=(0, 255, 255))
    chk.save(sys.argv[sys.argv.index('--check') + 1])
print('ok')
