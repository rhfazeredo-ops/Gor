# Telas do Terra de Gor no Godot: inicial, taverna (lobby), quadro de missões, seleção de heróis e carregamento.
# Mesmas artes e posições da versão web (coordenadas na arte, via Palco).
extends Control

var tela: Control
var dourado := Color(0.95, 0.78, 0.36)
var creme := Color(0.97, 0.92, 0.82)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var fundo := ColorRect.new(); fundo.color = Color(0.05, 0.04, 0.08); fundo.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE; add_child(fundo)
	if Estado.ir_para == "lobby": abrir_lobby()
	else: abrir_inicio()
	var a := {}
	for x in OS.get_cmdline_user_args():
		var p := x.trim_prefix("--").split("="); a[p[0]] = p[1] if p.size() > 1 else "1"
	if a.has("teste"): _teste(a.teste)

# prints automáticos das telas (usado só nos testes)
func _foto(dir: String, n: String) -> void:
	await get_tree().create_timer(0.8).timeout
	get_viewport().get_texture().get_image().save_png(dir.get_slice("#", 0) + "/" + n + ".png")

func _teste(dir: String) -> void:
	await _foto(dir, "1-inicio")
	_iniciar(); await _foto(dir, "2-taverna")
	abrir_quadro(); await get_tree().process_frame
	var bts := tela.find_children("*", "Button", true, false)
	for b in bts:
		if b.size.y > 600: b.pressed.emit(); break
	await _foto(dir, "3-quadro")
	for c in tela.get_children(): if c != tela.get_child(0): c.queue_free()
	abrir_herois(); await _foto(dir, "4-herois")
	for c in tela.get_children(): if c != tela.get_child(0): c.queue_free()
	abrir_quadro(); await get_tree().process_frame
	var papeis := []
	for b in tela.find_children("*", "Button", true, false): if b.size.y > 600: papeis.append(b)
	papeis[int(dir.get_slice("#", 1)) if "#" in dir else 1].pressed.emit()
	for b in tela.find_children("*", "Button", true, false):
		if b.text == "Iniciar": b.pressed.emit()
	await _foto(dir.get_slice("#", 0), "5-carregando")
	await get_tree().create_timer(4.0).timeout
	get_viewport().get_texture().get_image().save_png(dir.get_slice("#", 0) + "/6-missao.png")
	get_tree().quit()

func _trocar() -> Control:
	if tela: tela.queue_free()
	tela = Control.new(); tela.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); add_child(tela)
	return tela

func texto(t: String, tam: int, cor := creme, contorno := 8) -> Label:
	var l := Label.new(); l.text = t
	l.add_theme_font_size_override("font_size", tam); l.add_theme_color_override("font_color", cor)
	l.add_theme_constant_override("outline_size", contorno); l.add_theme_color_override("font_outline_color", Color(0.05, 0.02, 0.01))
	return l

func estilo(cor: Color, borda := Color(0, 0, 0, 0), largura := 0, raio := 8) -> StyleBoxFlat:
	var s := StyleBoxFlat.new(); s.bg_color = cor; s.border_color = borda; s.set_border_width_all(largura); s.set_corner_radius_all(raio)
	return s

func aviso(pai: Control, msg: String) -> void:
	var l := texto(msg, 36); l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var p := PanelContainer.new(); p.add_theme_stylebox_override("panel", estilo(Color(0.08, 0.05, 0.03, 0.92), dourado, 3, 6))
	p.add_child(l); add_child(p)
	p.position = Vector2(get_viewport_rect().size.x / 2.0 - 260, get_viewport_rect().size.y * 0.82); p.size = Vector2(520, 70)
	var tw := create_tween(); tw.tween_interval(1.6); tw.tween_property(p, "modulate:a", 0.0, 0.3); tw.tween_callback(p.queue_free)

