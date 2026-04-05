/**
 * CustomCoachPortraitService
 *
 * Handles importing, storing, and exporting custom coach portraits.
 * - Import: Accept PNG/JPG images, resize to 512x512
 * - Store: Save as PNG blobs in database with PID (50000+)
 * - Display: Return base64 data URLs for UI preview
 * - Export: Convert to DDS (DXT5/BC3) format for Madden mods
 */

import * as fs from 'fs';
import * as path from 'path';

import sharp from 'sharp';

import { userDatabaseService, CustomCoachPortrait } from './UserDatabaseService';

interface ImportResult {
  success: boolean;
  pid?: number;
  error?: string;
}

interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface BatchExportResult {
  success: boolean;
  exported: number;
  failed: number;
  errors: string[];
}

class CustomCoachPortraitService {
  private initialized = false;

  async initialize(): Promise<void> {
    await userDatabaseService.waitForReady();
    this.initialized = true;
    console.log('[CustomCoachPortraitService] Initialized');
  }

  /**
   * Import an image file, resize to 512x512, and save to database
   */
  async importPortrait(
    filePath: string,
    metadata?: { coachName?: string; year?: number }
  ): Promise<ImportResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Read and process image
      const imageBuffer = await this.processImage(filePath);

      // Get next available PID (50000+)
      const pid = userDatabaseService.getNextAvailableCoachPid();

      // Save to database
      userDatabaseService.saveCustomCoachPortrait(pid, imageBuffer, {
        originalFilename: path.basename(filePath),
        coachName: metadata?.coachName,
        year: metadata?.year
      });

      console.log(`[CustomCoachPortraitService] Imported portrait: ${filePath} -> PID ${pid}`);

