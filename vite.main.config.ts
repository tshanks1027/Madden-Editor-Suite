import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'electron',
        'sqlite3',
        'sharp',
        'puppeteer',
        // Do NOT externalize bit-buffer, stream-parser, papaparse - they need to be bundled
        // so they're available when RosterParser.js requires them at runtime
      ],
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

          // Copy portrait atlas JSON
          const atlasFile = path.join(srcDataDir, 'portrait-atlas.json');
          if (existsSync(atlasFile)) {
            const destAtlasFile = path.join(destDataDir, 'portrait-atlas.json');
            copyFileSync(atlasFile, destAtlasFile);
            console.log('Copied portrait-atlas.json to build output');
          }

          // Copy coach portrait atlas JSON
          const coachAtlasFile = path.join(srcDataDir, 'coach-atlas.json');
          if (existsSync(coachAtlasFile)) {
            const destCoachAtlasFile = path.join(destDataDir, 'coach-atlas.json');
            copyFileSync(coachAtlasFile, destCoachAtlasFile);
            console.log('Copied coach-atlas.json to build output');
          }

          // Copy portrait sprites directory
          const srcPortraitSpritesDir = path.join(srcDataDir, 'portrait-sprites');
          const destPortraitSpritesDir = path.join(destDataDir, 'portrait-sprites');
          if (existsSync(srcPortraitSpritesDir)) {
            if (!existsSync(destPortraitSpritesDir)) {
              mkdirSync(destPortraitSpritesDir, { recursive: true });
            }
            const portraitFiles = fs.readdirSync(srcPortraitSpritesDir);
            portraitFiles.forEach(file => {
              if (file.endsWith('.png')) {
                const srcFile = path.join(srcPortraitSpritesDir, file);
                const destFile = path.join(destPortraitSpritesDir, file);
                copyFileSync(srcFile, destFile);
              }
            });
            console.log(`Copied ${portraitFiles.filter(f => f.endsWith('.png')).length} portrait sprite sheets`);
          }

          // Copy coach sprites directory
          const srcCoachSpritesDir = path.join(srcDataDir, 'coach-sprites');
          const destCoachSpritesDir = path.join(destDataDir, 'coach-sprites');
          if (existsSync(srcCoachSpritesDir)) {
            if (!existsSync(destCoachSpritesDir)) {
              mkdirSync(destCoachSpritesDir, { recursive: true });
            }
            const coachFiles = fs.readdirSync(srcCoachSpritesDir);
            coachFiles.forEach(file => {
              if (file.endsWith('.png')) {
                const srcFile = path.join(srcCoachSpritesDir, file);
                const destFile = path.join(destCoachSpritesDir, file);
                copyFileSync(srcFile, destFile);
              }
            });
            console.log(`Copied ${coachFiles.filter(f => f.endsWith('.png')).length} coach sprite sheets`);
          }

          // Copy formulas directory
          const srcFormulasDir = path.join(srcDataDir, 'formulas');
          const destFormulasDir = path.join(destDataDir, 'formulas');
          if (existsSync(srcFormulasDir)) {
            if (!existsSync(destFormulasDir)) {
              mkdirSync(destFormulasDir, { recursive: true });
            }
            const formulaFiles = fs.readdirSync(srcFormulasDir);
            formulaFiles.forEach(file => {
              if (file.endsWith('.txt')) {
                const srcFile = path.join(srcFormulasDir, file);
                const destFile = path.join(destFormulasDir, file);
                copyFileSync(srcFile, destFile);
                console.log(`Copied formula file: ${file}`);
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

        // Copy services directory to build output (for CreatorService, etc.)
        const srcServicesDir = path.join(__dirname, 'src', 'main', 'services');
        const destServicesDir = path.join(__dirname, '.vite', 'build', 'services');

        if (existsSync(srcServicesDir)) {
          if (!existsSync(destServicesDir)) {
            mkdirSync(destServicesDir, { recursive: true });
          }

          // Copy all JS/TS/JSON files from services
          function copyServicesDirectory(src, dest) {
            const entries = fs.readdirSync(src, { withFileTypes: true });
            entries.forEach(entry => {
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);

              if (entry.isDirectory()) {
                if (!existsSync(destPath)) {
                  mkdirSync(destPath, { recursive: true });
                }
                copyServicesDirectory(srcPath, destPath);
              } else if (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.json')) {
                copyFileSync(srcPath, destPath);
                console.log(`Copied service: ${entry.name}`);
              }
            });
          }

          copyServicesDirectory(srcServicesDir, destServicesDir);
        }

        // Copy lib directory (contains draft-class and madden-franchise vendored code)
        // Exclude node_modules, .git, tests, docs to reduce bloat
        const srcLibDir = path.join(__dirname, 'src', 'main', 'lib');
        const destLibDir = path.join(__dirname, '.vite', 'build', 'lib');

        if (existsSync(srcLibDir)) {
          if (!existsSync(destLibDir)) {
            mkdirSync(destLibDir, { recursive: true });
          }

          function copyLibDirectory(src, dest) {
            const entries = fs.readdirSync(src, { withFileTypes: true });
            entries.forEach(entry => {
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);

              // Skip these directories to reduce bloat
              if (entry.isDirectory() && (
                entry.name === 'node_modules' ||
                entry.name === '.git' ||
                entry.name === '.vscode' ||
                entry.name === 'tests' ||
                entry.name === 'test' ||
                entry.name === 'docs' ||
                entry.name === 'scripts'
              )) {
                return;
              }

              // Skip test files
              if (entry.name.endsWith('.spec.js') || entry.name.endsWith('.test.js')) {
                return;
              }

              if (entry.isDirectory()) {
                if (!existsSync(destPath)) {
                  mkdirSync(destPath, { recursive: true });
                }
                copyLibDirectory(srcPath, destPath);
              } else if (entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
                copyFileSync(srcPath, destPath);
                console.log(`Copied lib: ${entry.name}`);
              }
            });
          }

          copyLibDirectory(srcLibDir, destLibDir);
        }

        // Copy required node_modules for lib to use
        // The lib directory files use CommonJS require() and need these modules accessible
        const destNodeModules = path.join(__dirname, '.vite', 'build', 'node_modules');
        if (!existsSync(destNodeModules)) {
          mkdirSync(destNodeModules, { recursive: true });
        }

        const requiredModules = ['bit-buffer', 'stream-parser', 'crc-32', 'fzstd'];
        requiredModules.forEach(moduleName => {
          const srcModule = path.join(__dirname, 'node_modules', moduleName);
          const destModule = path.join(destNodeModules, moduleName);

          if (existsSync(srcModule)) {
            function copyModuleRecursive(src, dest) {
              if (!existsSync(dest)) {
                mkdirSync(dest, { recursive: true });
              }

              const entries = fs.readdirSync(src, { withFileTypes: true });
              entries.forEach(entry => {
                const srcPath = path.join(src, entry.name);
                const destPath = path.join(dest, entry.name);

                if (entry.isDirectory()) {
                  copyModuleRecursive(srcPath, destPath);
                } else {
                  copyFileSync(srcPath, destPath);
                }
              });
            }

            copyModuleRecursive(srcModule, destModule);
            console.log(`Copied node_module: ${moduleName}`);
          } else {
            console.warn(`Required module not found: ${moduleName}`);
          }
        });

        console.log('Vite build complete - lib dependencies copied to .vite/build/node_modules');
      }
    }
  ],
});
