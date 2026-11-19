// Chão do deserto: textura pintada (padrão isométrico 2:1 preso à tela, como na versão 2D)
// + zonas: trilha batida (mais clara e lisa), chão pedregoso/sombreado perto das rochas,
// manchas grandes de tom, sombra de nuvens passando e escurecimento fora do mapa.
shader_type spatial;
render_mode diffuse_lambert, specular_disabled;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mascara : filter_linear;
uniform float escala = 0.42;
uniform vec2 tam_tex = vec2(1024.0, 1024.0);
uniform vec2 tam_mapa = vec2(72.0, 72.0);
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return noise(p) * 0.5 + noise(p * 2.1) * 0.3 + noise(p * 4.3) * 0.2; }
void fragment() {
  vec2 tela = vec2((wpos.x - wpos.z) * 32.0, (wpos.x + wpos.z) * 16.0);
  vec3 c = texture(tex, tela / (escala * tam_tex)).rgb;
  vec2 uvm = wpos.xz / tam_mapa;
  vec4 m = texture(mascara, uvm);
  float bord = smoothstep(0.03, 0.12, (fbm(wpos.xz * 0.9) - 0.5) * 0.15 + 0.06);
  // manchas grandes de tom (areia clara / escura)
  float n = fbm(wpos.xz * 0.08);
  c *= mix(0.88, 1.08, n);
  // trilha batida: mais clara, menos saturada, contornos irregulares
  float tr = smoothstep(0.25, 0.75, m.r + (fbm(wpos.xz * 0.6) - 0.5) * 0.5);
  vec3 batido = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 0.55) * vec3(1.12, 1.05, 0.96);
  c = mix(c, batido, tr * 0.6);
  // perto das rochas: chão mais escuro, avermelhado e pedregoso
  float pd = smoothstep(0.15, 0.9, m.g + (fbm(wpos.xz * 1.3) - 0.5) * 0.35) * (1.0 - tr * 0.7);
  c = mix(c, c * vec3(0.72, 0.6, 0.55), pd * 0.75);
  // sombra de nuvens passando devagar
  float nuvem = smoothstep(0.52, 0.72, fbm(wpos.xz * 0.045 + vec2(TIME * 0.012, TIME * 0.006)));
  c *= 1.0 - nuvem * 0.22;
  c = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, 0.86) * 0.94;
  // fora do mapa: mais escuro
  vec2 dentro = min(uvm, 1.0 - uvm);
  c *= mix(0.45, 1.0, smoothstep(-0.02, 0.04, min(dentro.x, dentro.y)));
  ALBEDO = c * vec3(0.86, 0.95, 1.12);
}
