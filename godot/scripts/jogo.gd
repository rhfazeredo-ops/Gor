# Terra de Gor (Godot) — missão escolhida no quadro da taverna (Estado.missao).
# Câmera isométrica igual à versão web (ortográfica, 45° e 30° de inclinação), luz quente do deserto
# com sombras reais, HUD pintado e música do deserto.
extends Node3D

const VISTA_ALTURA := 330.0 / 45.25     # mesma altura de mundo visível da versão web
var mapa: Mapa
var heroi: Heroi
var cam: Camera3D
var controles: Controles
var mortos := 0
var colhidas := 0
var flores: Array = []
var m: Dictionary
var hud_vida: Control; var hud_mana: Control; var txt_vida: Label; var txt_mana: Label
var txt_obj: Label; var aviso: Label
var concluida := false
var args := {}

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var p := a.trim_prefix("--").split("=")
		args[p[0]] = p[1] if p.size() > 1 else "1"
	randomize()
	m = Estado.missao
	if args.has("missao"): m = Estado.MISSOES[0] if args.missao == "plantas" else Estado.MISSOES[1]
	mapa = Mapa.new(); add_child(mapa); mapa.montar(m.layout)
	if args.has("colisao"): mapa.desenhar_colisoes()
	_luz()
	heroi = Heroi.new(); add_child(heroi); heroi.add_to_group("sombra")
	heroi.position = Vector3(mapa.dados.start.x + 2.5, 0, mapa.dados.start.y + 2.5)
	heroi.inicio = heroi.position
	heroi.acertar.connect(_golpe)
	heroi.consagrar.connect(_consagrar)
	heroi.proteger.connect(func(): Fx.bolha(heroi, 3.0); Fx.faiscas(self, heroi.global_position, 24, Color(1, 0.9, 0.5), 3.0))
	heroi.ferido.connect(func(d): Fx.numero(self, heroi.global_position, int(d), Color(1, 0.35, 0.29)); tremer(0.25))
	cam = Camera3D.new(); cam.projection = Camera3D.PROJECTION_ORTHOGONAL; cam.size = VISTA_ALTURA
	cam.near = 0.1; cam.far = 200.0; add_child(cam)
	if m.inimigos > 0: _escorpioes(m.inimigos)
	if m.plantas: _flores()
	_interface()
	_atmosfera()
	var mus := AudioStreamPlayer.new(); var st: AudioStreamMP3 = load("res://assets/som/deserto.mp3")
	st.loop = true; mus.stream = st; mus.volume_db = -5.0; add_child(mus); mus.play()
	if args.has("shot"): _modo_teste()
	elif args.has("teste"):
		await get_tree().create_timer(3.0).timeout
		get_viewport().get_texture().get_image().save_png(String(args.teste).get_slice("#", 0) + "/6-missao.png")
		get_tree().quit()

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
	# névoa quente ao longe (dá profundidade às bordas do cânion)
	env.fog_enabled = true; env.fog_light_color = Color(0.95, 0.72, 0.5); env.fog_density = 0.0
	env.fog_mode = Environment.FOG_MODE_DEPTH; env.fog_depth_begin = 34.0; env.fog_depth_end = 62.0; env.fog_depth_curve = 1.6
	env.adjustment_enabled = true; env.adjustment_contrast = 1.06; env.adjustment_saturation = 1.04
	amb.environment = env; add_child(amb)

