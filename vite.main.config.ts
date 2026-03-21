import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    // Don't empty out dir - avoids EBUSY errors when SQLite db is locked
    emptyOutDir: false,
    rollupOptions: {
      external: [
        'electron',
        'sqlite3',
        'better-sqlite3', // Native SQLite module for lookup service
        'sharp',
        'puppeteer',
        'papaparse',
        'madden-franchise', // ESM module needs to be loaded from node_modules at runtime
        // Do NOT externalize bit-buffer, stream-parser - they need to be bundled
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

          // Copy all CSV and JSON files from data/lookups/
          const srcLookupsDir = path.join(srcDataDir, 'lookups');
          if (existsSync(srcLookupsDir)) {
            const lookupFiles = fs.readdirSync(srcLookupsDir);
            lookupFiles.forEach(file => {
              if (file.endsWith('.csv') || file.endsWith('.json')) {
                const srcFile = path.join(srcLookupsDir, file);
                const destFile = path.join(lookupsDir, file);
                copyFileSync(srcFile, destFile);
                console.log(`Copied ${file} to build output`);
              }
            });
          }

          // Copy players.db SQLite database (skip if locked by another process)
          const srcDbFile = path.join(srcDataDir, 'players.db');
          if (existsSync(srcDbFile)) {
            const destDbFile = path.join(destDataDir, 'players.db');
            try {
              copyFileSync(srcDbFile, destDbFile);
              console.log('Copied players.db to build output');
            } catch (dbError) {
              if (dbError.code === 'EBUSY') {
                console.log('players.db is locked, using existing copy if available');
              } else {
                throw dbError;
              }
            }
          }

          // Copy player-career-stats.db SQLite database (for historical stats in retro editor)
          const srcCareerStatsDb = path.join(srcDataDir, 'player-career-stats.db');
          if (existsSync(srcCareerStatsDb)) {
            const destCareerStatsDb = path.join(destDataDir, 'player-career-stats.db');
            try {
              copyFileSync(srcCareerStatsDb, destCareerStatsDb);
              console.log('Copied player-career-stats.db to build output');
            } catch (dbError) {
              if (dbError.code === 'EBUSY') {
                console.log('player-career-stats.db is locked, using existing copy if available');
              } else {
                throw dbError;
              }
            }
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

          // Copy equipment years JSON (era-appropriate equipment assignment)
          const equipmentYearsFile = path.join(srcDataDir, 'equipment-years.json');
          if (existsSync(equipmentYearsFile)) {
            const destEquipmentYearsFile = path.join(destDataDir, 'equipment-years.json');
            copyFileSync(equipmentYearsFile, destEquipmentYearsFile);
            console.log('Copied equipment-years.json to build output');
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

          // Copy developer portrait atlas JSON (PIDs 11000-11999)
          const devAtlasFile = path.join(srcDataDir, 'developer-portrait-atlas.json');
          if (existsSync(devAtlasFile)) {
            const destDevAtlasFile = path.join(destDataDir, 'developer-portrait-atlas.json');
            copyFileSync(devAtlasFile, destDevAtlasFile);
            console.log('Copied developer-portrait-atlas.json to build output');
          }

          // Copy developer sprites directory (PIDs 11000-11999)
          const srcDevSpritesDir = path.join(srcDataDir, 'developer-sprites');
          const destDevSpritesDir = path.join(destDataDir, 'developer-sprites');
          if (existsSync(srcDevSpritesDir)) {
            if (!existsSync(destDevSpritesDir)) {
              mkdirSync(destDevSpritesDir, { recursive: true });
            }
            const devFiles = fs.readdirSync(srcDevSpritesDir);
            devFiles.forEach(file => {
              if (file.endsWith('.png')) {
                const srcFile = path.join(srcDevSpritesDir, file);
                const destFile = path.join(destDevSpritesDir, file);
                copyFileSync(srcFile, destFile);
              }
            });
            const devPngCount = devFiles.filter(f => f.endsWith('.png')).length;
            if (devPngCount > 0) {
              console.log(`Copied ${devPngCount} developer sprite sheets`);
            }
          }

          // Copy gear atlas JSON
          const gearAtlasFile = path.join(srcDataDir, 'gear-atlas.json');
          if (existsSync(gearAtlasFile)) {
            const destGearAtlasFile = path.join(destDataDir, 'gear-atlas.json');
            copyFileSync(gearAtlasFile, destGearAtlasFile);
            console.log('Copied gear-atlas.json to build output');
          }

          // Copy gear sprites directory
          const srcGearSpritesDir = path.join(srcDataDir, 'gear-sprites');
          const destGearSpritesDir = path.join(destDataDir, 'gear-sprites');
          if (existsSync(srcGearSpritesDir)) {
            if (!existsSync(destGearSpritesDir)) {
              mkdirSync(destGearSpritesDir, { recursive: true });
            }
            const gearFiles = fs.readdirSync(srcGearSpritesDir);
            gearFiles.forEach(file => {
              if (file.endsWith('.png')) {
                const srcFile = path.join(srcGearSpritesDir, file);
                const destFile = path.join(destGearSpritesDir, file);
                copyFileSync(srcFile, destFile);
              }
            });
            const gearPngCount = gearFiles.filter(f => f.endsWith('.png')).length;
            if (gearPngCount > 0) {
              console.log(`Copied ${gearPngCount} gear sprite images`);
            }
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

          // Copy templates directory (M26 draft class templates)
          const srcTemplatesDir = path.join(srcDataDir, 'Templates');
          const destTemplatesDir = path.join(destDataDir, 'Templates');
          if (existsSync(srcTemplatesDir)) {
            if (!existsSync(destTemplatesDir)) {
              mkdirSync(destTemplatesDir, { recursive: true });
            }
            const templateFiles = fs.readdirSync(srcTemplatesDir);
            templateFiles.forEach(file => {
              const srcFile = path.join(srcTemplatesDir, file);
              const destFile = path.join(destTemplatesDir, file);
              copyFileSync(srcFile, destFile);
              console.log(`Copied template file: ${file}`);
            });
          }

          // Copy retro directory (historical team data for retro franchise editor)
          const srcRetroDir = path.join(srcDataDir, 'retro');
          const destRetroDir = path.join(destDataDir, 'retro');
          if (existsSync(srcRetroDir)) {
            if (!existsSync(destRetroDir)) {
              mkdirSync(destRetroDir, { recursive: true });
            }
            const retroFiles = fs.readdirSync(srcRetroDir);
            retroFiles.forEach(file => {
              if (file.endsWith('.json')) {
                const srcFile = path.join(srcRetroDir, file);
                const destFile = path.join(destRetroDir, file);
                copyFileSync(srcFile, destFile);
                console.log(`Copied retro data file: ${file}`);
              }
            });

            // Copy retro/schedules subdirectory (historical NFL schedules)
            const srcSchedulesDir = path.join(srcRetroDir, 'schedules');
            const destSchedulesDir = path.join(destRetroDir, 'schedules');
            if (existsSync(srcSchedulesDir)) {
              if (!existsSync(destSchedulesDir)) {
                mkdirSync(destSchedulesDir, { recursive: true });
              }
              const scheduleFiles = fs.readdirSync(srcSchedulesDir);
              let scheduleCount = 0;
              scheduleFiles.forEach(file => {
                if (file.endsWith('.json')) {
                  const srcFile = path.join(srcSchedulesDir, file);
                  const destFile = path.join(destSchedulesDir, file);
                  copyFileSync(srcFile, destFile);
                  scheduleCount++;
                }
              });
              console.log(`Copied ${scheduleCount} schedule JSON files`);
            }

            // Copy retro/coaches subdirectory (historical coaching staff data)
            const srcCoachesDir = path.join(srcRetroDir, 'coaches');
            const destCoachesDir = path.join(destRetroDir, 'coaches');
            if (existsSync(srcCoachesDir)) {
              if (!existsSync(destCoachesDir)) {
                mkdirSync(destCoachesDir, { recursive: true });
              }
              const coachFiles = fs.readdirSync(srcCoachesDir);
              let coachCount = 0;
              coachFiles.forEach(file => {
                if (file.endsWith('.json')) {
                  const srcFile = path.join(srcCoachesDir, file);
                  const destFile = path.join(destCoachesDir, file);
                  copyFileSync(srcFile, destFile);
                  coachCount++;
                }
              });
              console.log(`Copied ${coachCount} coach JSON files`);
            }
          }

          // Copy tools directory (external exe tools like presentationIdFix)
          const srcToolsDir = path.join(srcDataDir, 'tools');
          const destToolsDir = path.join(destDataDir, 'tools');
          if (existsSync(srcToolsDir)) {
            if (!existsSync(destToolsDir)) {
              mkdirSync(destToolsDir, { recursive: true });
            }
            const toolFiles = fs.readdirSync(srcToolsDir);
            toolFiles.forEach(file => {
              if (file.endsWith('.exe')) {
                const srcFile = path.join(srcToolsDir, file);
                const destFile = path.join(destToolsDir, file);
                copyFileSync(srcFile, destFile);
                console.log(`Copied tool: ${file}`);
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

        const requiredModules = ['bit-buffer', 'stream-parser', 'crc-32', 'fzstd', 'papaparse', 'sql.js'];
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
