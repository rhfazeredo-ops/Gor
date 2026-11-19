#!/usr/bin/env python3
"""Pinta um modelo 3D sem textura (GLB do Tripo) com as imagens de referência (fundo liso):
projeta as cores de cada vista (lado, frente, costas) nos vértices visíveis nela, pesando pela
normal; o outro lado usa a imagem de lado espelhada. Grava as cores por vértice (float32 RGB).
  python3 tools/pintar-modelo.py modelo.glb lado.png frente.png costas.png saida.bin
Convenção: cabeça em +Z, cauda em -Z; a imagem de lado mostra o lado -X (cabeça à direita)."""
import sys, json, struct
import numpy as np
from PIL import Image
glb, lado, frente, costas, out = sys.argv[1:6]
d = open(glb, 'rb').read()
L = struct.unpack('<I', d[12:16])[0]; J = json.loads(d[20:20 + L]); B = 20 + L + 8
def acc(i, comps):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]
    dt = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']]
    return np.frombuffer(d, dt, a['count'] * comps, B + bv.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, comps) if comps > 1 else np.frombuffer(d, dt, a['count'], B + bv.get('byteOffset', 0) + a.get('byteOffset', 0))
pr = J['meshes'][0]['primitives'][0]
P = acc(pr['attributes']['POSITION'], 3).astype(np.float64); N = acc(pr['attributes']['NORMAL'], 3).astype(np.float64)
T = acc(pr['indices'], 1).astype(np.int64).reshape(-1, 3)

def subject_box(img):
    a = np.asarray(img).astype(np.int16); bg = np.median(np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3)]), 0)
    m = np.abs(a - bg).max(2) > 28
    ys, xs = np.where(m); return xs.min(), xs.max(), ys.min(), ys.max(), m

R = 700
def zbuffer(u, v, z):
    """rasteriza os triângulos numa grade RxR (u,v em 0..1, z: menor = mais perto)."""
    zb = np.full((R, R), np.inf)
    U = u * (R - 1); V = v * (R - 1)
    for a, b, c in T:
        xs = np.array([U[a], U[b], U[c]]); ys = np.array([V[a], V[b], V[c]]); zs = np.array([z[a], z[b], z[c]])
        x0, x1 = int(max(0, np.floor(xs.min()))), int(min(R - 1, np.ceil(xs.max()))); y0, y1 = int(max(0, np.floor(ys.min()))), int(min(R - 1, np.ceil(ys.max())))
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        den = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(den) < 1e-12: continue
        w0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / den
        w1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / den
        w2 = 1 - w0 - w1
        ins = (w0 >= -0.01) & (w1 >= -0.01) & (w2 >= -0.01)
        zz = w0 * zs[0] + w1 * zs[1] + w2 * zs[2]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        np.minimum(sub, np.where(ins, zz, np.inf), out=sub)
    return zb

# vistas: (imagem, espelhar, eixo horizontal da tela, sinal, profundidade (menor=perto), direção da câmera)
views = [
    (lado, False, 2, +1, P[:, 0], np.array([-1, 0, 0])),     # câmera em -X: direita = +Z
    (lado, True, 2, -1, -P[:, 0], np.array([1, 0, 0])),      # câmera em +X: direita = -Z (imagem espelhada)
    (frente, False, 0, +1, -P[:, 2], np.array([0, 0, 1])),   # câmera em +Z: direita = +X
    (costas, False, 0, -1, P[:, 2], np.array([0, 0, -1])),   # câmera em -Z: direita = -X
]
acc_c = np.zeros((len(P), 3)); acc_w = np.zeros(len(P))
for path, mirror, ax, sg, depth, cam in views:
    img = Image.open(path).convert('RGB')
    if mirror: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    bx0, bx1, by0, by1, mask = subject_box(img); A = np.asarray(img).astype(np.float64)
    h = sg * P[:, ax]; y = P[:, 1]
    u = (h - h.min()) / (h.max() - h.min()); v = 1 - (y - y.min()) / (y.max() - y.min())
    zb = zbuffer(u, v, depth)
    # visível: perto do z-buffer naquele ponto (com tolerância)
    ui = np.clip((u * (R - 1)).round().astype(int), 0, R - 1); vi = np.clip((v * (R - 1)).round().astype(int), 0, R - 1)
    span = depth.max() - depth.min()
    vis = depth <= zb[vi, ui] + span * 0.02
    px = bx0 + u * (bx1 - bx0); py = by0 + v * (by1 - by0)
    col = A[np.clip(py.round().astype(int), 0, A.shape[0] - 1), np.clip(px.round().astype(int), 0, A.shape[1] - 1)]
    # amostra num pequeno raio (evita pegar só o contorno preto)
    for dx, dy in ((3, 0), (-3, 0), (0, 3), (0, -3)):
        col = col + A[np.clip((py + dy).round().astype(int), 0, A.shape[0] - 1), np.clip((px + dx).round().astype(int), 0, A.shape[1] - 1)]
    col /= 5
    inm = mask[np.clip(py.round().astype(int), 0, A.shape[0] - 1), np.clip(px.round().astype(int), 0, A.shape[1] - 1)]
    w = np.clip(-(N @ cam), 0, 1) ** 2 + 0.05     # normal virada para a câmera pesa mais
    w = w * vis * inm
    acc_c += col * w[:, None]; acc_w += w
    print(path.split('/')[-1], 'mirror' if mirror else '', 'visíveis', int(vis.sum()))
# vértices sem nenhuma vista: média dos vizinhos (algumas passadas)
C = np.where(acc_w[:, None] > 0, acc_c / np.maximum(acc_w, 1e-9)[:, None], np.nan)
nb = [[] for _ in range(len(P))]
for a, b, c in T: nb[a] += [b, c]; nb[b] += [a, c]; nb[c] += [a, b]
for _ in range(30):
    miss = np.where(np.isnan(C[:, 0]))[0]
    if not len(miss): break
    for i in miss:
        vals = C[nb[i]]; vals = vals[~np.isnan(vals[:, 0])]
        if len(vals): C[i] = vals.mean(0)
C = np.nan_to_num(C, nan=110.0)
# suaviza um pouco e realça (contornos da arte viram manchas escuras demais)
for _ in range(1):
    C = np.array([(C[i] * 2 + C[nb[i]].mean(0)) / 3 if nb[i] else C[i] for i in range(len(P))])
lum = C.mean(1, keepdims=True); C = np.clip(lum + (C - lum) * 1.15, 0, 255)
(C / 255).astype('<f4').tofile(out)
print('ok', len(P), 'vértices')
