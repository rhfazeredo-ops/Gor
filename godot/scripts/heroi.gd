extends CharacterBody2D
## Herói controlado pelo joystick virtual (celular) ou WASD (PC).

@export var velocidade := 170.0
var joystick: Node = null   # definido pelo main

@onready var sprite: Sprite2D = $Sprite
var _tempo := 0.0

func _physics_process(delta: float) -> void:
	var dir := Vector2.ZERO
	if joystick and joystick.vetor != Vector2.ZERO:
		dir = joystick.vetor
	else:
		dir = Input.get_vector("mover_esquerda", "mover_direita", "mover_cima", "mover_baixo")
	velocity = dir * velocidade
	move_and_slide()

	if dir.x != 0:
		sprite.flip_h = dir.x < 0
	# balanço simples de caminhada até termos animações de verdade
	if dir.length() > 0.1:
		_tempo += delta * 12.0
		sprite.position.y = -abs(sin(_tempo)) * 4.0
	else:
		_tempo = 0.0
		sprite.position.y = lerp(sprite.position.y, 0.0, 0.3)
