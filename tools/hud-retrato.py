#!/usr/bin/env python3
"""Troca o retrato do HUD pelo da carta de seleção.
Dentro do círculo: rosto recortado da carta. O cabelo antigo que passava por cima
da moldura (no alto) é substituído pela moldura girada 90° (o lado esquerdo, limpo).
  python3 tools/hud-retrato.py hud.png carta.webp saida.png [cx cy r] [crop x0 y0 lado]"""
import sys
import numpy as np
from PIL import Image
hud, carta, out = sys.argv[1:4]
CX, CY, R = 358, 300, 240                      # círculo interno do retrato (arte 2172x724)
CROP = (0, 30, 284)                            # quadrado na carta: x0, y0, lado
a = np.asarray(Image.open(hud).convert('RGB')).copy()
H, W, _ = a.shape
yy, xx = np.mgrid[0:H, 0:W]
dx, dy = xx - CX, yy - CY
rr = np.hypot(dx, dy); ang = np.degrees(np.arctan2(dy, dx))     # -90 = para cima
# 1) moldura no alto: copia do lado esquerdo girado 90° (cima ← esquerda)
top = (rr > R - 4) & (rr < 365) & (ang > -150) & (ang < -30) & (yy < CY)
sx = (CX + dy).astype(int); sy = (CY - dx).astype(int)          # gira -90°: (dx,dy) -> (dy,-dx)
ok = top & (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
a[ok] = a[sy[ok], sx[ok]]
# 2) rosto da carta dentro do círculo
c = Image.open(carta).convert('RGBA')
x0, y0, L = CROP
face = c.crop((x0, y0, x0 + L, y0 + L)).resize((2 * R, 2 * R), Image.LANCZOS)
f = np.asarray(face).astype(np.float32)
disk = rr < R
fy, fx = (yy - (CY - R)).clip(0, 2 * R - 1), (xx - (CX - R)).clip(0, 2 * R - 1)
al = f[fy, fx, 3:4] / 255
bg = np.array([40, 30, 45], np.float32)
px = f[fy, fx, :3] * al + bg * (1 - al)
# borda escura suave por dentro do anel
edge = np.clip((rr - (R - 18)) / 18, 0, 1)[..., None]
px = px * (1 - 0.55 * edge)
a[disk] = px[disk].astype(np.uint8)
Image.fromarray(a).save(out)
print('ok')