# ======================= TELA INICIAL =======================
func abrir_inicio() -> void:
	var t := _trocar()
	var palco := Palco.criar(t, 2400, 1351, true, load("res://assets/telas/inicial.webp"), 0.15)
	var menu := VBoxContainer.new(); menu.add_theme_constant_override("separation", 0)
	var caixa := Panel.new(); caixa.add_theme_stylebox_override("panel", estilo(Color(0.04, 0.05, 0.13, 0.62), Color(0, 0, 0, 0), 0, 40))
	# menu a 59% da arte, mas sempre dentro da parte visível da tela
	var vis_fim: float = (get_viewport_rect().size.y - palco.position.y) / palco.scale.y
	var topo: float = min(797.0, vis_fim - 470.0 - 30.0)
	palco.caixa(caixa, 870, topo - 20, 660, 470)
	palco.caixa(menu, 900, topo, 600, 430)
	var itens := [["Iniciar", func(): _iniciar()], ["Carregar", func(): aviso(self, "Nenhum jogo salvo ainda.")],
		["Opções", func(): aviso(self, "Opções: em breve.")], ["Créditos", func(): aviso(self, "Terra de Gor — criação e arte: você")],
		["Sair", func(): get_tree().quit()]]
	for it in itens:
		var b := Button.new(); b.text = it[0]; b.custom_minimum_size = Vector2(600, 86)
		b.add_theme_font_size_override("font_size", 44)
		b.add_theme_color_override("font_color", creme if it[0] != "Carregar" else Color(1, 1, 1, 0.4))
		b.add_theme_color_override("font_hover_color", Color.WHITE); b.add_theme_constant_override("outline_size", 8)
		b.add_theme_color_override("font_outline_color", Color.BLACK)
		b.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
		var sel := estilo(Color(0.2, 0.3, 0.68, 0.95), dourado, 2, 4)
		for k in ["hover", "pressed", "focus"]: b.add_theme_stylebox_override(k, sel)
		b.pressed.connect(it[1]); menu.add_child(b)
	# no navegador o som só pode começar depois do primeiro toque
	if OS.has_feature("web"):
		var toque := Button.new(); toque.flat = true; toque.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		t.add_child(toque)
		var l := texto("Toque para começar", 60); l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM); l.position.y -= 220; l.size.x = 900; l.position.x -= 450
		toque.add_child(l); menu.visible = false; caixa.visible = false
		var tw := create_tween().set_loops(); tw.tween_property(l, "modulate:a", 0.45, 0.7); tw.tween_property(l, "modulate:a", 1.0, 0.7)
		toque.pressed.connect(func(): tw.kill(); toque.queue_free(); menu.visible = true; caixa.visible = true; Estado.tocar_menu())
	else:
		Estado.tocar_menu()

func _iniciar() -> void:
	Estado.parar_menu(2.0)
	abrir_lobby()

# ======================= TAVERNA (LOBBY) =======================
const LW := 1670.0
const PONTOS := [["missoes", 22, 165, 112, 110], ["missoes", 985, 355, 140, 110], ["Inventário", 22, 285, 112, 105], ["herois", 22, 395, 112, 100],
	["Estalajadeiro", 500, 255, 175, 115], ["Eventos", 1470, 385, 150, 110], ["Mensagens", 1515, 12, 60, 55], ["Configurações", 1590, 12, 65, 55]]

func abrir_lobby() -> void:
	Estado.ir_para = "inicio"
	if Estado.musica_menu.playing: Estado.parar_menu(1.5)
	var t := _trocar()
	var palco := Palco.criar(t, 2400, 1352, true, load("res://assets/telas/lobby.webp"))
	var k := 2400.0 / LW
	for p in PONTOS:
		var b := Button.new(); b.flat = true; b.focus_mode = Control.FOCUS_NONE
		b.add_theme_stylebox_override("pressed", estilo(Color(1, 0.86, 0.55, 0.2), Color(0, 0, 0, 0), 0, 20))
		palco.caixa(b, p[1] * k, p[2] * k, p[3] * k, p[4] * k)
		var id: String = p[0]
		b.pressed.connect(func():
			if id == "missoes": abrir_quadro()
			elif id == "herois": abrir_herois()
			else: aviso(self, id + ": em breve"))

