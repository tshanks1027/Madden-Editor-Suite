/**
 * FrostyExportService
 *
 * Generates FMT-importable files for throwback mods:
 * - Player portrait DDS files
 * - Portrait registration .bin files
 * - Player item XML files
 * - PAM/face assignment mappings
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Template paths (relative to PAM folder)
const TEMPLATE_BASE = 'C:\\Users\\tshan\\Downloads\\PAM\\DartTest';
const PORTRAIT_BIN_TEMPLATE = 'plpo_aaituiisaako_assetlibrary_playerportraits_brt.bin';
const PORTRAIT_BLUEPRINT_TEMPLATE = 'plpo_aaituiisaako_assetlibrary_playerportraits_brt_blueprint.bin';
const PLAYER_ITEM_TEMPLATE = 'DartJaxson_14796_item.xml';

// Template name that needs to be replaced (must be exactly 12 chars)
const TEMPLATE_PORTRAIT_NAME = 'aaituiisaako';
const TEMPLATE_PLAYER_NAME = 'DartJaxson';
const TEMPLATE_PID = '14796';

// Skin tone mapping based on race
// Race codes from CSV: 1=White, 5=Hispanic, 7=Black
// SkinToneBaseValue in game: 1=Light, 2=Dark (approximate)
const RACE_TO_SKIN_TONE: Record<number, number> = {
  1: 1,  // White -> Light skin tone
  5: 2,  // Hispanic -> can vary, default to 2
  7: 2,  // Black -> Dark skin tone
};

// Generic face category mapping
// gen_1 = Category 1, gen_4 = Category 4, gen_7 = Category 7, etc.
// These correspond to PAM categories in the game
const RACE_TO_GENERIC_PREFIX: Record<number, string> = {
  1: 'gen_3',  // White -> Category 3 (Caucasian)
  5: 'gen_4',  // Hispanic -> Category 4
  7: 'gen_2',  // Black -> Category 2 (African American)
};

interface PlayerExportData {
  firstName: string;
  lastName: string;
  pid: string;
  race?: number;
  team?: string;
}

interface ExportResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  filesCreated?: string[];
}

class FrostyExportService {
  private templatePath: string;

  constructor() {
    this.templatePath = TEMPLATE_BASE;
  }

  /**
   * Generate a portrait name that is exactly 12 characters
   * Format: LastNameFirst padded/truncated to 12 chars
   */
  private generatePortraitName(firstName: string, lastName: string): string {
    const combined = (lastName + firstName).toLowerCase().replace(/[^a-z]/g, '');
    if (combined.length === 12) {
      return combined;
    } else if (combined.length < 12) {
      // Pad with 'x' characters
      return combined + 'x'.repeat(12 - combined.length);
    } else {
      // Truncate
      return combined.substring(0, 12);
    }
  }

  /**
   * Replace all occurrences in a buffer (for binary files)
   */
  private replaceInBuffer(buffer: Buffer, search: string, replace: string): Buffer {
    const searchBuf = Buffer.from(search, 'utf8');
    const replaceBuf = Buffer.from(replace, 'utf8');

    if (searchBuf.length !== replaceBuf.length) {
      throw new Error(`Length mismatch: "${search}" (${searchBuf.length}) vs "${replace}" (${replaceBuf.length})`);
    }

    const result = Buffer.from(buffer);
    let index = 0;

    while ((index = result.indexOf(searchBuf, index)) !== -1) {
      replaceBuf.copy(result, index);
      index += searchBuf.length;
    }

    return result;
  }

  /**
   * Generate portrait registration .bin files for a player
   */
  async generatePortraitRegistration(
    player: PlayerExportData,
    outputDir: string
  ): Promise<ExportResult> {
    try {
      const portraitName = this.generatePortraitName(player.firstName, player.lastName);
      const filesCreated: string[] = [];

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Process .bin template
      const binTemplatePath = path.join(this.templatePath, PORTRAIT_BIN_TEMPLATE);
      if (fs.existsSync(binTemplatePath)) {
        const binBuffer = fs.readFileSync(binTemplatePath);
        const patchedBin = this.replaceInBuffer(binBuffer, TEMPLATE_PORTRAIT_NAME, portraitName);
        const binOutputName = `plpo_${portraitName}_assetlibrary_playerportraits_brt.bin`;
        const binOutputPath = path.join(outputDir, binOutputName);
        fs.writeFileSync(binOutputPath, patchedBin);
        filesCreated.push(binOutputName);
      }

      // Process _blueprint.bin template
      const blueprintTemplatePath = path.join(this.templatePath, PORTRAIT_BLUEPRINT_TEMPLATE);
      if (fs.existsSync(blueprintTemplatePath)) {
        const blueprintBuffer = fs.readFileSync(blueprintTemplatePath);
        const patchedBlueprint = this.replaceInBuffer(blueprintBuffer, TEMPLATE_PORTRAIT_NAME, portraitName);
        const blueprintOutputName = `plpo_${portraitName}_assetlibrary_playerportraits_brt_blueprint.bin`;
        const blueprintOutputPath = path.join(outputDir, blueprintOutputName);
        fs.writeFileSync(blueprintOutputPath, patchedBlueprint);
        filesCreated.push(blueprintOutputName);
      }

      return {
        success: true,
        outputPath: outputDir,
        filesCreated,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate a unique GUID
   */
  private generateGuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Generate a unique ItemDataId (8-9 digit number)
   */
  private generateItemDataId(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  /**
   * Generate player item XML file
   */
  async generatePlayerItem(
    player: PlayerExportData,
    outputDir: string
  ): Promise<ExportResult> {
    try {
      const filesCreated: string[] = [];
      const namePid = `${player.lastName}${player.firstName}_${player.pid}`;
      const namePidLower = namePid.toLowerCase();
      const folderLetter = player.lastName.charAt(0).toLowerCase();

      // Read template
      const templatePath = path.join(this.templatePath, PLAYER_ITEM_TEMPLATE);
      if (!fs.existsSync(templatePath)) {
        return { success: false, error: 'Template not found: ' + templatePath };
      }

      let content = fs.readFileSync(templatePath, 'utf8');

      // Replace name_pid patterns
      content = content.split(`${TEMPLATE_PLAYER_NAME}_${TEMPLATE_PID}`).join(namePid);
      content = content.split(`${TEMPLATE_PLAYER_NAME.toLowerCase()}_${TEMPLATE_PID}`).join(namePidLower);

      // Replace display name
      const displayName = `${player.firstName} ${player.lastName}`;
      content = content.split('Jaxon Dart').join(displayName);
      content = content.split('Jaxson Dart').join(displayName);

      // Replace folder letter in paths
      content = content.split('/d/').join(`/${folderLetter}/`);
      content = content.split('\\d\\').join(`\\${folderLetter}\\`);

      // Replace GUIDs to avoid conflicts
      content = content.replace(/Guid="[a-f0-9-]{36}"/gi, () => `Guid="${this.generateGuid()}"`);

      // Replace ItemDataId
      content = content.replace(/<Id>63867299<\/Id>/, `<Id>${this.generateItemDataId()}</Id>`);

      // Update SkinToneBaseValue based on race
      if (player.race !== undefined) {
        const skinTone = RACE_TO_SKIN_TONE[player.race] || 1;
        content = content.replace(/<SkinToneBaseValue>\d+<\/SkinToneBaseValue>/,
          `<SkinToneBaseValue>${skinTone}</SkinToneBaseValue>`);
      }

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Write output
      const outputFileName = `${namePid}_item.xml`;
      const outputPath = path.join(outputDir, outputFileName);
      fs.writeFileSync(outputPath, content, 'utf8');
      filesCreated.push(outputFileName);

      return {
        success: true,
        outputPath: outputDir,
        filesCreated,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate PAM assignment for a player based on race
   */
  getGenericFacePrefix(race: number): string {
    return RACE_TO_GENERIC_PREFIX[race] || 'gen_3';
  }

  /**
   * Export a single player for FMT import
   */
  async exportPlayer(
    player: PlayerExportData,
    outputDir: string
  ): Promise<ExportResult> {
    const results: ExportResult[] = [];
    const allFilesCreated: string[] = [];

    // Generate portrait registration files
    const registrationDir = path.join(outputDir, 'registration');
    const regResult = await this.generatePortraitRegistration(player, registrationDir);
    results.push(regResult);
    if (regResult.filesCreated) {
      allFilesCreated.push(...regResult.filesCreated.map(f => `registration/${f}`));
    }

    // Generate player item XML
    const itemsDir = path.join(outputDir, 'items');
    const itemResult = await this.generatePlayerItem(player, itemsDir);
    results.push(itemResult);
    if (itemResult.filesCreated) {
      allFilesCreated.push(...itemResult.filesCreated.map(f => `items/${f}`));
    }

    // Check for any failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      return {
        success: false,
        error: failures.map(f => f.error).join('; '),
      };
    }

    return {
      success: true,
      outputPath: outputDir,
      filesCreated: allFilesCreated,
    };
  }

  /**
   * Export multiple players for FMT import (batch mode)
   */
  async exportBatch(
    players: PlayerExportData[],
    outputDir: string,
    progressCallback?: (current: number, total: number, playerName: string) => void
  ): Promise<{
    success: boolean;
    totalPlayers: number;
    successCount: number;
    failureCount: number;
    errors: string[];
    outputPath: string;
  }> {
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerName = `${player.firstName} ${player.lastName}`;

      if (progressCallback) {
        progressCallback(i + 1, players.length, playerName);
      }

      const result = await this.exportPlayer(player, outputDir);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        errors.push(`${playerName}: ${result.error}`);
      }
    }

    // Generate PAM assignments file
    const pamAssignments: Record<string, { genericFace: string; skinTone: number }> = {};
    for (const player of players) {
      const key = player.pid;
      const race = player.race || 1;
      pamAssignments[key] = {
        genericFace: this.getGenericFacePrefix(race),
        skinTone: RACE_TO_SKIN_TONE[race] || 1,
      };
    }

    const pamPath = path.join(outputDir, 'pam_assignments.json');
    fs.writeFileSync(pamPath, JSON.stringify(pamAssignments, null, 2));

    // Generate instructions file
    const instructions = `
FMT Import Instructions
=======================

This folder contains FMT-importable files for ${players.length} players.

Contents:
- registration/ - Portrait registration .bin files
- items/ - Player item XML files
- pam_assignments.json - PAM/face assignment mappings

Import Steps:
1. Open FMT with Madden 26
2. Import the registration/*.bin files as asset library entries
3. Import the items/*.xml files as character items
4. Use pam_assignments.json to set correct face assignments

Generated: ${new Date().toISOString()}
`;
    fs.writeFileSync(path.join(outputDir, 'IMPORT_INSTRUCTIONS.txt'), instructions);

    return {
      success: failureCount === 0,
      totalPlayers: players.length,
      successCount,
      failureCount,
      errors,
      outputPath: outputDir,
    };
  }
}

export const frostyExportService = new FrostyExportService();
export default FrostyExportService;
