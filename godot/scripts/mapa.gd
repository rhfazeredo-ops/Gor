# Monta o mapa do deserto a partir de dados/mapas.json (exportado da versão web):
# chão pintado, peças 2D como "recortes" de pé (billboard) e colisões no contorno real de cada peça.
extends Node3D
class_name Mapa

const PPM := 45.25            # pixels por metro na escala do jogo (1 tile = 1 metro)
var dados: Dictionary
var colisores: Array = []
var moles: Array = []      # grama/arbustos: balançam quando alguém passa
var altos: Array = []      # rochas/árvores altas: ficam translúcidas com o herói atrás

func montar(layout: String) -> void:
	var tudo: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://dados/mapas.json"))
	var pecas: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://dados/pecas.json"))
	dados = tudo[layout]
	colisores = dados.colliders
	_chao()
	for d in dados.decos:
		_peca(d, pecas)
	_colisoes()

func _chao() -> void:
	var w: float = dados.w; var h: float = dados.h
	var m := MeshInstance3D.new()
	var pm := PlaneMesh.new(); pm.size = Vector2(w + 40, h + 40); m.mesh = pm
	m.position = Vector3(w / 2.0, 0, h / 2.0)
	var sm := ShaderMaterial.new(); sm.shader = load("res://shaders/chao.gdshader")
	sm.set_shader_parameter("mascara", _mascara()); sm.set_shader_parameter("tam_mapa", Vector2(w, h))
	var tex: Texture2D = load("res://assets/deserto/chao.webp")
	sm.set_shader_parameter("tex", tex); sm.set_shader_parameter("tam_tex", Vector2(tex.get_width(), tex.get_height()))
	m.material_override = sm
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)

# máscara do chão (8 px por tile): R = trilha/clareira (chão batido), G = perto de rocha (pedregoso/sombra)
func _mascara() -> ImageTexture:
	var k := 8; var w: int = int(dados.w) * k; var h: int = int(dados.h) * k
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var path: Array = dados.path; var larg: float = dados.get("largura", 3.0); var clar: Array = dados.get("clareiras", [])
	var rochas := []
	for d in dados.decos:
		if String(d.key).begins_with("rochedo") or String(d.key).begins_with("pico") or String(d.key).begins_with("paredao") or String(d.key).begins_with("ruina"):
			rochas.append(Vector3(d.x, d.y, d.w / 90.0))
	for j in h:
		for i in w:
			var p := Vector2((i + 0.5) / k, (j + 0.5) / k)
			var dp := 1e9
			for q in path.size() - 1:
				var a := Vector2(path[q][0], path[q][1]); var b := Vector2(path[q + 1][0], path[q + 1][1])
				dp = min(dp, Geometry2D.get_closest_point_to_segment(p, a, b).distance_to(p))
			var trilha: float = clamp(1.0 - (dp - larg * 0.45) / (larg * 0.8), 0.0, 1.0)
			for c in clar: trilha = max(trilha, clamp(1.0 - (p.distance_to(Vector2(c[0], c[1])) - c[2] * 0.55) / (c[2] * 0.6), 0.0, 1.0) * 0.8)
			var pedra := 0.0
			for r in rochas:
				var dr: float = p.distance_to(Vector2(r.x, r.y))
				if dr < r.z + 3.0: pedra = max(pedra, clamp(1.0 - (dr - r.z * 0.6) / 3.0, 0.0, 1.0))
			img.set_pixel(i, j, Color(trilha, pedra, 0, 1))
	return ImageTexture.create_from_image(img)

func _peca(d: Dictionary, pecas: Dictionary) -> void:
	if not pecas.has(d.key): return
	var tex: Texture2D = load("res://assets/deserto/" + pecas[d.key])
	if tex == null: return
	var s := Sprite3D.new()
	s.texture = tex
	var k: float = float(tex.get_width()) / float(d.w)        # pixels da textura por pixel do jogo
	s.pixel_size = 1.0 / (k * PPM)
	s.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	s.shaded = false
	s.alpha_cut = SpriteBase3D.ALPHA_CUT_OPAQUE_PREPASS
	s.flip_h = d.flip
	s.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# âncora (base do desenho) na posição do chão
	var ax: float = d.ax * k; var ay: float = d.ay * k
	s.offset = Vector2(tex.get_width() / 2.0 - ax, ay - tex.get_height() / 2.0)
	s.position = Vector3(d.x, 0.0, d.y)
	if d.flat: s.render_priority = -1
	add_child(s)
	if d.phys == "mole":
		s.billboard = BaseMaterial3D.BILLBOARD_DISABLED
		moles.append({ "s": s, "d": d, "sway": 0.0, "v": 0.0, "seed": randf() * 6.0 })
	elif d.h > 45 and not d.flat:
		altos.append({ "s": s, "d": d, "atras": false })

