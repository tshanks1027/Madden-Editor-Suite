/**
 * Playwright Configuration for Electron Testing
 *
 * This config enables E2E testing of the Madden Editor Suite Electron app.
 * Tests are located in tests/e2e/ directory.
 */

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000, // Increased for Electron app launch
  expect: {
    timeout: 10000, // Increased for file operations
  },
  fullyParallel: false, // Run tests sequentially for Electron
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Retry once on local failures
  workers: 1, // Single worker for Electron testing

  // Enhanced HTML reporter with screenshots
  reporter: [
    ['html', { outputFolder: 'test-reports/html', open: 'never' }],
    ['list'], // Console output
    ['json', { outputFile: 'test-reports/results.json' }]
  ],

  use: {
    // Show Electron window during tests
    headless: false,

    // Always capture screenshots for verification
    screenshot: 'on',

    // Video for failed tests
    video: 'retain-on-failure',

    // Trace for debugging
    trace: 'on-first-retry',

    // Slow down actions for visibility (ms)
    actionTimeout: 15000,

    // Base URL for renderer process
    baseURL: 'http://localhost:3000',
  },

  projects: [
    {
      name: 'electron-tests',
      testMatch: '**/*.(spec|test).js', // Run all spec/test files
      testIgnore: '**/archive/**', // Ignore archived tests
    },
  ],

  // Vite dev server for renderer process
  webServer: {
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for Electron to start
    stdout: 'pipe', // Capture console output
    stderr: 'pipe',
  },
});