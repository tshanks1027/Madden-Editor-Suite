import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    {
      name: 'copy-data-and-parsers',
      generateBundle() {
        const fs = require('fs');

        // Copy data directory to build output
        const srcDataDir = path.join(__dirname, 'data');
        const destDataDir = path.join(__dirname, '.vite', 'build', 'data');

        if (existsSync(srcDataDir)) {
          if (!existsSync(destDataDir)) {
            mkdirSync(destDataDir, { recursive: true });
          }

          // Create lookups directory
          const lookupsDir = path.join(destDataDir, 'lookups');
          if (!existsSync(lookupsDir)) {
            mkdirSync(lookupsDir, { recursive: true });
          }

          // Copy all CSV files from data/lookups/
          const srcLookupsDir = path.join(srcDataDir, 'lookups');
          if (existsSync(srcLookupsDir)) {
            const lookupFiles = fs.readdirSync(srcLookupsDir);
            lookupFiles.forEach(file => {
              if (file.endsWith('.csv')) {
                const srcFile = path.join(srcLookupsDir, file);
                const destFile = path.join(lookupsDir, file);
                copyFileSync(srcFile, destFile);
                console.log(`Copied ${file} to build output`);
              }
            });
          }
        }

        // Copy parsers directory to build output
        const srcParsersDir = path.join(__dirname, 'src', 'main', 'parsers');
        const destParsersDir = path.join(__dirname, '.vite', 'build', 'parsers');

        if (existsSync(srcParsersDir)) {
          if (!existsSync(destParsersDir)) {
            mkdirSync(destParsersDir, { recursive: true });
          }

          // Copy all JS files from parsers
          function copyDirectory(src, dest) {
            const entries = fs.readdirSync(src, { withFileTypes: true });
            entries.forEach(entry => {
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);

              if (entry.isDirectory()) {
                if (!existsSync(destPath)) {
                  mkdirSync(destPath, { recursive: true });
                }
                copyDirectory(srcPath, destPath);
              } else if (entry.name.endsWith('.js')) {
                copyFileSync(srcPath, destPath);
                console.log(`Copied parser: ${entry.name}`);
              }
            });
          }

          copyDirectory(srcParsersDir, destParsersDir);
        }

        // Copy lib directory to build output (contains TDB2Parser and dependencies)
        const srcLibDir = path.join(__dirname, 'src', 'main', 'lib');
        const destLibDir = path.join(__dirname, '.vite', 'build', 'lib');

        if (existsSync(srcLibDir)) {
          if (!existsSync(destLibDir)) {
            mkdirSync(destLibDir, { recursive: true });
          }

          // Recursively copy all JS files from lib
          function copyDirectory(src, dest) {
            const entries = fs.readdirSync(src, { withFileTypes: true });
            entries.forEach(entry => {
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);

              if (entry.isDirectory()) {
                if (!existsSync(destPath)) {
                  mkdirSync(destPath, { recursive: true });
                }
                copyDirectory(srcPath, destPath);
              } else if (entry.name.endsWith('.js')) {
                copyFileSync(srcPath, destPath);
                console.log(`Copied lib file: ${entry.name}`);
              }
            });
          }

          copyDirectory(srcLibDir, destLibDir);
        }
      }
    }
  ],
});