# ======================= QUADRO DE MISSÕES =======================
func abrir_quadro() -> void:
	var camada := Control.new(); camada.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); tela.add_child(camada)
	var dim := ColorRect.new(); dim.color = Color(0.03, 0.02, 0.06, 0.6); dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); camada.add_child(dim)
	dim.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed: camada.queue_free())
	var palco := Palco.criar(camada, 1920, 1280, false, load("res://assets/telas/quadro.webp"))
	var escolhida := [null]          # (lista: as funções internas enxergam a mesma escolha)
	var papeis := []
	var iniciar := Button.new(); iniciar.text = "Iniciar"; iniciar.disabled = true
	iniciar.add_theme_font_size_override("font_size", 56); iniciar.add_theme_color_override("font_color", Color(1, 0.96, 0.86))
	iniciar.add_theme_color_override("font_disabled_color", Color(0.6, 0.6, 0.65))
	iniciar.add_theme_stylebox_override("normal", estilo(Color(0.2, 0.31, 0.75), dourado, 5, 16))
	iniciar.add_theme_stylebox_override("hover", estilo(Color(0.25, 0.37, 0.85), dourado, 5, 16))
	iniciar.add_theme_stylebox_override("pressed", estilo(Color(0.15, 0.24, 0.6), dourado, 5, 16))
	iniciar.add_theme_stylebox_override("disabled", estilo(Color(0.18, 0.18, 0.22), Color(0.45, 0.4, 0.3), 5, 16))
	var n := Estado.MISSOES.size(); var ph := 691.0; var pw := ph * 1060.0 / 1484.0; var gap := 56.0
	var x0 := 259.0 + (1402.0 - (pw * n + gap * (n - 1))) / 2.0
	for i in n:
		var m: Dictionary = Estado.MISSOES[i]
		var c := Control.new(); palco.caixa(c, x0 + i * (pw + gap), 333, pw, ph)
		c.pivot_offset = Vector2(pw / 2.0, ph / 2.0); c.rotation_degrees = [-2.5, 2.0, -1.5, 3.0][i % 4]
		var brilho := Panel.new(); brilho.add_theme_stylebox_override("panel", _estilo_brilho()); brilho.visible = false
		brilho.position = Vector2(-10, -10); brilho.size = Vector2(pw + 20, ph + 20); c.add_child(brilho)
		var img := TextureRect.new(); img.texture = load("res://assets/telas/%s.webp" % m.papel); img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		img.size = Vector2(pw, ph); c.add_child(img)
		var b := Button.new(); b.flat = true; b.size = Vector2(pw, ph); b.focus_mode = Control.FOCUS_NONE; c.add_child(b)
		papeis.append([c, brilho, i])
		b.pressed.connect(func():
			escolhida[0] = m; iniciar.disabled = false
			for p in papeis:
				var sel: bool = p[2] == i
				p[1].visible = sel
				p[0].rotation_degrees = 0.0 if sel else [-2.5, 2.0, -1.5, 3.0][p[2] % 4]
				p[0].scale = Vector2(1.06, 1.06) if sel else Vector2.ONE)
	palco.caixa(iniciar, 760, 1105, 400, 110)
	iniciar.pressed.connect(func(): if escolhida[0] != null: _comecar(escolhida[0]))
	var fechar := Button.new(); fechar.text = "×"; fechar.add_theme_font_size_override("font_size", 90)
	fechar.add_theme_stylebox_override("normal", estilo(Color(0.16, 0.09, 0.05), dourado, 6, 70))
	fechar.add_theme_stylebox_override("hover", estilo(Color(0.22, 0.13, 0.07), dourado, 6, 70))
	fechar.add_theme_stylebox_override("pressed", estilo(Color(0.1, 0.06, 0.03), dourado, 6, 70))
	palco.caixa(fechar, 1730, 40, 134, 134)
	fechar.pressed.connect(camada.queue_free)

func _estilo_brilho() -> StyleBoxFlat:
	var s := estilo(Color(0, 0, 0, 0), Color(1, 0.83, 0.35), 8, 6)
	s.shadow_color = Color(1, 0.65, 0.1, 0.75); s.shadow_size = 28
	return s

