#!/usr/bin/env python3
"""Reduz as peças para ~4x o tamanho em que aparecem no jogo (as medidas do
manifest continuam na escala original; 'res' guarda a fração real da imagem).
  python3 tools/shrink-assets.py src/assets/deserto"""
import json, sys, os
from PIL import Image
# escala de desenho por tipo (igual a KIND em src/iso/bigdesert.js)
S = {'paredao': .36, 'pico': .33, 'rochedo': .31, 'ruina': .39, 'lago': .28, 'arvore': .19, 'arbusto': .1, 'grama': .075,
     'flores': .09, 'rochas': .14, 'ossos': .12, 'estandarte': .17, 'pilar': .2, 'pedras': .14, 'agua': .28}
def kind(n):
    if n.startswith('itens-2'): return 'ossos'
    if n.startswith('itens-1-3'): return 'rochas'
    if n.startswith('itens-1-4'): return 'arbusto'
    if n.startswith('itens-1-2'): return 'grama'
    return n.split('-')[0]
SERIES = {'arvore-7': .38, 'arbusto-7': .3, 'grama-5': .28, 'pedras-1': .16}   # igual a SERIES em bigdesert.js
d = sys.argv[1]; mp = os.path.join(d, 'manifest.json'); m = json.load(open(mp))
for name, pieces in m.items():
    s = SERIES.get(name, S.get(kind(name), .2)) * 1.3            # folga para peças desenhadas maiores (o = {s})
    for p in pieces:
        want = max(64, round(p['w'] * s * 4))
        f = os.path.join(d, p['file']); im = Image.open(f)
        if im.width <= want * 1.05: continue
        im.resize((want, round(im.height * want / im.width)), Image.LANCZOS).save(f, 'WEBP', quality=88, method=6)
        p['res'] = want / p['w']
json.dump(m, open(mp, 'w'), indent=1)
print('ok')
