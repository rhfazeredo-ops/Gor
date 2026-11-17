// The panel: example picker, look controls, stats. Pages describe their
// controls as a small list and this builds the same panel everywhere.

const CSS = `
html, body { margin: 0; height: 100%; background: #05060a; overflow: hidden; }
canvas { display: block; width: 100vw; height: 100vh; height: 100dvh; touch-action: none; }
.with-chrome canvas { position: fixed; left: 0; top: var(--head-h); }
.hud {
  --fg: #c9cde0; --dim: #6b7190; --line: #23263a; --bg: #0b0d14; --acc: #ffc874;
  position: fixed; top: calc(var(--head-h, 0px) + 12px); left: 12px; width: 236px; max-height: calc(100vh - var(--head-h, 0px) - var(--foot-h, 0px) - 24px);
  display: flex; flex-direction: column; box-sizing: border-box;
  background: var(--bg); border: 1px solid var(--line); color: var(--fg);
  font: 12px/1.35 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  user-select: none; -webkit-user-select: none;
}
.hud * { box-sizing: border-box; }
.hud-head { display: flex; align-items: center; justify-content: space-between; padding: 9px 10px 9px 12px; cursor: pointer; }
.hud-title { color: #fff; letter-spacing: 0.02em; }
.hud-fold { color: var(--dim); width: 20px; text-align: center; }
.hud-body { overflow-y: auto; border-top: 1px solid var(--line); scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.hud.folded .hud-body { display: none; }
.hud-sec { padding: 10px 0 8px; border-bottom: 1px solid var(--line); }
.hud-sec:last-child { border-bottom: 0; }
.hud-label { padding: 0 12px 6px; color: var(--dim); }
.hud-scene {
  display: flex; justify-content: space-between; gap: 8px; align-items: baseline;
  padding: 5px 12px 5px 10px; border-left: 2px solid transparent; color: var(--fg); text-decoration: none;
}
.hud-scene:hover { background: #121522; color: #fff; }
.hud-scene.on { border-left-color: var(--acc); color: #fff; background: #121522; }
.hud-scene small { color: var(--dim); font-size: 11px; white-space: nowrap; }
.hud-row { padding: 4px 12px; }
.hud-row-top { display: flex; justify-content: space-between; }
.hud-val { color: var(--dim); font-variant-numeric: tabular-nums; }
.hud input[type=range] {
  -webkit-appearance: none; appearance: none; width: 100%; height: 16px; margin: 2px 0 0; background: transparent; cursor: pointer;
}
.hud input[type=range]::-webkit-slider-runnable-track { height: 2px; background: var(--line); }
.hud input[type=range]::-moz-range-track { height: 2px; background: var(--line); }
.hud input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 8px; height: 14px; margin-top: -6px; background: var(--fg); border: 0; border-radius: 0; }
.hud input[type=range]::-moz-range-thumb { width: 8px; height: 14px; background: var(--fg); border: 0; border-radius: 0; }
.hud input[type=range]:hover::-webkit-slider-thumb { background: #fff; }
.hud-toggle { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 5px 12px; background: none; border: 0; color: var(--fg); font: inherit; cursor: pointer; text-align: left; }
.hud-toggle:hover { background: #121522; color: #fff; }
.hud-box { width: 11px; height: 11px; border: 1px solid var(--dim); }
.hud-toggle.on .hud-box { background: var(--acc); border-color: var(--acc); }
.hud-toggle kbd, .hud-btn kbd { color: var(--dim); font: inherit; margin-left: 6px; }
.hud-btns { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 12px 2px; }
.hud-btn { flex: 1 1 auto; padding: 6px 8px; background: #121522; border: 1px solid var(--line); color: var(--fg); font: inherit; cursor: pointer; text-align: center; }
.hud-btn:hover { border-color: var(--dim); color: #fff; }
.hud-btn.pick { border-color: var(--acc); color: #fff; }
.hud-btn.live { border-color: #ff7a5c; color: #ff7a5c; }
.hud-btn input { display: none; }
.hud-stats { padding: 8px 12px; color: var(--dim); border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; }
.hud.folded .hud-stats { display: none; }
.hud-hint { position: fixed; right: 14px; bottom: calc(var(--foot-h, 0px) + 12px); color: #4b5068; font: 11px ui-monospace, Menlo, monospace; pointer-events: none; }
.hud-load { position: fixed; inset: 0; display: grid; place-items: center; color: #6b7190; font: 12px ui-monospace, Menlo, monospace; pointer-events: none; }
/* site chrome: header and footer, in the style of the other cobanov.dev sites */
.with-chrome { --head-h: 48px; --foot-h: 38px; }
.site-head, .site-foot {
  position: fixed; left: 0; right: 0; z-index: 5; display: flex; align-items: center; gap: 18px; box-sizing: border-box;
  padding: 0 14px 0 12px; background: rgba(7, 8, 13, 0.88); color: #c9cde0;
  font: 12px/1.35 ui-monospace, "SF Mono", Menlo, Consolas, monospace; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.site-head { top: 0; height: var(--head-h); border-bottom: 1px solid #23263a; }
.site-foot { bottom: 0; height: var(--foot-h); border-top: 1px solid #23263a; color: #6b7190; justify-content: space-between; }
.site-head a, .site-foot a { color: inherit; text-decoration: none; }
.site-head a:hover, .site-foot a:hover { color: #fff; }
.site-brand { display: flex; align-items: center; gap: 10px; color: #fff !important; font-size: 13px; letter-spacing: 0.02em; white-space: nowrap; }
.site-brand svg { width: 22px; height: 22px; image-rendering: pixelated; shape-rendering: crispEdges; }
.site-brand small { color: #6b7190; font-size: 12px; }
.site-nav { display: flex; align-items: center; gap: 18px; margin-left: auto; white-space: nowrap; }
.site-star { display: inline-flex; align-items: stretch; border: 1px solid #23263a; background: #0b0d14; color: #c9cde0 !important; }
.site-star:hover { border-color: #ffc874; }
.site-star span { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; }
.site-star b { font-weight: normal; color: #ffc874; }
.site-star .count { border-left: 1px solid #23263a; color: #fff; font-variant-numeric: tabular-nums; }
.site-star .count:empty { display: none; }
.site-foot .row { display: flex; gap: 16px; white-space: nowrap; overflow: hidden; }
.site-foot .dim { color: #4b5068; }
@media (max-width: 900px) { .site-foot .also { display: none; } }
@media (max-width: 640px) {
  .with-chrome { --head-h: 46px; --foot-h: 0px; }
  .site-foot, .site-nav .wide, .site-brand small { display: none; }
}
@media (max-width: 640px) {
  .hud { top: auto; bottom: 0; left: 0; width: 100vw; max-height: 58dvh; border-width: 1px 0 0; font-size: 14px; padding-bottom: env(safe-area-inset-bottom); }
  .hud-head { padding: 13px 14px; }
  .hud-scene { padding: 11px 14px 11px 12px; }
  .hud-scene small { font-size: 12px; }
  .hud-label { padding: 0 14px 6px; }
  .hud-row { padding: 8px 14px; }
  .hud-toggle { padding: 11px 14px; }
  .hud-box { width: 15px; height: 15px; }
  .hud-btns { padding: 2px 14px 4px; gap: 8px; }
  .hud-btn { padding: 11px 10px; }
  .hud-btn kbd, .hud-toggle kbd { display: none; }
  .hud input[type=range] { height: 30px; }
  .hud input[type=range]::-webkit-slider-thumb { width: 14px; height: 22px; margin-top: -10px; }
  .hud input[type=range]::-moz-range-thumb { width: 14px; height: 22px; }
  .hud-stats { padding: 10px 14px; }
  .hud-hint { display: none; }
}
`;

