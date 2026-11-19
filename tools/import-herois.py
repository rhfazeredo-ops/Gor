#!/usr/bin/env python3
"""Tela de seleção de heróis (arte do usuário).
  base: tela vazia → fundo.webp (painel da direita limpo, slot 1 sem brilho)
  arte: mesma tela com o herói no meio → <id>-arte.webp (só o herói, por diferença com a base)
  exemplo: tela com estandarte → estandarte-<raca>.webp (fundo + estandarte, sem o herói)
  recortes do herói: retrato do slot, ícone da classe, emblema e 3 habilidades
  python3 tools/import-herois.py base.png arte.png exemplo.png dalarian humanos src/assets/herois"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
base_p, arte_p, ex_p, hid, raca, out = sys.argv[1:7]
B = np.asarray(Image.open(base_p).convert('RGB')).astype(np.float32)
A = np.asarray(Image.open(arte_p).convert('RGB')).astype(np.float32)
E = np.asarray(Image.open(ex_p).convert('RGB')).astype(np.float32)
H, W, _ = B.shape
def fill(arr, m, sig=(4, 10, 24, 60, 140)):
    w = (~m).astype(np.float32)
    for s in sig:
        num = np.stack([ndimage.gaussian_filter(arr[..., c] * w, s) for c in range(3)], 2)
        den = ndimage.gaussian_filter(w, s)[..., None]
        ok = (den[..., 0] > 0.2) & m
        arr[ok] = (num / np.maximum(den, 1e-4))[ok]; m = m & ~ok; w = (~m).astype(np.float32)
        if not m.any(): break
    return arr
save = lambda arr, name, q=88: Image.fromarray(arr.clip(0, 255).astype(np.uint8)).save(os.path.join(out, name), 'WEBP', quality=q, method=6)
def save_rgba(rgb, a, name):
    Image.fromarray(np.dstack([rgb.clip(0, 255), (a * 255).clip(0, 255)]).astype(np.uint8), 'RGBA').save(os.path.join(out, name), 'WEBP', quality=90, method=6)

# --- herói: diferença entre a tela com o herói e a base (só na faixa do meio) ---
d = np.abs(A - B).max(2)
reg = np.zeros((H, W), bool); reg[60:, 470:1135] = True
hero = (d > 28) & reg
hero = ndimage.binary_closing(hero, iterations=3)
hero = ndimage.binary_fill_holes(hero)
lab, n = ndimage.label(hero); sizes = ndimage.sum(hero, lab, range(1, n + 1))
hero = lab == (np.argmax(sizes) + 1)
ha = ndimage.gaussian_filter(hero.astype(np.float32), 1.0)
ys, xs = np.where(hero); y0, y1, x0, x1 = ys.min(), H, xs.min() - 4, xs.max() + 5
save_rgba(A[y0:y1, x0:x1], ha[y0:y1, x0:x1], f'{hid}-arte.webp')
art_box = (int(x0), int(y0), int(x1 - x0), int(y1 - y0))

# --- estandarte da raça: exemplo menos base (sem o herói), buracos atrás do herói preenchidos ---
X0B, X1B = 478, 1128
reg2 = np.zeros((H, W)); reg2[:, X0B:X1B] = 1
# bordas suaves dos lados (some no fundo, sem corte reto)
ramp = np.clip(np.minimum(np.arange(W) - X0B, X1B - np.arange(W)) / 90, 0, 1)
reg2 *= ramp[None, :]
heroE = ndimage.binary_dilation(hero, iterations=3)
ban = E.copy(); ban = fill(ban, heroE.copy())
dd = np.abs(ban - B).max(2)
ba = np.clip((dd - 6) / 30, 0, 1) * reg2
ba = ndimage.gaussian_filter(ba, 2)
save_rgba(ban[:, X0B:X1B], ba[:, X0B:X1B], f'estandarte-{raca}.webp')

# --- recortes: retrato do slot, ícone da classe (do exemplo), emblema e habilidades (da base) ---
Image.fromarray(E[183:303, 32:192].astype(np.uint8)).save(os.path.join(out, f'{hid}-slot.webp'), 'WEBP', quality=90)
crop_rgba = lambda arr, box: Image.fromarray(arr[box[1]:box[3], box[0]:box[2]].astype(np.uint8))
crop_rgba(E, (196, 205, 262, 275)).save(os.path.join(out, f'{hid}-classe.webp'), 'WEBP', quality=90)
crop_rgba(B, (1164, 133, 1276, 257)).save(os.path.join(out, f'{hid}-emblema.webp'), 'WEBP', quality=90)
for i, x in enumerate((1195, 1339, 1482)):
    crop_rgba(B, (x, 600, x + 116, 718)).save(os.path.join(out, f'{hid}-hab{i + 1}.webp'), 'WEBP', quality=90)

# rótulos dos atributos (ícone + nome), iguais para todos os heróis
crop_rgba(B, (1170, 418, 1362, 578)).save(os.path.join(out, 'atributos.webp'), 'WEBP', quality=90)

# --- fundo: painel da direita sem o conteúdo do Dalárian; slot 1 sem brilho (vira o slot 2 copiado) ---
F = B.copy()
inner = np.zeros((H, W), bool); inner[134:722, 1146:1640] = True
# interior do painel: degradê liso com a cor do próprio painel (topo e base)
top = np.median(B[128:134, 1150:1630].reshape(-1, 3), 0); bot = np.median(B[728:740, 1150:1630].reshape(-1, 3), 0)
t = ((np.arange(H) - 134) / (722 - 134)).clip(0, 1)[:, None]
grad = top * (1 - t) + bot * t
F[134:722, 1146:1640] = grad[134:722][:, None, :]
# slots: todos iguais ao slot 2 (o jogo desenha o brilho no escolhido)
# slot 1 (com brilho pintado) vira cópia do slot 2; a faixa em volta vira o fundo liso
F[150:316, 10:490] = B[150:151, 10:490]
F[316 - 140:436 - 140, 10:490] = B[316:436, 10:490]
save(F, 'fundo.webp')
import json
json.dump({'w': W, 'h': H, 'arte': {hid: art_box}}, open(os.path.join(out, 'telas.json'), 'w'))
print('ok', art_box)
