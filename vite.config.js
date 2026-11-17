import { defineConfig } from 'vite';
// base './' para funcionar no GitHub Pages (rhfazeredo-ops.github.io/Gor/)
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 4000, rollupOptions: { input: { main: 'index.html', modelos: 'modelos.html', pixel: 'pixel.html' } } },
});
