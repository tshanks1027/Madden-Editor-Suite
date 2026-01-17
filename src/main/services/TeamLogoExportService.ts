/**
 * TeamLogoExportService
 *
 * Manages team logo import/export for Frosty/MFT integration.
 * Uses 3-letter abbreviations from historical-teams.json for consistent naming.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Logo variant types that can be imported/exported
export const LOGO_TYPES = {
  primary: { description: 'Main team logo', frostyPath: 'content/common/textures/logos' },
  secondary: { description: 'Alternate/secondary logo', frostyPath: 'content/common/textures/logos' },
  wordmark: { description: 'Text-based team logo', frostyPath: 'content/common/textures/logos' },
  helmet: { description: 'Helmet decal texture', frostyPath: 'content/characters/player/parts/uniforms/helmets/NFL/partItems' },
  endzone: { description: 'End zone painting', frostyPath: 'content/common/textures/logos' },
  midfield: { description: 'Midfield logo', frostyPath: 'content/common/textures/logos' },
} as const;

export type LogoType = keyof typeof LOGO_TYPES;

interface TeamLogoInfo {
  teamIndex: number;
  currentName: string;
  currentCity: string;
  yearCity: string;
  yearName: string;
  abbreviation: string;
  needsCustomLogo: boolean;
  logos: Partial<Record<LogoType, string>>;  // paths to logo files
}

interface HistoricalTeam {
  teamIndex: number;
  currentName: string;
  currentCity: string;
  currentAbbreviation?: string;
  expansionYear?: number;
  changes: Array<{
    yearRange: [number, number];
    city: string | null;
    name: string | null;
    abbreviation: string;
    inactive?: boolean;
    needsCustomLogo?: boolean;
    note?: string;
  }>;
}

interface HistoricalTeamsData {
  description: string;
  teams: HistoricalTeam[];
}

interface LogoManifest {
  version: string;
  description: string;
  logoTypes: Record<string, { description: string; frostyPath: string }>;
  teams: Record<string, {
    logos: Partial<Record<LogoType, string>>;
    yearRange?: [number, number];
  }>;
}

interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  filesCreated?: string[];
  filesSkipped?: string[];
}

class TeamLogoExportService {
  private historicalTeams: HistoricalTeamsData | null = null;
  private logoManifest: LogoManifest | null = null;
  private logosBasePath: string = '';

  constructor() {
    this.initializePaths();
  }

  private initializePaths(): void {
    // Determine base path depending on whether we're packaged or in dev
    const isPackaged = app?.isPackaged ?? false;
    const basePath = isPackaged
      ? path.join(app.getAppPath(), '.vite', 'build')
      : path.join(__dirname, '..', '..', '..');

    this.logosBasePath = path.join(basePath, 'data', 'logos');
  }

  /**
   * Load historical teams data
   */
  private loadHistoricalTeams(): HistoricalTeamsData {
    if (this.historicalTeams) return this.historicalTeams;

    const isPackaged = app?.isPackaged ?? false;
    const appPath = app?.getAppPath() ?? process.cwd();
    const dataPath = isPackaged
      ? path.join(appPath, '.vite', 'build', 'data', 'retro')
      : path.join(appPath, 'data', 'retro');

    const teamsPath = path.join(dataPath, 'historical-teams.json');
    console.log('[TeamLogoExportService] Loading historical teams from:', teamsPath);

    try {
      const content = fs.readFileSync(teamsPath, 'utf8');
      this.historicalTeams = JSON.parse(content);
      return this.historicalTeams!;
    } catch (error) {
      console.error('Failed to load historical-teams.json:', error);
      throw new Error('Could not load historical teams data');
    }
  }

  /**
   * Load or create logo manifest
   */
  private loadManifest(): LogoManifest {
    if (this.logoManifest) return this.logoManifest;

    const manifestPath = path.join(this.logosBasePath, 'manifest.json');

    try {
      if (fs.existsSync(manifestPath)) {
        const content = fs.readFileSync(manifestPath, 'utf8');
        this.logoManifest = JSON.parse(content);
        return this.logoManifest!;
      }
    } catch (error) {
      console.error('Failed to load manifest.json:', error);
    }

    // Return default manifest
    this.logoManifest = {
      version: '1.0',
      description: 'Team logo manifest for Frosty/MFT export',
      logoTypes: LOGO_TYPES as unknown as Record<string, { description: string; frostyPath: string }>,
      teams: {}
    };
    return this.logoManifest;
  }

  /**
   * Save logo manifest
   */
  private saveManifest(): void {
    const manifest = this.loadManifest();
    const manifestPath = path.join(this.logosBasePath, 'manifest.json');

    // Ensure directory exists
    if (!fs.existsSync(this.logosBasePath)) {
      fs.mkdirSync(this.logosBasePath, { recursive: true });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Get team info for a specific year
   */
  getTeamForYear(teamIndex: number, year: number): { city: string; name: string; abbreviation: string; inactive: boolean } | null {
    const teamsData = this.loadHistoricalTeams();
    const team = teamsData.teams.find(t => t.teamIndex === teamIndex);

    if (!team) return null;

    // Check expansion year
    if (team.expansionYear && year < team.expansionYear) {
      return { city: '', name: '', abbreviation: 'NFL', inactive: true };
    }

    // Find the change that applies to this year
    for (const change of team.changes) {
      const [startYear, endYear] = change.yearRange;
      if (year >= startYear && year <= endYear) {
        return {
          city: change.city || '',
          name: change.name || '',
          abbreviation: change.abbreviation,
          inactive: change.inactive || false
        };
      }
    }

    // Default to current values
    return {
      city: team.currentCity,
      name: team.currentName,
      abbreviation: team.currentAbbreviation || team.changes[team.changes.length - 1]?.abbreviation || 'NFL',
      inactive: false
    };
  }

  /**
   * Get all teams for a specific year with logo info
   */
  getTeamsForYear(year: number): TeamLogoInfo[] {
    const teamsData = this.loadHistoricalTeams();
    const manifest = this.loadManifest();
    const result: TeamLogoInfo[] = [];

    for (const team of teamsData.teams) {
      const yearInfo = this.getTeamForYear(team.teamIndex, year);
      if (!yearInfo) continue;

      // Check if this abbreviation differs from current (needs custom logo)
      const currentAbbr = team.currentAbbreviation || team.changes[team.changes.length - 1]?.abbreviation;
      const needsCustomLogo = yearInfo.abbreviation !== currentAbbr || yearInfo.inactive;

      // Get existing logos from manifest
      const teamLogos = manifest.teams[yearInfo.abbreviation]?.logos || {};

      result.push({
        teamIndex: team.teamIndex,
        currentName: team.currentName,
        currentCity: team.currentCity,
        yearCity: yearInfo.city,
        yearName: yearInfo.name,
        abbreviation: yearInfo.abbreviation,
        needsCustomLogo,
        logos: teamLogos
      });
    }

    return result;
  }

  /**
   * Get all unique abbreviations that need custom logos
   */
  getAbbreviationsNeedingLogos(): Array<{ abbreviation: string; teams: string[]; yearRanges: string[] }> {
    const teamsData = this.loadHistoricalTeams();
    const abbrevMap = new Map<string, { teams: Set<string>; yearRanges: Set<string> }>();

    for (const team of teamsData.teams) {
      // Get current abbreviation
      const currentAbbr = team.currentAbbreviation || team.changes[team.changes.length - 1]?.abbreviation;

      for (const change of team.changes) {
        // Skip if matches current or is inactive marker
        if (change.abbreviation === currentAbbr && !change.inactive) continue;
        if (change.inactive && change.abbreviation === 'NFL') continue; // Skip NFL placeholders

        const key = change.abbreviation;
        if (!abbrevMap.has(key)) {
          abbrevMap.set(key, { teams: new Set(), yearRanges: new Set() });
        }

        const entry = abbrevMap.get(key)!;
        const teamFullName = `${change.city || ''} ${change.name || ''}`.trim() || team.currentName;
        entry.teams.add(teamFullName);
        entry.yearRanges.add(`${change.yearRange[0]}-${change.yearRange[1]}`);
      }
    }

    // Also add NFL for inactive teams
    if (!abbrevMap.has('NFL')) {
      abbrevMap.set('NFL', { teams: new Set(['Inactive Teams']), yearRanges: new Set(['Various']) });
    }

    return Array.from(abbrevMap.entries()).map(([abbreviation, data]) => ({
      abbreviation,
      teams: Array.from(data.teams),
      yearRanges: Array.from(data.yearRanges)
    })).sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
  }

  /**
   * Import a logo file for a team abbreviation
   */
  async importLogo(abbreviation: string, logoType: LogoType, sourcePath: string): Promise<ExportResult> {
    try {
      const manifest = this.loadManifest();

      // Create team directory if needed
      const teamDir = path.join(this.logosBasePath, abbreviation);
      if (!fs.existsSync(teamDir)) {
        fs.mkdirSync(teamDir, { recursive: true });
      }

      // Determine file extension
      const ext = path.extname(sourcePath).toLowerCase();
      if (ext !== '.dds' && ext !== '.png') {
        return { success: false, error: 'Logo must be a DDS or PNG file' };
      }

      // Copy file to logos directory
      const destFileName = `${logoType}${ext}`;
      const destPath = path.join(teamDir, destFileName);
      fs.copyFileSync(sourcePath, destPath);

      // Update manifest
      if (!manifest.teams[abbreviation]) {
        manifest.teams[abbreviation] = { logos: {} };
      }
      manifest.teams[abbreviation].logos[logoType] = `${abbreviation}/${destFileName}`;
      this.logoManifest = manifest;
      this.saveManifest();

      return {
        success: true,
        outputPath: destPath,
        filesCreated: [destFileName]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get path to a specific logo file
   */
  getLogoPath(abbreviation: string, logoType: LogoType): string | null {
    const manifest = this.loadManifest();
    const relativePath = manifest.teams[abbreviation]?.logos[logoType];
    if (!relativePath) return null;

    const fullPath = path.join(this.logosBasePath, relativePath);
    return fs.existsSync(fullPath) ? fullPath : null;
  }

  /**
   * Check if a logo exists for a team/type
   */
  hasLogo(abbreviation: string, logoType: LogoType): boolean {
    return this.getLogoPath(abbreviation, logoType) !== null;
  }

  /**
   * Get all logos for an abbreviation
   */
  getLogosForTeam(abbreviation: string): Partial<Record<LogoType, string>> {
    const manifest = this.loadManifest();
    const teamData = manifest.teams[abbreviation];
    if (!teamData) return {};

    const result: Partial<Record<LogoType, string>> = {};
    for (const [logoType, relativePath] of Object.entries(teamData.logos)) {
      const fullPath = path.join(this.logosBasePath, relativePath as string);
      if (fs.existsSync(fullPath)) {
        result[logoType as LogoType] = fullPath;
      }
    }
    return result;
  }

  /**
   * Export logos for a specific year to Frosty-compatible package
   */
  async exportForFrosty(year: number, outputDir: string): Promise<ExportResult> {
    try {
      const teams = this.getTeamsForYear(year);
      const filesCreated: string[] = [];
      const filesSkipped: string[] = [];

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      for (const team of teams) {
        if (!team.needsCustomLogo) continue;

        const logos = this.getLogosForTeam(team.abbreviation);

        for (const [logoType, sourcePath] of Object.entries(logos)) {
          if (!sourcePath) continue;

          // Determine Frosty output path
          const logoInfo = LOGO_TYPES[logoType as LogoType];
          const frostyDir = path.join(outputDir, logoInfo.frostyPath);

          if (!fs.existsSync(frostyDir)) {
            fs.mkdirSync(frostyDir, { recursive: true });
          }

          // Create output filename
          const ext = path.extname(sourcePath);
          const outputFileName = `${team.abbreviation}_${logoType}${ext}`;
          const outputPath = path.join(frostyDir, outputFileName);

          // Copy file
          fs.copyFileSync(sourcePath, outputPath);
          filesCreated.push(path.relative(outputDir, outputPath));
        }

        // Track teams without logos
        if (Object.keys(logos).length === 0) {
          filesSkipped.push(`${team.abbreviation} (no logos imported)`);
        }
      }

      // Generate import manifest
      const manifestContent = this.generateImportManifest(year, teams, filesCreated);
      const manifestPath = path.join(outputDir, 'FROSTY_IMPORT.txt');
      fs.writeFileSync(manifestPath, manifestContent);
      filesCreated.push('FROSTY_IMPORT.txt');

      return {
        success: true,
        outputPath: outputDir,
        filesCreated,
        filesSkipped
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate Frosty import instructions
   */
  private generateImportManifest(year: number, teams: TeamLogoInfo[], filesCreated: string[]): string {
    const teamsWithLogos = teams.filter(t => t.needsCustomLogo && Object.keys(this.getLogosForTeam(t.abbreviation)).length > 0);
    const teamsWithoutLogos = teams.filter(t => t.needsCustomLogo && Object.keys(this.getLogosForTeam(t.abbreviation)).length === 0);

    return `
Frosty Mod Manager - Team Logo Import
=====================================
Year: ${year}
Generated: ${new Date().toISOString()}

Teams with custom logos (${teamsWithLogos.length}):
${teamsWithLogos.map(t => `  - ${t.abbreviation}: ${t.yearCity} ${t.yearName}`).join('\n')}

Teams needing logos (${teamsWithoutLogos.length}):
${teamsWithoutLogos.map(t => `  - ${t.abbreviation}: ${t.yearCity} ${t.yearName}`).join('\n')}

Files created (${filesCreated.length}):
${filesCreated.map(f => `  - ${f}`).join('\n')}

Import Instructions:
====================
1. Open Frosty Mod Manager with Madden 26
2. Navigate to the appropriate asset paths shown below
3. Import each DDS file as a replacement texture

Logo Paths in Frosty:
- Primary logos: content/common/textures/logos
- Team select: common/ui/madden/swappables/teamlogos.ast
- Helmet textures: content/characters/player/parts/uniforms/helmets/NFL/partItems/

Recipe System Workaround (M26):
- Find expansion/vanity PartItems with full textures
- PartItem > References > Find full texture
- Import replacement DDS

MFT Integration:
- These files use 3-letter abbreviations matching MFT naming convention
- Simply rename to match your MFT logo slots
`.trim();
  }

  /**
   * Delete a logo
   */
  deleteLogo(abbreviation: string, logoType: LogoType): boolean {
    const logoPath = this.getLogoPath(abbreviation, logoType);
    if (!logoPath) return false;

    try {
      fs.unlinkSync(logoPath);

      // Update manifest
      const manifest = this.loadManifest();
      if (manifest.teams[abbreviation]?.logos[logoType]) {
        delete manifest.teams[abbreviation].logos[logoType];

        // Clean up empty team entries
        if (Object.keys(manifest.teams[abbreviation].logos).length === 0) {
          delete manifest.teams[abbreviation];
        }

        this.logoManifest = manifest;
        this.saveManifest();
      }

      return true;
    } catch (error) {
      console.error('Failed to delete logo:', error);
      return false;
    }
  }

  /**
   * Get logo summary for UI display
   */
  getLogoSummary(): {
    totalAbbreviations: number;
    abbreviationsWithLogos: number;
    totalLogos: number;
    byType: Record<LogoType, number>;
  } {
    const manifest = this.loadManifest();
    const byType: Record<LogoType, number> = {
      primary: 0,
      secondary: 0,
      wordmark: 0,
      helmet: 0,
      endzone: 0,
      midfield: 0
    };

    let totalLogos = 0;
    const abbreviationsWithLogos = new Set<string>();

    for (const [abbr, teamData] of Object.entries(manifest.teams)) {
      for (const [logoType] of Object.entries(teamData.logos)) {
        if (this.hasLogo(abbr, logoType as LogoType)) {
          byType[logoType as LogoType]++;
          totalLogos++;
          abbreviationsWithLogos.add(abbr);
        }
      }
    }

    return {
      totalAbbreviations: this.getAbbreviationsNeedingLogos().length,
      abbreviationsWithLogos: abbreviationsWithLogos.size,
      totalLogos,
      byType
    };
  }

  /**
   * Export logos for MFT (Madden Franchise Tool)
   * MFT uses simple lowercase abbreviation naming: stl.png, hou.png, etc.
   */
  async exportForMFT(year: number, outputDir: string): Promise<ExportResult> {
    try {
      const teams = this.getTeamsForYear(year);
      const filesCreated: string[] = [];
      const filesSkipped: string[] = [];

      // Create output directory
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      for (const team of teams) {
        if (!team.needsCustomLogo) continue;

        // Get primary logo (MFT mainly uses primary logos)
        const logos = this.getLogosForTeam(team.abbreviation);
        const primaryPath = logos.primary;

        if (primaryPath && fs.existsSync(primaryPath)) {
          // MFT naming: lowercase abbreviation
          const outputFileName = `${team.abbreviation.toLowerCase()}.png`;
          const outputPath = path.join(outputDir, outputFileName);

          // Copy file
          fs.copyFileSync(primaryPath, outputPath);
          filesCreated.push(outputFileName);
          console.log(`[TeamLogoExportService] MFT export: ${team.abbreviation} -> ${outputFileName}`);
        } else {
          filesSkipped.push(`${team.abbreviation} (no primary logo)`);
        }
      }

      // Generate MFT import instructions
      const manifestContent = `MFT Logo Import Instructions
==============================
Year: ${year}
Generated: ${new Date().toISOString()}

Files Created: ${filesCreated.length}
${filesCreated.map(f => `  - ${f}`).join('\n')}

Installation:
1. Open MFT (Madden Franchise Tool)
2. Go to Tools > Logo Manager (or similar)
3. Import these PNG files
4. Logos are named by team abbreviation (e.g., stl.png = St. Louis)

Note: These are historical team logos for ${year} season.
Teams use abbreviations from that era (e.g., STL Cardinals, HOU Oilers).
`;
      const manifestPath = path.join(outputDir, 'MFT_README.txt');
      fs.writeFileSync(manifestPath, manifestContent);
      filesCreated.push('MFT_README.txt');

      return {
        success: true,
        outputPath: outputDir,
        filesCreated,
        filesSkipped
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

export const teamLogoExportService = new TeamLogoExportService();
export default TeamLogoExportService;