# ======================= SELEÇÃO DE HERÓIS =======================
func abrir_herois() -> void:
	var camada := Control.new(); camada.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); tela.add_child(camada)
	var bg := ColorRect.new(); bg.color = Color(0.04, 0.063, 0.09); bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT); camada.add_child(bg)
	var palco := Palco.criar(camada, 1672, 941, false, load("res://assets/herois/fundo.webp"))
	var herois: Array = JSON.parse_string(FileAccess.get_file_as_string("res://dados/herois.json"))
	var telas: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/herois/telas.json"))
	var band := TextureRect.new(); band.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; palco.caixa(band, 478, 0, 650, 941)
	var arte := TextureRect.new(); arte.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; palco.add_child(arte)
	# lista com rolagem
	var rol := ScrollContainer.new(); rol.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rol.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	var fundo_lista := ColorRect.new(); fundo_lista.color = Color(0.043, 0.067, 0.098); palco.caixa(fundo_lista, 14, 160, 462, 680)
	palco.caixa(rol, 20, 166, 450, 668)
	var col := VBoxContainer.new(); col.add_theme_constant_override("separation", 12); col.custom_minimum_size.x = 446; rol.add_child(col)
	# painel da direita
	var emb := TextureRect.new(); emb.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; emb.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	palco.caixa(emb, 1164, 133, 112, 124)
	var nome := texto("", 40, Color(0.95, 0.89, 0.72)); palco.caixa(nome, 1300, 138, 330, 60)
	var classe := texto("", 24, Color(0.91, 0.7, 0.3), 4); palco.caixa(classe, 1302, 205, 300, 40)
	var desc := texto("", 19, Color(0.94, 0.9, 0.84), 3); desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; palco.caixa(desc, 1180, 262, 430, 130)
	var at := TextureRect.new(); at.texture = load("res://assets/herois/atributos.webp"); at.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	palco.caixa(at, 1170, 418, 192, 160)
	var barras := []
	for i in 4:
		var fundo_b := Panel.new(); fundo_b.add_theme_stylebox_override("panel", estilo(Color(0.11, 0.13, 0.19), Color(0.24, 0.26, 0.32), 1, 11))
		palco.caixa(fundo_b, 1380, 426 + i * 40, 232, 22)
		var f := Panel.new(); f.add_theme_stylebox_override("panel", estilo(Color(0.97, 0.76, 0.27), Color(0, 0, 0, 0), 0, 11)); f.size = Vector2(0, 22)
		fundo_b.add_child(f); barras.append(f)
	var habs := []
	for x in [1195, 1339, 1482]:
		var h := TextureRect.new(); h.expand_mode = TextureRect.EXPAND_IGNORE_SIZE; palco.caixa(h, x, 600, 116, 118); habs.append(h)
	var bloqueio := Panel.new(); bloqueio.add_theme_stylebox_override("panel", estilo(Color(0.13, 0.15, 0.2), Color(0.43, 0.35, 0.21), 3, 16))
	palco.caixa(bloqueio, 1180, 750, 435, 90)
	var lk := texto("Em breve", 34); lk.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; lk.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lk.size = Vector2(435, 90); bloqueio.add_child(lk)
	var cad_btn := Cadeado.new(); cad_btn.position = Vector2(110, 25); cad_btn.size = Vector2(40, 40); bloqueio.add_child(cad_btn)
	var sel_btn := Button.new(); sel_btn.flat = true; palco.caixa(sel_btn, 1175, 745, 445, 100)
	var voltar := Button.new(); voltar.flat = true; palco.caixa(voltar, 0, 18, 150, 92)
	voltar.pressed.connect(camada.queue_free)
	var slots := []
	var atual := [0]
	var marcar := func(i: int) -> void:
		atual[0] = i; var h: Dictionary = herois[i]
		for s in slots: s[1].visible = s[0] == i
		band.texture = load("res://assets/herois/estandarte-%s.webp" % h.raca)
		var b: Array = telas.arte[h.id]; arte.position = Vector2(b[0], b[1]); arte.size = Vector2(b[2], b[3])
		arte.texture = load("res://assets/herois/%s-arte.webp" % h.id)
		var jog: bool = h.jogavel != null
		arte.modulate = Color.WHITE if jog else Color(0.6, 0.6, 0.65)
		var e := "res://assets/herois/%s-emblema.webp" % h.id; emb.texture = load(e) if ResourceLoader.exists(e) else null
		nome.text = h.nome; classe.text = h.classe; desc.text = h.desc
		var ks := ["ataque", "defesa", "vida", "mobilidade"]
		for j in 4: barras[j].size.x = 232.0 * float(h.stats[ks[j]])
		for j in 3:
			var p := "res://assets/herois/%s-hab%d.webp" % [h.id, j + 1]
			habs[j].texture = load(p) if ResourceLoader.exists(p) else null
		bloqueio.visible = not jog
	for i in herois.size():
		var h: Dictionary = herois[i]
		var slot := Panel.new(); slot.custom_minimum_size = Vector2(446, 118)
		slot.add_theme_stylebox_override("panel", estilo(Color(0.09, 0.11, 0.15), Color(0.72, 0.54, 0.23), 2, 6))
		var sb := estilo(Color(0, 0, 0, 0), Color(1, 0.82, 0.35), 4, 6); sb.draw_center = false
		var brilho := Panel.new(); brilho.add_theme_stylebox_override("panel", sb); brilho.size = Vector2(446, 118)
		brilho.visible = false; brilho.mouse_filter = Control.MOUSE_FILTER_IGNORE; slot.add_child(brilho)
		var foto := TextureRect.new(); foto.texture = load("res://assets/herois/%s-slot.webp" % h.id); foto.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		foto.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED; foto.position = Vector2(3, 3); foto.size = Vector2(160, 112); slot.add_child(foto)
		var ic := "res://assets/herois/%s-classe.webp" % h.id
		if not ResourceLoader.exists(ic): ic = "res://assets/herois/%s-emblema.webp" % h.id
		if ResourceLoader.exists(ic):
			var icone := TextureRect.new(); icone.texture = load(ic); icone.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			icone.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED; icone.position = Vector2(176, 20); icone.size = Vector2(64, 78); slot.add_child(icone)
		var n1 := texto(h.nome, 30); n1.position = Vector2(250, 16); slot.add_child(n1)
		var c1 := texto(h.classe, 20, Color(0.91, 0.84, 0.71), 3); c1.position = Vector2(252, 62); c1.size.x = 190; c1.clip_text = true; slot.add_child(c1)
		if h.jogavel == null:
			for c in [foto, n1, c1]: c.modulate = Color(0.45, 0.45, 0.5)
			var cd := Cadeado.new(); cd.position = Vector2(118, 70); cd.size = Vector2(38, 38); slot.add_child(cd)
		var b := Button.new(); b.flat = true; b.size = Vector2(446, 118); b.focus_mode = Control.FOCUS_NONE; slot.add_child(b)
		b.pressed.connect(func(): marcar.call(i))
		col.add_child(slot); slots.append([i, brilho])
	var mais := Panel.new(); mais.custom_minimum_size = Vector2(446, 118)
	mais.add_theme_stylebox_override("panel", estilo(Color(0.07, 0.08, 0.11), Color(0.54, 0.42, 0.16), 2, 6))
	var pl := texto("+", 56, Color(0.91, 0.7, 0.3)); pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; pl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pl.size = Vector2(446, 118); mais.add_child(pl); col.add_child(mais)
	sel_btn.pressed.connect(func():
		var h: Dictionary = herois[atual[0]]
		if h.jogavel == null: aviso(self, h.nome + ": em breve")
		else: Estado.heroi = h.jogavel; camada.queue_free())
	var ini := 0
	for i in herois.size(): if herois[i].jogavel == Estado.heroi: ini = i
	marcar.call(ini)

