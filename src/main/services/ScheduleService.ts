/**
 * Schedule Service
 *
 * Manages historical NFL schedule data for the Retro Franchise Editor.
 * Loads schedules from JSON files and provides team name resolution.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Interfaces
export interface Game {
  week: number;
  weekType: 'preseason' | 'regular' | 'wildcard' | 'divisional' | 'conference' | 'superbowl';
  homeTeam: string;
  awayTeam: string;
  homeTeamIndex: number;
  awayTeamIndex: number;
  dayOfWeek?: string;
  date?: string;
}

export interface SeasonSchedule {
  year: number;
  seasonLength: number;
  byeWeeksEnabled: boolean;
  regularSeasonWeeks: number;
  games: Game[];
  playoffs: Game[];
}

export interface EraInfo {
  startYear: number;
  endYear: number;
  seasonLength: number;
  byeWeeks: boolean;
  regularSeasonWeeks?: number;
  playoffTeams: number;
  playoffFormat: string;
  note?: string;
}

export interface TeamNameMapping {
  teamIndex: number;
  years: [number, number];
  excludeYears?: number[];
}

export interface ScheduleMetadata {
  description: string;
  eras: EraInfo[];
  teamNameMappings: Record<string, TeamNameMapping>;
  abbreviationMappings: Record<string, number>;
  specialCases: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export class ScheduleService {
  private metadata: ScheduleMetadata | null = null;
  private scheduleCache: Map<number, SeasonSchedule> = new Map();
  private schedulesDir: string;
  private initialized: boolean = false;

  constructor() {
    // Find schedules directory
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'retro', 'schedules'),
      path.join(app.getAppPath(), 'data', 'retro', 'schedules'),
      path.join(__dirname, '..', '..', 'data', 'retro', 'schedules'),
    ];

    this.schedulesDir = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
    console.log('[ScheduleService] Schedules directory:', this.schedulesDir);
  }

  /**
   * Initialize the service by loading metadata
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadMetadata();
      this.initialized = true;
      console.log('[ScheduleService] Initialized successfully');
    } catch (error) {
      console.error('[ScheduleService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Load schedule metadata (era definitions, team mappings)
   */
  private async loadMetadata(): Promise<void> {
    const metadataPath = path.join(this.schedulesDir, 'schedule-metadata.json');

    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Schedule metadata not found: ${metadataPath}`);
    }

    const content = fs.readFileSync(metadataPath, 'utf-8');
    this.metadata = JSON.parse(content);
    console.log(`[ScheduleService] Loaded metadata with ${this.metadata?.eras.length} eras`);
  }

  /**
   * Load schedule for a specific year
   */
  public async loadSchedule(year: number): Promise<SeasonSchedule | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check cache first
    if (this.scheduleCache.has(year)) {
      return this.scheduleCache.get(year)!;
    }

    const schedulePath = path.join(this.schedulesDir, `${year}.json`);

    if (!fs.existsSync(schedulePath)) {
      console.warn(`[ScheduleService] Schedule not found for year ${year}`);
      return null;
    }

    try {
      const content = fs.readFileSync(schedulePath, 'utf-8');
      const schedule: SeasonSchedule = JSON.parse(content);

      // Cache the loaded schedule
      this.scheduleCache.set(year, schedule);
      console.log(`[ScheduleService] Loaded schedule for ${year}: ${schedule.games.length} games`);

      return schedule;
    } catch (error) {
      console.error(`[ScheduleService] Error loading schedule for ${year}:`, error);
      return null;
    }
  }

  /**
   * Get era information for a specific year
   */
  public getSeasonEra(year: number): EraInfo | null {
    if (!this.metadata) {
      console.warn('[ScheduleService] Metadata not loaded');
      return null;
    }

    const era = this.metadata.eras.find(e => year >= e.startYear && year <= e.endYear);
    return era || null;
  }

  /**
   * Resolve a team name to its franchise file teamIndex
   */
  public resolveTeamIndex(teamName: string, year: number): number {
    if (!this.metadata) {
      throw new Error('Metadata not loaded');
    }

    // Try full team name first
    const mapping = this.metadata.teamNameMappings[teamName];
    if (mapping) {
      // Check if year is in valid range and not excluded
      if (year >= mapping.years[0] && year <= mapping.years[1]) {
        if (!mapping.excludeYears || !mapping.excludeYears.includes(year)) {
          return mapping.teamIndex;
        }
      }
    }

    // Try abbreviation
    const abbrevMapping = this.metadata.abbreviationMappings[teamName.toUpperCase()];
    if (abbrevMapping !== undefined) {
      return abbrevMapping;
    }

    // Try partial matching (city or nickname)
    for (const [name, m] of Object.entries(this.metadata.teamNameMappings)) {
      if (name.includes(teamName) || teamName.includes(name)) {
        if (year >= m.years[0] && year <= m.years[1]) {
          if (!m.excludeYears || !m.excludeYears.includes(year)) {
            return m.teamIndex;
          }
        }
      }
    }

    throw new Error(`Unknown team: "${teamName}" for year ${year}`);
  }

  /**
   * Get all available schedule years
   */
  public getAvailableYears(): number[] {
    const years: number[] = [];

    try {
      const files = fs.readdirSync(this.schedulesDir);
      for (const file of files) {
        const match = file.match(/^(\d{4})\.json$/);
        if (match) {
          years.push(parseInt(match[1]));
        }
      }
    } catch (error) {
      console.error('[ScheduleService] Error reading schedules directory:', error);
    }

    return years.sort((a, b) => b - a); // Descending order
  }

  /**
   * Check if schedule data is available for a year
   */
  public hasSchedule(year: number): boolean {
    const schedulePath = path.join(this.schedulesDir, `${year}.json`);
    return fs.existsSync(schedulePath);
  }

  /**
   * Validate a schedule against active teams for a year
   */
  public validateScheduleForYear(schedule: SeasonSchedule, year: number): ValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check era compatibility
    const era = this.getSeasonEra(year);
    if (!era) {
      errors.push(`No era definition found for year ${year}`);
    } else {
      if (schedule.seasonLength !== era.seasonLength) {
        warnings.push(`Schedule has ${schedule.seasonLength} games, era expects ${era.seasonLength}`);
      }
      if (schedule.byeWeeksEnabled !== era.byeWeeks) {
        warnings.push(`Schedule bye weeks (${schedule.byeWeeksEnabled}) differs from era (${era.byeWeeks})`);
      }
    }

    // Validate team name resolutions
    const teamsInSchedule = new Set<string>();
    for (const game of schedule.games) {
      teamsInSchedule.add(game.homeTeam);
      teamsInSchedule.add(game.awayTeam);
    }

    for (const team of teamsInSchedule) {
      try {
        this.resolveTeamIndex(team, year);
      } catch (error) {
        errors.push(`Cannot resolve team: ${team}`);
      }
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Get games for a specific week
   */
  public async getGamesForWeek(year: number, week: number): Promise<Game[]> {
    const schedule = await this.loadSchedule(year);
    if (!schedule) return [];

    return schedule.games.filter(g => g.week === week);
  }

  /**
   * Get bye week for a specific team
   */
  public async getByeWeek(year: number, teamIndex: number): Promise<number | null> {
    const era = this.getSeasonEra(year);
    if (!era || !era.byeWeeks) {
      return null; // No bye weeks in this era
    }

    const schedule = await this.loadSchedule(year);
    if (!schedule) return null;

    // Find weeks where this team doesn't play
    const regularSeasonWeeks = schedule.regularSeasonWeeks || 17;
    const weeksWithGames = new Set<number>();

    for (const game of schedule.games) {
      if (game.weekType === 'regular') {
        if (game.homeTeamIndex === teamIndex || game.awayTeamIndex === teamIndex) {
          weeksWithGames.add(game.week);
        }
      }
    }

    // Find missing week (bye week)
    for (let week = 1; week <= regularSeasonWeeks; week++) {
      if (!weeksWithGames.has(week)) {
        return week;
      }
    }

    return null;
  }

  /**
   * Get summary statistics for a schedule
   */
  public async getScheduleSummary(year: number): Promise<{
    totalGames: number;
    regularSeasonGames: number;
    playoffGames: number;
    weekCount: number;
    teamsCount: number;
  } | null> {
    const schedule = await this.loadSchedule(year);
    if (!schedule) return null;

    const teams = new Set<number>();
    const weeks = new Set<number>();
    let regularSeasonGames = 0;

    for (const game of schedule.games) {
      teams.add(game.homeTeamIndex);
      teams.add(game.awayTeamIndex);
      if (game.weekType === 'regular') {
        weeks.add(game.week);
        regularSeasonGames++;
      }
    }

    return {
      totalGames: schedule.games.length + (schedule.playoffs?.length || 0),
      regularSeasonGames,
      playoffGames: schedule.playoffs?.length || 0,
      weekCount: weeks.size,
      teamsCount: teams.size
    };
  }

  /**
   * Clear the schedule cache
   */
  public clearCache(): void {
    this.scheduleCache.clear();
    console.log('[ScheduleService] Cache cleared');
  }

  /**
   * Check if service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get metadata (for debugging)
   */
  public getMetadata(): ScheduleMetadata | null {
    return this.metadata;
  }
}

// Export singleton instance
export const scheduleService = new ScheduleService();
