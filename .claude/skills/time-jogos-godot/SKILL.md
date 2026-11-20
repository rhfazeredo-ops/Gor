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
- Preferências de jogo do Terra de Gor: sem contadores (moedas/diamantes/chaves) na tela; música do título desde
  a abertura até o lobby; música do deserto só nos mapas de deserto, a partir dos 4 s.

## Fluxo padrão
1. Entender o pedido → olhar o código → fazer.
2. Testar no Godot sem tela (ver `tecnicas.md` → "Godot sem tela") e **olhar os prints**.
3. Para mapas/colisões: ferramentas de depuração (desenhar colisores, galeria de peças) antes de mexer.
4. Commit em português explicando o porquê → push na branch e no `main` → conferir os workflows.
5. Responder curto: o que mudou, como testar (link), o que ficou pendente.

## Links do Terra de Gor
- Site: https://rhfazeredo-ops.github.io/Gor/ (2D) e https://rhfazeredo-ops.github.io/Gor/godot/ (3D)
- APKs: releases `apk` (2D, Capacitor) e `apk-godot` (3D, Godot)
