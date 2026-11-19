# Efeitos (iguais em espírito aos da versão web): números de dano, faíscas, anel de impacto,
# área da Consagração e bolha da Proteção.
extends Node
class_name Fx

static func numero(pai: Node, pos: Vector3, valor: int, cor := Color.WHITE) -> void:
	var l := Label3D.new(); l.text = str(valor); l.font_size = 72; l.outline_size = 18
	l.modulate = cor; l.outline_modulate = Color(0.05, 0.02, 0.01); l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true; l.shaded = false; l.render_priority = 20; l.pixel_size = 0.006; l.position = pos + Vector3(randf_range(-0.3, 0.3), 1.6, 0)
	pai.add_child(l)
	var tw := l.create_tween().set_parallel(); tw.tween_property(l, "position:y", l.position.y + 1.0, 0.8)
	tw.tween_property(l, "modulate:a", 0.0, 0.8).set_delay(0.3); tw.chain().tween_callback(l.queue_free)

static func _mat_brilho(cor: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = cor; m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED; m.vertex_color_use_as_albedo = true
	return m

static func faiscas(pai: Node, pos: Vector3, n := 16, cor := Color(1, 0.85, 0.4), vel := 4.0, altura := 0.8) -> void:
	var p := CPUParticles3D.new(); p.one_shot = true; p.amount = n; p.lifetime = 0.6; p.explosiveness = 1.0
	p.direction = Vector3.UP; p.spread = 70.0; p.initial_velocity_min = vel * 0.5; p.initial_velocity_max = vel
	p.gravity = Vector3(0, -9, 0); p.scale_amount_min = 0.6; p.scale_amount_max = 1.2
	var q := QuadMesh.new(); q.size = Vector2(0.12, 0.12); q.material = _mat_brilho(cor); p.mesh = q
	var g := Gradient.new(); g.set_color(0, cor); g.set_color(1, Color(cor.r, cor.g * 0.5, 0, 0)); p.color_ramp = g
	p.position = pos + Vector3(0, altura, 0); pai.add_child(p); p.emitting = true
	p.get_tree().create_timer(1.2).timeout.connect(p.queue_free)

static func anel(pai: Node, pos: Vector3, raio: float, cor := Color(1, 0.85, 0.4), dur := 0.5) -> void:
	var a := MeshInstance3D.new(); var t := TorusMesh.new(); t.inner_radius = 0.92; t.outer_radius = 1.0; a.mesh = t
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD; m.albedo_color = cor
	a.material_override = m; a.position = pos + Vector3(0, 0.05, 0); a.scale = Vector3(0.2, 1, 0.2); pai.add_child(a)
	var tw := a.create_tween().set_parallel(); tw.tween_property(a, "scale", Vector3(raio, 1, raio), dur).set_ease(Tween.EASE_OUT)
	tw.tween_property(m, "albedo_color:a", 0.0, dur); tw.chain().tween_callback(a.queue_free)

static func _mat_luz(cor: Color, forca := 2.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new(); m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = cor * Color(forca, forca, forca, 1.0); m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m

# Martelo de luz: desce do céu, bate no chão (onImpact) e deixa uma coluna de luz
static func martelo_de_luz(pai: Node, pos: Vector3, ao_bater: Callable) -> void:
	var m := Node3D.new(); m.position = pos + Vector3(0, 7.0, 0); pai.add_child(m)
	var ouro := StandardMaterial3D.new(); ouro.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ouro.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; ouro.albedo_color = Color(1.0, 0.76, 0.28, 0.92)
	ouro.rim_enabled = false
	var branco := StandardMaterial3D.new(); branco.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	branco.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; branco.albedo_color = Color(1.0, 0.98, 0.88, 1.0)
	# halo dourado em volta do martelo

	var cabo := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.07; cm.bottom_radius = 0.07; cm.height = 1.7
	cabo.mesh = cm; cabo.material_override = ouro; cabo.position.y = 1.25; m.add_child(cabo)
	var cabeca := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(1.05, 0.55, 0.55)
	cabeca.mesh = bm; cabeca.material_override = ouro; cabeca.position.y = 0.31; m.add_child(cabeca)
	# estrela branca nas faces da cabeça
	for lado in [-1, 1]:
		for ang in [0.0, PI / 2.0]:
			var e := MeshInstance3D.new(); var em := BoxMesh.new(); em.size = Vector3(0.62, 0.1, 0.02)
			e.mesh = em; e.material_override = branco; e.position = Vector3(0, 0.31, 0.32 * lado); e.rotation.z = ang; m.add_child(e)
	var brilho := OmniLight3D.new(); brilho.light_color = Color(1, 0.85, 0.5); brilho.light_energy = 3.0; brilho.omni_range = 5.0
	brilho.position.y = 0.4; m.add_child(brilho)
	for c in m.find_children("*", "GeometryInstance3D", true, false): c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.rotation.y = randf_range(-0.4, 0.4)
	var tw := m.create_tween()
	tw.tween_property(m, "position:y", pos.y + 0.0, 0.3).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_callback(func():
		ao_bater.call()
		_coluna(pai, pos)
		var flash := OmniLight3D.new(); flash.light_color = Color(1, 0.9, 0.6); flash.light_energy = 6.0; flash.omni_range = 7.0
		flash.position = pos + Vector3(0, 1.0, 0); pai.add_child(flash)
		var tf := flash.create_tween(); tf.tween_property(flash, "light_energy", 0.0, 0.6); tf.tween_callback(flash.queue_free))
	# depois do impacto: sobe um pouco e some
	tw.tween_property(m, "position:y", pos.y + 0.6, 0.75)
	tw.parallel().tween_method(func(v): ouro.albedo_color.a = 0.92 * v; branco.albedo_color.a = v; brilho.light_energy = 2.0 * v, 1.0, 0.0, 0.75)
	tw.tween_callback(m.queue_free)

static func _coluna(pai: Node, pos: Vector3) -> void:
	var c := MeshInstance3D.new(); var cm := CylinderMesh.new(); cm.top_radius = 0.9; cm.bottom_radius = 0.65; cm.height = 9.0
	cm.cap_top = false; cm.cap_bottom = false; c.mesh = cm
	var sm := ShaderMaterial.new(); var sh := Shader.new()
	sh.code = """shader_type spatial; render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform float vida = 1.0;
void fragment() {
  float borda = pow(1.0 - abs(dot(NORMAL, VIEW)), 1.5);
  float alto = 1.0 - UV.y;
  ALBEDO = vec3(1.0, 0.86, 0.5) * 1.6; ALPHA = clamp((1.0 - borda) * (1.0 - alto) * 0.7 * vida, 0.0, 1.0);
}"""
	sm.shader = sh; c.material_override = sm; c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	c.position = pos + Vector3(0, 4.5, 0); pai.add_child(c)
	var tw := c.create_tween().set_parallel()
	tw.tween_method(func(v): sm.set_shader_parameter("vida", v), 1.0, 0.0, 0.75)
	tw.tween_property(c, "scale", Vector3(0.25, 1.0, 0.25), 0.75)
	tw.chain().tween_callback(c.queue_free)

# Chão sagrado (Consagração): círculo dourado com borda brilhante, anel interno, runas girando,
# cruz no centro e partículas de luz subindo. Pulsa e some no fim.
static func consagracao(pai: Node, pos: Vector3, raio: float, dur: float) -> Node3D:
	var raiz := Node3D.new(); raiz.position = pos + Vector3(0, 0.04, 0); pai.add_child(raiz)
	var d := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(raio * 2.0, raio * 2.0); d.mesh = pm
	d.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var sm := ShaderMaterial.new(); var sh := Shader.new()
	sh.code = """shader_type spatial; render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform float t = 0.0; uniform float vida = 0.0;
const vec3 OURO = vec3(1.0, 0.78, 0.32); const vec3 LUZ = vec3(1.0, 0.95, 0.75);
float anel(float r, float c, float w) { return smoothstep(w, 0.0, abs(r - c)); }
void fragment() {
  vec2 p = UV * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
  if (r > 1.0) discard;
  float pulso = 0.85 + 0.15 * sin(t * 7.0);
  float fundo = mix(0.1, 0.28 * pulso, smoothstep(0.0, 0.75, r)) + smoothstep(0.75, 1.0, r) * 0.27;
  float borda = anel(r, 0.97, 0.035) * 0.95;
  float interno = anel(r, 0.72, 0.018) * 0.8;
  // runas: 10 marcas girando entre os anéis
  float ar = a - t * 0.7; float setor = fract(ar / 6.2831853 * 10.0);
  float runa = step(0.80, r) * step(r, 0.92) * (step(0.35, setor) * step(setor, 0.65));
  float traco = runa * (step(0.84, r) * step(r, 0.88) + step(0.47, setor) * step(setor, 0.53));
  // cruz no centro
  float cruz = (step(abs(p.x), 0.035) * step(abs(p.y), 0.22) + step(abs(p.y), 0.035) * step(abs(p.x), 0.16) * step(-0.1, -p.y + 0.05)) ;
  cruz = clamp(cruz, 0.0, 1.0) * (0.75 + 0.25 * sin(t * 4.0));
  vec3 cor = OURO * fundo + LUZ * (borda + interno + traco * 0.9 + cruz * 0.8);
  ALBEDO = cor * 1.4; ALPHA = clamp((fundo + borda + interno + traco + cruz) * vida, 0.0, 1.0);
}"""
	sm.shader = sh; d.material_override = sm; raiz.add_child(d)
	var luz := OmniLight3D.new(); luz.light_color = Color(1, 0.8, 0.4); luz.light_energy = 0.0; luz.omni_range = raio * 1.8
	luz.position = Vector3(0, 0.8, 0); raiz.add_child(luz)
	# partículas de luz subindo
	var p := CPUParticles3D.new(); p.amount = 40; p.lifetime = 1.6
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE_SURFACE; p.emission_sphere_radius = raio * 0.9
	p.direction = Vector3.UP; p.spread = 10.0; p.initial_velocity_min = 0.6; p.initial_velocity_max = 1.3; p.gravity = Vector3.ZERO
	p.scale_amount_min = 0.5; p.scale_amount_max = 1.0
	var q := QuadMesh.new(); q.size = Vector2(0.1, 0.1); q.material = _mat_brilho(Color(1, 0.9, 0.55)); p.mesh = q
	var g := Gradient.new(); g.set_color(0, Color(1, 0.9, 0.5, 0.0)); g.add_point(0.2, Color(1, 0.9, 0.55, 1)); g.set_color(g.get_point_count() - 1, Color(1, 0.7, 0.2, 0.0))
	p.color_ramp = g; p.scale = Vector3(1, 0.05, 1); p.local_coords = true
	p.scale = Vector3.ONE; p.position = Vector3(0, 0.05, 0); raiz.add_child(p)
	var tw := raiz.create_tween(); tw.tween_method(func(v): sm.set_shader_parameter("t", v), 0.0, dur, dur)
	var tw2 := raiz.create_tween()
	tw2.tween_method(func(v): sm.set_shader_parameter("vida", v); luz.light_energy = 1.4 * v, 0.0, 1.0, 0.25)
	tw2.tween_interval(dur - 0.75)
	tw2.tween_callback(func(): p.emitting = false)
	tw2.tween_method(func(v): sm.set_shader_parameter("vida", v); luz.light_energy = 1.4 * v, 1.0, 0.0, 0.5)
	tw2.tween_callback(raiz.queue_free)
	return raiz

# bolha de luz (Proteção)
static func bolha(alvo: Node3D, dur: float) -> void:
	var b := MeshInstance3D.new(); var s := SphereMesh.new(); s.radius = 1.05; s.height = 2.1; b.mesh = s
	var sm := ShaderMaterial.new(); var sh := Shader.new()
	sh.code = """shader_type spatial; render_mode unshaded, blend_add, depth_draw_never, cull_back;
uniform float vida = 1.0; uniform float t = 0.0;
void fragment() {
  float fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.2);
  float fx = 0.5 + 0.5 * sin(UV.y * 40.0 - t * 5.0);
  ALBEDO = vec3(1.0, 0.85, 0.45); ALPHA = clamp((fr * 0.9 + 0.08 + fx * 0.05) * vida, 0.0, 1.0);
}"""
	sm.shader = sh; b.material_override = sm; b.position = Vector3(0, 0.95, 0); alvo.add_child(b)
	b.scale = Vector3.ONE * 0.3
	var tw := b.create_tween(); tw.tween_property(b, "scale", Vector3.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var tw2 := b.create_tween(); tw2.tween_method(func(v): sm.set_shader_parameter("t", v), 0.0, dur, dur)
	var tw3 := b.create_tween(); tw3.tween_interval(dur - 0.4); tw3.tween_method(func(v): sm.set_shader_parameter("vida", v), 1.0, 0.0, 0.4)
	tw3.tween_callback(b.queue_free)
