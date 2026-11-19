# Importa o HUD pintado (fundo verde) e separa as camadas para o jogo:
#   base.webp   moldura + retrato + barras vazias (sem números)
#   hp/mp/en.webp  preenchimento de cada barra (o jogo recorta pela porcentagem)
#   hud.json    caixas das barras, do nível e dos 4 espaços de habilidade
# Uso: python3 tools/import-hud.py docs/assets-ia/ui/hud-dalarian.png src/assets/hud
import sys, json, os
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
im = np.array(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(2), im.min(2)
sat = (mx - mn) / (mx + 1e-6)

# --- chroma key (alfa suave + tira o verde das bordas) ---
green = g - np.maximum(r, b)
alpha = np.clip(1 - (green - 40) / 80, 0, 1)
rgb = im.copy()
spill = np.maximum(0, g - np.maximum(r, b))
rgb[..., 1] -= spill * (1 - alpha) * 0 + np.minimum(spill, np.maximum(0, g - (r + b) / 2)) * (alpha < 1)
alpha_u8 = (alpha * 255).astype(np.uint8)

# --- máscaras das barras pela cor ---
masks = {
  'hp': (r > 70) & (g < 0.35 * r) & (b < 0.35 * r),
  'mp': (b > 70) & (r < 0.25 * b) & (g < 0.9 * b),
  'en': (r > 120) & (g > 0.4 * r) & (sat > 0.93) & (b < 25),
}
X0 = 788   # barras começam depois dos losangos dos ícones (que ficam por cima)
info = {'w': W, 'h': H, 'bars': {}}
fills, base = {}, rgb.copy()
for k, m in masks.items():
  m = m.copy(); m[:, :X0] = False
  rows = np.where(m.sum(1) > 300)[0]
  y0, y1 = rows.min(), rows.max()
  hull = np.zeros((H, W), bool)
  for y in range(y0, y1 + 1):
    xs = np.where(m[y])[0]
    if len(xs) < 50: continue
    hull[y, xs.min():xs.max() + 1] = True
  # apaga o texto: acha os pixels brancos dentro da barra, alarga para pegar o contorno
  white = hull & (mn > 170)
  cols = np.where(white.sum(0) > 2)[0]
  cols = cols[(cols > X0 + 250) & (cols < W - 250)]
  fill = rgb.copy()
  tx = cols
  if len(cols):
    a0, a1 = int(cols.min()) - 14, int(cols.max()) + 14
    P = min(a0 - X0 - 20, 260)
    for y in range(y0, y1 + 1):
      for x in range(a0, a1 + 1):
        if hull[y, x]:
          sx = a0 - 1 - ((x - a0) % P)
          if hull[y, sx]: fill[y, x] = rgb[y, sx]
  ys, xs = np.where(hull)
  bx0, bx1, by0, by1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
  fills[k] = (fill, hull)
  # barra vazia: textura escurecida e dessaturada
  lum = fill[..., :3].mean(2, keepdims=True)
  dark = (fill * 0.18 + lum * 0.12)
  base[hull] = dark[hull]
  info['bars'][k] = {'x': bx0, 'y': by0, 'w': bx1 - bx0 + 1, 'h': by1 - by0 + 1}
  print(k, info['bars'][k], 'texto', (int(tx.min()), int(tx.max())) if len(tx) else None)

# --- nível: apaga o número dentro do círculo escuro ---
yy, xx = np.mgrid[0:H, 0:W]
cx, cy, R = round(510 * W / 2000), round(515 * W / 2000), 64   # círculo do nível (medido na arte)
disk = (xx - cx) ** 2 + (yy - cy) ** 2 < R * R
ring = disk & (mx < 60)
bg = np.median(base[ring], axis=0)
base[disk] = bg
info['level'] = {'x': cx, 'y': cy, 'r': R}
# espaços de habilidade (medidos na arte)
k = W / 2000
info['slots'] = [{'x': round((642 + i * 141) * k), 'y': round(468 * k), 'w': round(124 * k), 'h': round(122 * k)} for i in range(4)]

def save(arr, a, name, scale=0.5):
  img = Image.fromarray(np.dstack([np.clip(arr, 0, 255).astype(np.uint8), a]), 'RGBA')
  img = img.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
  img.save(os.path.join(out, name), 'WEBP', quality=90, method=6)
save(base, alpha_u8, 'base.webp')
for k, (fill, hull) in fills.items():
  save(fill, (hull * alpha * 255).astype(np.uint8), k + '.webp')
info['scale'] = 0.5
json.dump(info, open(os.path.join(out, 'hud.json'), 'w'), indent=1)
