// Chão do deserto: a textura pintada fica "presa à tela" como na versão 2D (padrão isométrico 2:1),
// com manchas grandes de tom para não parecer repetida.
shader_type spatial;
render_mode diffuse_lambert, specular_disabled;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float escala = 0.42;
uniform vec2 tam_tex = vec2(1024.0, 1024.0);
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
  vec2 tela = vec2((wpos.x - wpos.z) * 32.0, (wpos.x + wpos.z) * 16.0);
  vec3 c = texture(tex, tela / (escala * tam_tex)).rgb;
  float n = noise(wpos.xz * 0.12) * 0.6 + noise(wpos.xz * 0.35) * 0.4;
  c *= mix(0.86, 1.1, n);
  // a luz do sol e o ambiente já são quentes: compensa para o chão manter as cores pintadas
  ALBEDO = c * vec3(0.86, 0.95, 1.12);   // = 1 / (ambiente + sol) no chão iluminado
}
