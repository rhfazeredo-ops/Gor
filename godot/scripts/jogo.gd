# Terra de Gor (Godot) — fatia de teste: missão "Mate 20 escorpiões" no Ninho dos Escorpiões.
# Câmera isométrica igual à versão web (ortográfica, 45° e 30° de inclinação), luz quente do deserto
# com sombras reais, HUD pintado e música do deserto.
extends Node3D

const VISTA_ALTURA := 330.0 / 45.25     # mesma altura de mundo visível da versão web
var mapa: Mapa
var heroi: Heroi
var cam: Camera3D
var controles: Controles
var mortos := 0
const ALVO := 20
var hud_vida: Control; var hud_mana: Control; var txt_vida: Label; var txt_mana: Label
var txt_obj: Label; var aviso: Label
var concluida := false
var args := {}

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var p := a.trim_prefix("--").split("=")
		args[p[0]] = p[1] if p.size() > 1 else "1"
	randomize()
	mapa = Mapa.new(); add_child(mapa); mapa.montar("ninho")
	_luz()
	heroi = Heroi.new(); add_child(heroi)
	heroi.position = Vector3(mapa.dados.start.x + 2.5, 0, mapa.dados.start.y + 2.5)
	heroi.acertar.connect(_golpe)
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.size = VISTA_ALTURA
	cam.near = 0.1; cam.far = 200.0; add_child(cam)
	_escorpioes(ALVO)
	_interface()
	var mus := AudioStreamPlayer.new(); var st: AudioStreamMP3 = load("res://assets/som/deserto.mp3")
	st.loop = true; mus.stream = st; mus.volume_db = -5.0; add_child(mus); mus.play()
	if args.has("shot"): _modo_teste()

func _luz() -> void:
	var sol := DirectionalLight3D.new()
	sol.light_color = Color(1.0, 0.92, 0.8); sol.light_energy = 0.55
	sol.shadow_opacity = 0.9; sol.shadow_blur = 1.5
	sol.rotation_degrees = Vector3(-52, -100, 0)
	sol.shadow_enabled = true; sol.directional_shadow_max_distance = 40.0
	add_child(sol)
	var amb := WorldEnvironment.new(); var env := Environment.new()
	env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.05, 0.04, 0.08)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(1.0, 0.86, 0.7); env.ambient_light_energy = 0.62
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	amb.environment = env; add_child(amb)

func _escorpioes(n: int) -> void:
	var st := Vector2(heroi.position.x, heroi.position.z)
	var pos: Array[Vector2] = []
	var tent := 0
	while pos.size() < n and tent < 4000:
		tent += 1
		var p := Vector2(randf_range(4, mapa.dados.w - 4), randf_range(4, mapa.dados.h - 4))
		if p.distance_to(st) < 9.0 or not mapa.livre(p.x, p.y, 0.5): continue
		var ok := true
		for q in pos: if q.distance_to(p) < 4.0: ok = false; break
		if ok: pos.append(p)
	for p in pos:
		var e := Escorpiao.new(); e.heroi = heroi; e.position = Vector3(p.x, 0, p.y)
		e.morreu.connect(func(): mortos += 1)
		add_child(e)

func _golpe(de: Vector3, frente: Vector3) -> void:
	for e in get_tree().get_nodes_in_group("_") : pass
	for c in get_children():
		if c is Escorpiao and c.vivo:
			var v: Vector3 = c.global_position - de; v.y = 0
			if v.length() < 1.9 + 0.42 and (v.length() < 0.6 or v.normalized().dot(frente) > 0.2):
				c.ferir(20.0, de)

func _physics_process(delta: float) -> void:
	heroi.mover(controles.dir, controles.atacar, controles.consumir_esquiva(), delta)
	var alvo := heroi.global_position + Vector3(heroi.mira.x, 0, heroi.mira.z) * 0.9
	var desejo := alvo + Vector3(1, 0, 1).normalized() * 30.0 * cos(deg_to_rad(30)) + Vector3.UP * 30.0 * sin(deg_to_rad(30))
	cam.global_position = cam.global_position.lerp(desejo, min(1.0, delta * 6.0)) if cam.global_position != Vector3.ZERO else desejo
	cam.look_at(cam.global_position - (desejo - alvo), Vector3.UP)
	_atualizar_hud()

