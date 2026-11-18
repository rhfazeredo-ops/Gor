import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Ateliê de assets em um único HTML: npm run build:atelier
export default defineConfig({
  base: './', publicDir: false, plugins: [viteSingleFile()],
  build: { target: 'es2022', outDir: 'dist-atelier', assetsInlineLimit: 100_000_000, rollupOptions: { input: 'tools/atelier.html' } },
});
