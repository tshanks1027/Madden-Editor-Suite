import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

// Plugin to copy static JS files that are loaded via <script src>
function copyStaticJs() {
  return {
    name: 'copy-static-js',
    writeBundle() {
      const srcDir = resolve(__dirname, 'src/renderer/js');
      const destDir = resolve(__dirname, '.vite/renderer/js');

      try {
        mkdirSync(destDir, { recursive: true });
        const files = readdirSync(srcDir);
        files.forEach(file => {
          if (file.endsWith('.js')) {
            copyFileSync(resolve(srcDir, file), resolve(destDir, file));
            console.log(`Copied renderer JS: ${file}`);
          }
        });
      } catch (err) {
        console.error('Error copying static JS files:', err);
      }
    }
  };
}

// https://vitejs.dev/config
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [copyStaticJs()],
  build: {
    outDir: resolve(__dirname, '.vite/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
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