# poeira no ar (segue o herói) e vinheta quente nas bordas da tela
var poeira: CPUParticles3D
func _atmosfera() -> void:
	poeira = CPUParticles3D.new(); poeira.amount = 60; poeira.lifetime = 7.0; poeira.preprocess = 7.0
	poeira.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX; poeira.emission_box_extents = Vector3(14, 3, 14)
	poeira.direction = Vector3(1, 0.1, -0.4); poeira.spread = 25.0; poeira.initial_velocity_min = 0.4; poeira.initial_velocity_max = 1.0
	poeira.gravity = Vector3.ZERO; poeira.scale_amount_min = 0.6; poeira.scale_amount_max = 1.4
	var q := QuadMesh.new(); q.size = Vector2(0.07, 0.07)
	var mm := StandardMaterial3D.new(); mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; mm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mm.albedo_color = Color(1, 0.93, 0.78, 0.55); mm.vertex_color_use_as_albedo = true; q.material = mm; poeira.mesh = q
	var g := Gradient.new(); g.set_color(0, Color(1, 1, 1, 0)); g.add_point(0.3, Color(1, 1, 1, 1)); g.set_color(g.get_point_count() - 1, Color(1, 1, 1, 0))
	poeira.color_ramp = g; poeira.local_coords = false; add_child(poeira)
	var cl := CanvasLayer.new(); cl.layer = -1; add_child(cl)
	var v := ColorRect.new(); v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new(); var sh := Shader.new()
	sh.code = """shader_type canvas_item;
void fragment() {
  vec2 p = UV - 0.5; p.x *= 1.6;
  float v = smoothstep(0.35, 0.95, length(p));
  COLOR = vec4(0.18, 0.07, 0.03, v * 0.55);
}"""
	sm.shader = sh; v.material = sm; cl.add_child(v)

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
		e.set_meta("raio_sombra", 0.9); e.add_to_group("sombra")
		add_child(e)

func _flores() -> void:
	var pecas: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://dados/pecas.json"))
	var tex: Texture2D = load("res://assets/deserto/" + pecas["flores-1"])
	for p in mapa.dados.flores:
		var s := Sprite3D.new(); s.texture = tex; s.billboard = BaseMaterial3D.BILLBOARD_ENABLED; s.shaded = false
		s.alpha_cut = SpriteBase3D.ALPHA_CUT_OPAQUE_PREPASS
		s.pixel_size = 0.95 / tex.get_width(); s.offset = Vector2(0, tex.get_height() / 2.0)
		s.position = Vector3(p[0], 0, p[1]); add_child(s)
		var anel := MeshInstance3D.new(); var tm := TorusMesh.new(); tm.inner_radius = 0.42; tm.outer_radius = 0.5; anel.mesh = tm
		var am := StandardMaterial3D.new(); am.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED; am.albedo_color = Color(1, 0.8, 0.3)
		am.emission_enabled = true; am.emission = Color(1, 0.7, 0.2); anel.material_override = am; anel.position = s.position + Vector3(0, 0.02, 0)
		add_child(anel); flores.append([s, anel])

func _escorpioes_vivos() -> Array:
	var r := []
	for c in get_children(): if c is Escorpiao and c.vivo: r.append(c)
	return r

func _golpe(de: Vector3, frente: Vector3) -> void:
	var alcance := 2.2 / 1.81 + 0.4
	var alvos := []
	for c in _escorpioes_vivos():
		var v: Vector3 = c.global_position - de; v.y = 0
		var d := v.length()
		if d > alcance + 0.42: continue
		if d > 0.35 and v.normalized().dot(frente) < 0.25: continue
		alvos.append([d, c])
	alvos.sort_custom(func(x, y): return x[0] < y[0])
	for i in alvos.size():
		var e: Escorpiao = alvos[i][1]
		var dano := roundi(heroi.atk * (0.6 if i > 0 else 1.0) * randf_range(0.9, 1.1))
		e.ferir(dano, de); Fx.numero(self, e.global_position, dano)
		Fx.faiscas(self, e.global_position, 12 if i == 0 else 6, Color(1, 0.9, 0.6), 3.5, 0.5)
	if alvos.size() > 0: pausa_impacto(0.055); tremer(0.25)

# Consagração: martelo de luz cai, dano e empurrão no impacto, área dourada que fere por 6 s
var areas := []
func _consagrar(pos: Vector3) -> void:
	var R := 3.0 / 1.81
	Fx.martelo_de_luz(self, pos, func():
		pausa_impacto(0.1); tremer(1.0)
		Fx.anel(self, pos, R + 0.9); Fx.faiscas(self, pos, 50, Color(1, 0.85, 0.4), 6.0, 0.2)
		Fx.consagracao(self, pos, R, 6.0)
		for e in _escorpioes_vivos():
			var v: Vector3 = e.global_position - pos; v.y = 0
			if v.length() < R + 0.42:
				var dano := roundi(heroi.atk * 1.2); e.ferir(dano, pos, 4.0); Fx.numero(self, e.global_position, dano, Color(1, 0.88, 0.4))
		areas.append({ "pos": pos, "R": R, "dps": heroi.atk * 0.2 * 5.0, "resta": 6.0, "tick": 0.5 }))

