// Música de fundo pela Web Audio: o MP3 vem embutido (data URL) e é decodificado na memória,
// sem fetch e sem <audio> (a página publicada bloqueia data:/blob: para mídia).
// Navegadores só liberam som depois de um toque/tecla: o contexto é retomado no primeiro gesto.
let ctx = null, gain = null;
const unlock = () => { if (ctx && ctx.state !== 'running') ctx.resume(); };
addEventListener('pointerdown', unlock, true); addEventListener('keydown', unlock, true);

function context() {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); gain = ctx.createGain(); gain.connect(ctx.destination); }
  return ctx;
}
function decode(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1), bin = atob(b64), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Promise((ok, err) => context().decodeAudioData(buf.buffer, ok, err));
}

export function createTrack(dataUrl, { volume = 0.6, loopEnd = null, loopStart = 0 } = {}) {
  let buffer = null, src = null, g = null;
  const ready = decode(dataUrl).then((b) => (buffer = b)).catch(() => null);
  return {
    async play(fadeIn = 1.5) {
      await ready; if (!buffer || src) return;
      const c = context();
      g = c.createGain(); g.connect(gain);
      g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(volume, c.currentTime + fadeIn);
      src = c.createBufferSource(); src.buffer = buffer; src.loop = true;
      src.loopStart = loopStart; src.loopEnd = loopEnd ?? buffer.duration;
      src.connect(g); src.start();
      unlock();
      window.__musica = { get estado() { return ctx.state; }, get tocando() { return !!src; }, duracao: buffer.duration };
    },
    stop(fadeOut = 1.2) {
      if (!src) return;
      const c = context(), s = src, gg = g; src = null;
      gg.gain.cancelScheduledValues(c.currentTime); gg.gain.setValueAtTime(gg.gain.value, c.currentTime);
      gg.gain.linearRampToValueAtTime(0, c.currentTime + fadeOut);
      s.stop(c.currentTime + fadeOut + 0.05);
      if (window.__musica) Object.defineProperty(window.__musica, 'tocando', { value: false });
    },
  };
}
