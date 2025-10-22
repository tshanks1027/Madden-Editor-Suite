import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [],
  build: {
    outDir: resolve(__dirname, '.vite/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        franchise: resolve(__dirname, 'src/renderer/franchise-editor.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: []
  },
});
