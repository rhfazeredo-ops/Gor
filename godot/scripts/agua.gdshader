shader_type canvas_item;
// Brilho ondulando na água (posição no mundo, para não "escorregar" com a câmera)
varying vec2 mundo;

void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	float onda = sin(mundo.x * 0.05 + TIME * 1.6) * sin(mundo.y * 0.09 - TIME * 1.1);
	c.rgb += vec3(0.05, 0.08, 0.08) * onda;
	c.rgb += vec3(0.25) * smoothstep(0.93, 1.0, onda);
	COLOR = c * COLOR;
}
