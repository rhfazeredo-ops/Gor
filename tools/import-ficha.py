#!/usr/bin/env python3
"""Recorta de uma ficha de personagem (fundo verde) o corpo inteiro em pé (o maior, no meio)
e o rosto (do busto grande à esquerda) para a tela de Heróis.
  python3 tools/import-ficha.py ficha.png id saida_dir [split_x]
Gera <id>-arte.png (corpo, RGBA) e <id>-rosto.png (busto, RGBA)."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
src, hid, out = sys.argv[1:4]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = a.shape
r, g, b = a[..., 0], a[..., 1], a[..., 2]
alpha = np.clip(1 - ((g - np.maximum(r, b)) - 20) / 45, 0, 1)
rgb = a.copy(); rgb[..., 1] = np.minimum(g, np.maximum(r, b) * 1.05 + 4)   # tira o reflexo verde
fg = alpha > 0.5
lab, n = ndimage.label(ndimage.binary_opening(fg, iterations=2))
sizes = ndimage.sum(fg, lab, range(1, n + 1))
OB = ndimage.find_objects(lab)
grandes = [i + 1 for i in range(n) if sizes[i] > 50000 and OB[i][1].start < W * 0.45 and OB[i][0].start < H * 0.3]
main = grandes[0]
m = np.isin(lab, grandes)
# corpo e busto encostados: distância geodésica (dentro do desenho) a um ponto no rosto e outro no tronco;
# cada pixel fica com o mais próximo. Pontos em fração da imagem (argumentos ou padrão).
from scipy.sparse import csgraph, coo_matrix
# sementes: argv[4] = busto "x,y;x,y", argv[5] = corpo "x,y;x,y" (frações da imagem)
P = lambda t: [tuple(float(v) for v in p.split(',')) for p in t.split(';')]
FACE = P(sys.argv[4] if len(sys.argv) > 4 else '0.10,0.25;0.08,0.55;0.18,0.62')
BODY = P(sys.argv[5] if len(sys.argv) > 5 else '0.38,0.45;0.36,0.70;0.36,0.76')
k = 4; ms = m[::k, ::k]; h, w = ms.shape; idx = -np.ones((h, w), int); pts = np.argwhere(ms); idx[ms] = np.arange(len(pts))
rows, cols = [], []
for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
    a1 = idx[max(0, -dy):h - max(0, dy), max(0, -dx):w - max(0, dx)]; a2 = idx[max(0, dy):, max(0, dx):][:a1.shape[0], :a1.shape[1]]
    ok = (a1 >= 0) & (a2 >= 0); rows += list(a1[ok]); cols += list(a2[ok])
G = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(len(pts), len(pts)))
def seed(px, py):
    y, x = int(py * H / k), int(px * W / k); d = np.hypot(pts[:, 0] - y, pts[:, 1] - x); return int(np.argmin(d))
seeds = [seed(*p) for p in FACE] + [seed(*p) for p in BODY]
dist = csgraph.dijkstra(G, directed=False, indices=seeds)
cl = (np.argmin(dist, 0) >= len(FACE)).astype(int)        # 1 = corpo
cl[np.isinf(dist.min(0))] = 0
lbl = np.full((h, w), -1); lbl[ms] = cl
up = np.kron(lbl, np.ones((k, k), int))[:H, :W]
face = m & (up == 0); body = m & (up == 1)
# fica com a maior parte ligada de cada (some pedaços soltos, como as cabecinhas de expressão)
def maior(x):
    l, k = ndimage.label(ndimage.binary_dilation(x, iterations=2))
    if k < 2: return x
    j = 1 + int(np.argmax(ndimage.sum(x, l, range(1, k + 1)))); return x & (l == j)
body = maior(body); face = maior(face)
# outros pedaços do corpo soltos (arma separada etc.) perto do corpo
ys, xs = np.where(body); bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
for i in range(1, n + 1):
    if i in grandes: continue
    if OB[i - 1][0].start > H * 0.72: continue        # fileira de expressões embaixo
    sl = ndimage.find_objects(lab)[i - 1]
    if sl[1].start > bx0 - 20 and sl[1].stop < bx1 + 140 and sl[0].start >= by0 - 20 and sl[0].stop <= by1 + 20 and sizes[i - 1] > 2000 and sl[1].stop < W * 0.55:
        body |= lab == i
# fileira de expressões: caixa a apagar (frações x0,y0,x1,y1; padrão embaixo à esquerda)
cb = [float(v) for v in __import__('os').environ.get('CORTE_BOX', '0,0.80,0.33,1').split(',')]
for j in range(0, len(cb), 4): body[int(H * cb[j + 1]):int(H * cb[j + 3]), int(W * cb[j]):int(W * cb[j + 2])] = False
# zona ambígua opcional (argv[6] = "x1,y1"): ali só fica no corpo o que tem cor de lâmina brilhante
if len(sys.argv) > 6:
    zx, zy = (float(v) for v in sys.argv[6].split(','))
    Z = np.zeros((H, W), bool); Z[:int(H * zy), :int(W * zx)] = True
    lam = (a.mean(2) > 125) & (np.minimum(r, b) - g > 25)
    lam = ndimage.binary_closing(lam, iterations=3) & m
    body = (body & ~Z) | (Z & lam & ndimage.binary_dilation(body | lam, iterations=1))
    body = maior(body); face = m & ~body; face = maior(face)
def save(mask, name):
    mm = ndimage.binary_dilation(mask, iterations=2) & (alpha > 0.02)
    ys, xs = np.where(mm); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    al = (alpha * mm)[y0:y1, x0:x1]
    Image.fromarray(np.dstack([rgb[y0:y1, x0:x1], al * 255]).clip(0, 255).astype(np.uint8), 'RGBA').save(f'{out}/{hid}-{name}.png')
    return (int(x0), int(y0), int(x1 - x0), int(y1 - y0))
print(hid, 'corpo', save(body, 'corpo'), 'rosto', save(face, 'rosto'))