func _atualizar_hud() -> void:
	_barra(hud_vida, heroi.vida / heroi.vida_max); _barra(hud_mana, heroi.mana / heroi.mana_max)
	txt_vida.text = "%d / %d" % [ceil(heroi.vida), heroi.vida_max]; txt_mana.text = "%d / %d" % [heroi.mana, heroi.mana_max]
	txt_obj.text = "Mate 20 escorpiões (%d/%d)." % [min(mortos, ALVO), ALVO]
	if mortos >= ALVO and not concluida:
		concluida = true; aviso.text = "Missão concluída!"; aviso.visible = true
	if not heroi.vivo and not concluida:
		aviso.text = "Você caiu…"; aviso.visible = true

# ---------------- interface ----------------
const HUD_W := 560.0
func _interface() -> void:
	var cl := CanvasLayer.new(); add_child(cl)
	var info: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/ui/hud.json"))
	var k: float = HUD_W / float(info.w)
	var hud := Control.new(); hud.position = Vector2(14, 10); cl.add_child(hud)
	var base := TextureRect.new(); base.texture = load("res://assets/ui/base.webp")
	base.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; base.size = Vector2(HUD_W, info.h * k); hud.add_child(base)
	hud_vida = _barra_nova(hud, "res://assets/ui/hp.webp", info, k)
	hud_mana = _barra_nova(hud, "res://assets/ui/mp.webp", info, k)
	txt_vida = _texto_barra(hud, info.bars.hp, k); txt_mana = _texto_barra(hud, info.bars.mp, k)
	var ob := Label.new(); ob.text = "OBJETIVO"; ob.position = Vector2(30, info.h * k + 6)
	ob.add_theme_font_size_override("font_size", 26); ob.add_theme_color_override("font_color", Color(1, 0.85, 0.42))
	ob.add_theme_constant_override("outline_size", 8); ob.add_theme_color_override("font_outline_color", Color.BLACK); hud.add_child(ob)
	txt_obj = Label.new(); txt_obj.position = Vector2(30, info.h * k + 40)
	txt_obj.add_theme_font_size_override("font_size", 26); txt_obj.add_theme_constant_override("outline_size", 8)
	txt_obj.add_theme_color_override("font_outline_color", Color.BLACK); hud.add_child(txt_obj)
	aviso = Label.new(); aviso.visible = false; aviso.set_anchors_preset(Control.PRESET_CENTER)
	aviso.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; aviso.add_theme_font_size_override("font_size", 72)
	aviso.add_theme_color_override("font_color", Color(1, 0.86, 0.45)); aviso.add_theme_constant_override("outline_size", 16)
	aviso.add_theme_color_override("font_outline_color", Color.BLACK); aviso.size = Vector2(1000, 120); aviso.position = Vector2(-500, -200)
	cl.add_child(aviso)
	controles = Controles.new(); cl.add_child(controles)

func _barra_nova(pai: Control, tex: String, info: Dictionary, k: float) -> Control:
	var corte := Control.new(); corte.clip_contents = true; corte.size = Vector2(HUD_W, info.h * k); pai.add_child(corte)
	var t := TextureRect.new(); t.texture = load(tex); t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.size = Vector2(HUD_W, info.h * k); corte.add_child(t)
	var b: Dictionary = info.bars.hp if tex.ends_with("hp.webp") else info.bars.mp
	corte.set_meta("x0", b.x * k); corte.set_meta("w", b.w * k)
	return corte

func _barra(c: Control, f: float) -> void:
	c.size.x = c.get_meta("x0") + c.get_meta("w") * clamp(f, 0.0, 1.0)

func _texto_barra(pai: Control, b: Dictionary, k: float) -> Label:
	var l := Label.new(); l.position = Vector2(b.x * k, b.y * k); l.size = Vector2(b.w * k * 0.94, b.h * k)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", int(b.h * k * 0.62)); l.add_theme_constant_override("outline_size", 6)
	l.add_theme_color_override("font_outline_color", Color.BLACK); pai.add_child(l); return l

# ---------------- teste automático (prints) ----------------
func _modo_teste() -> void:
	var cena: String = args.get("cena", "inicio")
	if cena == "luta":
		var alvo: Escorpiao = null
		for c in get_children(): if c is Escorpiao: alvo = c; break
		if alvo: alvo.global_position = heroi.global_position + Vector3(2.0, 0, -0.5)
	await get_tree().create_timer(float(args.get("espera", "3"))).timeout
	get_viewport().get_texture().get_image().save_png(args.shot)
	if args.has("shot2"):
		await get_tree().create_timer(1.0).timeout
		get_viewport().get_texture().get_image().save_png(args.shot2)
	get_tree().quit()
