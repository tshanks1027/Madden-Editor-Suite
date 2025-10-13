/**
 * Chrome Finder Utility
 *
 * Finds system-installed Chrome/Edge browsers to use with Puppeteer
 * instead of downloading Chromium (saves ~170MB and avoids firewall issues)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ChromeInfo {
  executablePath: string;
  browser: 'chrome' | 'edge' | 'chromium';
  version?: string;
}

/**
 * Find system Chrome or Edge installation
 * @returns Chrome info or null if not found
 */
export function findChrome(): ChromeInfo | null {
  const platform = process.platform;

  if (platform === 'win32') {
    return findChromeWindows();
  } else if (platform === 'darwin') {
    return findChromeMac();
  } else if (platform === 'linux') {
    return findChromeLinux();
  }

  return null;
}

/**
 * Find Chrome on Windows
 */
function findChromeWindows(): ChromeInfo | null {
  const paths = [
    // Chrome paths
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe'),

    // Edge paths (Chromium-based Edge)
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.PROGRAMFILES || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
  ];

  for (const chromePath of paths) {
    if (fs.existsSync(chromePath)) {
      const browser = chromePath.includes('Edge') ? 'edge' : 'chrome';
      console.log(`[ChromeFinder] Found ${browser} at: ${chromePath}`);
      return {
        executablePath: chromePath,
        browser
      };
    }
  }

  console.warn('[ChromeFinder] Chrome/Edge not found on Windows');
  return null;
}

/**
 * Find Chrome on macOS
 */
function findChromeMac(): ChromeInfo | null {
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];

  for (const chromePath of paths) {
    if (fs.existsSync(chromePath)) {
      const browser = chromePath.includes('Edge') ? 'edge' :
                     chromePath.includes('Chromium') ? 'chromium' : 'chrome';
      console.log(`[ChromeFinder] Found ${browser} at: ${chromePath}`);
      return {
        executablePath: chromePath,
        browser
      };
    }
  }

  console.warn('[ChromeFinder] Chrome/Edge not found on macOS');
  return null;
}

/**
 * Find Chrome on Linux
 */
function findChromeLinux(): ChromeInfo | null {
  const paths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable'
  ];

  for (const chromePath of paths) {
    if (fs.existsSync(chromePath)) {
      const browser = chromePath.includes('edge') ? 'edge' :
                     chromePath.includes('chromium') ? 'chromium' : 'chrome';
      console.log(`[ChromeFinder] Found ${browser} at: ${chromePath}`);
      return {
        executablePath: chromePath,
        browser
      };
    }
  }

  console.warn('[ChromeFinder] Chrome/Edge not found on Linux');
  return null;
}
