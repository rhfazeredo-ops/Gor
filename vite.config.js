import { defineConfig } from 'vite';
// base './' para funcionar no GitHub Pages (rhfazeredo-ops.github.io/Gor/)
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: { main: 'index.html', modelos: 'modelos.html' } } },
});
