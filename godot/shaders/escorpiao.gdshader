// Escorpião: cores por vértice (pintura feita a partir das referências) + animação por deformação
// dos vértices (patas em onda, cauda/bote, pinças, recuo, morte). Mesma lógica da versão web.
shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;
uniform float walk = 0.0; uniform float walk_amt = 0.0; uniform float tail = 0.0; uniform float sway = 0.0;
uniform float pinch = 0.0; uniform float claws = 0.0; uniform float bob = 0.0; uniform float lean = 0.0;
uniform float flash = 0.0;
float sm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
void vertex() {
  vec3 p = VERTEX; float x = p.x, y = p.y, z = p.z, ax = abs(x), sd = sign(x) == 0.0 ? 1.0 : sign(x);
  float tl = sm(0.25, 0.42, y) * (z < 0.08 ? 1.0 : 0.0) * (ax < 0.16 ? 1.0 : 0.6);
  float lg = (ax > 0.12 && y < 0.27 && z < 0.2 && z > -0.43) ? sm(0.12, 0.3, ax) * sm(0.27, 0.05, y) : 0.0;
  float k = clamp(floor((z + 0.43) / 0.16), 0.0, 3.0);
  float cl = sm(0.17, 0.3, z) * sm(0.04, 0.12, ax) * (y < 0.27 ? 1.0 : 0.0);
  float ph = walk * 6.2831853;
  if (lg > 0.0) { float f = ph + mod(k, 2.0) * 3.14159 + (sd > 0.0 ? 3.14159 : 0.0);
    z += sin(f) * 0.055 * lg * walk_amt; y += max(0.0, cos(f)) * 0.04 * lg * walk_amt; }
  if (cl > 0.0) { z += claws * 0.06 * cl; x -= sd * pinch * 0.035 * cl; }
  if (tl > 0.0) { float a = tail * tl, py = 0.26, pz = -0.36, dy = y - py, dz = z - pz, c = cos(a), s = sin(a);
    y = py + dy * c - dz * s; z = pz + dy * s + dz * c; x += sin(sway) * 0.05 * tl * (y - 0.25); }
  y += bob;
  if (lean != 0.0) { float c = cos(lean), s = sin(lean), dy = y - 0.15, dz = z; y = 0.15 + dy * c - dz * s; z = dy * s + dz * c; }
  VERTEX = vec3(x, y, z);
}
void fragment() { ALBEDO = mix(COLOR.rgb, vec3(1.0), flash * 0.6); }
