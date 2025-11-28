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
function detectMaddenVersion(buffer: Buffer): 'M25' | 'M26' | 'unknown' {
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

      // Read file once and reuse the buffer
      const buffer = fs.readFileSync(filePath);

      // Detect game version using the buffer
      const version = detectMaddenVersion(buffer);
      console.log(`[DraftClassService] Detected version: ${version}`);

      let draftClass: any;

      if (version === 'M25') {
        // Use madden-draft-class-tools for M25 (already have buffer)
        draftClass = readM25(buffer);

        // Map M25 field names to M26 field names for consistency
        // M25 uses portraitId, M26 uses PID
        // M25 stores player-specific PEPS in assetName field (e.g., "ZappeBailey_22049")
        // Falls back to genericHeadName if assetName not present
        draftClass.prospects = draftClass.prospects.map((prospect: any, index: number) => {
          const pid = prospect.portraitId || 0;
          const peps = prospect.assetName ||
                       (prospect.visuals && prospect.visuals.genericHeadName) ||
                       null;

          if (index === 0) {
            console.log('[DraftClassService] First prospect mapping:');
            console.log('  portraitId:', prospect.portraitId);
            console.log('  PID:', pid);
            console.log('  assetName:', prospect.assetName);
            console.log('  visuals.genericHeadName:', prospect.visuals?.genericHeadName);
            console.log('  PEPS:', peps);
          }

          return {
            ...prospect,
            PID: pid,
            PEPS: peps
          };
        });

        console.log('[DraftClassService] Successfully loaded M25 draft class');
        console.log(`[DraftClassService] - Prospects: ${draftClass.prospects.length}`);
        console.log(`[DraftClassService] - Year: ${draftClass.header.gameYear}`);
        console.log(`[DraftClassService] - File Name: ${draftClass.header.fileName}`);
        console.log(`[DraftClassService] - First prospect PID: ${draftClass.prospects[0].PID}`);
        console.log(`[DraftClassService] - First prospect PEPS: ${draftClass.prospects[0].PEPS}`);

        // Store original buffer and version for saving
        draftClass._originalBuffer = buffer;
        draftClass._version = 'M25';

        return {
          success: true,
          data: draftClass
        };

      } else if (version === 'M26') {
        // M26 uses custom parser with dynamic block scanning
        const path = require('path');
        const m26ParserPath = path.join(__dirname, 'lib', 'draft-class', 'M26Parser');
        const { parseM26Prospects } = require(m26ParserPath);

        // Parse header first (same structure, different offset - already have buffer)
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
          prospects,
          _originalBuffer: buffer, // Store for writing back
          _version: 'M26' // Store version for save operation
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
   * @param filePath - Path to save the draft class file
   * @param draftClassData - Draft class data with modified prospects
   * @returns Success status
   */
  async saveDraftClass(filePath: string, draftClassData: any): Promise<boolean> {
    try {
      console.log('[DraftClassService] Save operation requested for:', filePath);
      console.log('[DraftClassService] Prospect count:', draftClassData.prospects.length);

      const version = draftClassData._version || 'M25';
      console.log(`[DraftClassService] Saving as: ${version}`);

      let buffer: Buffer;

      if (version === 'M26') {
        // Use M26 writer
        const path = require('path');
        const m26WriterPath = path.join(__dirname, 'lib', 'draft-class', 'M26Writer');
        const { writeM26DraftClass } = require(m26WriterPath);

        if (!draftClassData._originalBuffer) {
          throw new Error('Cannot save M26 file - original buffer not found');
        }

        // CRITICAL FIX: Ensure _originalBuffer is a proper Buffer
        // When passed through IPC, Buffer objects get serialized as objects with numeric keys
        // Convert back to Buffer if necessary
        let originalBuffer = draftClassData._originalBuffer;
        if (!(originalBuffer instanceof Buffer)) {
          console.log('[DraftClassService] Converting serialized buffer back to Buffer');
          console.log('[DraftClassService]   Original type:', typeof originalBuffer);
          console.log('[DraftClassService]   Is array:', Array.isArray(originalBuffer));
          console.log('[DraftClassService]   Has data property:', originalBuffer?.data !== undefined);
          console.log('[DraftClassService]   Has type property:', originalBuffer?.type);

          if (originalBuffer?.type === 'Buffer' && Array.isArray(originalBuffer?.data)) {
            // Node.js Buffer serialized format: { type: 'Buffer', data: [...] }
            originalBuffer = Buffer.from(originalBuffer.data);
            console.log('[DraftClassService]   Converted from {type:Buffer,data:[]} format');
          } else if (Array.isArray(originalBuffer)) {
            // Plain array of bytes
            originalBuffer = Buffer.from(originalBuffer);
            console.log('[DraftClassService]   Converted from array format');
          } else if (typeof originalBuffer === 'object') {
            // Object with numeric keys (Electron IPC serialization)
            const values = Object.values(originalBuffer);
            originalBuffer = Buffer.from(values as number[]);
            console.log('[DraftClassService]   Converted from object-with-numeric-keys format');
          }
          console.log('[DraftClassService]   Final buffer length:', originalBuffer?.length);
        }

        // Ensure header has dataStartOffset (required by M26Writer)
        const header = draftClassData.header;
        if (header.dataStartOffset === undefined) {
          console.warn('[DraftClassService] header.dataStartOffset is missing! Setting to 0x46');
          header.dataStartOffset = 0x46; // M26 default
        }

        console.log('[DraftClassService] Writing M26 draft class:');
        console.log('[DraftClassService]   Buffer length:', originalBuffer?.length);
        console.log('[DraftClassService]   Prospects count:', draftClassData.prospects?.length);
        console.log('[DraftClassService]   header.dataStartOffset:', header.dataStartOffset);
        console.log('[DraftClassService]   First prospect:', draftClassData.prospects?.[0]?.firstName, draftClassData.prospects?.[0]?.lastName);

        buffer = writeM26DraftClass(
          originalBuffer,
          draftClassData.prospects,
          header
        );

      } else {
        // Use madden-draft-class-tools to write M25 files
        buffer = writeM25(draftClassData);
      }

      // Use atomic write: write to temp file, then rename
      // This prevents corruption if write fails and handles locked files better
      const tempPath = `${filePath}.tmp`;

      try {
        // Write to temp file first
        fs.writeFileSync(tempPath, buffer);

        // Delete original file if it exists (handle locked file case)
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (unlinkError: any) {
            // If we can't delete, try to force close handles (Windows)
            if (unlinkError.code === 'EPERM' || unlinkError.code === 'EBUSY') {
              console.warn('[DraftClassService] File is locked, attempting to overwrite directly');
              // Try direct overwrite as fallback
              fs.writeFileSync(filePath, buffer);
              // Clean up temp file
              try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
              console.log('[DraftClassService] Successfully saved draft class (direct overwrite)');
              return true;
            }
            throw unlinkError;
          }
        }

        // Rename temp to final
        fs.renameSync(tempPath, filePath);
        console.log('[DraftClassService] Successfully saved draft class');
        return true;

      } catch (writeError: any) {
        // Clean up temp file if it exists
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw writeError;
      }

    } catch (error: any) {
      console.error('[DraftClassService] Error saving draft class:', error);

      // Provide specific error messages for common issues
      if (error.code === 'EPERM') {
        throw new Error(
          `Permission denied when saving file. Possible causes:\n` +
          `• The file is open in another program (close it and try again)\n` +
          `• The directory is read-only\n` +
          `• Antivirus is blocking the file\n` +
          `• You don't have write permissions for this location\n\n` +
          `File: ${filePath}`
        );
      } else if (error.code === 'EBUSY') {
        throw new Error(
          `File is locked by another process. Close any programs that have this file open and try again.\n\n` +
          `File: ${filePath}`
        );
      } else if (error.code === 'ENOENT') {
        throw new Error(
          `Directory does not exist. Create the folder first.\n\n` +
          `Path: ${path.dirname(filePath)}`
        );
      }

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

  /**
   * Convert M25 draft class to M26 format
   * @param inputPath - Path to M25 draft class file
   * @param outputPath - Path for M26 output file
   * @param templatePath - Path to M26 template file
   * @returns Conversion result
   */
  async convertM25toM26(inputPath: string, outputPath: string, templatePath: string): Promise<any> {
    try {
      console.log('[DraftClassService] Converting M25 to M26:', inputPath);
      console.log('[DraftClassService] Using template:', templatePath);

      // Import converter using absolute path
      const path = require('path');
      const converterPath = path.join(__dirname, 'lib', 'draft-class', 'M25toM26Converter');
      const { convertM25toM26 } = require(converterPath);

      // Run conversion with template
      const result = convertM25toM26(inputPath, outputPath, templatePath);

      if (result.success) {
        console.log('[DraftClassService] Conversion successful');
        console.log(`  Prospects: ${result.prospectCount}`);
        console.log(`  Input size: ${result.inputSize} bytes`);
        console.log(`  Output size: ${result.outputSize} bytes`);
      }

      return result;

    } catch (error: any) {
      console.error('[DraftClassService] Error converting M25 to M26:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

}

// Export singleton instance
export const draftClassService = new DraftClassService();
