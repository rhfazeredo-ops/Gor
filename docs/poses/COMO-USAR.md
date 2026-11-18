# Animações com IA em cima do esqueleto (método do vídeo)

1. **Poses** (já geradas): `docs/poses/dalarian/<animação>.png` (8 linhas = direções S, SE, E, NE, N, NW, W, SW)
   e, uma direção por imagem, `docs/poses/dalarian/por-direcao/<animação>_<direção>.png`.
   Para gerar de novo: `npm run dev` e abrir `/tools/pose-sheets.html?hero=dalarian`.
2. **Desenhar**: numa IA de imagem (ChatGPT, Gemini…), envie **o desenho do herói**
   (`docs/sprites/dalarian-8-direcoes.png`) + **uma folha de pose por direção** com o prompt abaixo.
3. **Voltar para o jogo**: salve a imagem que a IA devolver e rode
   `python3 tools/import-pose-sheet.py <imagem> walk public/sprites/dalarian --frames 8 --rows 1 --dirs S`
   (troque `walk`, `8` e `S` pela animação, número de quadros e direção).

## Prompt (inglês funciona melhor nas IAs de imagem)
```
Image 1 is my character reference sheet (Dalárian, a paladin in silver armor with gold trim,
golden lion on the chest, long blond hair, blue cape with a gold cross, big war hammer in his
right hand). Image 2 is a pose sheet: a row of stick-figure poses for a walk animation, seen from
an isometric 3/4 top-down game camera. In the stick figures, RED limbs are the character's LEFT
side, BLUE limbs are his RIGHT side, the white circle is the head (orange dot = where the face
points) and the YELLOW line with a square is the war hammer.

Redraw the pose sheet with my character in every cell, matching each pose exactly (same position,
size, direction and limb placement), same grid and same cell size. Keep the character identical in
every frame (same armor, colors and proportions as the reference). Pixel art style, crisp, dark
outline. Plain flat green background (#00B140) everywhere, no shadows, no text, no labels.
```
