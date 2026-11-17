# Terra de Gor (Godot 4, 2D isométrico)

App nativo para celular, na horizontal, com joystick virtual. Feito no **Godot 4.3** (renderizador Compatibility).

## Abrir
1. Baixe o Godot 4.3 em godotengine.org.
2. Em **Importar**, escolha `godot/project.godot`.
3. Aperte **F5**. No PC: WASD, ou arraste com o mouse na metade esquerda da tela (simula o toque).

## Estrutura
- `maps/desfiladeiro.txt`: o mapa em texto. Cada caractere é um tile.
  `.` areia · `#` rocha · `^` platô alto · `~` água · `=` ponte · `P` nascimento do herói
- `scripts/mapa.gd`: lê o `.txt` e monta as camadas isométricas (chão, água com shader, paredes com colisão), mais a decoração.
- `scripts/heroi.gd`, `scripts/joystick.gd`, `scripts/main.gd`
- `assets/`: arte **provisória** gerada por `tools/gerar_tiles.py`. Para trocar, mantenha o tamanho: o atlas tem 8 tiles de 64×64, com o losango de 64×32 na parte de baixo.
- `tools/classificar_planta.py` + `tools/planta_para_mapa.py`: convertem uma imagem de planta vista de cima no `.txt`.

## Teste sem tela
`godot --path godot -- --captura=foto.png [--andar=x,y] [--zoom=0.3]` salva uma captura e fecha.
