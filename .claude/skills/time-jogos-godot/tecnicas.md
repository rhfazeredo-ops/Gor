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

## Árvores em "cartões" (alpha cards) — o jeito leve dos MMOs
- Tronco simples (6 lados, abrindo na base) + copa de ~25 retângulos planos cruzados, cada um com o desenho de
  um galho de fundo transparente (gerado em código: Image RGBA em tons de cinza; graveto curvo que afina e se
  divide, cachos de folhas com formato de folha — oval de pontas finas com nervura —, claras no alto do cacho;
  a cor vem da instância). Pinheiro: 11 andares de galhos; cada galho é um cartão **dobrado em telhado** (metades caindo para os
  lados) e **curvado para baixo** (ponta cai mais) — 4 quads; + 2 cartões cruzados na ponta.
  Cuidado: `fora.rotated(fora.cross(UP), +a)` levanta o galho (sinal); calcular a queda direto em y.
  Desenho de agulhas com traços de 2 px e denso: traço de 1 px some nos mipmaps (alfa < 0,5 → discard).
  Arbusto: 5 cartões cruzados + 1 deitado.
- Shader: corte duro do alfa (`discard` < 0,5 → opaco, sem ordenar), textura NEAREST com mipmaps, luz pela face
  em dois tons, vento maior no alto. A mesma árvore de perto e de longe (sem troca de detalhe).
- MultiMesh separada para tronco (sem cor de instância — o shader PS1 multiplica COLOR) e cartões (com cor).
- Pedaços de 128 m para ter poucos draw calls. Resultado: floresta densa com o FPS voltando de 2–3 para 5–7
  (no container sem GPU), contra ~2.200 quadradinhos por árvore da versão "folhas de verdade".
- Gravetos do desenho curtos e no meio do cartão: gravetos saindo da borda de baixo viram "guarda-chuva"
  vistos de baixo.

## Estilo pixel leve para vegetação
- Grama: cada folha é **um retângulo** (2 triângulos) de ponta quadrada, cor da base à ponta em 4 degraus.
- Folhas de verdade (perto, até ~60 m): cada folha um quadradinho fino em 3D (QuadMesh numa MultiMesh,
  rotação aleatória nos 3 eixos, dupla face), ~56 folhas pequenas (0,15–0,21 m) por **tufo**, ~21 tufos por árvore (3 em volta de cada ponta de galho
  + 9 pela copa); luz pela face (dois tons), miolo do tufo mais escuro, vento pelo centro do tufo
  (INSTANCE_CUSTOM). Montadas por pedaço perto do jogador; de longe ficam os splats.
- Folhas de longe: splats **quadrados** (`quadrado = true` no splat.gdshader), girados um pouco cada um
  pela posição, canto inferior direito um tom mais escuro.

## Braços em primeira pessoa (animação procedural, sem esqueleto)
- Pivôs das mãos presos à câmera; poses como dados: espada = [posição do cabo, direção da lâmina, giro do fio]
  (montar a Basis a partir da direção é bem mais fácil de acertar do que ângulos de Euler).
- **Golpes de espada sem "espada torta":** não interpolar Transform entre poses (o slerp da rotação gira a
  lâmina em volta dela mesma). Guardar a mão como [posição do cabo, direção da lâmina, normal da face] e montar
  a Basis (Y = lâmina, Z = face, X = guarda). Corte = arco: direção com dois slerps encadeados
  (preparação → meio apontando para a frente/cima → fim) e a face fixa = normal do plano do arco (o fio vai
  na frente); mão num Bézier quadrático passando à frente do corpo. Fases: preparação, corte, seguir, volta;
  o combo emenda do fim do golpe. Manter a lâmina visível: preparação com a mão em z ≈ -0,5 (não atrás da
  câmera), o meio do arco com componente para cima (senão a lâmina fica de ponta para a câmera).
- **Filmar o golpe para ajustar**: `--golpe=leve1|combo` deixa o jogo lento (`Engine.time_scale` ≈ 0,16) e
  salva um PNG por quadro desenhado (≈ 1/30 s de jogo cada) → folha de contatos. Pose parada engana; o
  movimento só se avalia assim (ex.: a preparação saía da tela por vários quadros).
