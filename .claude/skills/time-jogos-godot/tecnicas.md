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


## Armadilha da otimização "juntar peças"
- Juntar só malhas do material de construção (shader PS1) que não sejam PrimitiveMesh: juntar a água do rio
  com o plano do mar (PlaneMesh) fez o rio SUMIR. Depois de qualquer otimização, tirar print dos lugares
  com coisas especiais (rio, lago, fogo, postes) para conferir.
- Animação de morte de quadrúpede: tranco → patas cedem (frente primeiro) → corpo desce → tomba de lado.
  O giro de lado é em volta do pé: tirar o "abaixar" enquanto tomba, senão o corpo entra no chão.
- XP estilo WoW Classic: tabela do Classic + XP por bicho = 45 + 5×nível, ±por diferença de nível, zero se cinza.


## Espuma nas beiradas da água
- Faixa de malha ao longo da margem com UV.x = metros ao longo e UV.y = 0 (água) → 1 (margem) e um shader só:
  modo ondas (cristas `fract(y - t)` andando para a margem + espuma na beira) e modo correnteza (riscos finos
  em trilhas estreitas descendo o rio: ruído em x - t). Linha da praia achada andando em x até o chão
  ficar abaixo do nível do mar. render_priority 1, depth_draw_never, alfa.
- Ruído de valor quase nunca passa de 0,8: limiar ~0,66 para aparecer riscos.


## Itens com status (estilo WoW Classic)
- Item = dicionário com tipo (arma/escudo), dano_min/max, velocidade, armadura, bloqueio, nível; equipamento
  salvo junto do progresso; EQUIPAR troca com o que está na mão; sinal `equipou` troca o modelo na mão.
- Dano do jogador = arma + bônus por nível; crítico 5%. Redução por armadura do Classic:
  `arm / (arm + 400 + 85 × nível do atacante)`. Bloqueio ativo: 1º golpe depois de levantar = bloqueio total.
- Números de combate: guardar a posição 3D e a cada quadro `cam.unproject_position(pos) * REDUCAO` (a câmera
  está na SubViewport reduzida); sobem e somem em ~1,3 s; tamanho ≥ 50 na tela de 1920 de base.


## Mapa da região (estilo WoW)
- Gerar a imagem com o PRÓPRIO terreno do jogo num script `extends SceneTree` rodado com
  `godot --headless --script` (Regiao.new(): cor do chão, relevo sombreado pela derivada da altura, água,
  matas) → acabamento em Python (tom de pergaminho, granulado, vinheta, pixels 2×). 768 px para 1,2 km.
- Janela: Control que desenha a textura num quadrado com moldura, a posição do jogador convertida de mundo
  para UV `(x + LIM) / (2·LIM)` e uma seta apontando para `-basis.z`. Esconder bússola/relógio com ele aberto.
- Sem marcar lugares: a descoberta fica só na bússola (decisão do dono).


## Monstros humanoides e aranha (Tripo)
- Modelo do Tripo pode vir com o rig humanoide dele (mesmos 78 ossos do NPC base) mesmo sem animação: usar direto
  com a animação procedural dos moradores. Sem rig: transferir o esqueleto do NPC (`--eixos`).
- Arma presa na mão: o "cabo para a frente" vale para a pose de repouso (braço caído); se a pose de guarda
  levanta o braço ~90°, a arma tem de apontar para BAIXO no repouso para ficar deitada na guarda.
- Tripo multivisão às vezes gera DUAS cópias do objeto no mesmo arquivo (ex.: lança em duas alturas): cortar
  os triângulos de uma delas pelo centroide (gltf-transform, reescrever os índices).
- Aranha sem rig: classificar patas pelos vértices fora de dois elipsoides (abdômen e cefalotórax), qual pata
  pela direção a partir da raiz comparada com as pontas medidas; gait em dois grupos alternados no shader.
- Golpes que travam o inimigo a cada acerto deixam a luta fácil demais: só os fracos atordoam, e com chance.
- Chefe: barra do golpe em cima da cabeça (enche até o instante do dano), pancada com aviso de ~1 s.


## Distância de visão configurável (névoa estilo Minecraft)
- neb_ini/neb_fim viram uniforms GLOBAIS em todos os shaders; o menu muda os dois + `camera.far = distância + 10`
  (tudo além nem é desenhado: é aí que o celular ganha) + um global `neblina_ceu` que pinta a parte baixa do céu
  com a cor da névoa (senão o horizonte azul aparece atrás da névoa). Salvar em user://config.json.
