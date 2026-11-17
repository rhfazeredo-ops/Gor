extends Node2D

@onready var mundo = $Mundo
@onready var heroi = $Mundo/Heroi
@onready var camera: Camera2D = $Mundo/Heroi/Camera2D
@onready var joystick = $UI/Joystick

func _ready() -> void:
	heroi.joystick = joystick
	heroi.position = mundo.chao.map_to_local(mundo.celula_inicio)
	var r: Rect2 = mundo.limites()
	camera.limit_left = int(r.position.x)
	camera.limit_top = int(r.position.y) - 40
	camera.limit_right = int(r.end.x)
	camera.limit_bottom = int(r.end.y)
	camera.reset_smoothing()

# --- Ferramenta de teste: godot -- --captura=arquivo.png [--andar=x,y] ---
func _process(_delta: float) -> void:
	if Engine.get_process_frames() != 2:
		return
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--captura="):
			_capturar(arg.trim_prefix("--captura="))

func _capturar(caminho: String) -> void:
	var andar := Vector2.ZERO
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--andar="):
			var p := arg.trim_prefix("--andar=").split(",")
			andar = Vector2(float(p[0]), float(p[1]))
		if arg.begins_with("--zoom="):
			camera.zoom = Vector2.ONE * float(arg.trim_prefix("--zoom="))
			camera.limit_left = -100000; camera.limit_right = 100000
			camera.limit_top = -100000; camera.limit_bottom = 100000
			camera.top_level = true
			camera.position_smoothing_enabled = false
			camera.global_position = mundo.limites().get_center()
	if andar != Vector2.ZERO:
		joystick.vetor = andar
		await get_tree().create_timer(2.5).timeout
		joystick.vetor = Vector2.ZERO
	await get_tree().create_timer(1.0).timeout
	get_viewport().get_texture().get_image().save_png(caminho)
	print("captura salva: ", caminho, " heroi em ", heroi.position)
	get_tree().quit()