- **Copiar golpe de um vídeo de referência**: ffmpeg recortando só a área do vídeo (`crop`), 24 quadros/s,
  achar os trechos com movimento (diferença entre quadros), montar folhas de contatos e anotar: guarda, para
  onde vai a preparação, quantos quadros dura o corte, onde termina e como volta. No vídeo de espada e escudo
  do dono: guarda com a espada EM PÉ à direita e o escudo embaixo à esquerda; preparação rápida que tira a
  espada da tela; corte de ~0,1 s atravessando a tela; termina fora da tela e volta SUBINDO por baixo.
- **Peso no golpe**: preparação que DESACELERA no alto (1-(1-u)^2,6) com a espada visível (dá para ver ela
  "carregar"), corpo/câmera inclinando para trás; corte que começa devagar e ACELERA (u^2,2) com a câmera
  avançando e girando junto; no fim do corte, pausa de impacto (~0,07 s; forte 0,12 s) + tremor da câmera;
  embalo depois do corte (a lâmina passa do ponto e para devagar); andar a 45% da velocidade atacando.
- Sensação de golpe: rastro da lâmina (faixa clara só na metade de fora da lâmina, some em 0,11 s) e a câmera
  vira 2–5° junto com o corte (yaw), além do pitch/roll.
- Ações (escudada) = lista de [duração, pose, tranco da câmera]; golpe com easing "rápido no
  começo" (1-(1-u)^3), preparação com smoothstep; combo encadeia se apertar durante o golpe.
- Sensação de peso: armas atrasam ao girar a câmera (sway), balanço do passo em figura de 8, respiração,
  tranco da câmera (pitch/roll/avanço) no impacto, afundar ao cair.
- Conferir poses paradas com um argumento de teste (`--pose=d=leve1_fim,e=e_golpe`): o fim dos golpes tende a
  sair por baixo da tela — manter a mão em y ≥ -0,32 e z ≈ -0,55 (câmera com FOV 70).
- Argumentos `--chave=valor` com "=" no valor: `split("=", true, 1)`.

## Região grande de mundo aberto (Dallarian, 1,2 km)
- Mapa em código (`regiao.gd`): linhas de estradas e rio rasterizadas uma vez em grades de distância (4 m),
  só nas células perto de cada segmento → altura/cor/água em qualquer ponto ficam baratas.
- Terreno em pedaços de 64 m: versão simples (8 m) sempre montada com `visibility_range_begin`, versão
  detalhada (2 m, com colisão) só perto do jogador; a simples desce um pouco (e bem mais perto da água,
  senão cobre o rio de longe).
- Montanhas de borda: altura que **satura** (`alto * (1 - exp(-d/32))`), nunca potência (vira 500 m).
- Neblina mais fraca no alto (`nb *= 1 - smoothstep(14,70,y)*0.5`) para ver a silhueta dos limites.
- **Construções nunca flutuando:** cada uma chama `reg.aplanar(centro, meia_medida, ângulo, margem)` ANTES de
  montar o terreno; a altura do piso é a média do chão nos cantos/centro e o terreno aplana o retângulo
  (+1 m de folga) e volta suave na margem. Alicerce descendo 1,2 m. Grupos juntos (acampamento) = um plano só
  (planos sobrepostos com alturas diferentes fazem degrau). Teste `--checar` mede o vão em cada canto.
- **Cercas e muros sempre no chão e sólidos:** montar DEPOIS do terreno (lista de Callables), usando a altura
  exata da malha (`altura_malha`, não a fórmula — os triângulos de 2 m diferem dela): mourões enterrados 0,6 m,
  travessas em pedaços de 1 m seguindo o chão; colisão = caixa por trecho reto da altura mínima até a máxima
  do chão + altura da cerca (porteira aberta). Blocos soltos (ruínas) assentados no canto mais baixo.
  Teste `--andar=s` empurra o jogador para a frente e diz onde parou.
- **Vila em rua principal:** andar pela linha da estrada (`_ponto_na_linha`) a cada 10–13 m e pôr casas dos dois
  lados com recuo e ângulo variados (porta para a rua), ~18% de vãos (quintais), vagas especiais (taverna,
  igreja); trilhas estreitas (grade de distância própria, 1,3 m) para grupos de casas, hortas e o rio.
  `--cima=altura,x,z` dá a vista de cima para conferir o desenho.
