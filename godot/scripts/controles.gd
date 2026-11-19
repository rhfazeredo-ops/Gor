# Controles de toque: joystick à esquerda (aparece onde o dedo toca), botões de ataque e esquiva à direita.
# No PC também funcionam WASD / setas, espaço (atacar) e shift (esquivar).
extends Control
class_name Controles

var dir := Vector2.ZERO
var atacar := false
var _botao := false
var esquivar := false
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
	var esq := Button.new(); esq.text = "⇄"; esq.add_theme_font_size_override("font_size", 64)
	esq.anchor_left = 1; esq.anchor_top = 1; esq.anchor_right = 1; esq.anchor_bottom = 1
	esq.offset_left = -430; esq.offset_top = -180; esq.offset_right = -300; esq.offset_bottom = -50
	var st := StyleBoxFlat.new(); st.bg_color = Color(0.17, 0.11, 0.07, 0.85); st.set_corner_radius_all(65)
	st.border_color = Color(0.79, 0.64, 0.29); st.set_border_width_all(5)
	esq.add_theme_stylebox_override("normal", st); esq.add_theme_stylebox_override("pressed", st); esq.add_theme_stylebox_override("hover", st)
	esq.button_down.connect(func(): esquivar = true)
	add_child(esq)

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

func consumir_esquiva() -> bool:
	var e := esquivar; esquivar = false; return e

func _draw() -> void:
	if _dedo == -1: return
	draw_circle(_centro, RAIO, Color(1, 0.9, 0.7, 0.18))
	draw_arc(_centro, RAIO, 0, TAU, 48, Color(0.95, 0.8, 0.45, 0.6), 4.0)
	draw_circle(_centro + (_ponta - _centro).limit_length(RAIO), 52, Color(1, 0.92, 0.75, 0.55))
