# Terra de Gor

Jogo de ação co-op **2D isométrico em pixel art** (8 direções) para **celular (horizontal)** e PC, no gênero do Drakantos, com heróis próprios.

## Rodar
```bash
npm install
npm run dev
```
Abra o endereço que aparecer no terminal (ex.: http://localhost:5173).

## Controles
- **Celular:** joystick à esquerda, ataque e esquiva à direita (mira automática)
- **WASD:** mover
- **Mouse:** mirar
- **Clique:** atacar
- **Espaço:** esquivar

## Estrutura
- `src/`: código do jogo (`main.js` é a cena, `hero.js` o herói, `rig.js` os modelos 3D e as animações, `arena.js` o cenário, `input.js` os controles)
- `modelos.html`: visualizador dos 10 heróis e das animações (abra `/modelos.html` com o `npm run dev` rodando)
- `docs/GDD.md`: documento de design
- `public/concept-art/`: concept arts dos heróis e das facções
- `public/models/`: modelos 3D `.glb` (em breve)

## Pixel art 3D (Gaussian splats)
Visual em pixel art 3D usando o [pixelart-gaussiansplat](https://github.com/cobanov/pixelart-gaussiansplat) (MIT, código em `pixel/`, licença em `pixel/LICENSE`).
1. Com `npm run dev` rodando, abra `/tools/export-glb.html?hero=dalarian`: baixa o herói como `.glb` (modelo + esqueleto + animações).
2. `npm run pixel:convert -- caminho/dalarian.glb dalarian` gera `public/models/dalarian.psf.bin` e `.rig.glb`.
3. (opcional) `npm run pixel:island -- dalarian ruins` cria uma ilha para ele ficar em cima.
4. Abra `/pixel.html#dalarian`.

## Versão 2D (atual)
- `index.html` + `src/iso/`: motor isométrico em canvas (tiles 64x32, pixel art nítido, ordem por profundidade, colisão).
- `src/iso/maps.js`: mapas em texto (legenda no arquivo). `src/iso/art.js`: tiles, objetos e gosmas desenhados por código.
- Sprites dos heróis em `public/sprites/<heroi>/` (uma imagem por animação, linhas = 8 direções).
  - A partir de um desenho com as 8 direções: `python3 tools/import-sprite-sheet.py desenho.png public/sprites/dalarian --order NE,S,SE,E,N,NW,SW,W`
  - A partir do modelo 3D: `tools/bake-sprites.html?hero=dalarian`
- A versão 3D antiga continua em `prototipo-3d.html`.