- **Nada em cima da estrada:** `_longe_da_estrada(centro, meia, ang)` empurra a área da construção pelo
  gradiente da distância à estrada até sobrar 1,5 m da beira (5×5 pontos da área); usado em toda casa e nos
  campos com cerca, antes de aplanar. Teste `--estrada` lista o que ainda encosta na estrada.
- Atenção: `rotation.y = a` gira (x,z) por **-a** em `Vector2.rotated`.
- Jogador preso na região e fora da água funda: volta para a última posição boa.
- Desenho de mapa de referência de jogo de terceiros: aproveitar só princípios (vila no cruzamento,
  rio dividindo áreas, bordas fechadas, clareiras com pontos de interesse), não o traçado.

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
- **NPC base com skins por cor (Dallarian):** o Tripo já entrega o personagem com esqueleto (78 ossos, nomes
  L_Thigh/L_Calf/L_Upperarm/Head…), ~500 mil tris; `tripo-ps1.mjs` reduz para 2.200 mantendo pele e pesos.
  Pele e túnica (e cabelo e couro) têm a MESMA cor na textura → separar pela parte do corpo: na carga, gravar
  em COLOR de cada vértice o peso dos ossos da cabeça (r) e das mãos (g); o shader junta isso com a cor do
  pixel (cinza = calça, escuro = couro/cabelo, claro = pele/túnica) e troca cada área pela cor sorteada,
  mantendo o sombreado (brilho do pixel / brilho típico da área). Uma malha preparada é reaproveitada (static).
- Animação procedural nos ossos: pose global = rotação (eixo do esqueleto) * repouso levado pelo pai;
  local = global_do_pai⁻¹ * global. Conferir o eixo "para a frente" do modelo (este olha para +X).
- **Personagem do Tripo SEM esqueleto (mesmo corpo base):** `tools/transferir-esqueleto.mjs base_rigado novo saida`
  alinha os dois (altura/pés/centro) e cada vértice copia ossos+pesos dos 4 vértices mais próximos do base.
- **Ferramenta na mão:** BoneAttachment3D no osso R_Hand; achar o eixo do cabo por PCA dos vértices, a cabeça
  pelo trecho mais largo e a "face/lâmina" pelo vértice mais afastado do eixo nesse trecho; montar a Basis
  (Y = cabo para a cabeça, Z = face) e alinhar com o desejado no espaço do esqueleto (cabo para a frente,
  cabeça para baixo na pose de repouso); compensar a escala do modelo para o tamanho real.
- **Profissões:** estado "trabalho" fixo no posto; golpe em ciclo (sobe devagar 62%, desce rápido, segura) que
  dispara um Callable no impacto → CPUParticles3D one_shot `restart()` (faíscas na bigorna, lascas no tronco).
  Fazendeiro dentro do campo: muda de canteiro a cada 10–20 s; agachado na terra arada, colhendo em pé no
  trigo (agachado some no trigo alto).
- **NPC com vida:** estados andar / atividade / conversa. A animação de andar pesa pela velocidade REAL
  (get_real_velocity), nunca pela intenção — senão ele "anda parado" quando trava; travado 0,8 s → desiste e faz
  outra coisa. Destinos em lugares de interesse (porta das casas, beira do poço, frente da ferraria) com
  atividade própria (olhar em volta, braços cruzados, mãos atrás, coçar a cabeça, debruçar no poço, agachar).
  Conversa: um convida outro livre perto, os dois vão para pontos a 1,3 m um do outro, ficam de frente, quem
  fala gesticula (braço sobe e mexe), quem ouve cruza os braços e balança a cabeça; trocam a vez a cada 2–5 s.
  Poses em quatérnios por osso, suavizadas (slerp) — troca de pose sem estalo.
- NPC andando: CharacterBody3D em MOTION_MODE_FLOATING + altura do terreno a cada quadro (com gravidade, eles
  caíam pelo chão antes dos pedaços de terreno com colisão existirem).
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

## HUD
- Retrato da personagem tirado do próprio modelo 3D: SubViewport escondida (own_world_3d, fundo transparente,
  UPDATE_ALWAYS), câmera ortográfica no rosto, esperar ~4 frame_post_draw e copiar para ImageTexture.
  Atenção: modelos do Tripo vêm CENTRADOS (y de -0,49 a 0,49), não com os pés no zero.
- Retrato redondo: draw_colored_polygon com UVs + textura; molduras e barras em _draw (trocáveis por PNG).

