#!/usr/bin/env python3
"""Recorta o kit de interface de diálogo (fundo verde), apaga os textos pintados
e grava cada painel + as caixas onde o jogo escreve os textos.
  python3 tools/import-ui-kit.py docs/assets-ia/ui/dialogo-kit.png src/assets/ui-kit"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
al = np.clip(1 - ((g - np.maximum(r, b)) - 40) / 60, 0, 1)
rgb = im.copy(); rgb[..., 1] = np.minimum(g, np.maximum(r, b) * 1.05 + 4)
lum = rgb.mean(2)

def erase(x0, y0, x1, y1, mode, sigma=10):
    """Apaga o que for texto dentro do retângulo e preenche com a textura em volta (convolução normalizada)."""
    sub = rgb[y0:y1, x0:x1]; L = lum[y0:y1, x0:x1]
    if mode == 'escuro':                       # tinta escura sobre pergaminho
        m = L < 165
    elif mode == 'claro':                      # letra clara (com contorno) sobre faixa escura
        m = L > 80
    else:                                      # tudo que não é pergaminho (destaque, linhas, texto)
        med = np.median(sub.reshape(-1, 3), 0)
        m = np.abs(sub - med).sum(2) > 70
    m = ndimage.binary_dilation(m, iterations=5 if mode == 'claro' else 3)
    w = (~m).astype(np.float32)
    for s in (sigma, sigma * 2.5, sigma * 6):
        num = np.stack([ndimage.gaussian_filter(sub[..., c] * w, s) for c in range(3)], 2)
        den = ndimage.gaussian_filter(w, s)[..., None]
        fill = num / np.maximum(den, 1e-4)
        ok = (den[..., 0] > 0.15) & m
        sub[ok] = fill[ok]; m = m & ~ok; w = (~m).astype(np.float32)
        if not m.any(): break

PANELS = {
  # nome: caixa do painel, retângulos a apagar, caixas de texto (coordenadas da arte)
  'dialogo': {'box': (8, 0, 1148, 390), 'erase': [((432, 78, 690, 138), 'claro'), ((425, 180, 1035, 310), 'escuro', 8)],
              'text': {'nome': (440, 80, 690, 136), 'fala': (440, 180, 1030, 330)}},
  'missao': {'box': (48, 388, 1078, 578), 'erase': [((262, 445, 990, 520), 'claro')], 'text': {'titulo': (262, 445, 990, 520)}},
  'escolhas': {'box': (22, 578, 1078, 872), 'erase': [((278, 628, 1012, 818), 'pergaminho', 8)], 'text': {'opcoes': (285, 635, 1005, 815)}},
  'info': {'box': (1160, 14, 1760, 664), 'erase': [((1290, 180, 1630, 245), 'escuro'), ((1300, 258, 1630, 345), 'escuro')],
           'text': {'titulo': (1280, 180, 1640, 245), 'texto': (1270, 255, 1650, 350), 'item': (1380, 358, 1540, 506), 'ok': (1325, 525, 1595, 600)}},
  'dica': {'box': (1106, 682, 1760, 858), 'erase': [((1272, 720, 1690, 812), 'escuro')], 'text': {'texto': (1278, 718, 1700, 815)}},
}
meta = {}
for name, P in PANELS.items():
    for e in P['erase']:
        (x0, y0, x1, y1), mode = e[0], e[1]
        erase(x0, y0, x1, y1, mode, *(e[2:] or []))
for name, P in PANELS.items():
    x0, y0, x1, y1 = P['box']
    a = (al[y0:y1, x0:x1] * 255).astype(np.uint8)
    Image.fromarray(np.dstack([rgb[y0:y1, x0:x1].clip(0, 255).astype(np.uint8), a]), 'RGBA').save(os.path.join(out, name + '.webp'), 'WEBP', quality=90, method=6)
    meta[name] = {'w': x1 - x0, 'h': y1 - y0, 'text': {k: [v[0] - x0, v[1] - y0, v[2] - v[0], v[3] - v[1]] for k, v in P['text'].items()}}
json.dump(meta, open(os.path.join(out, 'kit.json'), 'w'), indent=1)
print('ok')
