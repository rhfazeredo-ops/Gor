// Chão em "Gaussian splats" estilo pixel art: cada splat é uma manchinha elíptica deitada no chão
// (instância de MultiMesh). A cor sai do mesmo chão pintado, lida no CENTRO do splat (cor chapada),
// reduzida a uma paleta pequena; a borda da gaussiana é cortada em degraus de pixel e a sombra
// vira pontilhado (Bayer). Opaco com profundidade: não precisa ordenar os splats.
shader_type spatial;
render_mode diffuse_lambert, specular_disabled, cull_disabled;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mascara : filter_linear;
uniform float escala = 0.42;
uniform vec2 tam_tex = vec2(1024.0, 1024.0);
uniform vec2 tam_mapa = vec2(72.0, 72.0);
uniform float pixel = 5.0;          // tamanho do "pixel" na tela
uniform float niveis = 10.0;         // tons por canal da paleta
// sombras de personagens (x, z, raio, força): manchas pontilhadas esticadas na direção do sol
uniform vec4 sombras[24];
uniform int n_sombras = 0;
uniform vec2 dir_sol = vec2(0.9, 0.2);
varying flat vec3 cor;
varying flat float semente;
varying vec3 wpos;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return noise(p) * 0.5 + noise(p * 2.1) * 0.3 + noise(p * 4.3) * 0.2; }
float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int m[16] = int[](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[q.y * 4 + q.x]) + 0.5) / 16.0;
}
void vertex() {
  wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
  vec3 c0 = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  semente = INSTANCE_CUSTOM.r;
  vec2 tela = vec2((c0.x - c0.z) * 32.0, (c0.x + c0.z) * 16.0);
  vec3 c = textureLod(tex, tela / (escala * tam_tex), 5.0).rgb;      // tom médio do chão pintado (sem rachaduras)
  float fenda = INSTANCE_CUSTOM.g;                                     // splats finos e escuros = rachaduras/pedrisco
  vec2 uvm = c0.xz / tam_mapa;
  vec4 m = textureLod(mascara, uvm, 0.0);
  c *= mix(0.86, 1.1, fbm(c0.xz * 0.08));
  float tr = smoothstep(0.25, 0.75, m.r + (fbm(c0.xz * 0.6) - 0.5) * 0.5);
  vec3 batido = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 0.55) * vec3(1.12, 1.05, 0.96);
  c = mix(c, batido, tr * 0.6);
  float pd = smoothstep(0.15, 0.9, m.g + (fbm(c0.xz * 1.3) - 0.5) * 0.35) * (1.0 - tr * 0.7);
  c = mix(c, c * vec3(0.72, 0.6, 0.55), pd * 0.75);
  c *= 0.95 + semente * 0.1;
  c *= mix(1.0, 0.72, fenda);                     // cada manchinha com um tom um pouco diferente
  vec2 dentro = min(uvm, 1.0 - uvm);
  c *= mix(0.45, 1.0, smoothstep(-0.02, 0.04, min(dentro.x, dentro.y)));
  cor = c * vec3(0.86, 0.95, 1.12);
}
void fragment() {
  // centro do "pixel" grande da tela e o UV correspondente (borda em degraus)
  vec2 px = (floor(FRAGCOORD.xy / pixel) + 0.5) * pixel;
  vec2 d = px - FRAGCOORD.xy;
  vec2 uv = UV + dFdx(UV) * d.x + dFdy(UV) * d.y;
  vec2 q = uv * 2.0 - 1.0;
  float g = exp(-dot(q, q) * 2.2);               // gaussiana
  if (g < 0.28) discard;                         // corte duro
  float b = bayer4(px / pixel);
  // miolo levemente mais claro, com pontilhado no meio-tom
  // borda um pouco mais escura (com pontilhado só na transição): dá volume a cada manchinha
  vec3 c = cor * mix(0.97, 1.03, step(b, smoothstep(0.28, 0.9, g)));
  // sombra de nuvens em pontilhado
  float nuvem = smoothstep(0.5, 0.75, fbm(wpos.xz * 0.045 + vec2(TIME * 0.012, TIME * 0.006)));
  c *= 1.0 - 0.2 * step(b, nuvem);
  // sombras dos personagens (pontilhado em dois níveis: miolo cheio, borda 50%)
  float somb = 0.0;
  for (int i = 0; i < n_sombras; i++) {
    vec4 sb = sombras[i];
    vec2 r = wpos.xz - (sb.xy + normalize(dir_sol) * sb.z * 1.2);
    vec2 ds = normalize(dir_sol);
    float u = dot(r, ds) / (sb.z * 2.2), v = dot(r, vec2(-ds.y, ds.x)) / sb.z;
    float e = u * u + v * v;
    somb = max(somb, sb.w * (e < 0.55 ? 1.0 : (e < 1.0 ? step(b, 0.5) : 0.0)));
  }
  c *= 1.0 - 0.48 * somb;
  // paleta pequena (com pontilhado entre os tons)
  c = floor(c * niveis + 0.5) / niveis;
  ALBEDO = c;
}
