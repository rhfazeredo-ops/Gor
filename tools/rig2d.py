"""
Esqueleto 2D para os sprites desenhados (animação por recorte).

Para cada direção:
  - acha o pé, o topo da cabeça, o quadril e o joelho;
  - recorta as pernas (coxa + canela) da parte de baixo da figura,
    separando a perna da esquerda e a da direita;
  - o resto (tronco, cabeça, braços, capa, martelo) é o "corpo".
Andar: as coxas giram no quadril, as canelas dobram no joelho, o corpo
sobe e desce. Na frente/costas a perna levanta em vez de girar.

A deformação é feita na resolução alta do desenho e depois reduzida, para
as peças giradas não ficarem serrilhadas.
"""
import math
import numpy as np

# como cada vista se comporta: giro lateral (sinal = lado do "para frente")
# e quanto a perna levanta
VIEW = {
    'S': dict(swing=0.0, lift=1.0, center_strip=True),
    'N': dict(swing=0.0, lift=1.0, center_strip=True),
    'E': dict(swing=1.0, lift=0.0, center_strip=False),
    'W': dict(swing=-1.0, lift=0.0, center_strip=False),
    'SE': dict(swing=0.6, lift=0.5, center_strip=False),
    'NE': dict(swing=0.6, lift=0.5, center_strip=False),
    'SW': dict(swing=-0.6, lift=0.5, center_strip=False),
    'NW': dict(swing=-0.6, lift=0.5, center_strip=False),
}