func _colisoes() -> void:
	var corpo := StaticBody3D.new(); add_child(corpo)
	for c in colisores:
		if c.t == "p":
			var cp := CollisionPolygon3D.new()
			var pts := PackedVector2Array()
			for p in c.pts: pts.append(Vector2(p[0], p[1]))
			cp.polygon = pts; cp.depth = 4.0
			cp.rotation_degrees = Vector3(90, 0, 0)
			corpo.add_child(cp)
		elif c.t == "c":
			var cs := CollisionShape3D.new(); var sh := CylinderShape3D.new()
			sh.radius = c.r; sh.height = 4.0; cs.shape = sh
			cs.position = Vector3(c.x, 0, c.y); corpo.add_child(cs)
		else:
			var cs := CollisionShape3D.new(); var sh := BoxShape3D.new()
			sh.size = Vector3(c.x1 - c.x0, 4.0, c.y1 - c.y0); cs.shape = sh
			cs.position = Vector3((c.x0 + c.x1) / 2.0, 0, (c.y0 + c.y1) / 2.0); corpo.add_child(cs)
	# bordas do mapa
	var w: float = dados.w; var h: float = dados.h
	for b in [[w / 2.0, 1.5, w, 3.0], [w / 2.0, h - 1.0, w, 2.0], [1.5, h / 2.0, 3.0, h], [w - 1.0, h / 2.0, 2.0, h]]:
		var cs := CollisionShape3D.new(); var sh := BoxShape3D.new()
		sh.size = Vector3(b[2], 4.0, b[3]); cs.shape = sh; cs.position = Vector3(b[0], 0, b[1]); corpo.add_child(cs)

# ponto livre? (para espalhar os escorpiões)
func livre(x: float, y: float, r: float) -> bool:
	if x < 4 or y < 4 or x > dados.w - 3 or y > dados.h - 3: return false
	for c in colisores:
		if c.t == "c":
			if Vector2(x - c.x, y - c.y).length() < c.r + r: return false
		elif c.t == "b":
			if x > c.x0 - r and x < c.x1 + r and y > c.y0 - r and y < c.y1 + r: return false
		else:
			var pts := PackedVector2Array()
			for p in c.pts: pts.append(Vector2(p[0], p[1]))
			if Geometry2D.is_point_in_polygon(Vector2(x, y), pts): return false
			for i in pts.size():
				if Geometry2D.get_closest_point_to_segment(Vector2(x, y), pts[i], pts[(i + 1) % pts.size()]).distance_to(Vector2(x, y)) < r: return false
	return true

var _t := 0.0
func animar(delta: float, heroi: Node3D, cam: Camera3D) -> void:
	_t += delta
	var hp := heroi.global_position; var hv: Vector3 = heroi.velocity
	for m in moles:
		var d: Dictionary = m.d
		var dx: float = hp.x - d.x; var dz: float = hp.z - d.y; var dist := sqrt(dx * dx + dz * dz)
		var rr: float = 0.25 + d.w / 180.0
		if dist < rr:
			m.v += ((hv.x - hv.z) * 0.05 + (-1.0 if dx - dz > 0 else 1.0) * 0.6 * (1.0 - dist / rr)) * delta * 60.0
		var vento := sin(_t * 1.7 + m.seed) * 0.03
		m.v += (-(m.sway - vento) * 40.0 - m.v * 6.0) * delta
		m.sway = clamp(m.sway + m.v * delta, -0.55, 0.55)
		m.s.global_basis = cam.global_basis * Basis(Vector3(0, 0, 1), -m.sway)
	var vh := get_viewport().get_visible_rect().size.y
	var ppm: float = vh / cam.size
	var hs := cam.unproject_position(hp + Vector3(0, 0.8, 0))
	for a in altos:
		var d: Dictionary = a.d
		var base := cam.unproject_position(Vector3(d.x, 0, d.y))
		var w: float = d.w / PPM * ppm; var h: float = d.h / PPM * ppm
		var x0: float = base.x - d.ax / PPM * ppm
		var atras: bool = (hp.x + hp.z) < (d.x + d.y) - 0.2 and hs.x > x0 and hs.x < x0 + w and hs.y < base.y and hs.y > base.y - h
		if atras != a.atras:
			a.atras = atras
			a.s.alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED if atras else SpriteBase3D.ALPHA_CUT_OPAQUE_PREPASS
			a.s.modulate.a = 0.45 if atras else 1.0
