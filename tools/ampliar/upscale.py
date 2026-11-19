# Amplia 4x com a RRDBNet em ONNX, em blocos com sobreposição; depois reduz para a largura pedida.
import sys, numpy as np, onnxruntime as ort
from PIL import Image
model, src, dst, W = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
so = ort.SessionOptions(); so.intra_op_num_threads = 0
sess = ort.InferenceSession(model, so, providers=['CPUExecutionProvider'])
im = Image.open(src); alpha = im.getchannel('A') if im.mode == 'RGBA' else None
a = np.asarray(im.convert('RGB')).astype(np.float32) / 255
H, Wd, _ = a.shape; T, P = 192, 12
out = np.zeros((H * 4, Wd * 4, 3), np.float32)
for y in range(0, H, T):
    for x in range(0, Wd, T):
        y0, x0 = max(0, y - P), max(0, x - P); y1, x1 = min(H, y + T + P), min(Wd, x + T + P)
        t = a[y0:y1, x0:x1].transpose(2, 0, 1)[None]
        r = sess.run(None, {'img': t})[0][0].transpose(1, 2, 0)
        oy, ox = (y - y0) * 4, (x - x0) * 4; hh, ww = min(T, H - y) * 4, min(T, Wd - x) * 4
        out[y * 4:y * 4 + hh, x * 4:x * 4 + ww] = r[oy:oy + hh, ox:ox + ww]
res = Image.fromarray((out.clip(0, 1) * 255).round().astype(np.uint8))
h2 = round(H * W / Wd); res = res.resize((W, h2), Image.LANCZOS)
if alpha is not None: res.putalpha(alpha.resize((W, h2), Image.LANCZOS))
res.save(dst, 'WEBP', quality=90, method=6) if dst.endswith('.webp') else res.save(dst)
print('ok', src.split('/')[-1], (Wd, H), '->', res.size)
