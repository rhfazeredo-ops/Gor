#!/usr/bin/env python3
"""Mede a base (pegada no chão) de cada asset e grava em manifest.json:
foot = {x0, x1, front} em pixels — colunas onde o objeto é 'alto' (ignora
pedrinhas soltas) e a linha mais baixa entre elas."""
import json, sys, os
import numpy as np
from PIL import Image
d = sys.argv[1]; mp = os.path.join(d, 'manifest.json'); m = json.load(open(mp))
for name, pieces in m.items():
    for p in pieces:
        a = np.asarray(Image.open(os.path.join(d, p['file'])).convert('RGBA'))[..., 3] > 128
        H, W = a.shape
        cnt = a.sum(0)
        cols = np.where(cnt > H * 0.18)[0]
        if len(cols) < 3: cols = np.where(cnt > 0)[0]
        x0, x1 = int(cols.min()), int(cols.max())
        low = [np.where(a[:, c])[0].max() for c in cols]
        p['foot'] = {'x0': x0, 'x1': x1, 'front': int(np.percentile(low, 90))}
json.dump(m, open(mp, 'w'), indent=1)
print('ok')