- Menu com o jogo pausado: `get_tree().paused = true` e process_mode ALWAYS no menu e nos botões.


## Diálogo dublado: nunca cortar a voz
- No celular o toque gera também um clique de mouse emulado: o toque que aperta CONVERSAR chegava na caixa de
  diálogo recém-aberta e pulava a 1ª fala (a voz da heroína "não saía"). Tocar na caixa só avança se a voz
  atual já terminou (e nunca nos primeiros 0,6 s); o avanço automático também espera a voz acabar; a conversa
  só fecha no fim das falas (ou se o jogador se afastar bastante).


## Monstros que voltam (respawn)
- Na morte, guardar uma Callable que recria o bicho com os mesmos dados (tipo, nível, grupo, posição de casa)
  numa lista [segundos, Callable, grupo]; a cada quadro descontar; ao vencer, se o jogador estiver perto da
  casa esperar mais 10 s (não "brotar" na cara dele); trocar os mortos do grupo pelo novo.
- Chefe: volta muito depois (1 h) e no ponto da rota mais longe do jogador.
- Grupo de bicho sozinho: o dicionário do grupo do bicho e o da lista de matilhas têm de ser O MESMO objeto.


## Aumentar o mapa sem desmontar a vila
- O mapa foi desenhado em coordenadas fixas. Para dobrar o tamanho: uma função de "espalhar" W(p) que deixa
  tudo até 150 m do centro igual e afasta o resto linearmente (W(r) = 150 + (r−150)·k), aplicada aos pontos do
  desenho (estradas, rio, lago, campos, morros, lugares) e Ws(r) às distâncias fixas (costa, pântano, montanhas).
  A vila, as trilhas e o píer continuam exatamente iguais. Tamanhos de coisas (lago, morros) crescem à parte.
- Mais área = mais grupos de monstros (2–2,5×) e mais barracas; testar com `--estrada` que nada caiu na estrada.
- Custo: floresta e terreno distante são montados no começo (4× mais pedaços): carregamento mais longo.


## Mapa retangular e cidade grande
- Limites separados X0/X1/Z0/Z1 (e grades NX×NZ) em vez de um LIM só; terreno, floresta, mapa e sorteios usam
  os limites; o plano do mar tem de ser deslocado para o centro do retângulo.
- Floresta montada aos poucos em volta do jogador (um pedaço por 0,1 s, solta os longe): com o mapa grande,
  montar tudo no começo dobrava o carregamento. No _ready do mundo o jogador ainda não está na árvore
  (usar a posição inicial).
- Cidade: retângulo com chão plano (terreno puxado para uma altura fixa até 60 m fora), casas com `chao_fixo`
  (sem aplanar: 400 planos deixavam a altura lentíssima), muralha em trechos entre os portões + ameias, torres,
  castelo, catedral, praça. Porto: puxar a linha da costa para perto da muralha leste só na faixa da cidade, e o
  cais começa onde a areia acaba. Testar o porto com a câmera em terra (embaixo da água o print engana).
- Com centenas de casas: juntar também malhas de várias superfícies (cada parte da casa no grupo do seu
  material) e indexar casas/lugares numa grade de 64 m para as buscas de "tem casa perto?".

## Travar a mira e monstros fora da água
- Travar a mira: alvo = inimigo do grupo com menor distância × (1 + (1 − frente)·1,5) até 30 m; a cada quadro
  lerp_angle no yaw do corpo e lerp no pitch do pescoço até o alvo; ignorar o olhar do toque/mouse enquanto travado;
  soltar se morrer ou passar de 40 m. HUD: X apagado no centro + triângulo vermelho e barra de vida em cima do alvo
  (unproject × REDUCAO). Tab com detecção de borda; botão próprio no celular.
- Monstro nunca na água: função na_agua (altura da malha < 0,35 ou abaixo do nível de água do lugar); ponto_seco
  procura em espiral em volta da casa ao nascer/renascer; depois do move_and_slide, se entrou na água, volta para a
  posição anterior. Teste `--checar_agua` conta os que estão na água no começo e depois de 20 s.
- Sortear lugares: filtrar também altura < 1,5 (perto do mar a "floresta" do ruído continua alta e cai no mar).

## Rio de verdade e montarias
- Segundo rio: mesma técnica do primeiro (polilinha → grade de distância e parâmetro t rasterizada uma vez),
  com nível por vértice sempre descendo até o mar; o terreno é cavado só dentro da largura + margem, e
  dist_rios() (mínimo dos dois) serve para floresta, monstros e grama. Ponte = vão maior que a largura no ponto.