      return { success: true, pid };
    } catch (error) {
      console.error('[CustomCoachPortraitService] Import failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Process an image file: read, resize to 512x512, convert to PNG
   */
  private async processImage(filePath: string): Promise<Buffer> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.dds') {
      throw new Error('DDS import requires raw pixel data conversion - please use PNG/JPG');
    }

    // Standard image formats (PNG, JPG, etc.)
    return sharp(filePath)
      .resize(512, 512, { fit: 'cover' })
      .png()
      .toBuffer();
  }

  /**
   * Get portrait image data as base64 data URL for display
   */
  async getPortraitDataUrl(pid: number): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const portrait = userDatabaseService.getCustomCoachPortrait(pid);
    if (!portrait) {
      return null;
    }

    const base64 = portrait.imageData.toString('base64');
    return `data:image/png;base64,${base64}`;
  }

  /**
   * Get portrait PNG buffer
   */
  getPortraitBuffer(pid: number): Buffer | null {
    const portrait = userDatabaseService.getCustomCoachPortrait(pid);
    return portrait?.imageData ?? null;
  }

  /**
   * Get all custom coach portraits (metadata only)
   */
  getAllPortraits(): Omit<CustomCoachPortrait, 'imageData'>[] {
    return userDatabaseService.getAllCustomCoachPortraits();
  }

  /**
   * Get portraits by year
   */
  getPortraitsByYear(year: number): Omit<CustomCoachPortrait, 'imageData'>[] {
    return userDatabaseService.getCustomCoachPortraitsByYear(year);
  }

  /**
   * Delete a portrait
   */
  deletePortrait(pid: number): void {
    userDatabaseService.deleteCustomCoachPortrait(pid);
  }

  /**
   * Update portrait metadata
   */
  updateMetadata(pid: number, metadata: { coachName?: string; databaseCoachId?: number; year?: number }): void {
    userDatabaseService.updateCustomCoachPortraitMetadata(pid, metadata);
  }

  /**
   * Get next available PID
   */
  getNextPid(): number {
    return userDatabaseService.getNextAvailableCoachPid();
  }

  /**
   * Check if portrait exists
   */
  hasPortrait(pid: number): boolean {
    return userDatabaseService.hasCustomCoachPortrait(pid);
  }

  /**
   * Get portrait count
   */
  getPortraitCount(): number {
    return userDatabaseService.getCustomCoachPortraitCount();
  }

  /**
   * Get portrait by coach ID
   */
  getPortraitByCoachId(coachId: number): number | null {
    return userDatabaseService.getCustomCoachPortraitByCoachId(coachId);
  }

  /**
   * Get available years
   */
  getAvailableYears(): number[] {
    return userDatabaseService.getCustomCoachPortraitYears();
  }

  /**
   * Export a portrait as DDS file
   */
  async exportAsDds(pid: number, outputDir: string): Promise<ExportResult> {
    try {
      const pngBuffer = this.getPortraitBuffer(pid);
      if (!pngBuffer) {
        return { success: false, error: `Portrait not found: PID ${pid}` };
      }

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Get raw RGBA pixels from PNG
      const { data: rgbaData, info } = await sharp(pngBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Compress to DXT5
      const dxt5Data = this.compressToDxt5(rgbaData, info.width, info.height);

      // Build DDS file
      const ddsBuffer = this.buildDdsFile(dxt5Data, info.width, info.height);

      // Write file - just the PID number to match in-game format
      const filename = `${pid}.dds`;
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, ddsBuffer);

      console.log(`[CustomCoachPortraitService] Exported: ${filePath}`);
      return { success: true, filePath };
    } catch (error) {
      console.error('[CustomCoachPortraitService] Export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Export multiple portraits as DDS files
   */
  async exportBatch(pids: number[], outputDir: string): Promise<BatchExportResult> {
    const result: BatchExportResult = {
      success: true,
      exported: 0,
      failed: 0,
      errors: []
    };

    for (const pid of pids) {
      const exportResult = await this.exportAsDds(pid, outputDir);
      if (exportResult.success) {
        result.exported++;
      } else {
        result.failed++;
        result.errors.push(exportResult.error || `Failed to export PID ${pid}`);
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Export all portraits for a specific year
   */
  async exportByYear(year: number, outputDir: string): Promise<BatchExportResult> {
    const portraits = this.getPortraitsByYear(year);
    const pids = portraits.map(p => p.pid);
    return this.exportBatch(pids, outputDir);
  }

  /**
   * Compress RGBA data to DXT5 format (BC3)
   */
  private compressToDxt5(rgbaData: Buffer, width: number, height: number): Buffer {
    const blocksX = Math.ceil(width / 4);
    const blocksY = Math.ceil(height / 4);
    const outputSize = blocksX * blocksY * 16;
    const output = Buffer.alloc(outputSize);

    let outPos = 0;

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const block: number[][] = [];
        for (let py = 0; py < 4; py++) {
          for (let px = 0; px < 4; px++) {
            const x = bx * 4 + px;
            const y = by * 4 + py;
            const idx = (y * width + x) * 4;

            if (x < width && y < height) {
              block.push([
                rgbaData[idx],
                rgbaData[idx + 1],
                rgbaData[idx + 2],
                rgbaData[idx + 3]
              ]);
            } else {
              block.push([0, 0, 0, 255]);
            }
          }
        }

        const alphaBlock = this.compressDxt5Alpha(block);
        alphaBlock.copy(output, outPos);
        outPos += 8;

        const colorBlock = this.compressDxt1Color(block);
        colorBlock.copy(output, outPos);
        outPos += 8;
      }
    }

    return output;
  }

  private compressDxt5Alpha(block: number[][]): Buffer {
    const result = Buffer.alloc(8);

    let minAlpha = 255;
    let maxAlpha = 0;
    for (const pixel of block) {
      minAlpha = Math.min(minAlpha, pixel[3]);
      maxAlpha = Math.max(maxAlpha, pixel[3]);
    }

    result[0] = maxAlpha;
    result[1] = minAlpha;

    let indices = 0n;
    for (let i = 0; i < 16; i++) {
      const alpha = block[i][3];
      let idx = 0;

      if (maxAlpha !== minAlpha) {
        if (alpha >= maxAlpha) {
          idx = 0;
        } else if (alpha <= minAlpha) {
          idx = 1;
        } else {
          const range = maxAlpha - minAlpha;
          const normalized = (alpha - minAlpha) / range;
          idx = Math.round(normalized * 6) + 1;
          if (idx > 7) idx = 7;
        }
      }

      indices |= BigInt(idx) << BigInt(i * 3);
    }

    for (let i = 0; i < 6; i++) {
      result[2 + i] = Number((indices >> BigInt(i * 8)) & 0xffn);
    }

    return result;
  }

  private compressDxt1Color(block: number[][]): Buffer {
    const result = Buffer.alloc(8);

    let minR = 255, minG = 255, minB = 255;
    let maxR = 0, maxG = 0, maxB = 0;

    for (const pixel of block) {
      minR = Math.min(minR, pixel[0]);
      minG = Math.min(minG, pixel[1]);
      minB = Math.min(minB, pixel[2]);
      maxR = Math.max(maxR, pixel[0]);
      maxG = Math.max(maxG, pixel[1]);
      maxB = Math.max(maxB, pixel[2]);
    }

    const color0 = this.rgb888to565(maxR, maxG, maxB);
    const color1 = this.rgb888to565(minR, minG, minB);

    result.writeUInt16LE(color0, 0);
    result.writeUInt16LE(color1, 2);

    let indices = 0;
    for (let i = 0; i < 16; i++) {
      const [r, g, b] = block[i];
      let idx = 0;

      if (color0 !== color1) {
        const d0 = Math.abs(r - maxR) + Math.abs(g - maxG) + Math.abs(b - maxB);
        const d1 = Math.abs(r - minR) + Math.abs(g - minG) + Math.abs(b - minB);

        const mid1R = (2 * maxR + minR) / 3;
        const mid1G = (2 * maxG + minG) / 3;
        const mid1B = (2 * maxB + minB) / 3;
        const d2 = Math.abs(r - mid1R) + Math.abs(g - mid1G) + Math.abs(b - mid1B);

        const mid2R = (maxR + 2 * minR) / 3;
        const mid2G = (maxG + 2 * minG) / 3;
        const mid2B = (maxB + 2 * minB) / 3;
        const d3 = Math.abs(r - mid2R) + Math.abs(g - mid2G) + Math.abs(b - mid2B);

        const minDist = Math.min(d0, d1, d2, d3);
        if (minDist === d0) idx = 0;
        else if (minDist === d1) idx = 1;
        else if (minDist === d2) idx = 2;
        else idx = 3;
      }

      indices |= idx << (i * 2);
    }

    // Use >>> 0 to convert to unsigned 32-bit integer (JS bitwise ops use signed 32-bit)
    result.writeUInt32LE(indices >>> 0, 4);
    return result;
  }

  private rgb888to565(r: number, g: number, b: number): number {
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  }

  private buildDdsFile(dxt5Data: Buffer, width: number, height: number): Buffer {
    const headerSize = 128;
    const header = Buffer.alloc(headerSize);

    header.write('DDS ', 0, 4, 'ascii');
    header.writeUInt32LE(124, 4);
    header.writeUInt32LE(0x000A1007, 8);
    header.writeUInt32LE(height, 12);
    header.writeUInt32LE(width, 16);
    header.writeUInt32LE(dxt5Data.length, 20);
    header.writeUInt32LE(0, 24);
    header.writeUInt32LE(1, 28);

    header.writeUInt32LE(32, 76);
    header.writeUInt32LE(0x4, 80);
    header.write('DXT5', 84, 4, 'ascii');

    header.writeUInt32LE(0x1000, 108);

    return Buffer.concat([header, dxt5Data]);
  }
}

export const customCoachPortraitService = new CustomCoachPortraitService();
