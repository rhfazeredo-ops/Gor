import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Gera um único HTML com tudo embutido (código, sprites, ícones): npm run build:single
export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [viteSingleFile()],
  build: { target: 'es2022', outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 100_000 },
});