- Montaria em primeira pessoa: o modelo do cavalo vira filho do CharacterBody (frente = −Z, igual à câmera),
  a altura do pescoço vai de 1,62 para ~2,55 com move_toward, os braços somem e a velocidade ×1,6.
  O pescoço e a cabeça do cavalo aparecem embaixo na tela e balançam com a animação (pernas em diagonal).
- Barra de "carregando" estilo WoW desenhada num Control (_draw): cancela se andar > 0,25 m, atacar ou sair do chão.
- Loja genérica: abrir(npc, cfg) com nome, cargo, itens, retrato e falas — o mesmo painel serve a vários vendedores.
- Item que vira montaria: comprar põe na bolsa; toque duplo (mesmo espaço em < 450 ms) "aprende" (some da bolsa,
  entra na lista de montarias) e mostra um recado grande no meio da tela; no menu, EQUIPAR escolhe a do botão.
- NPC parado num posto (vendedor): profissão própria usa o estado "trabalho" (vai ao posto e olha para olhar_posto);
  quando a profissão não tem modelo próprio, cair no modelo do tipo (MODELOS_PROF.has) e chamar montar() mesmo assim.
- Construção fora da cidade em terreno irregular: reg.aplanar(centro, meia, ang) uma vez para a área toda e usar a
  altura devolvida para tudo (cerca, telheiro, cavalos); registrar como "lugar" para a floresta não plantar árvores dentro.
- Peixes e juncos em vários rios: guardar [linha, comprimentos acumulados, total, largura(t), nível(t)] por rio
  (Callables dos métodos da Regiao) e escolher o rio mais perto da jogadora quando um cardume renasce.
- Cavalo do Tripo (sem rig): ~490 mil triângulos → `tools/tripo-ps1.mjs ... 3000 512` (fica ótimo). Vem com ~1 m de
  comprimento e a cabeça para +X: girar +90° em Y (frente = −Z) e escalar ~2,7×; achar a sela pelo perfil de altura
  ao longo de X (o ponto mais baixo das costas). Montado: Rachel um pouco atrás da sela e olhos a ~2,5 m, para ver
  o pescoço e as orelhas na frente; sem rig, a animação é o corpo todo subindo/descendo e balançando no passo.
- Ícone da bússola pintado de cor no jogo: a arte vem branca com contorno preto e fundo transparente; o modulate
  vermelho deixa o branco vermelho e o contorno preto.

## Imagem limpa x retrô (opções de Gráfico)
- O pontilhado Bayer + paleta curta (9 níveis) sobre a imagem em 1/4 da tela parece DEFEITO para quem olha de
  fora ("textura pontilhada sobre a cena inteira"). Padrão agora: pontilhado desligado e 32 níveis; opção
  "Pontilhado retrô" no menu para quem quiser.
- "Nitidez" no menu = stretch_shrink do SubViewportContainer (4 leve, 3 média, 2 alta); atualizar junto a escala
  usada pelo HUD para projetar marcadores (unproject × escala). Celular começa em 3, PC em 2. Salvo no config.
- Medir script por script: chamar de novo `_process/_physics_process` de cada nó com script e somar o tempo
  (`--perfil`). No Dallarian os scripts somam ~3,5 ms; o peso é gráfico (TIME_PROCESS no llvmpipe inclui o render).
- Não varrer `raiz.get_children()` a cada quadro para achar um NPC: guardar a referência uma vez.

## Rig automático de quadrúpede (cavalo do Tripo) no próprio Godot
- `scripts/rig_cavalo.gd`: lê `surface_get_arrays`, acha as 4 patas pela média dos vértices do quarto de baixo
  (frente/trás pelo meio do comprimento, esquerda/direita pelo sinal de Z), põe ossos de coxa (um pouco acima da
  barriga) e canela (joelho a ~22% da altura), pescoço e rabo; pesos de até 2 ossos com smoothstep; grava
  ARRAY_BONES/ARRAY_WEIGHTS numa ArrayMesh nova + Skin (bind = inverso da posição do osso) e põe o MeshInstance
  dentro de um Skeleton3D (mi.skeleton = ".."). Malha e Skin guardados por arquivo; um esqueleto por cavalo.
- Armadilha: os pelos dos cascos de trás passam do limite do rabo e iam junto com ele (fiapos esticados no
  galope). Abaixo do joelho, quase tudo é pata (faixa larga); rabo só no meio (|z| pequeno) e bem atrás.
