#!/usr/bin/env bash
# Prepara o Godot 4.5 (editor sem tela + modelos de exportação) para os workflows do GitHub.
set -e
V=4.5-stable; D=$HOME/godot-$V
mkdir -p "$D"
if [ ! -x "$D/godot" ]; then
  curl -sSL -o /tmp/g.zip "https://github.com/godotengine/godot/releases/download/$V/Godot_v${V}_linux.x86_64.zip"
  unzip -q -o /tmp/g.zip -d "$D" && mv "$D/Godot_v${V}_linux.x86_64" "$D/godot"
fi
T=$HOME/.local/share/godot/export_templates/4.5.stable
if [ ! -f "$T/version.txt" ]; then
  curl -sSL -o /tmp/t.tpz "https://github.com/godotengine/godot/releases/download/$V/Godot_v${V}_export_templates.tpz"
  mkdir -p "$T" && unzip -q -o /tmp/t.tpz -d /tmp/tpl && mv /tmp/tpl/templates/* "$T/"
fi
echo "$D" >> "$GITHUB_PATH"
