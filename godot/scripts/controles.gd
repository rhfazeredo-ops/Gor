# Controles de toque: joystick à esquerda (aparece onde o dedo toca), botões de ataque e esquiva à direita.
# No PC também funcionam WASD / setas, espaço (atacar) e shift (esquivar).
extends Control
class_name Controles

var dir := Vector2.ZERO
var atacar := false
var _botao := false
var usar_q := false
var usar_e := false
var bq: BotaoHab
var be: BotaoHab
var esquivar := false
var pegar := false
var bp: Button
var _dedo := -1
var _centro := Vector2.ZERO
var _ponta := Vector2.ZERO
const RAIO := 110.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var atk := TextureButton.new()
	atk.texture_normal = load("res://assets/ui/ataque.png")
	atk.ignore_texture_size = true; atk.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	atk.custom_minimum_size = Vector2(190, 190); atk.size = Vector2(190, 190)
	atk.anchor_left = 1; atk.anchor_top = 1; atk.anchor_right = 1; atk.anchor_bottom = 1
	atk.offset_left = -250; atk.offset_top = -260; atk.offset_right = -60; atk.offset_bottom = -70
	atk.button_down.connect(func(): _botao = true)
	atk.button_up.connect(func(): _botao = false)
	add_child(atk)
	bq = BotaoHab.criar(self, "res://assets/ui/consagracao.png", -430, -340, 140)
	bq.button_down.connect(func(): usar_q = true)
	be = BotaoHab.criar(self, "res://assets/ui/protecao.png", -230, -450, 140)
	be.button_down.connect(func(): usar_e = true)
	var esq := Button.new(); esq.text = "⇄"; esq.add_theme_font_size_override("font_size", 64)
	esq.anchor_left = 1; esq.anchor_top = 1; esq.anchor_right = 1; esq.anchor_bottom = 1
	esq.offset_left = -430; esq.offset_top = -180; esq.offset_right = -300; esq.offset_bottom = -50
	var st := StyleBoxFlat.new(); st.bg_color = Color(0.17, 0.11, 0.07, 0.85); st.set_corner_radius_all(65)
	st.border_color = Color(0.79, 0.64, 0.29); st.set_border_width_all(5)
	esq.add_theme_stylebox_override("normal", st); esq.add_theme_stylebox_override("pressed", st); esq.add_theme_stylebox_override("hover", st)
	esq.button_down.connect(func(): esquivar = true)
	add_child(esq)
	# botão de interação (só aparece perto de algo que dá para pegar)
	bp = Button.new(); bp.text = "PEGAR"; bp.add_theme_font_size_override("font_size", 40)
	bp.add_theme_color_override("font_color", Color(1, 0.95, 0.8)); bp.add_theme_constant_override("outline_size", 8)
	bp.add_theme_color_override("font_outline_color", Color(0.15, 0.07, 0.02))
	bp.anchor_left = 1; bp.anchor_top = 1; bp.anchor_right = 1; bp.anchor_bottom = 1
	bp.offset_left = -700; bp.offset_top = -230; bp.offset_right = -470; bp.offset_bottom = -120
	var sp := StyleBoxFlat.new(); sp.bg_color = Color(0.2, 0.42, 0.16, 0.92); sp.set_corner_radius_all(55)
	sp.border_color = Color(0.98, 0.82, 0.38); sp.set_border_width_all(6); sp.shadow_size = 10; sp.shadow_color = Color(0, 0, 0, 0.4)
	var sp2 := sp.duplicate(); sp2.bg_color = Color(0.3, 0.58, 0.22, 0.95)
	bp.add_theme_stylebox_override("normal", sp); bp.add_theme_stylebox_override("hover", sp); bp.add_theme_stylebox_override("pressed", sp2)
	bp.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	bp.button_down.connect(func(): pegar = true)
	bp.visible = false; add_child(bp)

func _input(e: InputEvent) -> void:
	if e is InputEventScreenTouch:
		if e.pressed and _dedo == -1 and e.position.x < get_viewport_rect().size.x * 0.45:
			_dedo = e.index; _centro = e.position; _ponta = e.position
		elif not e.pressed and e.index == _dedo:
			_dedo = -1; dir = Vector2.ZERO
		queue_redraw()
	elif e is InputEventScreenDrag and e.index == _dedo:
		_ponta = e.position
		var v: Vector2 = (_ponta - _centro) / RAIO
		dir = v.limit_length(1.0) if v.length() > 0.15 else Vector2.ZERO
		queue_redraw()