## Dublagem
- O dono grava no gravador do celular (m4a/AAC) e manda zip; o Godot não lê m4a → ffmpeg para OGG Vorbis mono:
  `silenceremove` no começo e no fim (com areverse), `highpass=f=80`, `loudnorm=I=-16:TP=-1.5` (volume igual).
- Diálogo = lista de [quem, texto, áudio]; legenda com o nome colorido por personagem; passa sozinho quando o
  áudio termina (+0,6 s) ou no toque; sem áudio, tempo de leitura (1,5 s + 0,055 s por letra). NPC escuta de
  braços cruzados e gesticula na própria fala.
- **Tratamento de voz (ffmpeg):** highpass 90 Hz → afftdn (ruído) → agate leve → EQ (-2 dB em 250 Hz tira
  o "abafado", +3 dB em 3,2 kHz dá clareza, +1,5 dB agudos) → deesser → acompressor 3:1 → loudnorm -16 LUFS →
  alimiter. Efeitos: loudnorm -14 + compressão leve; música -18 LUFS (fica atrás das vozes).
- **Mixagem no Godot (scripts/audio.gd):** buses Musica (EQ abrindo espaço nos médios), Voz (compressor +
  reverb de sala bem leve), Efeitos (reverb curto); limitador no Master. Música abaixa ~9 dB enquanto alguém
  fala (ducking) e volta devagar. Som 3D com filtro de distância (abafado ao longe).
- **Som 3D com a câmera dentro de SubViewport (efeito pixel): `vp.audio_listener_enable_3d = true`**, senão
  todo AudioStreamPlayer3D fica mudo (o "ouvido" é a câmera da tela de baixo). Atenuação: INVERSE_DISTANCE
  com unit_size = raio de volume cheio (6 m) → -4 dB a 10 m, -10 a 20 m, -16 a 40 m.
- O microfone do chat vira texto: áudio só chega como arquivo anexado.

## Publicação
- GitHub Pages: build da web (vite) + export Web do Godot em `/godot/`. O deploy às vezes falha com
  "No artifacts found": usar `continue-on-error` + espera + segunda tentativa (não re-rodar só o job falho,
  duplica o artefato).
- APK do Godot no CI: Java 17, keystore de debug em cache (mesma assinatura → instala por cima),
  `editor_settings-4.5.tres` com caminhos do Android, `--export-debug "Android"`, release `apk-godot`.
- Web: ler parâmetros do endereço com `JavaScriptBridge.eval("location.search")` (só se `OS.has_feature("web")`).

## Dia e noite (sem luzes de verdade, leve no celular)
- Relógio no script do mundo (1 h de jogo = 1 min). Uniforms **globais** (project.godot `[shader_globals]`):
  `luz_ambiente` (vec3: branco de dia, laranja no crepúsculo, azul-escuro de noite), `noite` (0..1) e
  `lanterna0..5` (vec4: posição + força) com as 6 lanternas/fogueiras mais perto do jogador (reordenar a
  cada 0,25 s). Sem arrays globais no Godot: usar vários vec4.
- Um include `shaders/noite.gdshaderinc` com `noite_cor(cor, pos_mundo)` e `noite_nevoa(neblina)`; em todo
  shader do mundo a linha final vira `ALBEDO = mix(noite_cor(c, (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz),
  noite_nevoa(neblina), nb)` — a posição no mundo sai do VERTEX do fragment, sem mexer no vertex shader.
- Luz das lanternas em faixas (`floor(q*6)/6`) = cara de pixel art. Chamas e lanternas usam `brilha = true`
  (não escurecem). Céu: mistura para azul-marinho, estrelas por hash numa grade de ângulos, lua num ponto fixo.
- Descansar (barraca): ColorRect preto com tween (escurece → muda a hora → aviso → clareia).

## Armas e props do Tripo
- **Eixo de uma arma/ferramenta**: `tools/eixo-ferramenta.mjs arquivo.glb` (PCA: eixo, ponta mín/máx, largura
  por trecho — o trecho mais largo é a guarda/cabeça, e a direção dele dá a guarda). Montar a Basis
  (guarda, lâmina, guarda×lâmina), transpor e pôr a origem no ponto do cabo: `Transform3D(r.scaled(k), -(r*cabo)*k)`.