def build_rig(rgb, mask, foot, top, d):
    """rgb: HxWx3, mask: HxW bool (figura). Devolve dict com as peças."""
    H, W = mask.shape
    h = foot - top
    hipY = int(top + 0.55 * h)
    kneeY = int(hipY + 0.5 * (foot - hipY))
    # pés: largura nas últimas linhas (sem o martelo, que fica mais alto)
    band = mask[max(0, foot - int(0.08 * h)):foot + 1]
    cols = np.where(band.any(0))[0]
    fx0, fx1 = (cols.min(), cols.max()) if len(cols) else (W // 3, 2 * W // 3)
    fx0, fx1 = max(0, fx0 - 5), min(W - 1, fx1 + 5)
    # divisão entre as pernas: maior vão interno entre os pés; se as pernas se
    # sobrepõem (vista de lado), divide pela mediana dos pixels das pernas
    occ = band[:, fx0:fx1 + 1].any(0)
    first, last = np.argmax(occ), len(occ) - 1 - np.argmax(occ[::-1])
    gaps, start = [], None
    for i in range(first, last + 1):
        if not occ[i]:
            if start is None: start = i
        elif start is not None:
            gaps.append((i - start, start)); start = None
    dup = False
    if gaps and max(gaps)[0] >= 2:
        g = max(gaps); split = fx0 + g[1] + g[0] // 2
    else:
        dup = True
        lower = mask[hipY_tmp:foot + 1, fx0:fx1 + 1] if (hipY_tmp := int(top + 0.55 * h)) else band
        xs = np.where(lower)[1]
        split = fx0 + int(np.median(xs)) if len(xs) else (fx0 + fx1) // 2

    yy, xx = np.mgrid[0:H, 0:W]
    blue = (rgb[..., 2] > rgb[..., 0] + 25) & (rgb[..., 2] > rgb[..., 1] + 10)   # capa/tabardo
    legzone = mask & (yy >= hipY) & (xx >= fx0) & (xx <= fx1) & ~blue
    if VIEW[d]['center_strip']:
        legzone &= np.abs(xx - split) > max(3, int(0.035 * W))
    if dup:
        # pernas sobrepostas: a visível é a da frente; a de trás é uma cópia mais escura
        left = legzone; right = legzone
    else:
        left = legzone & (xx < split)
        right = legzone & (xx >= split)
    body = mask & ~left & ~right
    # pivôs: quadril no centro de cada perna, na linha do quadril
    def pivot(m):
        xs = np.where(m.any(0))[0]
        return (xs.mean() if len(xs) else split, hipY)
    return dict(hipY=hipY, kneeY=kneeY, foot=foot, split=split, fx=(fx0, fx1), dup=dup,
                body=body, legs=[left, right], hips=[pivot(left), pivot(right)])


def sample(src, m, x, y):
    """amostra o vizinho mais próximo de (x, y) em src, só onde m é verdadeiro."""
    H, W = m.shape
    xi = np.round(x).astype(int); yi = np.round(y).astype(int)
    ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
    xi = np.clip(xi, 0, W - 1); yi = np.clip(yi, 0, H - 1)
    ok &= m[yi, xi]
    return src[yi, xi], ok


def walk_frame(rgba, rig, d, p, pad=24):
    """rgba: HxWx4 float. p: fase (0..2π). Devolve quadro (H+2pad)x(W+2pad)x4
    com o mesmo referencial (+pad)."""
    H, W, _ = rgba.shape
    v = VIEW[d]
    out = np.zeros((H + 2 * pad, W + 2 * pad, 4), np.float32)
    OY, OX = np.mgrid[0:H + 2 * pad, 0:W + 2 * pad].astype(np.float32)
    OY -= pad; OX -= pad
    h = rig['foot'] - rig['hipY']
    bob = -4.0 * abs(math.sin(p)) * (h / 100)          # sobe na passagem das pernas

    def paint(sx, sy, m, dark=1.0):
        col, ok = sample(rgba, m, sx, sy)
        if dark != 1.0:
            col = col.copy(); col[..., :3] *= dark
        out[ok] = col[ok]

    legs_order = [0, 1]
    # perna de trás primeiro: a cópia escura (pernas sobrepostas) ou a que vai para trás
    if rig['dup']: legs_order = [1, 0]
    elif v['swing'] != 0 and math.sin(p) * v['swing'] < 0: legs_order = [1, 0]
    for li in legs_order:
        m = rig['legs'][li]
        sgn = 1 if li == 0 else -1
        ph = p + (0 if li == 0 else math.pi)
        thigh = 0.5 * math.sin(ph) * v['swing']                 # giro no quadril
        swing_fwd = math.cos(ph) > 0                              # perna indo para frente
        knee = (0.75 * max(0.0, math.cos(ph)) ** 1.5) * (1 if v['swing'] >= 0 else -1) * abs(v['swing'])
        lift = v['lift'] * 11.0 * max(0.0, math.sin(ph)) * (h / 100)
        hx, hy = rig['hips'][li]
        hy = hy + bob * 0.5
        ky = rig['kneeY']
        # canela: inverso de (girar no joelho por thigh+knee, depois mover com a coxa)
        # posição do joelho depois do giro da coxa
        kx_rest, ky_rest = hx, ky
        c, s = math.cos(thigh), math.sin(thigh)
        kx = hx + (kx_rest - hx) * c - (ky_rest - rig['hipY']) * s
        kyy = hy + (kx_rest - hx) * s + (ky_rest - rig['hipY']) * c - lift
        a = thigh - knee
        ca, sa = math.cos(-a), math.sin(-a)
        dx, dy = OX - kx, OY - kyy
        sx = kx_rest + dx * ca - dy * sa
        sy = ky_rest + dx * sa + dy * ca
        shin = m & (np.mgrid[0:H, 0:W][0] >= ky)
        dark = 0.62 if (rig['dup'] and li == 1) else 1.0
        paint(sx, sy, shin, dark)
        # coxa: inverso do giro no quadril
        ct, st = math.cos(-thigh), math.sin(-thigh)
        dx, dy = OX - hx, OY - (hy - lift * 0.4)
        sx = hx + dx * ct - dy * st
        sy = rig['hipY'] + dx * st + dy * ct
        thighm = m & (np.mgrid[0:H, 0:W][0] < ky)
        paint(sx, sy, thighm, dark)
    # corpo por cima (tabardo e capa cobrem o alto das pernas)
    paint(OX, OY - bob, rig['body'])
    return out