func _process(_d: float) -> void:
	var k := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	if Input.is_key_pressed(KEY_A): k.x -= 1
	if Input.is_key_pressed(KEY_D): k.x += 1
	if Input.is_key_pressed(KEY_W): k.y -= 1
	if Input.is_key_pressed(KEY_S): k.y += 1
	if k.length() > 0.0 and _dedo == -1: dir = k.limit_length(1.0)
	elif _dedo == -1 and k.length() == 0.0: dir = Vector2.ZERO
	atacar = _botao or Input.is_key_pressed(KEY_SPACE)
	if Input.is_key_pressed(KEY_SHIFT): esquivar = true
	if Input.is_key_pressed(KEY_Q): usar_q = true
	if Input.is_key_pressed(KEY_E): usar_e = true
	if Input.is_key_pressed(KEY_F) and bp.visible: pegar = true

func consumir_q() -> bool:
	var v := usar_q; usar_q = false; return v

func consumir_e() -> bool:
	var v := usar_e; usar_e = false; return v

func consumir_pegar() -> bool:
	var v := pegar; pegar = false; return v

# mostra/esconde o botão de pegar (com um pulinho ao aparecer)
func mostrar_pegar(sim: bool) -> void:
	if sim == bp.visible: return
	bp.visible = sim
	if not sim: pegar = false; return
	bp.pivot_offset = bp.size / 2.0; bp.scale = Vector2(0.6, 0.6)
	bp.create_tween().tween_property(bp, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func consumir_esquiva() -> bool:
	var e := esquivar; esquivar = false; return e

func _draw() -> void:
	if _dedo == -1: return
	draw_circle(_centro, RAIO, Color(1, 0.9, 0.7, 0.18))
	draw_arc(_centro, RAIO, 0, TAU, 48, Color(0.95, 0.8, 0.45, 0.6), 4.0)
	draw_circle(_centro + (_ponta - _centro).limit_length(RAIO), 52, Color(1, 0.92, 0.75, 0.55))

# botão redondo de habilidade com recarga (escurece em "pizza" e mostra os segundos)
class BotaoHab extends TextureButton:
	var frac := 0.0; var seg := 0.0; var sem_mana := false
	static func criar(pai: Control, icone: String, x: float, y: float, t: float) -> BotaoHab:
		var b := BotaoHab.new(); b.texture_normal = load(icone); b.ignore_texture_size = true
		b.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
		b.anchor_left = 1; b.anchor_top = 1; b.anchor_right = 1; b.anchor_bottom = 1
		b.offset_left = x; b.offset_top = y; b.offset_right = x + t; b.offset_bottom = y + t
		b.clip_contents = true; pai.add_child(b); return b
	func definir(f: float, s: float, mana_ok: bool) -> void:
		frac = f; seg = s; sem_mana = not mana_ok; queue_redraw()
	func _draw() -> void:
		var c := size / 2.0; var r: float = min(size.x, size.y) / 2.0
		if sem_mana and frac <= 0.0: draw_rect(Rect2(Vector2.ZERO, size), Color(0.05, 0.08, 0.25, 0.5))
		if frac > 0.0:
			var pts := PackedVector2Array([c]); var n := 40
			for i in n + 1:
				var a := -PI / 2.0 + TAU * frac * float(i) / n
				pts.append(c + Vector2(cos(a), sin(a)) * r * 1.5)
			draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0))
			draw_colored_polygon(pts, Color(0.03, 0.02, 0.06, 0.72))
			var f := get_theme_default_font()
			draw_string_outline(f, Vector2(0, c.y + 18), str(int(ceil(seg))), HORIZONTAL_ALIGNMENT_CENTER, size.x, 52, 10, Color.BLACK)
			draw_string(f, Vector2(0, c.y + 18), str(int(ceil(seg))), HORIZONTAL_ALIGNMENT_CENTER, size.x, 52, Color(1, 0.95, 0.85))
