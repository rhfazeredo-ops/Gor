#!/usr/bin/env python3
"""Compacta dist-itch/ em jogo/terra-de-gor-itch.zip (index.html na raiz, como o itch.io pede)."""
import os, zipfile
src, out = 'dist-itch', 'jogo/terra-de-gor-itch.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(src):
        for f in files:
            p = os.path.join(root, f); z.write(p, os.path.relpath(p, src))
n = sum(len(f) for _, _, f in os.walk(src))
print(out, round(os.path.getsize(out) / 1e6, 2), 'MB,', n, 'arquivos')
