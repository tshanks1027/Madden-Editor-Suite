/**
 * LogoScraperService
 *
 * Downloads NFL team logos from sportslogos.net for historical franchise editing.
 * Converts GIF logos to MFT-compatible PNG format.
 *
 * Target format:
 * - PNG with 1024x1024 dimensions (divisible by 4 for MFT compatibility)
 * - Lowercase abbreviation naming: [abbr].png
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import https from 'https';
import http from 'http';

interface LogoEntry {
  yearRange: [number, number];
  url: string;
  type?: string;
  note?: string;
}

interface TeamData {
  name: string;
  sportslogos_id: number;
  logos: LogoEntry[];
  helmets?: LogoEntry[];
  alias?: string;
  note?: string;
}

interface LogoDatabase {
  version: string;
  source: string;
  teams: Record<string, TeamData>;
  abbreviation_mapping: Record<string, string>;
}

export interface LogoDownloadResult {
  success: boolean;
  abbreviation: string;
  outputPath?: string;
  originalUrl?: string;
  error?: string;
}

class LogoScraperService {
  private logosBasePath: string = '';
  private databasePath: string = '';
  private database: LogoDatabase | null = null;
  private initialized: boolean = false;

  constructor() {
    // Defer initialization to avoid issues when app is not ready
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initializePaths();
    this.initialized = true;
  }

  private initializePaths(): void {
    const isPackaged = app?.isPackaged ?? false;
    const appPath = app?.getAppPath() ?? process.cwd();

    // Static database path (read-only, from app bundle)
    const staticBasePath = isPackaged
      ? path.join(appPath, '.vite', 'build')
      : appPath;
    this.databasePath = path.join(staticBasePath, 'data', 'logos');

    // Writable logos path (in user data directory for downloads)
    const userDataPath = app?.getPath('userData') ?? process.cwd();
    this.logosBasePath = path.join(userDataPath, 'logos');

    // Ensure writable logos directory exists
    if (!fs.existsSync(this.logosBasePath)) {
      fs.mkdirSync(this.logosBasePath, { recursive: true });
    }
  }

  /**
   * Load the sportslogos database
   */
  private loadDatabase(): LogoDatabase {
    this.ensureInitialized();
    if (this.database) return this.database;

    const dbPath = path.join(this.databasePath, 'sportslogos-database.json');
    console.log('[LogoScraperService] Loading database from:', dbPath);

    if (!fs.existsSync(dbPath)) {
      throw new Error('Logo database not found: ' + dbPath);
    }

    const content = fs.readFileSync(dbPath, 'utf-8');
    this.database = JSON.parse(content);
    console.log('[LogoScraperService] Loaded database with', Object.keys(this.database!.teams).length, 'teams');
    return this.database!;
  }

  /**
   * Get logo URL for a team and year
   */
  getLogoUrlForYear(abbreviation: string, year: number): string | null {
    const db = this.loadDatabase();
    const abbr = abbreviation.toUpperCase();

    // Check for alias
    const teamKey = db.abbreviation_mapping[abbr] || abbr;
    const team = db.teams[teamKey];

    if (!team) {
      console.log(`[LogoScraperService] No team found for abbreviation: ${abbr}`);
      return null;
    }

    // Handle alias teams
    if (team.alias) {
      return this.getLogoUrlForYear(team.alias, year);
    }

    // Find logo for year
    for (const logo of team.logos || []) {
      if (year >= logo.yearRange[0] && year <= logo.yearRange[1]) {
        return logo.url;
      }
    }

    // Fall back to most recent logo
    if (team.logos && team.logos.length > 0) {
      return team.logos[team.logos.length - 1].url;
    }

    return null;
  }

  /**
   * Download an image from URL
   */
  private downloadImage(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[LogoScraperService] Downloading: ${url}`);

      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(outputPath);

      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            try { fs.unlinkSync(outputPath); } catch {}
            this.downloadImage(redirectUrl, outputPath).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`[LogoScraperService] Downloaded to: ${outputPath}`);
          resolve();
        });

        file.on('error', (err) => {
          try { fs.unlinkSync(outputPath); } catch {}
          reject(err);
        });
      });

      request.on('error', (err) => {
        try { fs.unlinkSync(outputPath); } catch {}
        reject(err);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Convert GIF to PNG and resize to 1024x1024
   */
  private async convertToPng(inputPath: string, outputPath: string): Promise<void> {
    console.log(`[LogoScraperService] Converting to PNG: ${inputPath} -> ${outputPath}`);

    await sharp(inputPath)
      .resize(1024, 1024, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);

    console.log(`[LogoScraperService] Converted to 1024x1024 PNG`);
  }

  /**
   * Download and convert a team logo
   */
  async scrapeTeamLogo(abbreviation: string, year?: number): Promise<LogoDownloadResult> {
    this.ensureInitialized();
    const abbr = abbreviation.toUpperCase();
    const targetYear = year || 2024;

    console.log(`[LogoScraperService] Scraping logo for ${abbr} (year: ${targetYear})`);

    try {
      const url = this.getLogoUrlForYear(abbr, targetYear);

      if (!url) {
        return {
          success: false,
          abbreviation: abbr,
          error: `No logo URL found for ${abbr} in year ${targetYear}`
        };
      }

      // Create temp directory
      const tempDir = path.join(this.logosBasePath, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Download GIF
      const ext = path.extname(url) || '.gif';
      const tempPath = path.join(tempDir, `${abbr}_temp${ext}`);
      await this.downloadImage(url, tempPath);

      // Convert to PNG
      const outputPath = path.join(this.logosBasePath, `${abbr.toLowerCase()}.png`);
      await this.convertToPng(tempPath, outputPath);

      // Cleanup temp file
      try { fs.unlinkSync(tempPath); } catch {}

      return {
        success: true,
        abbreviation: abbr,
        outputPath,
        originalUrl: url
      };

    } catch (error: any) {
      console.error(`[LogoScraperService] Error scraping ${abbr}:`, error);
      return {
        success: false,
        abbreviation: abbr,
        error: error.message
      };
    }
  }

  /**
   * Scrape logos for multiple teams
   */
  async scrapeLogosForYear(year: number, abbreviations: string[]): Promise<{ success: boolean; results: LogoDownloadResult[] }> {
    const results: LogoDownloadResult[] = [];

    for (const abbr of abbreviations) {
      const result = await this.scrapeTeamLogo(abbr, year);
      results.push(result);

      // Small delay between downloads to be nice to the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { success: true, results };
  }

  /**
   * Get list of available teams in database
   */
  getAvailableTeams(): string[] {
    const db = this.loadDatabase();
    return Object.keys(db.teams).filter(key => !db.teams[key].alias);
  }

  /**
   * Check if a logo exists locally
   */
  hasLogo(abbreviation: string): boolean {
    this.ensureInitialized();
    const logoPath = path.join(this.logosBasePath, `${abbreviation.toLowerCase()}.png`);
    return fs.existsSync(logoPath);
  }

  /**
   * Get path to a logo file
   */
  getLogoPath(abbreviation: string): string | null {
    this.ensureInitialized();
    const logoPath = path.join(this.logosBasePath, `${abbreviation.toLowerCase()}.png`);
    return fs.existsSync(logoPath) ? logoPath : null;
  }

  /**
   * List all downloaded logos
   */
  listDownloadedLogos(): string[] {
    this.ensureInitialized();
    if (!fs.existsSync(this.logosBasePath)) return [];

    return fs.readdirSync(this.logosBasePath)
      .filter(f => f.endsWith('.png') && !f.includes('temp'))
      .map(f => f.replace('.png', '').toUpperCase());
  }

  /**
   * Get the base path for logos
   */
  getLogosBasePath(): string {
    this.ensureInitialized();
    return this.logosBasePath;
  }
}

export const logoScraperService = new LogoScraperService();
