# Técnicas aprendidas (com as armadilhas que já custaram tempo)

## Godot sem tela (testar e tirar print no container)
- Binário 4.5 Linux + modelos de exportação (`codigo/godot-ci.sh` baixa os dois).
- Importar: `godot --headless --path . --import` (rodar **duas vezes** depois de trocar um GLB).
- Rodar com imagem: `xvfb-run -a -s "-screen 0 1920x1080x24" godot --rendering-driver opengl3 --resolution 1920x1080 --path . res://cenas/jogo.tscn -- --shot=saida.png --espera=2`
- Argumentos depois de `--` chegam em `OS.get_cmdline_user_args()`. Padrão usado: `--shot`, `--espera`,
  `--cena=luta|inicio`, `--missao=...`, `--ponto=x,y` (teleporta), `--colisao` (desenha colisores), `--pegar`
  (aperta o botão de interação), `--geral` (câmera de cima do mapa todo).
- Print: `get_viewport().get_texture().get_image().save_png(caminho)` depois de alguns quadros.
- Sem GPU no container: FPS medido aqui não vale; desempenho se testa no celular.
- Avisos de ALSA/áudio no xvfb são normais.

## Armadilhas de GDScript / Godot
- Lambda captura **cópia** de variável local (Dictionary/valor): use um "holder" `var x := [null]` e `x[0] = ...`.
- Controles de UI: usar `set_anchors_and_offsets_preset` / âncoras + offsets, senão somem fora da tela.
- GLB com texturas: ao trocar o modelo, apagar `assets/modelos/<nome>_*` e `.godot/imported/<nome>*` e importar 2×.
- `if a: b; c` numa linha só: tudo depois dos `:` faz parte do if.
- Função criada e nunca chamada passa despercebida (a coleta de plantas ficou assim): conferir com grep.
- Renderizador **Compatibility** (celular/web): MultiMesh **não recebe sombra** de DirectionalLight →
  desenhar sombras no shader (manchas pontilhadas por personagem, ver splats).

## Primeira pessoa com visual PS1 (Dallarian)
- Imagem 3D numa SubViewport dentro de SubViewportContainer com `stretch_shrink = 4` e filtro NEAREST
  (≈480×270), e um shader canvas_item no container: paleta reduzida + pontilhado Bayer.
- Shader PS1 (unshaded): luz calculada no vértice, vértices presos à grade da tela (tremem),
  textura 32 px sem suavização, neblina por distância no vértice. Clarão de relâmpago por
  `global uniform` (declarado em `[shader_globals]` do project.godot).
- Pixel splats em primeira pessoa: quads virados para a câmera montados no vertex shader
  (`em_pe` = só no eixo vertical, para grama), corte duro da gaussiana → sem ordenação.
  Grama em blocos de 20 m com `visibility_range_end` ≈ 42 m.
- **Colisão de terreno com ConcavePolygonShape3D: ligar `backface_collision`** (senão o jogador atravessa o
  chão se os triângulos estiverem "virados").
- Shaders com `cull_disabled` para não depender da ordem dos vértices das malhas geradas por código.
- GDScript: `var x := array[i]` de Array sem tipo não compila → declarar o tipo (`var x: Color = ...`).
- Gerar malhas por código: SurfaceTool com várias superfícies (uma por material) no mesmo ArrayMesh.

## Câmera isométrica igual à arte 2D
- Ortográfica, giro 45°, inclinação 30° → projeção 2:1 exata (losango de 64×32 px por tile).
- 1 tile = 1 m; 45,25 px por metro (64/√2). Tela: x ∝ (x − z), y ∝ (x + z).
- Peças 2D como Sprite3D billboard com a âncora (base do desenho) na posição do chão; `pixel_size = 1/(k·PPM)`.

## Colisões de peças 2D num mapa isométrico
- Contorno de baixo do desenho = borda da frente da base; espelhar pela corda entre as pontas = borda de trás.
- **Casco convexo** do polígono (sem "dentes" por onde o herói entra no desenho).
- Rochas: metade de baixo do contorno; troncos caídos: só ~22% de baixo (sem galhos), encolhido 0,8;
  árvores em pé: **círculo no tronco** (r ≈ 0,4), raízes/capim não bloqueiam.
