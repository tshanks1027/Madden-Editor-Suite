#!/usr/bin/env node

/**
 * Package Validator Agent
 *
 * Scans codebase for packaging issues before building:
 * - Hardcoded paths that should be dynamic
 * - Missing dependencies
 * - Files that need to be included in ASAR
 * - Common build issues
 * - NSIS installer configuration
 *
 * Usage:
 *   node package-validator.js scan           # Scan for all issues
 *   node package-validator.js fix            # Auto-fix issues where possible
 *   node package-validator.js verify         # Verify packaged build
 *   node package-validator.js nsis           # Check NSIS configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const PACKAGE_JSON = path.join(ROOT_DIR, 'package.json');
const FORGE_CONFIG = path.join(ROOT_DIR, 'forge.config.ts');

class PackageValidator {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.fixes = [];
  }

  /**
   * Main scan function - checks for all packaging issues
   */
  async scan() {
    console.log('🔍 Scanning codebase for packaging issues...\n');

    this.checkHardcodedPaths();
    this.checkDependencies();
    this.checkAsarConfig();
    this.checkRendererPath();
    this.checkNativeModules();
    this.checkForgeConfig();
    this.checkNulFile();

    this.printReport();
  }

  /**
   * Check for hardcoded absolute paths
   */
  checkHardcodedPaths() {
    console.log('📂 Checking for hardcoded paths...');

    const jsFiles = this.getAllJsFiles(SRC_DIR);
    const problematicPatterns = [
      /path\.join\(['"]C:['"]/gi,
      /path\.join\(['"]\/Users\//gi,
      /['"]C:\\Users\\/gi,
      /require\(['"].*?C:\\.*?['"]\)/gi,
      /require\(['"].*?\/Users\/.*?['"]\)/gi
    ];

    jsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');

      problematicPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          matches.forEach(match => {
            this.issues.push({
              type: 'HARDCODED_PATH',
              file: path.relative(ROOT_DIR, file),
              issue: `Hardcoded absolute path found: ${match}`,
              fix: 'Use __dirname or app.getPath() for dynamic paths'
            });
          });
        }
      });
    });

    console.log(`   Found ${this.issues.filter(i => i.type === 'HARDCODED_PATH').length} hardcoded path issues`);
  }

  /**
   * Check dependencies are properly declared
   */
  checkDependencies() {
    console.log('📦 Checking dependencies...');

    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
    const jsFiles = this.getAllJsFiles(SRC_DIR);

    const requiredModules = new Set();

    jsFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');

      // Find all require() statements
      const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
      for (const match of requireMatches) {
        const moduleName = match[1];
        // Skip relative requires and node built-ins
        if (!moduleName.startsWith('.') && !moduleName.startsWith('node:')) {
          const baseModule = moduleName.split('/')[0];
          if (!this.isNodeBuiltin(baseModule)) {
            requiredModules.add(baseModule);
          }
        }
      }

      // Find ES6 imports
      const importMatches = content.matchAll(/import .+ from ['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const moduleName = match[1];
        if (!moduleName.startsWith('.') && !moduleName.startsWith('node:')) {
          const baseModule = moduleName.split('/')[0];
          if (!this.isNodeBuiltin(baseModule)) {
            requiredModules.add(baseModule);
          }
        }
      }
    });

    // Check if all required modules are in dependencies
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };

    requiredModules.forEach(module => {
      if (!allDeps[module]) {
        this.issues.push({
          type: 'MISSING_DEPENDENCY',
          file: 'package.json',
          issue: `Module "${module}" is used but not listed in dependencies`,
          fix: `Run: npm install ${module}`
        });
      }
    });

    console.log(`   Found ${this.issues.filter(i => i.type === 'MISSING_DEPENDENCY').length} dependency issues`);
  }

  /**
   * Check ASAR unpack configuration
   */
  checkAsarConfig() {
    console.log('📦 Checking ASAR configuration...');

    if (!fs.existsSync(FORGE_CONFIG)) {
      this.issues.push({
        type: 'MISSING_CONFIG',
        file: 'forge.config.ts',
        issue: 'Forge config file not found',
        fix: 'Create forge.config.ts with proper ASAR configuration'
      });
      return;
    }

    const forgeConfig = fs.readFileSync(FORGE_CONFIG, 'utf-8');

    // Check if data files are unpacked
    if (!forgeConfig.includes('data/lookups') || !forgeConfig.includes('parsers')) {
      this.warnings.push({
        type: 'ASAR_CONFIG',
        file: 'forge.config.ts',
        issue: 'Data files may not be properly unpacked from ASAR',
        fix: 'Ensure unpack pattern includes: {**/data/lookups/**/*,**/parsers/**/*}'
      });
    }

    console.log(`   ASAR config looks ${this.warnings.filter(w => w.type === 'ASAR_CONFIG').length === 0 ? 'good' : 'suspicious'}`);
  }

  /**
   * Check renderer path configuration in main.ts
   */
  checkRendererPath() {
    console.log('🖥️  Checking renderer path...');

    const mainTsPath = path.join(SRC_DIR, 'main.ts');
    if (!fs.existsSync(mainTsPath)) {
      this.issues.push({
        type: 'MISSING_FILE',
        file: 'src/main.ts',
        issue: 'Main process file not found',
        fix: 'Create src/main.ts'
      });
      return;
    }

    const mainContent = fs.readFileSync(mainTsPath, 'utf-8');

    // Check for correct renderer path
    const rendererPathPattern = /loadFile\s*\(\s*path\.join\s*\(\s*__dirname\s*,\s*['"]([^'"]+)['"]\s*\)/;
    const match = mainContent.match(rendererPathPattern);

    if (match) {
      const rendererPath = match[1];
      // Should be ../renderer/index.html, NOT ../renderer/main_window/index.html
      if (rendererPath.includes('main_window') || rendererPath.includes('${')) {
        this.issues.push({
          type: 'RENDERER_PATH',
          file: 'src/main.ts',
          issue: `Renderer path incorrect: ${rendererPath}`,
          fix: 'Change to: path.join(__dirname, "../renderer/index.html")',
          lineNumber: this.getLineNumber(mainContent, match[0])
        });
      }
    }

    console.log(`   Renderer path ${this.issues.filter(i => i.type === 'RENDERER_PATH').length === 0 ? 'correct' : 'INCORRECT'}`);
  }

  /**
   * Check native modules are properly configured
   */
  checkNativeModules() {
    console.log('⚙️  Checking native modules...');

    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
    const nativeModules = ['sqlite3', 'sharp'];

    nativeModules.forEach(module => {
      if (packageJson.dependencies && packageJson.dependencies[module]) {
        // Check if auto-unpack-natives plugin is enabled
        const forgeConfig = fs.readFileSync(FORGE_CONFIG, 'utf-8');
        if (!forgeConfig.includes('auto-unpack-natives')) {
          this.warnings.push({
            type: 'NATIVE_MODULE',
            file: 'forge.config.ts',
            issue: `Native module "${module}" detected but auto-unpack-natives plugin may not be enabled`,
            fix: 'Enable @electron-forge/plugin-auto-unpack-natives in forge.config.ts'
          });
        }
      }
    });

    console.log(`   Native modules ${this.warnings.filter(w => w.type === 'NATIVE_MODULE').length === 0 ? 'configured' : 'need attention'}`);
  }

  /**
   * Check for nul file (Windows null device file)
   */
  checkNulFile() {
    console.log('📄 Checking for nul file...');

    const nulPaths = [
      path.join(ROOT_DIR, 'nul'),
      path.join(ROOT_DIR, 'out', 'Madden Editor Suite-win32-x64', 'resources', 'app', 'nul')
    ];

    nulPaths.forEach(nulPath => {
      if (fs.existsSync(nulPath)) {
        this.issues.push({
          type: 'NUL_FILE',
          file: path.relative(ROOT_DIR, nulPath),
          issue: 'Windows null device file found - will break file I/O in packaged app',
          fix: `Delete the file: rm "${nulPath}"`
        });
      }
    });

    // Check if nul is in forge ignore patterns
    const forgeConfig = fs.readFileSync(FORGE_CONFIG, 'utf-8');
    if (!forgeConfig.includes('/nul')) {
      this.warnings.push({
        type: 'NUL_IGNORE',
        file: 'forge.config.ts',
        issue: 'nul file not in forge ignore patterns',
        fix: 'Add /^\\/nul$/ to excludePatterns in forge.config.ts'
      });
    }

    console.log(`   Found ${this.issues.filter(i => i.type === 'NUL_FILE').length} nul file issues`);
  }

  /**
   * Check Forge configuration for common issues
   */
  checkForgeConfig() {
    console.log('🔧 Checking Forge configuration...');

    if (!fs.existsSync(FORGE_CONFIG)) {
      return;
    }

    const forgeConfig = fs.readFileSync(FORGE_CONFIG, 'utf-8');

    // Check for NSIS maker (future enhancement)
    if (!forgeConfig.includes('MakerSquirrel') && !forgeConfig.includes('NSIS')) {
      this.warnings.push({
        type: 'INSTALLER',
        file: 'forge.config.ts',
        issue: 'No Windows installer maker configured',
        fix: 'Add MakerSquirrel or NSIS maker to forge.config.ts'
      });
    }

    console.log('   Forge config checked');
  }

  /**
   * Verify a packaged build works
   */
  async verifyPackage() {
    console.log('✅ Verifying packaged build...\n');

    // Check if package was built
    const outDir = path.join(ROOT_DIR, 'out');
    if (!fs.existsSync(outDir)) {
      console.log('❌ No packaged build found. Run: npm run package');
      return false;
    }

    // Find the packaged app
    const platforms = fs.readdirSync(outDir);
    console.log(`📦 Found builds for: ${platforms.join(', ')}\n`);

    // Check for common issues in packaged build
    platforms.forEach(platform => {
      const platformDir = path.join(outDir, platform);
      const resourcesDir = path.join(platformDir, 'resources');

      if (fs.existsSync(resourcesDir)) {
        console.log(`Checking ${platform}:`);

        // Check ASAR file exists
        const asarPath = path.join(resourcesDir, 'app.asar');
        if (fs.existsSync(asarPath)) {
          console.log('  ✅ app.asar exists');

          // Check unpacked directory
          const unpackedPath = path.join(resourcesDir, 'app.asar.unpacked');
          if (fs.existsSync(unpackedPath)) {
            console.log('  ✅ app.asar.unpacked exists');

            // List unpacked files
            const unpackedFiles = this.listFilesRecursive(unpackedPath);
            console.log(`  📂 Unpacked ${unpackedFiles.length} files`);
          } else {
            console.log('  ⚠️  No unpacked files (may cause issues with data/parsers)');
          }
        } else {
          console.log('  ❌ app.asar not found');
        }
      }
      console.log('');
    });

    return true;
  }

  /**
   * Auto-fix issues where possible
   */
  async fix() {
    console.log('🔧 Attempting to auto-fix issues...\n');

    await this.scan();

    const fixableIssues = this.issues.filter(i =>
      i.type === 'RENDERER_PATH' || i.type === 'MISSING_DEPENDENCY'
    );

    if (fixableIssues.length === 0) {
      console.log('✅ No auto-fixable issues found');
      return;
    }

    console.log(`\nFound ${fixableIssues.length} auto-fixable issues:\n`);

    fixableIssues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.file}: ${issue.issue}`);
      console.log(`   Fix: ${issue.fix}\n`);
    });

    // For now, just report what could be fixed
    // Future: implement actual auto-fixing
    console.log('⚠️  Auto-fix not yet implemented. Please apply fixes manually.');
  }

  /**
   * Print final report
   */
  printReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PACKAGING VALIDATION REPORT');
    console.log('='.repeat(80) + '\n');

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log('✅ No packaging issues found! Build should work correctly.\n');
      return;
    }

    if (this.issues.length > 0) {
      console.log(`❌ CRITICAL ISSUES (${this.issues.length}):\n`);
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.type}] ${issue.file}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Fix: ${issue.fix}`);
        if (issue.lineNumber) {
          console.log(`   Line: ${issue.lineNumber}`);
        }
        console.log('');
      });
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  WARNINGS (${this.warnings.length}):\n`);
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.type}] ${warning.file}`);
        console.log(`   Warning: ${warning.issue}`);
        console.log(`   Suggestion: ${warning.fix}`);
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log(`\nSummary: ${this.issues.length} critical issues, ${this.warnings.length} warnings`);

    if (this.issues.length > 0) {
      console.log('\n❌ PACKAGING WILL LIKELY FAIL - Fix critical issues before building\n');
    } else {
      console.log('\n✅ No critical issues - Safe to package\n');
    }
  }

  /**
   * Helper: Get all JS/TS files recursively
   */
  getAllJsFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && item !== 'node_modules' && item !== '.git') {
        files.push(...this.getAllJsFiles(fullPath));
      } else if (/\.(js|ts|jsx|tsx)$/.test(item)) {
        files.push(fullPath);
      }
    });

    return files;
  }

  /**
   * Helper: List files recursively
   */
  listFilesRecursive(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.listFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    });

    return files;
  }

  /**
   * Helper: Check if module is Node built-in
   */
  isNodeBuiltin(moduleName) {
    const builtins = [
      'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util',
      'stream', 'events', 'child_process', 'cluster', 'net', 'dns',
      'dgram', 'readline', 'repl', 'tls', 'tty', 'zlib', 'buffer',
      'querystring', 'string_decoder', 'timers', 'vm', 'assert',
      'constants', 'module', 'process', 'punycode', 'v8'
    ];
    return builtins.includes(moduleName);
  }

  /**
   * Helper: Get line number of a match in content
   */
  getLineNumber(content, match) {
    const upToMatch = content.substring(0, content.indexOf(match));
    return upToMatch.split('\n').length;
  }
}

// CLI Interface
async function main() {
  const [,, command] = process.argv;

  const validator = new PackageValidator();

  switch (command) {
    case 'scan':
      await validator.scan();
      process.exit(validator.issues.length > 0 ? 1 : 0);
      break;

    case 'verify':
      await validator.verifyPackage();
      break;

    case 'fix':
      await validator.fix();
      break;

    default:
      console.log(`
Package Validator Agent

Commands:
  scan      - Scan codebase for packaging issues
  verify    - Verify packaged build integrity
  fix       - Auto-fix issues (where possible)

Examples:
  node package-validator.js scan
  node package-validator.js verify
  node package-validator.js fix

What it checks:
  ✓ Hardcoded absolute paths
  ✓ Missing dependencies
  ✓ ASAR configuration
  ✓ Renderer path correctness
  ✓ Native module configuration
  ✓ Forge configuration
`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = PackageValidator;
