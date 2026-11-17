extends Node2D
## Monta o mapa isométrico a partir de um arquivo de texto (a "planta").
## Legenda:  .  areia (andável)   #  rocha (parede)   ^  platô alto (parede)
##           ~  água (bloqueia)   =  ponte (andável)  P  ponto de nascimento

@export_file("*.txt") var arquivo_mapa := "res://maps/desfiladeiro.txt"
@export var semente_decoracao := 42

const TILE := Vector2i(64, 32)
const ATLAS := preload("res://assets/tiles/desfiladeiro.png")
const DECOR := {
	"pedra_p": preload("res://assets/decor/pedra_p.png"),
	"pedra_g": preload("res://assets/decor/pedra_g.png"),
	"arbusto": preload("res://assets/decor/arbusto.png"),
	"arbusto_rosa": preload("res://assets/decor/arbusto_rosa.png"),
}
const AGUA_SHADER := preload("res://scripts/agua.gdshader")

# Colunas do atlas
enum { AREIA_A, AREIA_B, AREIA_C, AGUA, PONTE, ROCHA_A, ROCHA_B, PLATO }

var largura := 0
var altura := 0
var celula_inicio := Vector2i.ZERO
var chao: TileMapLayer
var agua: TileMapLayer
var paredes: TileMapLayer

func _ready() -> void:
	y_sort_enabled = true
	var linhas := _ler_mapa()
	var tileset := _criar_tileset()
	chao = _nova_camada("Chao", tileset, false, -2)
	agua = _nova_camada("Agua", tileset, false, -2)
	var mat := ShaderMaterial.new()
	mat.shader = AGUA_SHADER
	agua.material = mat
	paredes = _nova_camada("Paredes", tileset, true, 0)

	var rng := RandomNumberGenerator.new()
	rng.seed = semente_decoracao
	# Moldura de rocha em volta, para o herói não sair do mapa
	for y in range(-1, altura + 1):
		for x in range(-1, largura + 1):
			var c := "#"
			if y >= 0 and y < altura and x >= 0 and x < largura:
				c = linhas[y][x] if x < linhas[y].length() else "#"
			_colocar(Vector2i(x, y), c, rng)

func _ler_mapa() -> PackedStringArray:
	var texto := FileAccess.get_file_as_string(arquivo_mapa)
	var linhas := PackedStringArray()
	for l in texto.split("\n"):
		if l.strip_edges() != "":
			linhas.append(l.strip_edges())
	altura = linhas.size()
	for l in linhas:
		largura = max(largura, l.length())
	return linhas

func _colocar(cel: Vector2i, c: String, rng: RandomNumberGenerator) -> void:
	match c:
		"~":
			agua.set_cell(cel, 0, Vector2i(AGUA, 0))
		"=":
			chao.set_cell(cel, 0, Vector2i(PONTE, 0))
		"#":
			chao.set_cell(cel, 0, Vector2i(AREIA_A, 0))
			paredes.set_cell(cel, 0, Vector2i(ROCHA_A if rng.randf() < 0.6 else ROCHA_B, 0))
		"^":
			chao.set_cell(cel, 0, Vector2i(AREIA_A, 0))
			paredes.set_cell(cel, 0, Vector2i(PLATO, 0))
		_:
			chao.set_cell(cel, 0, Vector2i([AREIA_A, AREIA_B, AREIA_C][rng.randi() % 3], 0))
			if c == "P":
				celula_inicio = cel
			else:
				_talvez_decorar(cel, rng)

func _talvez_decorar(cel: Vector2i, rng: RandomNumberGenerator) -> void:
	var r := rng.randf()
	var nome := ""
	var solido := false
	if r < 0.012:
		nome = "pedra_g"; solido = true
	elif r < 0.035:
		nome = "pedra_p"; solido = true
	elif r < 0.07:
		nome = "arbusto"
	elif r < 0.08:
		nome = "arbusto_rosa"
	if nome == "":
		return
	var pos := chao.map_to_local(cel) + Vector2(rng.randf_range(-10, 10), rng.randf_range(-5, 5))
	var tex: Texture2D = DECOR[nome]
	var no: Node2D
	if solido:
		var corpo := StaticBody2D.new()
		var forma := CollisionShape2D.new()
		var circ := CircleShape2D.new()
		circ.radius = tex.get_width() * 0.3
		forma.shape = circ
		forma.scale = Vector2(1, 0.5)  # elipse achatada, combina com o chão isométrico
		corpo.add_child(forma)
		no = corpo
	else:
		no = Node2D.new()
	var spr := Sprite2D.new()
	spr.texture = tex
	spr.offset = Vector2(0, -tex.get_height() / 2.0 + 4)  # pé do sprite no ponto do nó
	no.add_child(spr)
	no.position = pos
	add_child(no)

func _nova_camada(nome: String, ts: TileSet, ysort: bool, z: int) -> TileMapLayer:
	var camada := TileMapLayer.new()
	camada.name = nome
	camada.tile_set = ts
	camada.y_sort_enabled = ysort
	camada.z_index = z
	add_child(camada)
	return camada

func _criar_tileset() -> TileSet:
	var ts := TileSet.new()
	ts.tile_shape = TileSet.TILE_SHAPE_ISOMETRIC
	ts.tile_layout = TileSet.TILE_LAYOUT_DIAMOND_DOWN
	ts.tile_size = TILE
	ts.add_physics_layer()
	var src := TileSetAtlasSource.new()
	src.texture = ATLAS
	src.texture_region_size = Vector2i(TILE.x, 64)
	ts.add_source(src, 0)
	var losango := PackedVector2Array([
		Vector2(0, -TILE.y / 2.0), Vector2(TILE.x / 2.0, 0),
		Vector2(0, TILE.y / 2.0), Vector2(-TILE.x / 2.0, 0)])
	for i in ATLAS.get_width() / TILE.x:
		src.create_tile(Vector2i(i, 0))
		var td := src.get_tile_data(Vector2i(i, 0), 0)
		# A pegada (losango) fica na parte de baixo da região de 64 px de altura
		td.texture_origin = Vector2i(0, 16)
		if i in [AGUA, ROCHA_A, ROCHA_B, PLATO]:
			td.add_collision_polygon(0)
			td.set_collision_polygon_points(0, 0, losango)
	return ts

## Retângulo do mapa em coordenadas do mundo (para limitar a câmera)
func limites() -> Rect2:
	var cantos := [Vector2i(0, 0), Vector2i(largura, 0), Vector2i(0, altura), Vector2i(largura, altura)]
	var r := Rect2(chao.map_to_local(cantos[0]), Vector2.ZERO)
	for c in cantos:
		r = r.expand(chao.map_to_local(c))
	return r