- Escudo: medir qual face tem o umbo (frente) e girar para a frente da mão; a alça atrás fica na luva.
- Props com ponto especial (lanterna do poste): achar os vértices da peça no arquivo (filtro por região) e
  guardar o centro; depois `mod.global_transform * ponto` dá a posição da luz no mundo.
- Barracas/acampamentos: escolher candidatos (longe da vila, de estradas, rio, lago, lugares, campos, chão sem
  desnível) e pegar os mais espalhados com escolha gulosa (cada nova o mais longe possível das escolhidas).

## Variedade de NPCs
- Cada corpo novo (mulher, gorda, velha, forte, velho, crianças) é um modelo próprio com o esqueleto do NPC
  base transferido (`transferir-esqueleto.mjs --eixos`), então toda a animação procedural serve. Tipo define
  altura e "ritmo" (velhos andam e balançam mais devagar); cache da malha com regiões por skin.
- Crianças: pega-pega — pegador corre até o outro, o fugitivo foge em curva (vetor de fuga girado) e volta
  para o centro da área; ao pegar, trocam os papéis e o novo pegador "conta" 1,3 s. Corrida = mesma caminhada
  com passo maior, joelho mais dobrado, braços dobrados e tronco inclinado (`_corre` 0..1 pela velocidade).

## Golpes em primeira pessoa (orientação da espada)
- O dono quer a espada **em pé** parada, andando e correndo; no corte vertical ela fica em pé (componente x da
  direção ≈ 0 o golpe todo) e no horizontal fica **deitada** (y ≈ 0). Armadilha de perspectiva: lâmina
  apontando para a FRENTE com a mão abaixo dos olhos parece apontar para CIMA, e na altura dos olhos some.
  No corte horizontal, a lâmina aponta para o lado do movimento (ex.: direita-frente) com a mão ainda à
  esquerda, e só depois a mão atravessa — assim ela cruza a tela deitada.
- Testar golpes com prints congelados (`--pose=d=golpe:fase:u`), vários de uma vez em paralelo e montados
  numa folha.
- Pulo no celular: guardar o pedido 0,2 s e aceitar até 0,15 s depois de sair do chão (terreno irregular
  "descola" o corpo); garantir multitoque checando o retângulo do botão no `_input`.
- Tripo: modelo "com animação" pode chegar só com o rig (sem `animations` no GLB) — conferir com gltf-transform
  antes de prometer usar a animação.


## Animar modelo do Tripo SEM esqueleto (quadrúpedes)
- Marcar as partes nas **cores dos vértices** uma vez por tipo (GDScript, no carregamento): r = qual perna (pelos
  4 pés achados nos vértices mais baixos, separados pelo x médio e pelo lado z), g = peso do ombro/quadril
  (rampa pela altura), b = peso do joelho, a = 0,5 + cabeça / − cauda (rampa pelo comprimento). Pivôs saem da
  mesma medição (pés, 55% e 27% da altura, 78% e 23,5% do comprimento).
- No vertex shader: girar em volta dos pivôs (joelho primeiro, depois ombro), cabeça e cauda; o corpo inteiro
  (pulo, agachar, rolar) mexe no nó visual. Material próprio por indivíduo (uniforms de pose).
- Trote = pares diagonais; galope = dianteiras juntas e traseiras juntas, defasadas; joelho dobra só na fase
  de voltar a perna. Ataque = agacha 0,3 s → salta 0,3 s (patas da frente esticadas, morde no meio) → cai.
  Esquiva = pulo lateral com patas encolhidas e corpo inclinado.
- **Armadilha:** zerar a velocity no fim do _physics_process apaga o salto do ataque — calcular a velocidade do
  salto no mesmo lugar em que se monta a velocity final.
- Pausas e relógios de IA: usar o relógio da física (`Engine.get_physics_frames()/ticks`), não Time do sistema —
  com o jogo lento (teste sem GPU) o relógio do sistema corre na frente e a matilha ataca em rajada.
- Matilha: dicionário compartilhado (casa, membros, alerta, atacante, pausa); cada lobo com seu ângulo na roda;
  só o "atacante" vai para cima; força de separação de 2,6 m entre eles.
- Testes: `--lobos=N --lobo_anim=correr|atacar:u|esquivar:u --lobo_um=0 --lobo_pos=x,z` (prints congelados) e
  `--lobo_log=1 --lutar=1` (estado da matilha por segundo e mordidas).


