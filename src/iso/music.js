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
// aceita arquivo separado (site normal: baixa com fetch) ou data URL (HTML único: decodifica sem fetch)
async function decode(url) {
  let data;
  if (url.startsWith('data:')) {
    const bin = atob(url.slice(url.indexOf(',') + 1)), buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    data = buf.buffer;
  } else data = await (await fetch(url)).arrayBuffer();
  return new Promise((ok, err) => context().decodeAudioData(data, ok, err));
}

// Web Audio nos dois casos: o arquivo baixa e decodifica assim que a página abre (antes do toque),
// então no primeiro toque o som sai na hora. (<audio> no celular só começa a baixar depois do toque.)
export function createTrack(url, opts = {}) {
  return webAudioTrack(url, opts);
}

// site normal (GitHub Pages / itch): <audio> em streaming — começa a tocar com poucos segundos baixados
function streamTrack(url, { volume = 0.6, loopEnd = null } = {}) {
  const el = new Audio(); el.src = url; el.preload = 'auto'; el.loop = true; el.volume = 0;
  let want = false, fadeT = 0;
  const fade = (to, secs, done) => {
    clearInterval(fadeT); const from = el.volume, t0 = performance.now();
    fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (secs * 1000)); el.volume = from + (to - from) * k; if (k >= 1) { clearInterval(fadeT); done && done(); } }, 30);
  };
  if (loopEnd) el.addEventListener('timeupdate', () => { if (el.currentTime >= loopEnd) el.currentTime = 0; });
  const tryPlay = () => { if (!want || !el.paused) return; el.play().then(() => fade(volume, 1.5)).catch(() => {}); };
  // celular: só toca depois do primeiro toque/tecla
  addEventListener('pointerdown', tryPlay, true); addEventListener('keydown', tryPlay, true); addEventListener('touchend', tryPlay, true);
  const ready = new Promise((r) => { el.addEventListener('canplay', r, { once: true }); el.addEventListener('error', r, { once: true }); });
  const t = {
    ready,
    get playing() { return !el.paused; },
    play() { want = true; tryPlay(); },
    stop(fadeOut = 1.2) { want = false; fade(0, fadeOut, () => el.pause()); },
  };
  window.__musica = { get estado() { return el.paused ? 'parada' : 'tocando'; }, get tocando() { return !el.paused; } };
  return t;
}

// HTML único (link do Claude): a página bloqueia <audio> com data:, então decodifica na Web Audio
function webAudioTrack(url, { volume = 0.6, loopEnd = null, loopStart = 0 } = {}) {  let buffer = null, src = null, g = null;
  const ready = decode(url).then((b) => (buffer = b)).catch(() => null);
  return {
    ready,
    get playing() { return !!src && ctx.state === 'running'; },
    async play(fadeIn = 0.25) {
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
