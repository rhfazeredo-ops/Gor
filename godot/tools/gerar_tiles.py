"""Gera a arte PROVISÓRIA do mapa (tiles isométricos, decoração e herói).
Troque os PNGs gerados pela arte final mantendo os mesmos tamanhos.
Uso: python3 godot/tools/gerar_tiles.py
"""
import numpy as np, random, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
TW, TH = 64, 32          # pegada do tile no chão (losango)
RH = 64                  # altura da região de cada tile no atlas
CLIFF = 28               # altura dos blocos de rocha
rng = np.random.default_rng(7)

def diamond_mask(w, h, oy=0, H=RH):
    yy, xx = np.mgrid[0:H, 0:w].astype(float)
    cx, cy = w / 2 - 0.5, oy + h / 2 - 0.5
    return (np.abs(xx - cx) / (w / 2) + np.abs(yy - cy) / (h / 2)) <= 1.06

def noise(h, w, scale=1.0):
    n = rng.normal(0, 1, (h, w))
    img = Image.fromarray(((n - n.min()) / (np.ptp(n)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(scale))
    a = np.asarray(img).astype(float) / 255
    return (a - a.mean()) / (a.std() + 1e-6)

def paint(mask, base, var=12, blur=1.2, light=None):
    h, w = mask.shape
    n = noise(h, w, blur)
    col = np.array(base, float)[None, None, :] + n[..., None] * var
    if light is not None: col = col * light[..., None]
    out = np.zeros((h, w, 4), float)
    out[..., :3] = np.clip(col, 0, 255); out[..., 3] = mask * 255
    return out

def outline(arr, color=(60, 35, 20), alpha=150):
    a = arr[..., 3] > 0
    edge = a & ~(np.roll(a, 1, 0) & np.roll(a, -1, 0) & np.roll(a, 1, 1) & np.roll(a, -1, 1))
    arr[edge, :3] = arr[edge, :3] * 0.4 + np.array(color) * 0.6
    return arr

def flat(base, var=10, speckles=None):
    m = diamond_mask(TW, TH, RH - TH)
    yy = np.mgrid[0:RH, 0:TW][0]
    light = 1.0 + (RH - TH / 2 - yy) / TH * 0.06
    arr = paint(m, base, var, 1.5, light)
    if speckles:
        for _ in range(speckles[0]):
            x, y = rng.integers(8, TW - 8), rng.integers(RH - TH + 6, RH - 6)
            if m[y, x]: arr[y, x:x + 2, :3] = speckles[1]
    return arr

def block(top, side_l, side_r, h=CLIFF, var=8):
    top_m = diamond_mask(TW, TH, RH - TH - h)
    base_m = diamond_mask(TW, TH, RH - TH)
    yy, xx = np.mgrid[0:RH, 0:TW]
    # lados: área entre o losango de cima e o de baixo
    body = np.zeros_like(top_m)
    for x in range(TW):
        ys_top = np.where(top_m[:, x])[0]; ys_bot = np.where(base_m[:, x])[0]
        if len(ys_top) and len(ys_bot):
            body[ys_top[len(ys_top) // 2]:ys_bot.max() + 1, x] = True
    left = body & (xx < TW / 2) & ~top_m
    right = body & (xx >= TW / 2) & ~top_m
    # camadas horizontais na rocha (estratos)
    strata = 1 + 0.08 * np.sin(yy * 0.9 + noise(RH, TW, 2) * 1.5)
    arr = paint(left, side_l, var, 1.6, strata) + paint(right, side_r, var, 1.6, strata)
    t = paint(top_m, top, var * 0.8, 1.5)
    arr[top_m] = t[top_m]
    return outline(arr)

def water():
    m = diamond_mask(TW, TH, RH - TH)
    yy, xx = np.mgrid[0:RH, 0:TW]
    waves = 1 + 0.07 * np.sin(xx * 0.35 + yy * 0.7)
    return paint(m, (46, 150, 168), 6, 2.5, waves)

def bridge():
    arr = flat((90, 70, 50), 4)
    m = diamond_mask(TW, TH, RH - TH)
    yy, xx = np.mgrid[0:RH, 0:TW]
    # tábuas na direção da ponte (eixo x do mapa = diagonal ↘ na tela)
    u = (xx / (TW / 2) - yy / (TH / 2))
    plank = (np.floor(u * 3) % 2 == 0)
    col = np.where(plank[..., None], np.array([150, 108, 66]), np.array([128, 90, 54]))
    n = noise(RH, TW, 0.8)[..., None] * 10
    arr[m, :3] = np.clip(col + n, 0, 255)[m]
    gap = np.abs((u * 3) % 1) < 0.08
    arr[m & gap, :3] = (70, 48, 30)
    return arr

SAND = (214, 180, 118)
tiles = [
    flat(SAND, 9, (14, (190, 150, 95))),
    flat((210, 176, 112), 9, (10, (232, 205, 150))),
    flat((219, 186, 124), 9, (18, (176, 140, 90))),
    water(),
    bridge(),
    block((150, 100, 64), (112, 74, 50), (86, 56, 40)),
    block((158, 106, 68), (118, 80, 54), (92, 60, 42)),
    block(SAND, (132, 92, 60), (104, 72, 48)),
]
atlas = np.concatenate(tiles, axis=1).clip(0, 255).astype(np.uint8)
Image.fromarray(atlas, 'RGBA').save(os.path.join(ROOT, 'tiles', 'desfiladeiro.png'))

# ---------- decoração ----------
def blob_sprite(w, h, color, dark, shape='rock'):
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    d.ellipse((w * 0.1, h - 10, w * 0.9, h - 1), fill=(0, 0, 0, 70))  # sombra
    if shape == 'rock':
        d.ellipse((w * 0.08, h * 0.3, w * 0.92, h - 4), fill=dark + (255,))
        d.ellipse((w * 0.14, h * 0.22, w * 0.86, h - 9), fill=color + (255,))
        d.ellipse((w * 0.3, h * 0.28, w * 0.6, h * 0.5), fill=tuple(min(255, c + 30) for c in color) + (255,))
    else:
        for _ in range(9):
            cx, cy = random.uniform(w * .25, w * .75), random.uniform(h * .35, h * .75)
            r = random.uniform(w * .14, w * .22)
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dark + (255,))
        for _ in range(7):
            cx, cy = random.uniform(w * .3, w * .7), random.uniform(h * .3, h * .65)
            r = random.uniform(w * .1, w * .16)
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color + (255,))
    return im

random.seed(3)
blob_sprite(40, 34, (176, 110, 72), (110, 62, 40)).save(os.path.join(ROOT, 'decor', 'pedra_p.png'))
blob_sprite(64, 54, (168, 104, 66), (104, 58, 36)).save(os.path.join(ROOT, 'decor', 'pedra_g.png'))
blob_sprite(40, 36, (110, 140, 80), (66, 96, 56), 'bush').save(os.path.join(ROOT, 'decor', 'arbusto.png'))
blob_sprite(40, 36, (178, 96, 104), (120, 60, 70), 'bush').save(os.path.join(ROOT, 'decor', 'arbusto_rosa.png'))

# ---------- herói provisório (Dalárian) ----------
w, h = 56, 80
im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
d.ellipse((10, h - 12, w - 10, h - 2), fill=(0, 0, 0, 90))
d.rounded_rectangle((16, 34, 40, 72), 8, fill=(40, 70, 140), outline=(20, 30, 60), width=2)   # corpo/armadura
d.rectangle((16, 50, 40, 55), fill=(214, 170, 60))                                           # cinto dourado
d.ellipse((17, 14, 39, 38), fill=(232, 196, 160), outline=(70, 50, 40), width=2)            # cabeça
d.pieslice((15, 10, 41, 34), 180, 360, fill=(214, 170, 60), outline=(90, 70, 20))           # elmo
d.line((43, 30, 43, 66), fill=(110, 80, 50), width=4)                                        # cabo do martelo
d.rounded_rectangle((35, 18, 53, 32), 3, fill=(200, 200, 210), outline=(80, 80, 90), width=2)  # cabeça do martelo
im.save(os.path.join(ROOT, 'heroes', 'dalarian_provisorio.png'))
print('ok')
