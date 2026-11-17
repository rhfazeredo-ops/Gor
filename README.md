# Terra de Gor

Jogo de ação co-op em 3D para **celular (horizontal)** e PC, inspirado em Drakantos, feito com **Three.js**.

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
