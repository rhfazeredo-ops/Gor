# Lê o .pth (zip do PyTorch) sem torch e monta a RRDBNet (Real-ESRGAN anime 6B) em ONNX.
import sys, zipfile, pickle, io, numpy as np, onnx
from onnx import helper, TensorProto, numpy_helper
pth, out = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(pth); root = z.namelist()[0].split('/')[0]
class Stor:
    def __init__(s, key, dtype): s.key, s.dtype = key, dtype
DT = {'FloatStorage': np.float32, 'HalfStorage': np.float16}
class U(pickle.Unpickler):
    def find_class(s, mod, name):
        if name == '_rebuild_tensor_v2':
            def rb(st, off, size, stride, *a):
                arr = np.frombuffer(z.read(f'{root}/data/{st.key}'), st.dtype)
                return np.lib.stride_tricks.as_strided(arr[off:], size, [x * arr.itemsize for x in stride]).copy() if size else arr[off:off + 1].copy()
            return rb
        if mod == 'torch' and name.endswith('Storage'): return name
        if mod == 'collections' and name == 'OrderedDict':
            import collections; return collections.OrderedDict
        return super().find_class(mod, name)
    def persistent_load(s, pid):
        _, typ, key, loc, n = pid
        return Stor(key, DT[typ if isinstance(typ, str) else typ.__name__])
sd = U(io.BytesIO(z.read(f'{root}/data.pkl'))).load()
sd = sd.get('params_ema', sd.get('params', sd))
nodes, inits = [], []
def W(name):
    inits.append(numpy_helper.from_array(sd[name + '.weight'].astype(np.float32), name + '.w'))
    inits.append(numpy_helper.from_array(sd[name + '.bias'].astype(np.float32), name + '.b'))
cnt = [0]
def nm(p): cnt[0] += 1; return f'{p}_{cnt[0]}'
def conv(x, name):
    W(name); o = nm(name); nodes.append(helper.make_node('Conv', [x, name + '.w', name + '.b'], [o], pads=[1, 1, 1, 1], kernel_shape=[3, 3])); return o
def lrelu(x): o = nm('lr'); nodes.append(helper.make_node('LeakyRelu', [x], [o], alpha=0.2)); return o
def cat(xs): o = nm('cat'); nodes.append(helper.make_node('Concat', xs, [o], axis=1)); return o
inits.append(numpy_helper.from_array(np.array(0.2, np.float32), 'k02'))
def resid(a, x): m = nm('mul'); nodes.append(helper.make_node('Mul', [a, 'k02'], [m])); o = nm('add'); nodes.append(helper.make_node('Add', [m, x], [o])); return o
def rdb(x, p):
    x1 = lrelu(conv(x, p + '.conv1')); x2 = lrelu(conv(cat([x, x1]), p + '.conv2')); x3 = lrelu(conv(cat([x, x1, x2]), p + '.conv3'))
    x4 = lrelu(conv(cat([x, x1, x2, x3]), p + '.conv4')); x5 = conv(cat([x, x1, x2, x3, x4]), p + '.conv5'); return resid(x5, x)
nb = len({k.split('.')[1] for k in sd if k.startswith('body.')})
feat = conv('img', 'conv_first'); h = feat
for i in range(nb): h = resid(rdb(rdb(rdb(h, f'body.{i}.rdb1'), f'body.{i}.rdb2'), f'body.{i}.rdb3'), h)
b = conv(h, 'conv_body'); f = nm('add'); nodes.append(helper.make_node('Add', [feat, b], [f]))
inits.append(numpy_helper.from_array(np.array([1, 1, 2, 2], np.float32), 'sc2'))
for up in ('conv_up1', 'conv_up2'):
    r = nm('rs'); nodes.append(helper.make_node('Resize', [f, '', 'sc2'], [r], mode='nearest')); f = lrelu(conv(r, up))
o = conv(lrelu(conv(f, 'conv_hr')), 'conv_last')
nodes.append(helper.make_node('Identity', [o], ['out']))
g = helper.make_graph(nodes, 'rrdb', [helper.make_tensor_value_info('img', TensorProto.FLOAT, [1, 3, None, None])], [helper.make_tensor_value_info('out', TensorProto.FLOAT, [1, 3, None, None])], inits)
m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)]); onnx.save(m, out)
print('ok blocos', nb, 'params', sum(v.size for v in sd.values()))
