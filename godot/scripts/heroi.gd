# Dalarian: modelo do Tripo com esqueleto e animações (exportado da versão web), visual "pintado"
# (luz em faixas + contorno escuro). Anda com joystick/WASD, ataca com o martelo, rola (esquiva).
extends CharacterBody3D
class_name Heroi

const ESCALA := 2.11          # modelo (0,87 m) → altura do herói no jogo
var vel := 4.3
var vida := 200.0; var vida_max := 200.0
var mana := 100.0; var mana_max := 100.0
var vivo := true
var modelo: Node3D
var anim: AnimationPlayer
var martelo: Node3D
var martelo_rot0: Basis
var acao := ""                 # "", "ataque", "esquiva"
var t_acao := 0.0
var acertou := false
var recarga_atk := 0.0
var recarga_esq := 0.0
var dir_esq := Vector3.ZERO
var invul := 0.0
var flash := 0.0
var mira := Vector3(0, 0, 1)
var atk := 20.0
var recarga_q := 0.0; var recarga_e := 0.0
const CUSTO_Q := 35.0; const CUSTO_E := 25.0; const REGEN_MANA := 7.0
const RECARGA_Q := 18.0; const RECARGA_E := 25.0
var morto_t := 0.0
var inicio := Vector3.ZERO
signal acertar(pos: Vector3, frente: Vector3)
signal consagrar(pos: Vector3)
signal proteger
signal ferido(dano: float)

func _ready() -> void:
	var cs := CollisionShape3D.new(); var sh := CapsuleShape3D.new(); sh.radius = 0.32; sh.height = 1.6
	cs.shape = sh; cs.position.y = 0.8; add_child(cs)
	modelo = (load("res://assets/modelos/dalarian.glb") as PackedScene).instantiate()
	modelo.scale = Vector3.ONE * ESCALA
	add_child(modelo)
	anim = modelo.find_child("AnimationPlayer", true, false)
	for n in ["idle", "corrida"]:
		var a := anim.get_animation(n); if a: a.loop_mode = Animation.LOOP_LINEAR
	martelo = modelo.find_child("martelo", true, false)
	if martelo: martelo_rot0 = martelo.basis
	_estilo(modelo)
	tocar("idle")

# luz em faixas (toon) e contorno escuro em todas as malhas
func _estilo(n: Node) -> void:
	if n is MeshInstance3D:
		var mi := n as MeshInstance3D
		for i in mi.get_surface_override_material_count():
			var m := mi.mesh.surface_get_material(i)
			if m is StandardMaterial3D:
				var t := (m as StandardMaterial3D).duplicate() as StandardMaterial3D
				t.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
				t.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
				t.metallic = 0.0; t.roughness = 1.0
				var o := ShaderMaterial.new(); o.shader = load("res://shaders/contorno.gdshader")
				o.set_shader_parameter("espessura", 0.006)
				t.next_pass = o
				mi.set_surface_override_material(i, t)
	for c in n.get_children(): _estilo(c)

func tocar(nome: String, blend := 0.12) -> void:
	if anim.current_animation == nome: return
	anim.play(nome, blend)
	# martelo: em pé ao correr/esquivar, para a frente ao atacar (como nos sprites da versão web)
	if martelo:
		var giro: float = {"corrida": -0.8, "esquiva": -0.8, "dano": -0.8, "morte": -0.8, "consagracao": 0.6, "protecao": 1.2}.get(nome, 0.0)
		martelo.basis = martelo_rot0 * Basis(Vector3.RIGHT, giro)

