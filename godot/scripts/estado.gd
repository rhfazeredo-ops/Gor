# Estado global do jogo (autoload "Estado"): herói escolhido, missão em andamento e para onde voltar.
extends Node

const MISSOES := [
	{ "id": "plantas", "papel": "missao-plantas", "layout": "canion", "nome": "Plantas raras do Desfiladeiro",
	  "tipo": "coletar", "alvo": 10, "texto": "Colete 10 plantas raras", "plantas": true, "inimigos": 0 },
	{ "id": "escorpioes", "papel": "missao-escorpioes", "layout": "ninho", "nome": "Praga de escorpiões",
	  "tipo": "matar", "alvo": 20, "texto": "Mate 20 escorpiões", "plantas": false, "inimigos": 20 },
]
var heroi := "dalarian"
var missao: Dictionary = MISSOES[1]
var ir_para := "inicio"          # tela que o menu abre: "inicio" ou "lobby"
var musica_menu: AudioStreamPlayer

func _ready() -> void:
	musica_menu = AudioStreamPlayer.new()
	var st: AudioStreamMP3 = load("res://assets/som/tela-inicial.mp3"); st.loop = true
	musica_menu.stream = st; musica_menu.volume_db = -4.0; add_child(musica_menu)

func tocar_menu() -> void:
	if not musica_menu.playing: musica_menu.play()
	var tw := create_tween(); musica_menu.volume_db = -30.0; tw.tween_property(musica_menu, "volume_db", -4.0, 0.4)

func parar_menu(seg := 1.5) -> void:
	if not musica_menu.playing: return
	var tw := create_tween(); tw.tween_property(musica_menu, "volume_db", -40.0, seg); tw.tween_callback(musica_menu.stop)