- Ferramentas: galeria com cada peça + polígono (Playwright tirando print de uma página) e linhas de
  colisão no Godot (ImmediateMesh, `no_depth_test`). Conferir que trilha/clareiras/objetivos ficam livres.
- No Godot: CollisionPolygon3D com `rotation_degrees = (90,0,0)` (y do polígono vira z do mundo).

## Modelos 3D (Tripo → jogo)
- Créditos da API do Tripo são separados dos créditos do site. Chave só via formulário seguro.
- Rig automático (`tools/tripo-rig.js`): articulações medidas na malha por perfil; animações da Universal
  Animation Library (Godot Standard); pesos por segmentos de osso.
- Braços em "T para trás": girar os vértices do braço no ombro (mesmo sentido nos dois lados) e espelhar z
  das juntas do lado direito.
- Capa separada por **conectividade da malha** (flood fill) para não esticar a barra.
- Reduzir triângulos: `codigo/decimar.mjs` (gltf-transform + meshoptimizer: weld → simplify). 96k → 23k sem
  diferença visível na câmera do jogo. Texturas ≤ 1024 px para personagem pequeno na tela.
- Exportar para o Godot: GLTFExporter (three.js) numa página aberta pelo Playwright, binário em base64.
- **Modelos do Tripo chegam pesados e às vezes com defeito** (visto no Dallarian):
  - ~1 milhão de triângulos, textura 2048 JPEG, compressão `EXT_meshopt_compression` + `KHR_mesh_quantization`
    (precisa do `MeshoptDecoder` para ler);
  - **peças soltas a mais**: um "bastão" fino na frente da personagem; ou, quando a folha de 4 vistas vai como
    uma imagem só, **vários objetos juntos** (5 espadas num modelo).
  - Ferramentas: `tools/tripo-pecas.mjs` (lista as peças soltas com triângulos e caixa) e
    `tools/tripo-ps1.mjs entrada saida <tris> <px> [mín] [só_a_peça_N]` (descompacta, tira peças pequenas ou
    fica só com a N-ésima, reduz triângulos com meshoptimizer e a textura com sharp, grava GLB comum).
  - Resultados bons: personagem 2.500 tris + textura 512; espada 500 tris + 256.
  - Conferir sempre com `godot/ferramentas/ver_modelo.gd` (folha com 4 vistas + close).
  - No Godot: trocar o material do GLB pelo shader PS1 usando a `albedo_texture` original (`modelo_ps1()`).
  - Personagem do Tripo vem de frente para +X: girar -90° em Y para ficar de frente para +Z.
- Monstro simples: animar por deformação de vértices no shader (escorpião) em vez de rig.

## Chão em Gaussian splats estilo pixel art (`codigo/splat_chao.gdshader`, `codigo/chao_splat.gd`)
- Cada splat = quad deitado (PlaneMesh 1×1) numa MultiMesh; rotação e escala aleatórias (elipse).
- **Opaco com corte duro** (`discard` abaixo de um limiar da gaussiana) → usa profundidade, **não precisa
  ordenar** nem com câmera girando. É isso que deixa leve.
- Cor chapada por splat: lida no vertex shader no centro da instância (textureLod com mip alto do chão).
- Visual pixel: UV "travado" no centro do pixel grande da tela (`UV + dFdx(UV)*d.x + dFdy(UV)*d.y`),
  paleta reduzida (`floor(c*niveis+0.5)/niveis`), pontilhado Bayer 4×4 só em transições/sombras/nuvens.
- Blocos de 8×8 tiles (uma MultiMeshInstance por bloco) para o Godot cortar o que está fora da tela.
- Splats finos e escuros (~8%) fazem as rachaduras. Chão base por baixo só com o tom médio.
- Em primeira pessoa: splats menores perto da câmera, maiores longe; colisão com formas invisíveis simples.

## Publicação
- GitHub Pages: build da web (vite) + export Web do Godot em `/godot/`. O deploy às vezes falha com
  "No artifacts found": usar `continue-on-error` + espera + segunda tentativa (não re-rodar só o job falho,
  duplica o artefato).
- APK do Godot no CI: Java 17, keystore de debug em cache (mesma assinatura → instala por cima),
  `editor_settings-4.5.tres` com caminhos do Android, `--export-debug "Android"`, release `apk-godot`.
- Web: ler parâmetros do endereço com `JavaScriptBridge.eval("location.search")` (só se `OS.has_feature("web")`).
