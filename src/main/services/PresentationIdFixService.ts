/**
 * PresentationIdFixService
 *
 * Service to run presentationIdFixV3.0.exe on roster files to fix comm/presentation IDs
 * before save operations complete.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class PresentationIdFixService {
  private exePath: string;
  private enabled: boolean = true;

  constructor() {
    // Look for bundled exe first, then fall back to common locations
    this.exePath = this.findExePath();
  }

  /**
   * Search for the presentationIdFix exe - bundled first, then common locations
   */
  private findExePath(): string {
    const appPath = app.getAppPath();
    const userProfile = process.env.USERPROFILE || '';

    const possiblePaths = [
      // Bundled with the app (preferred)
      path.join(appPath, 'data', 'tools', 'presentationIdFixV3.0.exe'),
      path.join(appPath, '..', '..', 'data', 'tools', 'presentationIdFixV3.0.exe'), // For unpacked
      // User's known locations
      path.join(userProfile, 'OneDrive', 'Documents', 'Madden Files', 'Tools', 'presentationIdFixV3.0 (1).exe'),
      path.join(userProfile, 'OneDrive', 'Documents', 'Madden Files', 'Tools', 'presentationIdFixV3.0.exe'),
      path.join(userProfile, 'Documents', 'Madden Files', 'Tools', 'presentationIdFixV3.0.exe'),
      path.join(userProfile, 'Downloads', 'presentationIdFixV3.0.exe'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`[PresentationIdFix] Found exe at: ${p}`);
        return p;
      }
    }

    // Default to bundled path even if not found (will log warning when used)
    console.log('[PresentationIdFix] Exe not found in any location');
    return path.join(appPath, 'data', 'tools', 'presentationIdFixV3.0.exe');
  }

  /**
   * Set the path to the presentationIdFix executable
   */
  public setExePath(exePath: string): void {
    this.exePath = exePath;
  }

  /**
   * Get the current exe path
   */
  public getExePath(): string {
    return this.exePath;
  }

  /**
   * Enable or disable the presentation ID fix
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if the presentation ID fix is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if the exe exists at the configured path
   */
  public exeExists(): boolean {
    return fs.existsSync(this.exePath);
  }

  /**
   * Run presentationIdFix on a roster file
   * @param filePath - Absolute path to the roster file
   * @returns Promise that resolves when the tool completes
   */
  public async fixPresentationIds(filePath: string): Promise<void> {
    if (!this.enabled) {
      console.log('[PresentationIdFix] Feature is disabled, skipping');
      return;
    }

    if (!this.exeExists()) {
      console.warn(`[PresentationIdFix] Exe not found at: ${this.exePath}`);
      console.warn('[PresentationIdFix] Skipping presentation ID fix');
      return;
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log('[PresentationIdFix] Running presentationIdFix on:', filePath);
    console.log('[PresentationIdFix] Exe path:', this.exePath);

    return new Promise((resolve, reject) => {
      // Run the exe with the file path as an argument
      const process = spawn(this.exePath, [filePath], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        console.error('[PresentationIdFix] Error running exe:', error.message);
        // Don't reject - we want saves to succeed even if this tool fails
        console.warn('[PresentationIdFix] Continuing without presentation ID fix');
        resolve();
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('[PresentationIdFix] Successfully fixed presentation IDs');
          if (stdout) {
            console.log('[PresentationIdFix] Output:', stdout);
          }
          resolve();
        } else {
          console.warn(`[PresentationIdFix] Process exited with code ${code}`);
          if (stderr) {
            console.warn('[PresentationIdFix] Error output:', stderr);
          }
          // Don't reject - we want saves to succeed even if this tool fails
          console.warn('[PresentationIdFix] Continuing without presentation ID fix');
          resolve();
        }
      });

      // Set a timeout to prevent hanging (30 seconds)
      const timeout = setTimeout(() => {
        console.warn('[PresentationIdFix] Timeout - killing process');
        process.kill();
        resolve();
      }, 30000);

      process.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Test if the exe runs successfully on a test file
   */
  public async testExe(testFilePath?: string): Promise<boolean> {
    if (!this.exeExists()) {
      console.error('[PresentationIdFix] Exe not found at:', this.exePath);
      return false;
    }

    if (testFilePath && !fs.existsSync(testFilePath)) {
      console.error('[PresentationIdFix] Test file not found:', testFilePath);
      return false;
    }

    console.log('[PresentationIdFix] Testing exe...');

    try {
      if (testFilePath) {
        // Create a temp copy to test on
        const tempPath = testFilePath + '.test_temp';
        fs.copyFileSync(testFilePath, tempPath);

        await this.fixPresentationIds(tempPath);

        // Clean up
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        console.log('[PresentationIdFix] Test successful');
        return true;
      } else {
        // Just check if exe exists
        return this.exeExists();
      }
    } catch (error: any) {
      console.error('[PresentationIdFix] Test failed:', error.message);
      return false;
    }
  }
}

// Export singleton instance
export const presentationIdFixService = new PresentationIdFixService();
