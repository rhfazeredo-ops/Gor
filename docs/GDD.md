# Terra de Gor: documento de design (GDD)

> Jogo de ação co-op em 3D inspirado em **Drakantos**, feito com **Three.js** para rodar no navegador.

## 0. Referência: como funciona o Drakantos
- MMORPG gratuito em pixel art, visto de cima, com combate de ação rápido (estúdio brasileiro Wingeon, de Curitiba).
- **Heróis no lugar de classes:** mais de 20 heróis, cada um com mecânicas próprias, e o jogador troca de herói.
- Missões e masmorras co-op com chefes, mundo aberto, Guilda de Aventureiros.
- PvP: arenas, "mini MOBA", ranqueadas. Extras: casas, mercado, eventos globais, skins e pets.
- **Nossa versão:** a mesma ideia, mas em 3D com câmera 3/4. Começamos pelo núcleo (herói + combate + masmorra co-op) e deixamos o MMO para depois.

## 1. Visão
- **Gênero:** ação RPG co-op com câmera de cima em 3/4, como no Drakantos: heróis com papéis, masmorras com ondas de inimigos e chefes.
- **Plataforma:** **celular na horizontal (landscape) como foco principal**, com joystick virtual. Também roda no PC pelo navegador.
- **Tecnologia:** Three.js com Vite e JavaScript. Modelos em `.glb`.
- **Estilo visual:** fantasia estilizada pintada à mão (linha WoW/Hearthstone), cores fortes e silhuetas fáceis de ler de cima.

## 2. Facções e heróis

| Facção | Herói | Classe | Papel | Arma |
|---|---|---|---|---|
| **Vark** (vermelho/osso) | **Drakhar** | Guerreiro | Tanque / bruiser | Cutelo de osso de duas mãos |
| | **Karisha** | Guerreira | DPS corpo a corpo | Duas adagas curvas de osso |
| | *(sem nome)* | Xamã | Suporte / cura | Cajado com crânio e cristal azul |
| **Vaeltharianos** (roxo/dourado) | **Kaedrion** | Templário Imperial | Tanque | Lâmina lunar + escudo |
| | **Nyxara** | Operativa da Vigília do Eclipse | DPS à distância / assassina | Glaives de arremesso |
| | **Vaelyra** | Maga Arcana | DPS mágico / controle | Cajado de lua crescente |
| **Humanos** (azul/dourado) | **Dalárian** | Paladino da Luz | Tanque / suporte | Martelo de guerra |
| | **Aelina** | Sacerdotisa | Cura | Cetro solar + lanterna |
| | **Ignara** | Maga de Fogo | DPS em área | Magia de fogo + grimório |
| | *(sem nome)* | Ladino | DPS corpo a corpo | Duas adagas de dragão |

Os concept arts estão em `docs/concept-art/`.

### Kit de habilidades (modelo para todo herói)
- **Ataque básico** (botão grande / clique).
- **Habilidade 1 e 2** (recarga curta).
- **Ultimate** (recarga longa).
- **Esquiva**.
- **Passiva:** única por herói.

## 3. Controles e câmera
### Celular (principal), tela horizontal
- **Joystick virtual** na metade esquerda da tela: aparece onde o dedo encosta.
- **Botões à direita:** ataque (grande), esquiva e, depois, Q/E/R em arco em volta do ataque.
- **Mira automática:** mira no inimigo mais próximo; sem inimigo perto, mira na direção do movimento.
- Botão de tela cheia (trava na horizontal no Android). Na vertical aparece o aviso "gire o celular".
- *(futuro)* Suporte a controle físico Bluetooth.

### PC
- **WASD:** mover. **Mouse:** mirar. **Clique:** atacar. **Espaço:** esquivar. **Q/E/R:** habilidades.

### Câmera
- Fixa em 3/4 de cima, seguindo o herói com suavidade.

## 4. Loop de jogo
**Taverna (lobby) → pegar missão → DG (mapa fechado e curto) → completar objetivo → recompensas → voltar à taverna.**

### 4.1 Taverna (lobby)
Espaço social onde os heróis andam e falam com os NPCs:
- **Mercador:** vende consumíveis (poções de vida etc.) por ouro.
- **Mestre de Missões:** lista as missões disponíveis e abre o portal para a DG.
- **Trocador de Fragmentos:** troca fragmentos raros por **skins**.
- *(futuro)* Outros jogadores na mesma taverna (co-op).

### 4.2 DGs (mapas de missão)
Mapas fechados e curtos. Cada missão tem **um** objetivo:
| Tipo | Exemplo |
|---|---|
| **Caçar** | Matar 15 lobos |
| **Coletar** | Juntar 10 cristais (dropados pelos monstros ou espalhados pelo mapa) |
| **Chefe** | Derrotar um boss específico |

### 4.3 Níveis e dificuldade
- **Herói** ganha XP e sobe de nível.
- **Mapas** têm nível. Quanto maior o nível, mais fortes os monstros e melhores as recompensas.
- O nível do mapa acompanha o nível do herói (ou o jogador escolhe).

### 4.4 Recompensas
- **Ouro e XP:** em toda missão.
- **Artefatos:** aumentam os status do herói (vida, dano, defesa, velocidade, recarga...). Têm **nível** e **raridade**, que melhoram conforme o nível do mapa. Os ícones serão enviados pelo Rafael.
- **Fragmentos:** drop **muito raro**, usados no Trocador por skins.

### 4.5 Skins
- **Variação de cor:** mudam a paleta do herói.
- **Skin completa:** muda toda a aparência do herói.
- Os concepts serão enviados pelo Rafael.

## 5. Pipeline de arte 3D
1. Concept art com 4 vistas (frente, lado, costas e 3/4). ✅ Já feito.
2. Gerar o modelo 3D a partir da imagem (ferramentas como Meshy ou Tripo) ou modelar no Blender.
3. Rig e animações: Mixamo (andar, correr, atacar, morrer) ou Blender.
4. Exportar em `.glb` (comprimido) para `public/models/`.
5. Até lá, o jogo usa formas simples (cápsulas) coloridas com a paleta de cada herói.

## 6. Roadmap
- **M0 (base):** cena 3D, chão, herói cápsula andando com WASD, câmera 3/4, mira pelo mouse.
- **M1 (combate):** ataque básico, inimigos simples que perseguem o herói, vida e dano, barra de HP.
- **M2 (primeiro herói):** kit completo de 1 herói (Drakhar), esquiva e recargas.
- **M3 (missão):** primeira DG com objetivo de caçar, coletar ou chefe, tela de vitória e recompensas.
- **M3.5 (taverna):** lobby com Mercador, Mestre de Missões e Trocador, mais inventário de artefatos.
- **M4 (modelos):** trocar as cápsulas por modelos `.glb` animados.
- **M5 (mais heróis):** um herói de cada facção, depois o resto.
- **M6 (co-op):** multiplayer online (WebSocket ou WebRTC).

## 7. Em aberto
- Nome do Xamã Vark e do Ladino humano.
- Co-op online desde o começo ou só depois do jogo solo estar bom?
- Nome final do jogo (provisório: **Terra de Gor**).
- Símbolos das facções: algumas artes usam o símbolo da Horda e o leão parecido com o da Aliança (de World of Warcraft). Para publicar, trocar por emblemas próprios (ex.: o crânio com chifres dos Vark).
