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
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,  // Disabled - no ASAR
      [FuseV1Options.OnlyLoadAppFromAsar]: false,  // Disabled - no ASAR
    }),
  ],
};

export default config;
