// Contorno escuro (casco invertido), como o contorno pintado das peças do mapa.
shader_type spatial;
render_mode unshaded, cull_front, depth_draw_opaque;
uniform float espessura = 0.012;
uniform vec4 cor : source_color = vec4(0.07, 0.035, 0.015, 1.0);
void vertex() { VERTEX += NORMAL * espessura; }
void fragment() { ALBEDO = cor.rgb; }