- Animação: fase acumulada pela velocidade (~2,6 m por passada), trote em diagonal (sen na coxa em torno do eixo
  lateral, canela dobra com max(0, cos)), pescoço balança no dobro da frequência, rabo levanta andando.
- Conferir com `godot/ferramentas/ver_cavalo.gd` (6 momentos do passo de lado, ou `--frente`).

## Coletar em instância de MultiMesh (arbusto de frutinhas)
- Guardar, ao montar o pedaço, [MultiMesh, posições] dos arbustos coletáveis; a interação procura o mais perto
  5×/s (não a cada quadro). Colhido = `set_instance_color` com um verde que escurece os pontinhos (parece arbusto
  sem fruta) e volta ao branco depois do tempo. Como os pedaços são soltos e remontados, o estado "colhido" fica
  num dicionário pela posição arredondada e é reaplicado ao remontar.

## Morte em primeira pessoa
- Cair morta: o nó do pescoço desce até ~0,26 m e gira ~1,3 rad no eixo Z (tomba de lado) com curva acelerada
  (u²) em ~1 s; braços descem para fora da tela; tremor na batida; sem entrada até reviver.
- Tela: ColorRect vermelho embaixo do HUD (move_child para o índice do HUD) e texto grande no _draw do HUD; depois
  tween da cor para preto, teleporte para o ponto de renascer (de frente para a estátua) e o preto some.