## Fauna leve (peixes e pássaros)
- Peixes = MultiMesh de quadrados deitados com a silhueta desenhada no shader (oval + cauda, pixels grandes,
  cauda balançando por INSTANCE_CUSTOM), escuros e meio transparentes logo acima da água opaca (render_priority).
  **Visto da beira o quadrado deitado vira um risco**: alargar a largura no vertex shader conforme o ângulo
  da câmera (`VERTEX.z *= clamp(0.7/|v.y|, 1, 4)`).
- Seguir o rio pela distância ao longo da linha (comprimento acumulado), com deslocamento lateral dentro da
  largura; lago = volta em círculo entre a ilha e a margem.
- Pássaros: corpo + duas asas em pivôs (rotation.z bate/plana); bando em V. Tudo perto do jogador: grupo que
  fica longe renasce perto dele (não gasta nada no resto do mapa).
- class_name novo só é achado pelo jogo depois de `godot --headless --import` (atualiza o cache de classes).


## Vegetação de enfeite (arbustos, samambaias, taboas)
- Mesmo sistema de cartões das árvores. Cartões que precisam de duas cores (folha verde + flor, folha + espiga
  marrom) vêm com a textura JÁ colorida e a cor da instância perto do branco (só varia o tom); os cinzas
  continuam recebendo a cor da instância.
- Taboa/junco: textura de folhas compridas que curvam no alto + talos com espiga marrom; touceiras ao longo da
  linha do rio (dos dois lados, na beira: meia largura −0,3 a +2,2 m) com falhas por ruído; volta do lago e da ilha.
- Jardins: 1–3 arbustos floridos nas laterais/fundos das casas, nunca na rua. Na grama alta, arbusto pequeno
  some: usar escala ≥ 1.
- `--desenhos` salva as texturas dos cartões em user:// para conferir lado a lado.


## Progresso, bolsa e loja
- Dinheiro guardado num inteiro só, em cobre (100 cobre = 1 prata, 100 prata = 1 ouro); converter só para mostrar.
- Curva de níveis suave para nível máximo 30: XP(n) = 80·n^1,5 arredondado de 10 em 10 (multiplicar por 1,5 a
  cada nível explode: 1,5^29). Ao carregar o jogo, recalcular vida/mana máximas pelo nível.
- Salvar progresso em `user://progresso.json` (FileAccess + JSON) com atraso de 1 s depois de mudar; nos testes
  com `--shot` não carregar nem salvar (resultado sempre igual).
- Painéis de loja com PanelContainer + StyleBoxFlat (fundo escuro, borda dourada); desligar o `_input` dos
  controles enquanto o painel está aberto (o toque no painel não mexe o joystick).


## Inventário e vendedor estilo WoW (Godot, sem cena: tudo em código)
- Bolsas = lista de 3 lugares; cada bolsa tem um array de espaços (null ou [id, qtd]); pegar() completa
  pilhas e depois ocupa vazios e devolve o que não coube; salvar/carregar em JSON com migração do formato antigo.
- Janelas: PanelContainer + StyleBoxFlat escuro com borda dourada; dicas em azul-escuro; nome na cor da
  qualidade (cinza, branco, verde, azul); preço com moedinhas (só as moedas que aparecem); botões vermelhos.
- Montagem manual das bolsas: da direita para a esquerda, de baixo para cima, usando
  `get_combined_minimum_size()` para saber o tamanho antes de posicionar (coluna nova quando não cabe).
- Vender no celular: tocar no item abre a dica com VENDER (evita vender sem querer). Recompra guarda os 12
  últimos vendidos.
- Ícones: usar `assets/ui/itens/<id>.png` se existir; senão desenhar um provisório no código (Image).
- Retrato de NPC na janela: SubViewport com o modelo, câmera ortográfica no rosto (como o retrato do HUD).


## Recortar folhas de ícones (PNG com transparência)
- Separar as peças pelas colunas com alfa forte (alfa > 40) e recortar cada peça pelo bbox de alfa > 60:
  o bbox com alfa > 0 pega um "brilho" quase invisível na folha inteira e o ícone fica minúsculo no espaço.
- Ícones de item 128×128 quadrados (margem de 4%), moedas 64×64, símbolos de botão 160×160 com o mesmo
  preenchimento dos outros (medir o bbox de um ícone que já existe).


