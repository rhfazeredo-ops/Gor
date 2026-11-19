import { defineConfig } from 'vite';
// Build para o itch.io: só o jogo (index.html), arquivos separados, caminhos relativos.
// Gera dist-itch/ e o zip para enviar: npm run build:itch
export default defineConfig({
  base: './',
  publicDir: false,            // o jogo atual não usa nada de public/ (tudo vem de src/assets)
  build: { outDir: 'dist-itch', emptyOutDir: true, target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 4000,
    rollupOptions: { input: { main: 'index.html' } } },
});