## NPC do Tripo com o mesmo esqueleto, mas outra orientação/pose de descanso
- A freira veio com os mesmos nomes de ossos dos moradores, mas de frente para +Z e em pose de T; os moradores
  olham para +X e descansam em pose de A (braços ~58° para baixo). Medir isso imprimindo get_bone_global_rest dos
  dois esqueletos (ombro e mão). Correção: conjugar a rotação de cada osso pelo giro entre os espaços
  (q' = R·q·R⁻¹, R = 90° em Y no sentido certo, conferido pelo lado do braço esquerdo), multiplicar os braços por
  uma rotação extra que leva o T até o A, e girar o nó do modelo 180° em vez de 90°.
- Ajustar uma pose nova (mãos orando) com um parâmetro de teste na linha de comando e 3 prints lado a lado.

## Estabilidade da imagem (o que parecia defeito no celular)
- Tremido PS1 (vértices arredondados numa grade 320×180) faz casas e montanhas "dançarem" quando a câmera anda:
  deixar como opção (uniform global tremor_ps1, padrão 0).
- Textura "nearest" sem mipmap cintila de longe (moiré): gerar mipmaps na Image e usar filter_nearest_mipmap
  (continua com pixels duros de perto).
- Splats do chão que encolhiam perto da câmera viravam "bolhas" crescendo e diminuindo ao andar: tamanho fixo.
- Poça com reflexo do céu (fbm de 5 oitavas por pixel) era cara e chamativa: cor chapada.
- Splats em blocos montados em volta do jogador "brotam" na borda: passar o alcance da camada por instância
  (custom data) e, no vertex, encolher a mancha até zero entre 62% e 92% do alcance (pela distância horizontal
  do centro até a câmera). Os blocos entram/saem onde as manchas já têm tamanho zero.

## Save na nuvem com Supabase (login anônimo) direto do Godot
- Sem SDK: HTTPRequest. Login anônimo = POST /auth/v1/signup com corpo {} (precisa ligar "Allow anonymous sign-ins"
  em Authentication → Sign In / Providers). Guardar o refresh_token em user:// e renovar com
  POST /auth/v1/token?grant_type=refresh_token. Header `apikey` = chave publishable (pública) + `Authorization: Bearer`.
- Tabela saves(user_id uuid pk default auth.uid() references auth.users, dados jsonb) com RLS: select/insert/update
  só quando auth.uid() = user_id. Upsert: POST /rest/v1/saves?on_conflict=user_id com
  `Prefer: resolution=merge-duplicates`.
- Save local continua; o save leva "salvo_em" (unix) e, ao abrir, o mais novo vence. Enviar no máximo a cada 30 s
  e na hora em NOTIFICATION_APPLICATION_PAUSED (celular indo para o fundo) e WM_CLOSE_REQUEST.
- Android: permissions/internet=true no export_presets.cfg, senão o APK não acessa a rede.

## Atualização automática do APK sem loja (pacote .pck)
- Cena de início (main_scene) confere um versao.json na Release do GitHub; se o número for maior que o do APK
  (res://versao.json, gravado pelo workflow com GITHUB_RUN_NUMBER) e que o do pacote já baixado, baixa o .pck
  (HTTPRequest.download_file, confere o tamanho) para user:// e chama ProjectSettings.load_resource_pack(arq, true)
  antes de change_scene_to_file da cena principal. APK novo instalado por cima ganha do pacote antigo.
- Workflow: `godot --export-pack "Android" dallarian.pck` + versao.json {n, tamanho} na mesma Release.
- include_filter="versao.json" no export (arquivo que não é recurso não entra no export sem isso).
- Testado: pacote com uma classe nova (class_name) carregado por cima do jogo antigo funciona no 4.5.
- Supabase sem precisar do painel: em vez de auth anônima (tem que ligar no painel), perfil por aparelho
  (uuid + segredo aleatório em user://) e funções security definer salvar_jogo/carregar_jogo que conferem o
  segredo (crypt/bcrypt do pgcrypto); tabela com RLS e sem políticas (só as funções acessam).

## Armadilhas: portão na muralha em pedaços, ponte e passada do cavalo
- Abrir o vão do portão testando só o MEIO de cada pedaço do muro falha quando o vão cai na junta entre dois
  pedaços (ângulo do portão = múltiplo exato do passo): testar também as pontas do pedaço.
- Peça girada com atan2: Basis(UP, θ) leva o eixo Z local para (sen θ, 0, cos θ); para alinhar com a tangente da
  muralha (−sen a, cos a), θ = atan2(−sen a, cos a) — sem somar 90°.
- Ponte na altura fixa da cidade e margem natural mais alta: aterrar um corredor da estrada até a altura da ponte
  (fora do vão), e pintar o calçamento nesse corredor.
- Animação de passo de quadrúpede: passada cresce com a velocidade (≈2,4 m andando, ≈6 m galopando); frequência
  = velocidade / passada. Galope = patas da frente quase juntas e depois as de trás (fases 0; 0,6; π; π+0,6).
- Andadura natural de cavalo: a pata fica ~60% da passada no chão (vai reta da frente para trás) e ~40% no ar
  (volta rápida com o joelho dobrando em sen(πv)) — bem melhor que um seno simétrico. Passo em 4 tempos com as
  fases trás-esq 0, frente-esq ¼, trás-dir ½, frente-dir ¾; trote = diagonais; galope = frente juntas e trás juntas.
  Referência em GIF: separar os quadros com PIL (ImageSequence) e medir o tempo de uma passada.

## Trancos ao andar: montar o mundo em segundo plano (WorkerThreadPool)
- Medir antes: embrulhar a montagem de cada pedaço com Time.get_ticks_usec e correr a cavalo (teste --picos). No
  Dallarian cada pedaço levava 10–90 ms no quadro principal (o quadro de 60 FPS tem 16 ms).
- Separar cada sistema em "dados" (só lê o mapa: posições, cores, arrays da malha) e "montar" (cria nós). Os dados
  rodam em WorkerThreadPool.add_task; a cada quadro, is_task_completed → wait_for_task_completion → montar.
  No máximo 3 tarefas juntas; resultado descartado se o pedaço já ficou longe. No carregamento monta tudo na hora.
- MultiMesh: empacotar o buffer na tarefa (12 floats do Transform3D em linhas + 4 da cor + 4 do custom) e no
  quadro principal só `instance_count` + `buffer` (rápido). Terreno: SurfaceTool.commit_to_arrays na tarefa;
  colisão com ConcavePolygonShape3D.set_faces(vértices) em vez de create_trimesh_shape.
- Cache compartilhado (alturas do terreno) com Mutex; grades de busca preguiçosas precisam estar completas antes.
- Travar em 60 FPS (application/run/max_fps=60) e nitidez automática: média < 48 FPS por 4 s → baixa um nível.

## Movimento fluido (travadinhas ao andar)
- Movimento no _physics_process (60 Hz) e tela em outro ritmo = soluço quando o FPS oscila. Ligar
  physics/common/physics_interpolation=true (Godot 4.4+, 3D) e: chamar reset_physics_interpolation() depois de
  teletransportar; o que se mexe no _process (pássaros, chuva, folhas que seguem o jogador) fica com
  physics_interpolation_mode = OFF, ou passa para _physics_process (animação do cavalo).
- Velocidade com aceleração/freada exponencial (lerp com 1−exp(−k·dt)): a pé k≈14/18, a cavalo k≈4/6 ("peso"),
  no ar k×0,35.
- ARMADILHA das tarefas em segundo plano: a tarefa não pode ler um Dictionary que o quadro principal está alterando
  (ex.: a camada com "ativos") — deu "corrupted size vs. prev_size" ao fechar. Passar uma cópia (duplicate) só com
  os dados de que ela precisa, e esperar todas as tarefas em _exit_tree.
- Referência em vídeo (gravação de tela): ffmpeg crop na área do desenho + quadros na taxa original; achar o
  período do ciclo pela diferença média entre o quadro i e o i+lag (o menor valor = período). Galope do vídeo:
  12 quadros a 24 fps = 0,5 s; apoio curto (~30% por pata), fases trás 0,55/0,65 e frente 0/0,1 da passada,
  "voo" com as patas recolhidas entre a frente sair e as de trás chegarem.
- `gh release create` com vários arquivos pode deixar a Release como RASCUNHO (o link de download dá 404, mesmo
  com o workflow verde). Depois do create: `gh release edit TAG --draft=false` e conferir com `gh release view`.

## Carregamento lento: medir cada etapa do _ready
- Imprimir o tempo de cada etapa (`--carga`). No Dallarian: espuma da praia 12 s (laço "while altura > 0: x += 1"
  por 2 km × 500 linhas), monstros 9 s (sorteio com 24 mil tentativas calculando a altura logo de cara + ~650 nós
  criados antes da primeira imagem), terreno de longe 6 s.
- Correções: busca em passos largos + refino (e começar perto da resposta da linha anterior); no sorteio, testes
  baratos (grades, contas) antes da altura; criar os monstros por uma fila depois do carregamento (3 ms por quadro,
  os mais perto da jogadora primeiro — o grupo existe já, os membros chegam); cálculo por pedaço em
  WorkerThreadPool.add_group_task + wait (só ajuda se o cálculo não depender de dados que mudam).
- Pré-calcular no build: o que é determinístico e caro (alturas e cores do terreno de longe) vai num arquivo gerado
  no workflow (`godot --headless --path . res://cenas/mundo.tscn -- --gerar_terreno`, grava em res://dados com
  FileAccess.open_compressed ZSTD + store_var) e entra no export pelo include_filter ("versao.json,dados/*"); o
  arquivo fica no .gitignore (sempre gerado igual ao código). Sem o arquivo, o jogo calcula como antes. 5,7 s → 0,8 s.
- Folhagem em cinza tingida pela cor da instância "suja" detalhes coloridos (frutas): pintar o verde na própria
  textura e deixar a instância branca.

## Galope de quadrúpede por perfil de apoio (lobo, cachorro)
- Por pata: `u = fposmod(fase/TAU + deslocamento, 1)`; apoio `u < 0.34` com ângulo do quadril 1 → -1 (reta para
  trás) e joelho quase reto; voo com `smoothstep` de volta e dobra `sin(πv)`. Deslocamentos do galope rotatório:
  frente 0 e -0.08, trás -0.5 e -0.58 (frente e trás opostas = esticado ↔ recolhido).
- Corpo: altura e inclinação pela fase global (`recolhe = 0.5+0.5cos(2π(u-0.45))`), cabeça quase nivelada.
- Teste com quadro congelado: `--monstro=lobo_marrom --manim=correr:0.33` (u fixa a fase) e ver 6 quadros lado a lado.

## Contorno branco de seleção (corpo com saque) em shaders próprios
- Corpo do shader num `.gdshaderinc` com `#ifdef CONTORNO`; dois arquivos `.gdshader` curtos: o normal
  (`render_mode` de sempre + `#include`) e o de contorno (`unshaded, cull_front` + `#define CONTORNO` + `#include`).
  Assim o contorno usa a MESMA deformação do vértice (patas dobradas no shader, esqueleto).
- No contorno: cresce em pixels de tela (normal em view space → direção no clip, `* espessura * 2 / VIEWPORT_SIZE
  * c.w`) e empurra a casca ~25 cm para trás (`vp.xyz += normalize(vp.xyz) * 0.25`) — sem isso aparecem riscos
  brancos por dentro (dobras do pelo, cartões do modelo do Tripo). Fragmento: branco chapado.
- Liga com `material.next_pass = ShaderMaterial(contorno)` e copia os uniforms
  (`shader.get_shader_uniform_list()`) a cada quadro enquanto estiver selecionado.
- Classe nova (`class_name`) só existe depois de `godot --headless --path . --import`; sem isso o teste trava em
  "Could not find type".
