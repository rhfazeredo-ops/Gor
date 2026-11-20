# Chão de teste feito de "Gaussian splats" em estilo pixel art (ver shaders/splat_chao.gdshader).
# Milhares de manchinhas elípticas deitadas no chão, em blocos de 8×8 tiles (o Godot só desenha
# os blocos que estão na tela). A câmera não gira e os splats são opacos: não há ordenação.
extends Node3D
class_name ChaoSplat

const BLOCO := 8
const POR_TILE := 4          # splats por tile (~25 mil no mapa todo)

var sm: ShaderMaterial

# sombras dos personagens (o renderizador de celular não projeta sombra real em MultiMesh)
func sombras(nos: Array) -> void:
	var lista: Array[Vector4] = []
	for n in nos:
		if lista.size() >= 24: break
		if not (n is Node3D) or not n.is_visible_in_tree(): continue
		var p: Vector3 = n.global_position
		lista.append(Vector4(p.x, p.z, n.get_meta("raio_sombra", 0.45), clamp(1.0 - p.y * 0.8, 0.0, 1.0)))
	var n := lista.size()
	while lista.size() < 24: lista.append(Vector4(0, 0, 1, 0))
	sm.set_shader_parameter("sombras", lista)
	sm.set_shader_parameter("n_sombras", n)

func montar(mapa: Mapa, mat_base: ShaderMaterial) -> void:
	var w: int = int(mapa.dados.w); var h: int = int(mapa.dados.h)
	sm = ShaderMaterial.new(); sm.shader = load("res://shaders/splat_chao.gdshader")
	for p in ["tex", "mascara", "tam_tex", "tam_mapa"]: sm.set_shader_parameter(p, mat_base.get_shader_parameter(p))
	var quad := PlaneMesh.new(); quad.size = Vector2(1, 1)
	var rng := RandomNumberGenerator.new(); rng.seed = 7
	var margem := 6
	for by in range(-margem, h + margem, BLOCO):
		for bx in range(-margem, w + margem, BLOCO):
			var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; mm.use_custom_data = true
			mm.mesh = quad
			var n := BLOCO * BLOCO * POR_TILE
			mm.instance_count = n
			for i in n:
				var x := bx + rng.randf() * BLOCO; var z := by + rng.randf() * BLOCO
				var fenda := rng.randf() < 0.08
				var tam := rng.randf_range(0.5, 0.9) if fenda else rng.randf_range(0.8, 1.5)
				var alongado := rng.randf_range(0.12, 0.2) if fenda else rng.randf_range(0.55, 1.0)
				var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(tam, 1.0, tam * alongado))
				mm.set_instance_transform(i, Transform3D(b, Vector3(x, (0.025 if fenda else 0.002) + rng.randf() * 0.02, z)))
				mm.set_instance_custom_data(i, Color(rng.randf(), 1.0 if fenda else 0.0, 0, 0))
			var mi := MultiMeshInstance3D.new(); mi.multimesh = mm; mi.material_override = sm
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(mi)
