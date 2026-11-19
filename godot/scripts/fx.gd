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

# área dourada no chão (Consagração): pulsa enquanto dura
static func consagracao(pai: Node, pos: Vector3, raio: float, dur: float) -> MeshInstance3D:
	var d := MeshInstance3D.new(); var c := CylinderMesh.new(); c.top_radius = raio; c.bottom_radius = raio; c.height = 0.02; c.radial_segments = 48
	d.mesh = c
	var sm := ShaderMaterial.new(); var sh := Shader.new()
	sh.code = """shader_type spatial; render_mode unshaded, blend_add, depth_draw_never, cull_disabled;
uniform float t = 0.0; uniform float vida = 1.0;
void fragment() {
  vec2 p = UV * 2.0 - 1.0; float r = length(p);
  float borda = smoothstep(0.82, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r));
  float runas = 0.5 + 0.5 * sin(atan(p.y, p.x) * 12.0 + t * 2.0);
  float miolo = (1.0 - r) * 0.16 * (0.75 + 0.25 * sin(t * 4.0));
  vec3 cor = vec3(1.0, 0.78, 0.32);
  ALBEDO = cor; ALPHA = clamp((borda * (0.7 + 0.3 * runas) + miolo) * vida, 0.0, 1.0);
}"""
	sm.shader = sh; d.material_override = sm; d.position = pos + Vector3(0, 0.03, 0); pai.add_child(d)
	var luz := OmniLight3D.new(); luz.light_color = Color(1, 0.8, 0.4); luz.light_energy = 1.5; luz.omni_range = raio * 1.6
	luz.position = Vector3(0, 1.0, 0); d.add_child(luz)
	var tw := d.create_tween(); tw.tween_method(func(v): sm.set_shader_parameter("t", v), 0.0, dur, dur)
	var tw2 := d.create_tween(); tw2.tween_interval(dur - 0.5); tw2.tween_method(func(v): sm.set_shader_parameter("vida", v); luz.light_energy = 1.5 * v, 1.0, 0.0, 0.5)
	tw2.tween_callback(d.queue_free)
	return d

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
