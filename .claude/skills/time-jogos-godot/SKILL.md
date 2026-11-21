---
name: time-jogos-godot
description: Manual do time (dono do projeto + Claude) para fazer jogos no Godot 4.5 e na web — preferências do dono, como testar o Godot sem tela, pipeline de modelos 3D (Tripo, rig, animações, redução de triângulos), mapas isométricos com peças 2D e colisões, chão em Gaussian splats estilo pixel art, publicação no GitHub Pages e APK. Use em qualquer trabalho de jogo deste dono, neste ou em projetos novos.
---

# Manual do time — jogos no Godot

Aprendido no projeto **Terra de Gor** (ARPG isométrico co-op; versão principal em Godot 4.5 3D, em `godot/`;
versão web Canvas2D antiga em `src/iso`). Vale para os próximos projetos (ex.: jogo 3D em primeira pessoa
com Gaussian splats). Detalhes técnicos em `tecnicas.md`; código reaproveitável em `codigo/`.

## Como trabalhar com o dono
- Fala português do Brasil; responder em português, direto, com prints do jogo para mostrar o resultado.
- Gosta de ver funcionando: rodar o jogo, tirar print, comparar antes × depois lado a lado.
- Commit e push na branch de trabalho **e** no `main` (Pages e APKs saem do `main`); ele aprovou isso.
- Ideias novas e arriscadas entram como **teste desligado por padrão** (ex.: `?splat` no navegador / `--splat`),
  sem estragar o jogo que já funciona.
- Nunca pedir chave/segredo no chat: usar o formulário seguro de credencial do ambiente.
- Gosta de técnicas novas (Gaussian splat, procedural, pixel art 3D); explicar custo/limites com honestidade
  e propor um teste pequeno antes de mudar tudo.
- **Prompts sempre prontos**: quando pedir arte, mandar o prompt completo, para colar direto no ChatGPT,
  sem partes para o dono editar. Um prompt por peça, em português, em bloco de código.
- **Prompts de época:** no Dallarian (fantasia medieval) toda roupa e objeto é medieval — escrever no prompt
  o que é de época (túnica de lã/linho, gibão, faixas nas pernas, sapatos de couro, cinto de corda) e proibir o
  moderno (xadrez, suspensórios, botões, bolsos de calça).
- **Arte 2D → 3D**: imagem no ChatGPT (folha com 4 vistas ortográficas: frente, esquerda, costas, direita;
  fundo cinza liso, luz neutra, sem sombra, sem perspectiva, cores chapadas) → prompt de "separar as vistas"
  → Tripo 3D em **Multiview**, Low Poly, textura 1K, PBR desligado, sem rig (o rig é feito por nós), GLB.
  Sempre dar junto as especificações do Tripo (faces por tipo de peça e tamanho real em metros).
- Próximo projeto (planejado): jogo de fantasia medieval em **primeira pessoa**, visual "3D pintado com cara de
  pixel art" (paleta reduzida, sombras em blocos, céu de tempestade, vale com vila), mundo em pixel splats
  gerados por código e objetos do Tripo com o mesmo filtro.
- Preferências de jogo do Terra de Gor: sem contadores (moedas/diamantes/chaves) na tela; música do título desde
  a abertura até o lobby; música do deserto só nos mapas de deserto, a partir dos 4 s.

- **Links a cada atualização:** no fim de toda resposta com atualização, mandar o link do site E o do APK
  (conferir antes que o workflow do APK terminou com sucesso; se ainda estiver gerando, avisar).
  Dallarian: site https://rhfazeredo-ops.github.io/Dallarian/ — APK
  https://github.com/rhfazeredo-ops/Dallarian/releases/download/apk/dallarian.apk

## Fluxo padrão
1. Entender o pedido → olhar o código → fazer.
2. Testar no Godot sem tela (ver `tecnicas.md` → "Godot sem tela") e **olhar os prints**.
3. Para mapas/colisões: ferramentas de depuração (desenhar colisores, galeria de peças) antes de mexer.
4. Commit em português explicando o porquê → push na branch e no `main` → conferir os workflows.
5. Responder curto: o que mudou, como testar (link), o que ficou pendente.

## Links do Terra de Gor
- Site: https://rhfazeredo-ops.github.io/Gor/ (2D) e https://rhfazeredo-ops.github.io/Gor/godot/ (3D)
- APKs: releases `apk` (2D, Capacitor) e `apk-godot` (3D, Godot)