## Ajustes de jogo (feedback do dono)
- Inimigo NÃO foge depois de atacar: fica em "fúria" (colado no jogador, ataca de novo quando a recarga
  acaba, no máximo 2 atacando juntos); esquiva só de lado, sem se afastar, e já volta atacando. Se o jogador
  chega perto de um lobo da roda, ele não recua: encara e ataca.
- Mancha preta em modelo do Tripo (ex.: orelha): achar os triângulos da região pelas posições, pegar os UVs,
  pintar os pixels escuros dentro desses triângulos (um pouco aumentados) com o tom do pelo e trocar a imagem
  dentro do GLB com gltf-transform; apagar `<nome>_Color_*` e `.godot/imported/<nome>*` e importar 2×.
- Fogo bom e leve: labaredas desenhadas no shader (ruído subindo, forma de gota, cores em faixas, pixels
  grandes) em 2–6 quadrados que giram para a câmera + CPUParticles3D de fagulhas subindo (preprocess para já
  começar aceso).
- Preço que não dá para pagar: só o número em vermelho (moedinha continua normal).


## Chuva e sons enviados pelo dono
- Chuva: uniform global `chuva` (0..1, entra/sai em ~25 s); céu com mais nuvens cinzas, sem sol nem estrelas;
  luz ambiente multiplicada por um cinza-azulado; CPUParticles3D (traços verticais, BILLBOARD_FIXED_Y,
  local_coords = false) presa 13 m acima do jogador; som em loop com volume = linear_to_db(chuva).
  CPUParticles3D NÃO tem amount_ratio no 4.5 — variar a opacidade do material.
- Loop sem emenda de um som curto: cruzar os últimos 2 s com os primeiros 2 s (raiz quadrada nas curvas) no
  Python e cortar o começo; loudnorm -20 LUFS para ambiente.
- Efeito longo (rosnado) vira 3 sons: um longo (alerta) e dois curtos (ataque), com fade de 0,08/0,25 s;
  tom mais grave para o líder (pitch 0,8) e espera mínima entre um som e outro do mesmo bicho.


## Vento e relógio
- Vento: uniform global `forca_vento` multiplicando o balanço que os shaders já tinham (grama, cartões,
  splats); rajadas = soma de senos lentos no relógio da física; chuva soma mais vento. Folhinhas voando =
  CPUParticles3D (local_coords false) atrás do jogador no sentido do vento, só nas rajadas e de dia.
- Som de vento sem arquivo do dono: ffmpeg `anoisesrc=color=brown` + lowpass 700 Hz + volume oscilando
  (rajadas), loop cruzado de 3 s, loudnorm -22 LUFS; volume segue a força do vento.
- Relógio clean: hora de 5 em 5 min embaixo da bússola, sol (círculo + raios) ou lua (draw_arc grosso).


## Otimização para celular (medir antes de mexer)
- Medir com `Performance.get_monitor` (RENDER_TOTAL_DRAW_CALLS_IN_FRAME, RENDER_TOTAL_PRIMITIVES_IN_FRAME,
  TIME_PROCESS) num teste `--perf`, e o tempo de cada script trocando `_process` por um embrulho que soma
  `Time.get_ticks_usec()` (tirar depois). Triângulos por sistema: somar malhas × instâncias por dono.
- Metas de celular médio: ≲ 200 mil triângulos e ≲ 300 chamadas de desenho por quadro.
- O que mais rendeu no Dallarian: (1) LOD das árvores de cartões — copa completa até ~90 m, versão com 9
  cartões maiores depois (`visibility_range_end/begin` em dois MultiMesh com as mesmas posições); (2) alcance
  menor de árvores/grama/splats escondido pela neblina mais perto (neb_fim 330 → 270); (3) blocos maiores de
  grama/splats e terreno distante juntado em blocos 2×2 com `SurfaceTool.append_from`; (4) juntar peças
  paradas do mesmo material por célula de 96 m; (5) animação de ossos dos NPCs a cada 3–5 quadros de longe
  (tempo acumulado) e nada além de 95 m; lobos idem; (6) menos variedade por pedaço (2 copas, 1 flor).
- Variável `celular` (OS.has_feature("mobile") ou `--celular` no PC) corta mais distância/densidade só no
  celular.

