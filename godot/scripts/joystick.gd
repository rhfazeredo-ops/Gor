extends Control
## Joystick virtual: aparece onde o dedo encosta na metade esquerda da tela.

@export var raio := 90.0
@export var zona_morta := 0.15

var vetor := Vector2.ZERO
var _dedo := -1
var _centro := Vector2.ZERO
var _ponta := Vector2.ZERO

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _posicao_repouso() -> Vector2:
	return Vector2(170, size.y - 160)

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and _dedo == -1 and event.position.x < size.x * 0.5:
			_dedo = event.index
			_centro = event.position
			_ponta = event.position
			_atualizar()
		elif not event.pressed and event.index == _dedo:
			_dedo = -1
			vetor = Vector2.ZERO
			queue_redraw()
	elif event is InputEventScreenDrag and event.index == _dedo:
		_ponta = event.position
		_atualizar()

func _atualizar() -> void:
	var d := _ponta - _centro
	if d.length() > raio:
		d = d.normalized() * raio
	var v := d / raio
	vetor = v if v.length() > zona_morta else Vector2.ZERO
	queue_redraw()

func _draw() -> void:
	var c := _centro if _dedo != -1 else _posicao_repouso()
	var alfa := 0.55 if _dedo != -1 else 0.25
	draw_circle(c, raio, Color(0, 0, 0, alfa * 0.5))
	draw_arc(c, raio, 0, TAU, 48, Color(1, 0.85, 0.5, alfa), 3.0, true)
	draw_circle(c + vetor * raio, raio * 0.42, Color(1, 0.85, 0.5, alfa + 0.15))