func _areas(delta: float) -> void:
	for a in areas.duplicate():
		a.resta -= delta; a.tick -= delta
		if a.tick <= 0.0:
			a.tick = 0.5
			for e in _escorpioes_vivos():
				var v: Vector3 = e.global_position - a.pos; v.y = 0
				if v.length() < a.R + 0.42:
					var dano := roundi(a.dps * 0.5); e.ferir(dano, a.pos, 0.3); Fx.numero(self, e.global_position, dano, Color(1, 0.88, 0.4))
		if a.resta <= 0.0: areas.erase(a)

# pausa de impacto (o mundo quase congela por um instante) e tremor da câmera
func pausa_impacto(seg: float) -> void:
	Engine.time_scale = 0.05
	await get_tree().create_timer(seg, true, false, true).timeout
	Engine.time_scale = 1.0

var tremor := 0.0
func tremer(f: float) -> void: tremor = max(tremor, f)

func _physics_process(delta: float) -> void:
	heroi.mover(controles.dir, controles.atacar, controles.consumir_esquiva(), delta, controles.consumir_q(), controles.consumir_e())
	_areas(delta)
	if poeira: poeira.global_position = heroi.global_position + Vector3(0, 1.5, 0)
	mapa.animar(delta, heroi, cam)
	if mapa.splat: mapa.splat.sombras(get_tree().get_nodes_in_group("sombra"))
	if m.plantas:
		if args.has("pegar") and controles.bp.visible: controles.pegar = true; args.erase("pegar")
		_colher()
	controles.bq.definir(heroi.recarga_q / heroi.RECARGA_Q, heroi.recarga_q, heroi.mana >= heroi.CUSTO_Q)
	controles.be.definir(heroi.recarga_e / heroi.RECARGA_E, heroi.recarga_e, heroi.mana >= heroi.CUSTO_E)
	var alvo := heroi.global_position + Vector3(heroi.mira.x, 0, heroi.mira.z) * 0.9
	var desejo := alvo + Vector3(1, 0, 1).normalized() * 30.0 * cos(deg_to_rad(30)) + Vector3.UP * 30.0 * sin(deg_to_rad(30))
	cam.global_position = cam.global_position.lerp(desejo, min(1.0, delta * 6.0)) if cam.global_position != Vector3.ZERO else desejo
	cam.look_at(cam.global_position - (desejo - alvo), Vector3.UP)
	if args.has("ponto"):
		var pp := String(args.ponto).split(","); heroi.global_position = Vector3(float(pp[0]), 0, float(pp[1])); args.erase("ponto")
	if args.has("geral"):
		var c := Vector3(mapa.dados.w / 2.0, 0, mapa.dados.h / 2.0); cam.size = 62.0
		cam.global_position = c + Vector3(1, 0, 1).normalized() * 30.0 * cos(deg_to_rad(30)) + Vector3.UP * 30.0 * sin(deg_to_rad(30))
		cam.look_at(c, Vector3.UP)
	tremor = max(0.0, tremor - delta * 2.5)
	cam.h_offset = randf_range(-1, 1) * tremor * 0.12; cam.v_offset = randf_range(-1, 1) * tremor * 0.12
	_atualizar_hud()

const ALCANCE_PEGAR := 1.5
# planta mais próxima ao alcance (ou null)
func _flor_perto():
	var melhor = null; var dm := ALCANCE_PEGAR
	for f in flores:
		var s: Sprite3D = f[0]
		var dd := Vector2(heroi.global_position.x - s.position.x, heroi.global_position.z - s.position.z).length()
		if dd < dm: dm = dd; melhor = f
	return melhor

