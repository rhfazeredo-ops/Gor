// The viewer.
//   /?s=<scene>    a stand-alone scene          (public/models/<scene>.dio)
//   /?m=<model>    a converted model, on its island if it has one
//
// Options: px (pixel size), dither (0–1), light, colors, bands, anim, elev, fit,
//          quant=0 (no palette), crisp=0 (soft Gaussians), island=0, capture=1,
//          ss=0 (no 2×2 supersampling), outline=0 (no darker silhouette pixels)

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SparkRenderer } from "@sparkjsdev/spark";
import { createPost } from "./render/post.js";
import { uniforms, setLights } from "./render/shade.js";
import { createHud, commonControls, applyCrisp, showLoading, defaultPixel, portraitFit, viewportSize } from "./render/hud.js";
import { loadModel } from "./viewer/model.js";
import { loadRig } from "./viewer/rig.js";
import { loadWorld } from "./viewer/world.js";
import { extractPalette } from "./viewer/palette.js";
import { setupPlay } from "./play.js";

THREE.ColorManagement.enabled = false; // palette colours stay exactly as authored

const params = new URLSearchParams(location.search);
const num = (key, fallback) => (params.has(key) ? Number(params.get(key)) : fallback);
const MODEL = params.get("m") || (params.get("s") ? null : (location.hash.slice(1) || "dalarian"));
const SCENE = MODEL ? null : params.get("s") || "caravan";
const NAME = MODEL || SCENE;
const BACKGROUND = "#07080c";
const dpr = Math.min(window.devicePixelRatio || 1, 2);

const state = {
  pixel: num("px", 0), // CSS pixels per art pixel; 0 = pick from the window size
  dither: num("dither", 0),
  quant: params.get("quant") !== "0",
  crisp: params.get("crisp") !== "0",
  colors: num("colors", 28),
  ss: params.get("ss") === "0" ? 1 : 2,
  outline: params.get("outline") !== "0",
  idle: true, // camera orbits by itself until you drag
};

// ---- renderer --------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(dpr);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
const spark = new SparkRenderer({ renderer });
scene.add(spark);
// the splats are drawn into this small target; the post pass turns it into pixels
const lowRes = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
const post = createPost();
post.setBackground(BACKGROUND);
applyCrisp(spark, post, state.crisp);
post.setOutline(state.outline);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.6;
controls.maxDistance = 14;
let hud;
controls.addEventListener("start", () => { state.idle = false; hud?.set("orbit", false); });

function resize() {
  const { w, h } = viewportSize();
  renderer.setSize(w, h);
  const px = (state.pixelUsed = state.pixel || defaultPixel());
  const lw = Math.max(1, Math.round(w / px)), lh = Math.max(1, Math.round(h / px));
  lowRes.setSize(lw * state.ss, lh * state.ss);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  post.setSizes(lw, lh, px * dpr, state.ss);
}
window.addEventListener("resize", resize);
resize();

// ---- content ---------------------------------------------------------------
let model = null, rig = null, world = null, play = null;
// Terra de Gor: começa no modo jogar (?jogar=0 volta ao visualizador)
const PLAY = MODEL && params.get("jogar") !== "0";
const target = new THREE.Vector3();
let radius = 1; // of everything on screen, for framing and fog

async function load() {
  let groundY = 0, height = 0;
  if (MODEL) {
    model = await loadModel(MODEL);
    scene.add(model.mesh);
    if (model.skin && params.get("rig") !== "0") {
      rig = await loadRig(MODEL, model);
      rig.play(rig.clips.includes(params.get("anim")) ? params.get("anim") : rig.clips.includes("walk") ? "walk" : rig.clips[0]);
    }
    height = model.size[1];
    groundY = -height / 2;
    radius = 0.5 * Math.hypot(...model.size);
    uniforms.exposure.value = num("light", 1);
    uniforms.bands.value = num("bands", 5);
  }
  if (SCENE || params.get("island") !== "0") world = await loadWorld(NAME, groundY);
  if (SCENE && !world) throw new Error(`models/${SCENE}.dio not found. Build it with tools/build-scene.mjs`);
  if (!world) return;

  for (const mesh of world.meshes) scene.add(mesh);
  if (rig) rig.groundY = groundY;
  const { meta } = world;
  const low = groundY + meta.bottom * 0.8, high = groundY + Math.max(height, meta.top) + 0.1;
  target.set(0, (low + high) / 2, 0);
  controls.target.copy(target);
  radius = Math.max(meta.R * (SCENE ? 1.12 : 1.3), (high - low) / 2) * 1.03;
  if (SCENE) {
    // a scene brings its own palette (and may ask for dithering)
    post.setBackground(meta.background);
    uniforms.worldExposure.value = num("light", meta.light ?? 1);
    uniforms.bands.value = num("bands", 0);
    if (!params.has("dither")) state.dither = meta.dither ?? 0;
    if (!state.pixel) { state.pixel = Math.max(2, defaultPixel() - 1); resize(); }
  }
}

