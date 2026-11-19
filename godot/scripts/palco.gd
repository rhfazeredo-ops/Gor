# "Palco": área do tamanho de uma arte (em pixels da arte) encaixada na tela.
# cobrir = true → preenche a tela (corta bordas); false → arte inteira visível.
# Os filhos são posicionados nas coordenadas da arte, então dá para usar as medidas da versão web.
extends Control
class_name Palco

var art_w := 1920.0; var art_h := 1080.0; var cobrir := true; var ancora_y := 0.5

static func criar(pai: Node, w: float, h: float, cobre: bool, textura: Texture2D = null, anc_y := 0.5) -> Palco:
	var p := Palco.new(); p.art_w = w; p.art_h = h; p.cobrir = cobre; p.ancora_y = anc_y
	p.size = Vector2(w, h); p.mouse_filter = Control.MOUSE_FILTER_PASS
	if textura:
		var t := TextureRect.new(); t.texture = textura; t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		t.size = Vector2(w, h); t.mouse_filter = Control.MOUSE_FILTER_IGNORE; p.add_child(t)
	pai.add_child(p); p.ajustar()
	p.get_viewport().size_changed.connect(p.ajustar)
	return p

func ajustar() -> void:
	var v := get_viewport_rect().size
	var s: float = max(v.x / art_w, v.y / art_h) if cobrir else min(v.x / art_w, v.y / art_h)
	scale = Vector2(s, s)
	position = Vector2((v.x - art_w * s) / 2.0, (v.y - art_h * s) * ancora_y)

# caixa nas coordenadas da arte
func caixa(c: Control, x: float, y: float, w: float, h: float) -> Control:
	c.position = Vector2(x, y); c.size = Vector2(w, h); add_child(c); return c