# ======================= CARREGAMENTO → MISSÃO =======================
func _comecar(m: Dictionary) -> void:
	Estado.missao = m
	var t := _trocar()
	var palco := Palco.criar(t, 2400, 1351, true, load("res://assets/telas/carregando.webp"))
	var info: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://assets/telas/barra.json"))
	var v := get_viewport_rect().size
	var bw: float = min(v.x * 0.56, v.y * 1.0); var k: float = bw / info.w
	var barra := Control.new(); barra.position = Vector2((v.x - bw) / 2.0, v.y * 0.95 - info.h * k); barra.size = Vector2(bw, info.h * k); t.add_child(barra)
	var canal := Control.new(); canal.clip_contents = true
	canal.position = Vector2(info.chan[0], info.chan[1]) * k; canal.size = Vector2(0, info.chan[3] * k); barra.add_child(canal)
	var faixa := TextureRect.new(); faixa.texture = load("res://assets/telas/fill-tile.webp"); faixa.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	faixa.stretch_mode = TextureRect.STRETCH_TILE; faixa.size = Vector2(info.chan[2] * k, info.chan[3] * k); canal.add_child(faixa)
	var mold := TextureRect.new(); mold.texture = load("res://assets/telas/moldura.webp"); mold.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mold.size = barra.size; barra.add_child(mold)
	var l := texto("Carregando %s…" % ("o Ninho dos Escorpiões" if m.layout == "ninho" else "o Desfiladeiro do Sol"), 36)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER; l.position = Vector2(0, -50); l.size.x = bw; barra.add_child(l)
	var tw := create_tween(); tw.tween_property(canal, "size:x", info.chan[2] * k, 1.2)
	await tw.finished
	await get_tree().process_frame
	get_tree().change_scene_to_file("res://cenas/jogo.tscn")

# cadeado desenhado (a fonte padrão não tem o emoji)
class Cadeado extends Control:
	func _draw() -> void:
		var s := size
		draw_circle(s / 2.0, s.x / 2.0, Color(0.1, 0.06, 0.03))
		draw_arc(s / 2.0, s.x / 2.0, 0, TAU, 32, Color(0.79, 0.64, 0.29), 2.0)
		draw_arc(Vector2(s.x / 2.0, s.y * 0.42), s.x * 0.17, PI, TAU, 16, Color(0.98, 0.8, 0.3), s.x * 0.07)
		draw_rect(Rect2(s.x * 0.28, s.y * 0.42, s.x * 0.44, s.y * 0.32), Color(0.98, 0.8, 0.3))