func mover(entrada: Vector2, atacar: bool, esquivar: bool, delta: float, usar_q := false, usar_e := false) -> void:
	recarga_atk -= delta; recarga_esq -= delta; invul -= delta; flash = max(0.0, flash - delta * 4.0)
	recarga_q = max(0.0, recarga_q - delta); recarga_e = max(0.0, recarga_e - delta)
	mana = min(mana_max, mana + REGEN_MANA * delta)
	if not vivo:
		velocity = Vector3.ZERO; move_and_slide()
		morto_t += delta
		if morto_t > 3.0: _renascer()
		return
	# direção na tela → chão (câmera isométrica girada 45°)
	var d := Vector3(entrada.x + entrada.y, 0, -entrada.x + entrada.y) / sqrt(2.0)
	if d.length() > 1.0: d = d.normalized()
	if acao == "esquiva":
		t_acao += delta
		velocity = dir_esq * 6.8
		if t_acao > 0.34: acao = ""
	elif acao == "consagracao":
		t_acao += delta; velocity = Vector3.ZERO
		if not acertou and t_acao > 0.18: acertou = true; consagrar.emit(global_position)
		if t_acao > 0.9: acao = ""
	elif acao == "protecao":
		t_acao += delta; velocity = Vector3.ZERO
		if not acertou and t_acao > 0.14: acertou = true; invul = 3.0; proteger.emit()
		if t_acao > 0.55: acao = ""
	elif acao == "ataque":
		t_acao += delta
		velocity = d * vel * 0.35
		if not acertou and t_acao > 0.21:
			acertou = true; acertar.emit(global_position, mira)
		if t_acao > 0.42: acao = ""
	else:
		velocity = d * vel
		if d.length() > 0.1: mira = d.normalized()
		if esquivar and recarga_esq <= 0.0:
			acao = "esquiva"; t_acao = 0.0; recarga_esq = 0.8; invul = 0.36
			dir_esq = (d.normalized() if d.length() > 0.1 else mira); mira = dir_esq
			anim.play("esquiva", 0.05); anim.speed_scale = 3.0; tocar_martelo("esquiva")
		elif usar_q and recarga_q <= 0.0 and mana >= CUSTO_Q:
			acao = "consagracao"; t_acao = 0.0; acertou = false; recarga_q = RECARGA_Q; mana -= CUSTO_Q
			anim.play("consagracao", 0.08); anim.speed_scale = 1.2; tocar_martelo("consagracao")
		elif usar_e and recarga_e <= 0.0 and mana >= CUSTO_E:
			acao = "protecao"; t_acao = 0.0; acertou = false; recarga_e = RECARGA_E; mana -= CUSTO_E
			anim.play("protecao", 0.08); anim.speed_scale = 1.4; tocar_martelo("protecao")
		elif atacar and recarga_atk <= 0.0:
			acao = "ataque"; t_acao = 0.0; acertou = false; recarga_atk = 0.55
			anim.stop(); anim.play("ataque", 0.05); anim.seek(0.12, true); anim.speed_scale = 1.9; tocar_martelo("ataque")
		else:
			anim.speed_scale = 1.35 if d.length() > 0.1 else 1.0
			tocar("corrida" if d.length() > 0.1 else "idle")
	if acao == "": anim.speed_scale = 1.35 if d.length() > 0.1 else 1.0
	modelo.rotation.y = lerp_angle(modelo.rotation.y, atan2(mira.x, mira.z), min(1.0, delta * 16.0))
	velocity.y = 0.0
	move_and_slide()

func tocar_martelo(nome: String) -> void:
	if martelo:
		var giro: float = {"esquiva": -0.8, "consagracao": 0.6, "protecao": 1.2}.get(nome, 0.0)
		martelo.basis = martelo_rot0 * Basis(Vector3.RIGHT, giro)

func ferir(dano: float, de := Vector3.INF) -> void:
	if not vivo or invul > 0.0: return
	vida = max(0.0, vida - dano); flash = 1.0
	ferido.emit(dano)
	if de != Vector3.INF:
		var a := global_position - de; a.y = 0
		if a.length() > 0.01: global_position += a.normalized() * 0.25
	if vida <= 0.0:
		vivo = false; morto_t = 0.0; acao = ""; anim.speed_scale = 1.0; anim.play("morte", 0.1)
	elif acao == "":
		anim.play("dano", 0.05); anim.speed_scale = 1.3

func _renascer() -> void:
	vivo = true; vida = vida_max; mana = mana_max; invul = 2.0; global_position = inicio
	acao = ""; anim.speed_scale = 1.0; anim.play("idle", 0.1)
