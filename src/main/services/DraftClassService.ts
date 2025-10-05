/**
 * Draft Class Service
 *
 * Service layer for draft class file operations.
 * Provides methods for loading, saving, validating, and exporting draft class files.
 *
 * Source: Uses calibrated parser from src/main/lib/draft-class/
 *         Based on madden-draft-class-tools by WiiExpertise (GPL-3.0)
 */

import * as path from 'path';

// Import draft class parser functions
import * as fs from 'fs';

// Use madden-draft-class-tools for M25 files (tested and working)
const { readDraftClass: readM25, writeDraftClass: writeM25 } = require('madden-draft-class-tools');

/**
 * Detect if file is Madden 25 or Madden 26
 * M25 has "Madden-25" in the fileName field at offset 0x22
 * M26 has "Madden-26" or similar
 */
function detectMaddenVersion(filePath: string): 'M25' | 'M26' | 'unknown' {
  const buffer = fs.readFileSync(filePath);

  // Check FBCHUNKS signature
  const signature = buffer.toString('ascii', 0, 8);
  if (signature !== 'FBCHUNKS') {
    return 'unknown';
  }

  // Read fileName field (21 bytes at offset 0x22)
  const fileName = buffer.toString('ascii', 0x22, 0x22 + 21).replace(/\0/g, '');

  if (fileName.includes('Madden-25')) {
    return 'M25';
  } else if (fileName.includes('Madden-26') || fileName.includes('Madden NFL 26')) {
    return 'M26';
  }

  return 'unknown';
}

/**
 * Draft Class Service
 * Main service for draft class file operations
 */
export class DraftClassService {

  /**
   * Load and parse a draft class file
   * @param filePath - Path to the draft class file
   * @returns Parsed draft class data with prospects array
   */
  async loadDraftClass(filePath: string): Promise<any> {
    try {
      console.log('[DraftClassService] Loading draft class from:', filePath);

      // Detect game version
      const version = detectMaddenVersion(filePath);
      console.log(`[DraftClassService] Detected version: ${version}`);

      let draftClass: any;

      if (version === 'M25') {
        // Use madden-draft-class-tools for M25
        const buffer = fs.readFileSync(filePath);
        draftClass = readM25(buffer);

        console.log('[DraftClassService] Successfully loaded M25 draft class');
        console.log(`[DraftClassService] - Prospects: ${draftClass.prospects.length}`);
        console.log(`[DraftClassService] - Year: ${draftClass.header.gameYear}`);
        console.log(`[DraftClassService] - File Name: ${draftClass.header.fileName}`);

        return {
          success: true,
          data: draftClass
        };

      } else if (version === 'M26') {
        // M26 uses custom parser with dynamic block scanning
        const path = require('path');
        const m26ParserPath = path.join(__dirname, 'lib', 'draft-class', 'M26Parser');
        const { parseM26Prospects } = require(m26ParserPath);

        // Parse header first (same structure, different offset)
        const buffer = fs.readFileSync(filePath);
        const signature = buffer.toString('ascii', 0, 8);
        const versionByte = buffer.readUInt8(8);
        const year = buffer.readUInt16LE(0x16);
        const product = buffer.toString('ascii', 0x22, 0x37).replace(/\0/g, '');

        const header = {
          signature,
          version: versionByte,
          year,
          product,
          gameVersion: 'M26',
          dataStartOffset: 0x46 // M26 starts at 0x46
        };

        // Parse prospects using M26-specific parser
        const prospects = parseM26Prospects(buffer, header);

        draftClass = {
          header,
          prospects
        };

        console.log('[DraftClassService] Successfully loaded M26 draft class');
        console.log(`[DraftClassService] - Prospects: ${draftClass.prospects.length}`);
        console.log(`[DraftClassService] - Year: ${draftClass.header.year}`);

        return {
          success: true,
          data: draftClass
        };

      } else {
        throw new Error('Unknown draft class format - not a valid Madden 25 or 26 file');
      }

    } catch (error: any) {
      console.error('[DraftClassService] Error loading draft class:', error);
      throw new Error(`Failed to load draft class: ${error.message}`);
    }
  }

  /**
   * Save modified draft class data
   * NOTE: Currently read-only - writing not yet implemented in parser
   * @param filePath - Path to save the draft class file
   * @param prospects - Array of prospect data
   * @returns Success status
   */
  async saveDraftClass(filePath: string, draftClassData: any): Promise<boolean> {
    try {
      console.log('[DraftClassService] Save operation requested for:', filePath);
      console.log('[DraftClassService] Prospect count:', draftClassData.prospects.length);

      // Use madden-draft-class-tools to write M25 files
      const buffer = writeM25(draftClassData);
      fs.writeFileSync(filePath, buffer);

      console.log('[DraftClassService] Successfully saved draft class');

      return true;

    } catch (error: any) {
      console.error('[DraftClassService] Error saving draft class:', error);
      throw new Error(`Failed to save draft class: ${error.message}`);
    }
  }

  /**
   * Export draft class to JSON for backup/analysis
   * @param filePath - Path to the draft class file
   * @param outputPath - Path for JSON output
   * @returns Success status
   */
  async exportToJSON(filePath: string, outputPath: string): Promise<boolean> {
    try {
      console.log('[DraftClassService] Exporting draft class to JSON');
      console.log(`[DraftClassService] - Source: ${filePath}`);
      console.log(`[DraftClassService] - Output: ${outputPath}`);

      // Load draft class and export to JSON
      const result = await this.loadDraftClass(filePath);
      fs.writeFileSync(outputPath, JSON.stringify(result.data, null, 2), 'utf8');

      console.log('[DraftClassService] Successfully exported to JSON');

      return true;

    } catch (error: any) {
      console.error('[DraftClassService] Error exporting to JSON:', error);
      throw new Error(`Failed to export to JSON: ${error.message}`);
    }
  }

  /**
   * Validate draft class file format
   * @param filePath - Path to the draft class file
   * @returns Validation result with format details
   */
  async validateDraftClass(filePath: string): Promise<any> {
    try {
      console.log('[DraftClassService] Validating draft class:', filePath);

      const buffer = fs.readFileSync(filePath);
      const signature = buffer.toString('ascii', 0, 8);

      if (signature !== 'FBCHUNKS') {
        return {
          valid: false,
          error: `Invalid signature: "${signature}" (expected "FBCHUNKS")`
        };
      }

      const version = detectMaddenVersion(filePath);

      console.log('[DraftClassService] Validation passed');
      console.log(`[DraftClassService] - Signature: ${signature}`);
      console.log(`[DraftClassService] - Version: ${version}`);

      return {
        valid: true,
        signature,
        version,
        fileSize: buffer.length
      };

    } catch (error: any) {
      console.error('[DraftClassService] Error validating draft class:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get draft class file metadata
   * @param filePath - Path to the draft class file
   * @returns File information (player count, game version, year, etc.)
   */
  async getDraftClassInfo(filePath: string): Promise<any> {
    try {
      console.log('[DraftClassService] Getting draft class info:', filePath);

      const version = detectMaddenVersion(filePath);
      const result = await this.loadDraftClass(filePath);

      const info = {
        valid: true,
        prospectCount: result.data.prospects.length,
        version,
        fileSize: fs.statSync(filePath).size
      };

      console.log('[DraftClassService] Retrieved file info successfully');
      console.log(`[DraftClassService] - Prospects: ${info.prospectCount}`);
      console.log(`[DraftClassService] - Version: ${info.version}`);

      return info;

    } catch (error: any) {
      console.error('[DraftClassService] Error getting draft class info:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

}

// Export singleton instance
export const draftClassService = new DraftClassService();
