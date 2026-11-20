# Terra de Gor — instruções para o Claude

- Responder em **português do Brasil**. O dono e o Claude são um time.
- Antes de qualquer trabalho de jogo, ler a skill **`.claude/skills/time-jogos-godot/`** (SKILL.md e tecnicas.md):
  preferências do dono, como testar o Godot sem tela, pipeline de modelos, colisões, Gaussian splats, publicação.
- Ao aprender algo novo que sirva para outros projetos (técnica, armadilha, preferência), **acrescentar na skill**
  e fazer commit junto com o trabalho.
- Projeto novo: copiar a pasta `.claude/skills/time-jogos-godot/` para o repositório novo.
- Versão principal: Godot 4.5 em `godot/` (renderizador Compatibility). Versão web antiga em `src/iso`.
- Commit e push na branch de trabalho e no `main` (Pages e APKs são gerados a partir do `main`).
