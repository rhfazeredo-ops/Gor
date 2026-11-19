# Escorpião do deserto: modelo do Tripo pintado com as referências; animação no shader (escorpiao.gdshader).
# Persegue o herói, para perto, arma o ferrão e dá o bote. 140 de vida; ao morrer afunda na areia e some.
extends CharacterBody3D
class_name Escorpiao

const ESCALA := 2.61
var vida := 140.0; var vida_max := 140.0
var vel := 1.55; var dano := 18.0
var vivo := true
var heroi: Heroi
var estado := "parado"; var t := 0.0; var t_est := 0.0; var recarga := 0.8; var acertou := false
var dir := Vector3(0, 0, 1)
var empurrao := Vector3.ZERO
var flash := 0.0; var t_morte := -1.0
var vagar := Vector3.ZERO; var t_vagar := 0.0
var mat: ShaderMaterial; var mat_c: ShaderMaterial
var modelo: Node3D
signal morreu

func _ready() -> void:
	var cs := CollisionShape3D.new(); var sh := CylinderShape3D.new(); sh.radius = 0.42; sh.height = 1.0
	cs.shape = sh; cs.position.y = 0.5; add_child(cs)
	modelo = (load("res://assets/modelos/escorpiao.glb") as PackedScene).instantiate()
	modelo.scale = Vector3.ONE * ESCALA; add_child(modelo)
	mat = ShaderMaterial.new(); mat.shader = load("res://shaders/escorpiao.gdshader")
	mat_c = ShaderMaterial.new(); mat_c.shader = load("res://shaders/escorpiao_contorno.gdshader")
	mat_c.set_shader_parameter("espessura", 0.008)
	mat.next_pass = mat_c
	for mi in modelo.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).material_override = mat
	t = randf() * 3.0

func _p(nome: String, v: float) -> void:
	mat.set_shader_parameter(nome, v); mat_c.set_shader_parameter(nome, v)

func ferir(d: float, de: Vector3) -> void:
	if not vivo: return
	vida -= d; flash = 1.0
	var a := global_position - de; a.y = 0
	empurrao = a.normalized() * 1.2
	if vida <= 0.0:
		vivo = false; t_morte = 0.0; morreu.emit()
		collision_layer = 0; collision_mask = 0
	elif estado != "ataque":
		estado = "dano"; t_est = 0.0

func _physics_process(delta: float) -> void:
	t += delta; recarga -= delta; flash = max(0.0, flash - delta * 4.0)
	_p("flash", flash)
	if not vivo:
		t_morte += delta
		var k: float = min(1.0, t_morte / 0.6)
		modelo.position.y = -0.4 * k; modelo.scale = Vector3.ONE * ESCALA * (1.0 - 0.3 * k)
		_p("flash", 1.0 - k)
		if t_morte > 0.6: queue_free()
		return
	var para := heroi.global_position - global_position; para.y = 0
	var dist := para.length()
	var mov := Vector3.ZERO
	if estado == "ataque":
		t_est += delta
		var u: float = min(1.0, t_est / 0.62)
		var a: float = (-0.32 * smoothstep(0.0, 0.45, u)) if u < 0.45 else ((-0.32 + 1.05 * smoothstep(0.45, 0.62, u)) if u < 0.62 else 0.73 * (1.0 - smoothstep(0.7, 1.0, u)))
		_pose(0.0, 0.0, a, 0.0, 1.0 if u < 0.5 else 0.0, 0.6 if (u > 0.45 and u < 0.85) else 0.15, 0.06 if (u > 0.5 and u < 0.8) else 0.0)
		if not acertou and t_est > 0.36:
			acertou = true
			var ponta := global_position + dir * 0.8
			if heroi.vivo and Vector2(heroi.global_position.x - ponta.x, heroi.global_position.z - ponta.z).length() < 0.75 + 0.32:
				heroi.ferir(dano)
		if t_est > 0.62: estado = "parado"; recarga = 1.4 + randf() * 0.6
	elif estado == "dano":
		t_est += delta
		var u2: float = min(1.0, t_est / 0.28)
		_pose(0.0, 0.0, -0.15 * sin(u2 * PI), 0.0, 1.0, -0.3, -0.16 * sin(u2 * PI))
		if t_est > 0.28: estado = "parado"
	else:
		var ve := heroi.vivo and dist < 8.0
		if ve and dist < 1.25 + 0.42 and recarga <= 0.0:
			estado = "ataque"; t_est = 0.0; acertou = false; dir = para.normalized()
		elif ve and dist > 1.0 + 0.42:
			mov = para.normalized()
		elif not ve:
			t_vagar -= delta
			if t_vagar <= 0.0:
				var ang := randf() * TAU; vagar = Vector3(cos(ang), 0, sin(ang)) * (0.0 if randf() < 0.5 else 0.5); t_vagar = 1.5 + randf() * 2.0
			mov = vagar
		elif ve: dir = para.normalized()
		if mov.length() > 0.01:
			dir = dir.lerp(mov.normalized(), min(1.0, delta * 8.0)).normalized()
			var u3 := fmod(t * 1.75, 1.0)
			_pose(u3, 1.0, sin(u3 * TAU * 2.0) * 0.05, sin(u3 * TAU) * 0.8, 0.2, 0.1, 0.0)
		else:
			var u4 := fmod(t / 1.0, 1.0)
			_pose(0.0, 0.0, sin(u4 * TAU) * 0.07, sin(u4 * TAU) * 0.6, (sin(u4 * TAU * 2.0) * 0.5 + 0.5) * 0.6, 0.0, 0.0)
	velocity = mov * vel + empurrao
	empurrao *= pow(0.001, delta)
	move_and_slide()
	modelo.rotation.y = lerp_angle(modelo.rotation.y, atan2(dir.x, dir.z), min(1.0, delta * 10.0))

func _pose(walk: float, walk_amt: float, tail: float, sway: float, pinch: float, claws: float, lean: float) -> void:
	_p("walk", walk); _p("walk_amt", walk_amt); _p("tail", tail); _p("sway", sway)
	_p("pinch", pinch); _p("claws", claws); _p("lean", lean)
