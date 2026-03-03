import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use local build-assets directory for branding
const brandingPath = path.join(__dirname, 'build-assets');

const config: ForgeConfig = {
  packagerConfig: {
    icon: path.join(brandingPath, 'madden.ico'),
    name: 'Madden Editor Suite',
    executableName: 'madden-editor-suite',
    asar: false,  // Disable ASAR completely - let Node resolve modules normally
    prune: true,  // Remove devDependencies - only keep production dependencies
    // Don't ignore .vite directory when packaging
    ignore: (path: string) => {
      // Include everything except common ignored directories
      if (!path) return false;

      const excludePatterns = [
        // Don't ignore node_modules - we need it in the package!
        /^\/\.git/,
        /^\/dist/,
        /^\/out/,
        /^\/coverage/,
        /^\/.vscode/,
        /^\/tests/,
        /^\/\.github/,
        /^\/build-assets/,  // Don't package the source build assets
        /^\/\.claude/,
        /^\/agents/,
        /^\/commands/,
        /^\/docs/,
        /^\/playwright-report/,
        /^\/releases/,
        /^\/temp-check/,
        /^\/temp-check2/,
        /^\/temp-extract/,
        /^\/temp-final/,
        /^\/temp-validate/,
        /^\/temp-verify/,
        /^\/temp_extracted/,
        /^\/test-reports/,
        /^\/test-results/,
        /^\/nul$/,  // Ignore Windows null device file

        // CRITICAL: Exclude large dev/source folders (already built to .vite/)
        /^\/src($|\/)/,          // Source code - compiled to .vite/build
        /^\/data($|\/)/,         // Root data - copied to .vite/build/data
        /^\/temp($|\/)/,         // Temp files from dev
        /^\/FrostyToolsuite($|\/)/,  // Dev tool
        /^\/scripts($|\/)/,      // Dev scripts
        /^\/ralph-claude-code($|\/)/,  // Dev files
        /^\/ui-mockups($|\/)/,   // Dev mockups
        /^\/game-dev-workflow($|\/)/,  // Dev workflow
        /^\/\.project-memory($|\/)/,   // Dev memory

        // Exclude dev files in root
        /^\/[^/]+\.js$/,         // Root JS files (dev scripts)
        /^\/[^/]+\.mjs$/,        // Root MJS files
        /^\/[^/]+\.ts$/,         // Root TS files (except in subdirs)
        /^\/tsconfig\.json$/,
        /^\/\.eslintrc/,
        /^\/\.prettierrc/,
        /^\/vite\..+\.config\.ts$/,
        /^\/forge\.config\.ts$/,
        /^\/electron-builder\.yml$/,

        // Exclude large testing/dev dependencies that shouldn't be in production
        /node_modules\/playwright($|\/)/,
        /node_modules\/@playwright($|\/)/,
        // NOTE: Puppeteer IS needed for draft class generator web scraping
        // /node_modules\/puppeteer($|\/)/,
        // /node_modules\/puppeteer-core($|\/)/,
        // /node_modules\/chromium-bidi($|\/)/,

        // Exclude unused UI frameworks (using Handsontable instead)
        /node_modules\/react($|\/)/,
        /node_modules\/react-dom($|\/)/,
        /node_modules\/react-color($|\/)/,
        /node_modules\/ag-grid-community($|\/)/,
        /node_modules\/ag-grid-react($|\/)/,
        /node_modules\/three($|\/)/,
        /node_modules\/zustand($|\/)/,

        // Exclude @types packages (TypeScript types not needed at runtime)
        /node_modules\/@types\//,
      ];

      return excludePatterns.some(pattern => pattern.test(path));
    },
  },
  rebuildConfig: {},
  makers: [
    // Use electron-builder for NSIS installer (via npm run dist)
    // Forge only creates ZIP for distribution backup
    new MakerZIP({}, ['darwin', 'win32']),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // NOTE: FusesPlugin removed - was conflicting with VitePlugin start command
    // Fuses are packaging-time features and don't need to be active during development
    // Electron fuses will still be applied during the package step via electron-builder
  ],
};

export default config;
