/**
 * Debug Logger Utility
 *
 * Writes debug logs to a file so they can be read programmatically
 * and don't get lost in the console output
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class DebugLogger {
  private logFilePath: string;
  private enabled: boolean = true;

  constructor(logFileName: string = 'scraper-debug.log') {
    // Store logs in user data directory
    const userDataPath = app.getPath('userData');
    this.logFilePath = path.join(userDataPath, logFileName);

    console.log(`[DebugLogger] Log file: ${this.logFilePath}`);
  }

  /**
   * Clear the log file (call this at the start of roster generation)
   */
  clear(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.unlinkSync(this.logFilePath);
      }
      this.log('=== DEBUG LOG STARTED ===\n');
      console.log(`[DebugLogger] Log file cleared: ${this.logFilePath}`);
    } catch (error) {
      console.error('[DebugLogger] Error clearing log file:', error);
    }
  }

  /**
   * Write a log entry to the file
   * @param message - Log message
   */
  log(message: string): void {
    if (!this.enabled) return;

    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;

      fs.appendFileSync(this.logFilePath, logEntry, 'utf-8');

      // Also log to console so user can see it in real-time
      console.log(message);
    } catch (error) {
      console.error('[DebugLogger] Error writing to log file:', error);
    }
  }

  /**
   * Write team-specific section header
   * @param teamAbbr - Team abbreviation
   * @param year - Season year
   */
  logTeamHeader(teamAbbr: string, year: number): void {
    this.log('\n' + '='.repeat(80));
    this.log(`TEAM: ${teamAbbr.toUpperCase()} (${year})`);
    this.log('='.repeat(80));
  }

  /**
   * Log player data extraction
   * @param rowNum - Row number in table
   * @param playerData - Player data extracted
   */
  logPlayerRow(rowNum: number, playerData: any): void {
    this.log(`  Row ${rowNum}:`);
    this.log(`    Name: ${playerData.name || 'EMPTY'}`);
    this.log(`    Position: ${playerData.position || 'EMPTY'}`);
    this.log(`    Jersey: ${playerData.jerseyNumber || 'N/A'}`);
    this.log(`    Height: ${playerData.height || 'N/A'}`);
    this.log(`    Weight: ${playerData.weight || 'N/A'}`);
    this.log(`    Age: ${playerData.age || 'N/A'}`);
    this.log(`    College: ${playerData.college || 'N/A'}`);
  }

  /**
   * Log scraping summary for a team
   * @param teamAbbr - Team abbreviation
   * @param playersFound - Number of players found
   * @param tableFound - Whether roster table was found
   * @param rowsFound - Number of rows in table
   */
  logScrapeSummary(teamAbbr: string, playersFound: number, tableFound: boolean, rowsFound: number): void {
    this.log(`\n[SCRAPE SUMMARY - ${teamAbbr.toUpperCase()}]`);
    this.log(`  Roster table found: ${tableFound ? 'YES' : 'NO'}`);
    this.log(`  Rows in table: ${rowsFound}`);
    this.log(`  Players extracted: ${playersFound}`);

    if (playersFound === 0 && rowsFound > 0) {
      this.log(`  ⚠️ WARNING: Found ${rowsFound} rows but extracted ZERO players!`);
    }
  }

  /**
   * Read the entire log file contents
   * @returns Log file contents as string
   */
  read(): string {
    try {
      if (fs.existsSync(this.logFilePath)) {
        return fs.readFileSync(this.logFilePath, 'utf-8');
      }
      return 'Log file does not exist yet.';
    } catch (error) {
      console.error('[DebugLogger] Error reading log file:', error);
      return 'Error reading log file.';
    }
  }

  /**
   * Get the log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Export singleton instance for scraper debugging
export const scraperDebugLogger = new DebugLogger('scraper-debug.log');

// Export singleton instance for general session debugging (CLEARS ON EACH APP START)
export const sessionDebugLogger = new DebugLogger('session-debug.log');
