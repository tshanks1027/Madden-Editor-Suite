/**
 * Update Checker Service
 *
 * Checks GitHub for new releases and notifies users when updates are available.
 * Does NOT auto-download or auto-install - just notifies the user.
 */

import { app } from 'electron';
import * as https from 'https';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

export class UpdateChecker {
  private readonly GITHUB_REPO = 'tshanks1027/Madden-Editor-Suite';
  private readonly CHECK_INTERVAL = 4 * 60 * 60 * 1000; // Check every 4 hours
  private checkTimer: NodeJS.Timeout | null = null;

  /**
   * Start periodic update checks
   */
  startPeriodicChecks(onUpdateAvailable: (info: UpdateInfo) => void): void {
    // Check immediately on startup
    this.checkForUpdates().then(info => {
      if (info.hasUpdate) {
        onUpdateAvailable(info);
      }
    }).catch(err => {
      console.error('[UpdateChecker] Initial check failed:', err);
    });

    // Then check every 4 hours
    this.checkTimer = setInterval(async () => {
      try {
        const info = await this.checkForUpdates();
        if (info.hasUpdate) {
          onUpdateAvailable(info);
        }
      } catch (err) {
        console.error('[UpdateChecker] Periodic check failed:', err);
      }
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop periodic update checks
   */
  stopPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Check GitHub for latest release
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    const currentVersion = app.getVersion();
    console.log(`[UpdateChecker] Current version: ${currentVersion}`);

    try {
      // Fetch latest release from GitHub API
      const releaseData = await this.fetchLatestRelease();

      const latestVersion = releaseData.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
      console.log(`[UpdateChecker] Latest version: ${latestVersion}`);

      const hasUpdate = this.compareVersions(currentVersion, latestVersion) < 0;

      // Use Google Drive download link for the ZIP file
      // GitHub releases show release notes, Google Drive hosts the actual download
      const downloadUrl = 'https://drive.google.com/file/d/1VcnwuGipCnFqvhYSyIEwCx4IteipdqPV/view?usp=drive_link';

      const updateInfo: UpdateInfo = {
        currentVersion,
        latestVersion,
        hasUpdate,
        downloadUrl: downloadUrl, // Google Drive link for the packaged ZIP
        releaseNotes: releaseData.body || 'No release notes available.',
        publishedAt: releaseData.published_at
      };

      console.log(`[UpdateChecker] Update available: ${hasUpdate}`);
      return updateInfo;

    } catch (error: any) {
      console.error('[UpdateChecker] Failed to check for updates:', error);
      throw new Error(`Failed to check for updates: ${error.message}`);
    }
  }

  /**
   * Fetch latest release from GitHub API
   */
  private fetchLatestRelease(): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.GITHUB_REPO}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'Madden-Editor-Suite',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const releaseData = JSON.parse(data);
              resolve(releaseData);
            } catch (err) {
              reject(new Error('Failed to parse GitHub API response'));
            }
          } else {
            reject(new Error(`GitHub API returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }
}

// Export singleton instance
export const updateChecker = new UpdateChecker();