const BUILT_IN = [{ id: "angler", label: "Anglerfish", meta: "all in code", href: "/angler.html" }];

const style = document.createElement("style");
style.textContent = CSS;
document.head.appendChild(style);

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const fmtCount = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));

// ---- site header and footer ------------------------------------------------
const REPO = "cobanov/pixelart-gaussiansplat";
const GH = `https://github.com/${REPO}`;
// the brand mark: one splat as a pixel-art disc with a highlight and an outline
const LOGO = (() => {
  const rows = ["..oooo..", ".oyyyao.", "oyywyaao", "oyyyyaao", "oayyaaao", "oaaaaaro", ".oaarro.", "..oooo.."];
  const col = { o: "#2a2444", y: "#ffd76a", w: "#fff3c8", a: "#ff9a3a", r: "#c23c36" };
  const rects = rows.flatMap((r, y) => [...r].map((ch, x) => (col[ch] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${col[ch]}"/>` : ""))).join("");
  return `<svg viewBox="0 0 8 8" aria-hidden="true">${rects}</svg>`;
})();
const fmtStars = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n));

function createChrome() {
  if (document.querySelector(".site-head")) return;
  const head = el("header", "site-head");
  head.innerHTML = `
    <a class="site-brand" href="/">${LOGO}<span>pixel-art splats</span><small>Gaussian splats as pixel art</small></a>
    <nav class="site-nav" aria-label="Site">
      <a class="wide" href="${GH}/blob/main/docs/how-it-works.md">How it works</a>
      <a class="wide" href="${GH}/blob/main/docs/make-a-scene.md">Make your own</a>
      <a class="site-star" href="${GH}" aria-label="Star on GitHub"><span><b>★</b> Star</span><span class="count"></span></a>
    </nav>`;
  const foot = el("footer", "site-foot");
  foot.innerHTML = `
    <div class="row">
      <span>Made by <a href="https://cobanov.dev">Mert Cobanov</a></span>
      <span class="dim">Open source, MIT</span>
      <span class="dim">Built on <a href="https://github.com/sparkjsdev/spark">Spark</a> and <a href="https://threejs.org">three.js</a></span>
    </div>
    <div class="row also">
      <span class="dim">Also by me</span>
      <a href="https://runyard.cobanov.dev">runyard</a>
      <a href="https://checkmark.cobanov.dev">checkmark</a>
      <a href="https://clockmark.cobanov.dev">clockmark</a>
      <a href="https://bucketmark.app">bucketmark</a>
    </div>`;
  document.body.append(head, foot);
  document.documentElement.classList.add("with-chrome");
  window.dispatchEvent(new Event("resize")); // the drawing area just got smaller

  // star count, cached for the session (the GitHub API allows 60 calls an hour per visitor)
  const count = head.querySelector(".count"), key = "splats-stars";
  const show = (n) => { if (Number.isFinite(n)) count.textContent = fmtStars(n); };
  const cached = sessionStorage.getItem(key);
  if (cached) show(Number(cached));
  else fetch(`https://api.github.com/repos/${REPO}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (d && Number.isFinite(d.stargazers_count)) { sessionStorage.setItem(key, d.stargazers_count); show(d.stargazers_count); }
  }).catch(() => {});
}

export function showLoading(text) {
  const d = el("div", "hud-load", text);
  document.body.appendChild(d);
  return () => d.remove();
}

// controls: { kind: "range" | "toggle" | "button" | "file", id, label, ... }
export function createHud({ current, controls = [], hint = "drag: orbit · scroll: zoom · H: hide panel" }) {
  const api = { set() {}, count() {}, el: null };
  if (new URLSearchParams(location.search).has("capture")) return api;

  createChrome();
  const root = el("div", "hud");
  const head = el("div", "hud-head");
  head.append(el("span", "hud-title", "scenes & look"), el("span", "hud-fold", "–"));
  const body = el("div", "hud-body");
  const stats = el("div", "hud-stats", "…");
  root.append(head, body, stats);
  const fold = (v) => {
    root.classList.toggle("folded", v ?? !root.classList.contains("folded"));
    head.lastChild.textContent = root.classList.contains("folded") ? "+" : "–";
  };
  head.onclick = () => fold();
  if (window.innerWidth <= 640) fold(true);

  // ---- scenes
  const scenes = el("div", "hud-sec");
  scenes.append(el("div", "hud-label", "examples"));
  const addScene = (s) => {
    const a = el("a", "hud-scene" + (s.id === current ? " on" : ""));
    a.href = s.href;
    a.append(el("span", null, s.label), el("small", null, s.meta || ""));
    scenes.append(a);
  };
  body.append(scenes);
  // examples come from public/models/models.json, kept up to date by the tools
  fetch("./models/models.json").then((r) => (r.ok ? r.json() : [])).catch(() => []).then((list) => {
    for (const m of list)
      addScene(m.scene
        ? { id: `scene:${m.name}`, label: m.label || m.name, meta: "scene", href: `/?s=${m.name}` }
        : { id: `model:${m.name}`, label: m.label || m.name, meta: fmtCount(m.count), href: `/?m=${m.name}${m.query ? "&" + m.query : ""}` });
    BUILT_IN.forEach(addScene);
  });

  // ---- controls
  const setters = {}, keys = {};
  const sec = (title) => { const s = el("div", "hud-sec"); s.append(el("div", "hud-label", title)); body.append(s); return s; };
  const ranges = controls.filter((c) => c.kind === "range");
  const toggles = controls.filter((c) => c.kind === "toggle");
  const buttons = controls.filter((c) => c.kind === "button" || c.kind === "file");

  if (ranges.length) {
    const s = sec("look");
    for (const c of ranges) {
      const row = el("div", "hud-row"), top = el("div", "hud-row-top"), val = el("span", "hud-val");
      const input = el("input");
      Object.assign(input, { type: "range", min: c.min, max: c.max, step: c.step ?? 1, value: c.value });
      const show = (v) => (val.textContent = c.format ? c.format(v) : String(v));
      show(c.value);
      input.oninput = () => { const v = Number(input.value); show(v); c.onInput(v); };
      top.append(el("span", null, c.label), val);
      row.append(top, input);
      s.append(row);
      setters[c.id] = (v) => { input.value = v; show(v); };
    }
  }
  if (toggles.length) {
    const s = sec("view");
    for (const c of toggles) {
      const b = el("button", "hud-toggle" + (c.value ? " on" : ""));
      const left = el("span", null, c.label);
      if (c.key) left.append(el("kbd", null, c.key === " " ? "space" : c.key.toUpperCase()));
      b.append(left, el("span", "hud-box"));
      const set = (v, fire) => { b.classList.toggle("on", v); if (fire) c.onChange(v); };
      b.onclick = () => set(!b.classList.contains("on"), true);
      s.append(b);
      setters[c.id] = (v) => set(v, false);
      if (c.key) keys[c.key] = () => b.click();
    }
  }
  for (const c of controls.filter((c) => c.kind === "choice")) {
    const s = sec(c.label), wrap = el("div", "hud-btns");
    const set = (v, fire) => { for (const b of wrap.children) b.classList.toggle("pick", b.dataset.v === v); if (fire) c.onChange(v); };
    c.options.forEach((o, i) => {
      const b = el("button", "hud-btn", o);
      b.dataset.v = o;
      b.onclick = () => set(o, true);
      if (i < 9) { b.append(el("kbd", null, String(i + 1))); keys[String(i + 1)] = () => b.click(); }
      wrap.append(b);
    });
    set(c.value, false);
    s.append(wrap);
    setters[c.id] = (v) => set(v, false);
  }
  if (buttons.length) {
    const s = sec("actions"), wrap = el("div", "hud-btns");
    for (const c of buttons) {
      const b = el(c.kind === "file" ? "label" : "button", "hud-btn", c.label);
      if (c.key) b.append(el("kbd", null, c.key.toUpperCase()));
      if (c.kind === "file") {
        const input = el("input");
        Object.assign(input, { type: "file", accept: c.accept || "image/*" });
        input.onchange = () => input.files[0] && c.onFile(input.files[0]);
        b.append(input);
      } else {
        b.onclick = () => c.onClick(b);
        if (c.key) keys[c.key] = () => b.click();
      }
      wrap.append(b);
    }
    s.append(wrap);
  }

  window.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.target.tagName === "INPUT") return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "h") root.style.display = root.style.display === "none" ? "" : "none";
    else if (keys[k]) { e.preventDefault(); keys[k](); }
  });

  document.body.append(root, el("div", "hud-hint", hint));

  // ---- stats: scene text + measured fps
  let label = "", frames = 0, last = performance.now(), fps = 0;
  const tick = (now) => {
    frames++;
    if (now - last >= 500) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0; last = now;
      stats.textContent = `${label}${label ? " · " : ""}${fps} fps`;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  api.set = (id, v) => setters[id]?.(v);
  api.count = (n) => (label = `${n.toLocaleString("en-US")} splats`);
  api.el = root;
  return api;
}

// Hard pixels: splats become flat opaque discs and the post pass alpha-tests
// instead of blending. Off = classic soft Gaussians.
export function applyCrisp(spark, post, on) {
  spark.falloff = on ? 0 : 1;
  spark.maxStdDev = on ? 1.5 : Math.sqrt(8);
  spark.blurAmount = on ? 0 : 0.3;
  spark.preBlurAmount = on ? 0.3 : 0;
  post.setCrisp(on);
}

export function makeRecorder(canvas) {
  let rec = null;
  return (button) => {
    if (rec) return rec.stop();
    const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    rec = new MediaRecorder(canvas.captureStream(60), { mimeType: mime, videoBitsPerSecond: 16e6 });
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type: mime }));
      a.download = `pixel-art-splats-${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      rec = null;
      button?.classList.remove("live");
    };
    rec.start();
    button?.classList.add("live");
  };
}

// The controls every page shares.
export function commonControls({ state, post, spark, resize, canvas }) {
  return {
    look: [
      { kind: "range", id: "pixel", label: "pixel size", min: 1, max: 8, value: state.pixel || state.pixelUsed, format: (v) => `${v}px`, onInput: (v) => { state.pixel = v; resize(); } },
      { kind: "range", id: "dither", label: "dither", min: 0, max: 1, step: 0.05, value: state.dither, format: (v) => v.toFixed(2), onInput: (v) => (state.dither = v) },
    ],
    view: [
      { kind: "toggle", id: "quant", label: "palette", key: "q", value: state.quant, onChange: (v) => (state.quant = v) },
      { kind: "toggle", id: "crisp", label: "hard pixels", key: "x", value: state.crisp, onChange: (v) => { state.crisp = v; applyCrisp(spark, post, v); } },
      { kind: "toggle", id: "ss", label: "2×2 supersample", key: "s", value: state.ss === 2, onChange: (v) => { state.ss = v ? 2 : 1; resize(); } },
      { kind: "toggle", id: "outline", label: "outline", key: "e", value: !!state.outline, onChange: (v) => { state.outline = v; post.setOutline(v); } },
      { kind: "toggle", id: "orbit", label: "auto orbit", key: "o", value: state.idle, onChange: (v) => (state.idle = v) },
    ],
    record: { kind: "button", id: "rec", label: "record", key: "r", onClick: makeRecorder(canvas) },
  };
}

// The drawing area: the window minus the site header and footer.
export function viewportSize() {
  const css = getComputedStyle(document.documentElement), px = (v) => parseFloat(css.getPropertyValue(v)) || 0;
  return { w: window.innerWidth, h: Math.max(1, window.innerHeight - px("--head-h") - px("--foot-h")) };
}

// Default art-pixel size: 5 CSS px on a desktop window, proportionally smaller
// on phones so the picture keeps roughly the same number of art pixels.
export const defaultPixel = () => {
  const m = Math.min(window.innerWidth, window.innerHeight);
  return m >= 700 ? 5 : Math.max(2, Math.round(m / 150));
};
// Portrait screens are narrower than the model: pull the camera back.
export const portraitFit = (aspect) => Math.max(1, 0.9 / aspect);