# só colhe quando o jogador aperta "Pegar" (botão na tela ou F no teclado)
func _colher() -> void:
	var f = _flor_perto() if heroi.vivo else null
	controles.mostrar_pegar(f != null)
	if f == null or not controles.consumir_pegar(): return
	var s: Sprite3D = f[0]
	colhidas += 1; flores.erase(f)
	Fx.faiscas(self, s.position, 22, Color(1, 0.6, 0.3), 3.5, 0.3)
	f[1].queue_free()
	var tw := s.create_tween()
	tw.tween_property(s, "position", s.position + Vector3(0, 1.2, 0), 0.35).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(s, "modulate:a", 0.0, 0.35)
	tw.tween_callback(s.queue_free)
	_faixa("Planta rara coletada (%d/%d)" % [min(colhidas, m.alvo), m.alvo])

func _atualizar_hud() -> void:
	_barra(hud_vida, heroi.vida / heroi.vida_max); _barra(hud_mana, heroi.mana / heroi.mana_max)
	txt_vida.text = "%d / %d" % [ceil(heroi.vida), heroi.vida_max]; txt_mana.text = "%d / %d" % [heroi.mana, heroi.mana_max]
	var feito: int = colhidas if m.tipo == "coletar" else mortos
	txt_obj.text = "%s (%d/%d)." % [m.texto, min(feito, m.alvo), m.alvo]
	if feito >= m.alvo and not concluida:
		concluida = true; _fim("Missão concluída!")
	aviso.visible = concluida or not heroi.vivo
	if not heroi.vivo and not concluida: aviso.text = "Você caiu… voltando em instantes" 

var faixa: Label
func _faixa(t: String) -> void:
	if faixa == null:
		faixa = Label.new(); faixa.add_theme_font_size_override("font_size", 46); faixa.add_theme_color_override("font_color", Color(1, 0.86, 0.45))
		faixa.add_theme_constant_override("outline_size", 12); faixa.add_theme_color_override("font_outline_color", Color.BLACK)
		faixa.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; faixa.set_anchors_preset(Control.PRESET_CENTER_TOP)
		faixa.size = Vector2(1200, 80); faixa.position = Vector2(-600, 230); aviso.get_parent().add_child(faixa)
	faixa.text = t; faixa.modulate.a = 1.0
	var tw := faixa.create_tween(); tw.tween_interval(1.2); tw.tween_property(faixa, "modulate:a", 0.0, 0.4)

func _fim(msg: String) -> void:
	aviso.text = msg; aviso.visible = true
	var ok := Button.new(); ok.text = "Voltar à taverna"; ok.add_theme_font_size_override("font_size", 44)
	var st := StyleBoxFlat.new(); st.bg_color = Color(0.2, 0.31, 0.75); st.border_color = Color(0.95, 0.78, 0.36); st.set_border_width_all(5); st.set_corner_radius_all(16)
	st.content_margin_left = 40; st.content_margin_right = 40; st.content_margin_top = 14; st.content_margin_bottom = 14
	for k in ["normal", "hover", "pressed"]: ok.add_theme_stylebox_override(k, st)
	ok.set_anchors_preset(Control.PRESET_CENTER); ok.position = Vector2(-220, -40); ok.size = Vector2(440, 100)
	aviso.get_parent().add_child(ok)
	ok.pressed.connect(func(): Estado.ir_para = "lobby"; get_tree().change_scene_to_file("res://cenas/menu.tscn"))

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
	if cena == "habilidade":
		var alvo2: Escorpiao = null
		for c in get_children(): if c is Escorpiao: alvo2 = c; break
		if alvo2: alvo2.global_position = heroi.global_position + Vector3(1.4, 0, 0)
		await get_tree().create_timer(0.6).timeout
		controles.usar_q = true
		if args.has("seq"):
			for i in 5:
				await get_tree().create_timer(float(args.seq)).timeout
				get_viewport().get_texture().get_image().save_png(String(args.shot).replace(".png", "-%d.png" % i))
			get_tree().quit(); return
		await get_tree().create_timer(0.5).timeout
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