// colours for surfaces, and colours only translucent light may use (beams, glows)
function palette() {
  if (world?.meta.palette) return [world.meta.palette, world.meta.glowPalette || []];
  const lit = world?.lights[0]?.color;
  return [[
    BACKGROUND,
    ...(world ? world.particleColors : []),
    ...extractPalette(model.rgba, model.count, state.colors, uniforms.exposure.value, lit),
    // the island gets its own small budget, so it never takes colours from the model
    ...(world ? extractPalette(world.rgba, world.meta.count, 10, 1, lit) : []),
  ], []];
}

// ---- frame -----------------------------------------------------------------
function step(t) {
  uniforms.time.value = t;
  rig?.update(t);
  if (world) setLights(world.lights, t, world.meshes[0].visible);

  if (play) play.update(t);
  else if (state.idle) {
    const fit = (radius / Math.tan(THREE.MathUtils.degToRad(15))) * num("fit", 1.12) * portraitFit(camera.aspect);
    // scenes drift in for a close look and back out again
    const zoom = SCENE ? 0.7 + 0.3 * (0.5 + 0.5 * Math.cos(t * 0.11)) : 1 - 0.12 * Math.sin(t * 0.15);
    const angle = t * (SCENE ? 0.17 : 0.25) + 0.6, dist = fit * zoom, elev = num("elev", world?.meta.elev ?? 0.22);
    camera.position.set(Math.sin(angle) * dist, target.y + dist * (elev + 0.06 * Math.sin(t * 0.2)), Math.cos(angle) * dist);
    camera.lookAt(target);
  } else controls.update();
  uniforms.camera.value.copy(camera.position);
  const d = camera.position.distanceTo(target);
  uniforms.fog.value.set(d + radius * 0.1, d + radius * 1.8);

  // modifiers read uniforms, so every mesh is regenerated each frame
  model?.mesh.updateVersion();
  world?.meshes.forEach((m) => m.updateVersion());

  renderer.setRenderTarget(lowRes);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  post.render(renderer, lowRes.texture, state.quant, state.dither);
}

// ---- start -----------------------------------------------------------------
const id = `${SCENE ? "scene" : "model"}:${NAME}`;
const loading = showLoading(`loading ${NAME}…`);
try {
  await load();
} catch (e) {
  loading();
  showLoading(e.message);
  createHud({ current: id });
  throw e;
}
loading();
post.setPalette(...palette());
if (PLAY && rig) play = setupPlay({ model, rig, world, camera, controls, state });

const common = commonControls({ state, post, spark, resize, canvas: renderer.domElement });
const repalette = () => post.setPalette(...palette());
hud = createHud({
  current: id,
  controls: SCENE ? [
    ...common.look,
    { kind: "range", id: "light", label: "light", min: 0.5, max: 2.5, step: 0.05, value: uniforms.worldExposure.value, format: (v) => v.toFixed(2), onInput: (v) => (uniforms.worldExposure.value = v) },
    ...common.view,
    common.record,
  ] : [
    ...common.look,
    { kind: "range", id: "colors", label: "colours", min: 4, max: 48, value: state.colors, onInput: (v) => { state.colors = v; repalette(); } },
    { kind: "range", id: "light", label: "light", min: 0.5, max: 2.5, step: 0.05, value: uniforms.exposure.value, format: (v) => v.toFixed(2), onInput: (v) => { uniforms.exposure.value = v; repalette(); } },
    { kind: "range", id: "bands", label: "light bands", min: 0, max: 8, value: uniforms.bands.value, format: (v) => (v ? String(v) : "smooth"), onInput: (v) => (uniforms.bands.value = v) },
    ...common.view,
    ...(world ? [{ kind: "toggle", id: "island", label: "island", key: "g", value: true, onChange: (v) => world.meshes.forEach((m) => (m.visible = v)) }] : []),
    common.record,
    ...(rig ? [{ kind: "choice", id: "anim", label: "animation", options: rig.clips, value: rig.current, onChange: rig.play }] : []),
  ],
});
hud.count((model?.count || 0) + (world?.count || 0));

// ?capture=1 stops the clock: drive frames yourself with window.viewer.renderAt(t)
// (rendered twice, so Spark's asynchronous sort catches up with the new camera)
window.viewer = { state, play: (clip) => rig?.play(clip), renderAt: async (t) => { step(t); await new Promise((r) => setTimeout(r, 30)); step(t); } };
if (!params.has("capture")) {
  const clock = new THREE.Timer();
  const frame = () => { clock.update(); step(clock.getElapsed()); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
