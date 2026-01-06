/**
 * CustomPortraitService
 *
 * Handles importing, storing, and exporting custom player portraits.
 * - Import: Accept PNG/JPG/DDS images, resize to 512x512
 * - Store: Save as PNG blobs in database with PID (12000+)
 * - Display: Return base64 data URLs for UI preview
 * - Export: Convert to DDS (DXT5/BC3) format for Madden mods
 */

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { userDatabaseService, CustomPortrait } from './UserDatabaseService';

// DDS file format constants
const DDS_MAGIC = 0x20534444; // "DDS "
const DDSD_CAPS = 0x1;
const DDSD_HEIGHT = 0x2;
const DDSD_WIDTH = 0x4;
const DDSD_PIXELFORMAT = 0x1000;
const DDSD_LINEARSIZE = 0x80000;
const DDPF_FOURCC = 0x4;
const DDSCAPS_TEXTURE = 0x1000;

// DXT5 FourCC code
const FOURCC_DXT5 = 0x35545844; // "DXT5"

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

class CustomPortraitService {
  private initialized = false;

  async initialize(): Promise<void> {
    await userDatabaseService.waitForReady();
    this.initialized = true;
    console.log('[CustomPortraitService] Initialized');
  }

  /**
   * Import an image file, resize to 512x512, and save to database
   */
  async importPortrait(
    filePath: string,
    metadata?: { playerName?: string; year?: number }
  ): Promise<ImportResult> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Read and process image
      const imageBuffer = await this.processImage(filePath);

      // Get next available PID
      const pid = userDatabaseService.getNextAvailablePid();

      // Save to database
      userDatabaseService.saveCustomPortrait(pid, imageBuffer, {
        originalFilename: path.basename(filePath),
        playerName: metadata?.playerName,
        year: metadata?.year
      });

      console.log(`[CustomPortraitService] Imported portrait: ${filePath} -> PID ${pid}`);

      return { success: true, pid };
    } catch (error) {
      console.error('[CustomPortraitService] Import failed:', error);
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
      // For DDS files, we need to decode them first
      // For now, try to read with sharp (may not work for all DDS formats)
      // In production, you might need a DDS decoder library
      try {
        return await sharp(filePath)
          .resize(512, 512, { fit: 'cover' })
          .png()
          .toBuffer();
      } catch {
        // If sharp can't read DDS, read raw and try alternative approach
        throw new Error('DDS import requires raw pixel data conversion - please use PNG/JPG');
      }
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

    const portrait = userDatabaseService.getCustomPortrait(pid);
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
    const portrait = userDatabaseService.getCustomPortrait(pid);
    return portrait?.imageData ?? null;
  }

  /**
   * Get all custom portraits (metadata only)
   */
  getAllPortraits(): Omit<CustomPortrait, 'imageData'>[] {
    return userDatabaseService.getAllCustomPortraits();
  }

  /**
   * Get portraits by year
   */
  getPortraitsByYear(year: number): Omit<CustomPortrait, 'imageData'>[] {
    return userDatabaseService.getCustomPortraitsByYear(year);
  }

  /**
   * Delete a portrait
   */
  deletePortrait(pid: number): void {
    userDatabaseService.deleteCustomPortrait(pid);
  }

  /**
   * Update portrait metadata
   */
  updateMetadata(pid: number, metadata: { playerName?: string; databasePlayerId?: number; year?: number }): void {
    userDatabaseService.updateCustomPortraitMetadata(pid, metadata);
  }

  /**
   * Get next available PID
   */
  getNextPid(): number {
    return userDatabaseService.getNextAvailablePid();
  }

  /**
   * Check if portrait exists
   */
  hasPortrait(pid: number): boolean {
    return userDatabaseService.hasCustomPortrait(pid);
  }

  /**
   * Get portrait count
   */
  getPortraitCount(): number {
    return userDatabaseService.getCustomPortraitCount();
  }

  /**
   * Get custom portrait PID by database player ID
   * Returns the PID if a custom portrait is assigned to this player, null otherwise
   */
  getPortraitByPlayerId(playerId: number): number | null {
    return userDatabaseService.getCustomPortraitByPlayerId(playerId);
  }

  /**
   * Export a portrait as DDS file (DXT5/BC3 format)
   */
  async exportAsDds(pid: number, outputPath: string): Promise<ExportResult> {
    console.log(`[CustomPortraitService] Exporting PID ${pid} to ${outputPath}`);
    try {
      const portrait = userDatabaseService.getCustomPortrait(pid);
      if (!portrait) {
        console.error(`[CustomPortraitService] Portrait not found: PID ${pid}`);
        return { success: false, error: `Portrait not found: PID ${pid}` };
      }

      console.log(`[CustomPortraitService] Got portrait data, size: ${portrait.imageData?.length || 0} bytes`);

      // Get raw RGBA pixels from PNG
      const { data: rgbaData, info } = await sharp(portrait.imageData)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      console.log(`[CustomPortraitService] Image dimensions: ${info.width}x${info.height}`);

      if (info.width !== 512 || info.height !== 512) {
        console.error(`[CustomPortraitService] Wrong dimensions: ${info.width}x${info.height}, expected 512x512`);
        return { success: false, error: `Portrait must be 512x512, got ${info.width}x${info.height}` };
      }

      // Compress to DXT5
      const dxt5Data = this.compressToDxt5(rgbaData, 512, 512);

      // Build DDS file with header
      const ddsBuffer = this.buildDdsFile(dxt5Data, 512, 512);

      // Write to file
      const filename = `${pid}.dds`;
      const filePath = path.join(outputPath, filename);

      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      fs.writeFileSync(filePath, ddsBuffer);

      console.log(`[CustomPortraitService] Exported DDS: ${filePath}`);

      return { success: true, filePath };
    } catch (error) {
      console.error('[CustomPortraitService] DDS export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Export multiple portraits as DDS files
   */
  async exportBatch(
    pids: number[],
    outputPath: string,
    progressCallback?: (current: number, total: number, pid: number) => void
  ): Promise<{ success: boolean; exported: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let exported = 0;
    let failed = 0;

    for (let i = 0; i < pids.length; i++) {
      const pid = pids[i];

      if (progressCallback) {
        progressCallback(i + 1, pids.length, pid);
      }

      const result = await this.exportAsDds(pid, outputPath);
      if (result.success) {
        exported++;
      } else {
        failed++;
        errors.push(`PID ${pid}: ${result.error}`);
      }
    }

    return { success: failed === 0, exported, failed, errors };
  }

  /**
   * Export all portraits for a specific year
   */
  async exportByYear(year: number, outputPath: string): Promise<{ success: boolean; exported: number; failed: number; errors: string[] }> {
    const portraits = this.getPortraitsByYear(year);
    const pids = portraits.map(p => p.pid);
    return this.exportBatch(pids, outputPath);
  }

  /**
   * Compress RGBA data to DXT5 format
   * This is a simplified implementation - for production, consider using a proper DXT library
   */
  private compressToDxt5(rgbaData: Buffer, width: number, height: number): Buffer {
    // DXT5 compresses 4x4 pixel blocks into 16 bytes each
    // For 512x512: 128x128 blocks = 16384 blocks * 16 bytes = 262144 bytes
    const blocksX = width / 4;
    const blocksY = height / 4;
    const dxtData = Buffer.alloc(blocksX * blocksY * 16);

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const blockOffset = (by * blocksX + bx) * 16;

        // Extract 4x4 block of RGBA pixels
        const block = this.extractBlock(rgbaData, width, bx * 4, by * 4);

        // Compress block to DXT5
        const compressedBlock = this.compressBlockDxt5(block);

        compressedBlock.copy(dxtData, blockOffset);
      }
    }

    return dxtData;
  }

  /**
   * Extract a 4x4 block of RGBA pixels
   */
  private extractBlock(rgbaData: Buffer, width: number, x: number, y: number): Buffer {
    const block = Buffer.alloc(64); // 16 pixels * 4 bytes (RGBA)

    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const srcOffset = ((y + py) * width + (x + px)) * 4;
        const dstOffset = (py * 4 + px) * 4;

        block[dstOffset + 0] = rgbaData[srcOffset + 0]; // R
        block[dstOffset + 1] = rgbaData[srcOffset + 1]; // G
        block[dstOffset + 2] = rgbaData[srcOffset + 2]; // B
        block[dstOffset + 3] = rgbaData[srcOffset + 3]; // A
      }
    }

    return block;
  }

  /**
   * Compress a 4x4 block to DXT5 format (16 bytes)
   * DXT5 layout: 8 bytes alpha + 8 bytes color
   */
  private compressBlockDxt5(block: Buffer): Buffer {
    const output = Buffer.alloc(16);

    // Extract alpha values
    const alphas: number[] = [];
    for (let i = 0; i < 16; i++) {
      alphas.push(block[i * 4 + 3]);
    }

    // Compress alpha (8 bytes)
    this.compressAlphaBlock(alphas, output, 0);

    // Extract RGB values and find color extremes
    const colors: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < 16; i++) {
      colors.push({
        r: block[i * 4 + 0],
        g: block[i * 4 + 1],
        b: block[i * 4 + 2]
      });
    }

    // Compress color (8 bytes)
    this.compressColorBlock(colors, output, 8);

    return output;
  }

  /**
   * Compress alpha values to DXT5 alpha block format
   */
  private compressAlphaBlock(alphas: number[], output: Buffer, offset: number): void {
    // Find min/max alpha
    let minAlpha = 255;
    let maxAlpha = 0;

    for (const a of alphas) {
      minAlpha = Math.min(minAlpha, a);
      maxAlpha = Math.max(maxAlpha, a);
    }

    // Store alpha endpoints
    output[offset + 0] = maxAlpha;
    output[offset + 1] = minAlpha;

    // Generate alpha palette
    const alphaPalette: number[] = [maxAlpha, minAlpha];
    if (maxAlpha > minAlpha) {
      for (let i = 1; i <= 6; i++) {
        alphaPalette.push(Math.round(((7 - i) * maxAlpha + i * minAlpha) / 7));
      }
    } else {
      for (let i = 1; i <= 4; i++) {
        alphaPalette.push(Math.round(((5 - i) * maxAlpha + i * minAlpha) / 5));
      }
      alphaPalette.push(0);
      alphaPalette.push(255);
    }

    // Encode alpha indices (3 bits per pixel, 48 bits total = 6 bytes)
    let indexBits = BigInt(0);
    for (let i = 0; i < 16; i++) {
      let bestIndex = 0;
      let bestDist = 256;

      for (let j = 0; j < 8; j++) {
        const dist = Math.abs(alphas[i] - alphaPalette[j]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = j;
        }
      }

      indexBits |= BigInt(bestIndex) << BigInt(i * 3);
    }

    // Write 6 bytes of alpha indices
    for (let i = 0; i < 6; i++) {
      output[offset + 2 + i] = Number((indexBits >> BigInt(i * 8)) & BigInt(0xFF));
    }
  }

  /**
   * Compress RGB colors to DXT color block format
   */
  private compressColorBlock(colors: { r: number; g: number; b: number }[], output: Buffer, offset: number): void {
    // Find color extremes (simple approach: use min/max luminance)
    let minColor = colors[0];
    let maxColor = colors[0];
    let minLum = this.luminance(minColor);
    let maxLum = this.luminance(maxColor);

    for (const c of colors) {
      const lum = this.luminance(c);
      if (lum < minLum) {
        minLum = lum;
        minColor = c;
      }
      if (lum > maxLum) {
        maxLum = lum;
        maxColor = c;
      }
    }

    // Convert to RGB565
    const color0 = this.rgb888To565(maxColor.r, maxColor.g, maxColor.b);
    const color1 = this.rgb888To565(minColor.r, minColor.g, minColor.b);

    // Ensure color0 > color1 for 4-color mode
    const [c0, c1] = color0 > color1 ? [color0, color1] : [color1, color0];
    const [col0, col1] = color0 > color1 ? [maxColor, minColor] : [minColor, maxColor];

    // Write color endpoints
    output.writeUInt16LE(c0, offset + 0);
    output.writeUInt16LE(c1, offset + 2);

    // Generate color palette
    const palette = [
      col0,
      col1,
      {
        r: Math.round((2 * col0.r + col1.r) / 3),
        g: Math.round((2 * col0.g + col1.g) / 3),
        b: Math.round((2 * col0.b + col1.b) / 3)
      },
      {
        r: Math.round((col0.r + 2 * col1.r) / 3),
        g: Math.round((col0.g + 2 * col1.g) / 3),
        b: Math.round((col0.b + 2 * col1.b) / 3)
      }
    ];

    // Encode color indices (2 bits per pixel, 32 bits total = 4 bytes)
    // Use array to avoid JavaScript's 32-bit signed integer overflow
    const indexBytes = [0, 0, 0, 0];
    for (let i = 0; i < 16; i++) {
      let bestIndex = 0;
      let bestDist = Infinity;

      for (let j = 0; j < 4; j++) {
        const dist = this.colorDistanceSq(colors[i], palette[j]);
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = j;
        }
      }

      // Each pixel gets 2 bits, 4 pixels per byte
      const byteIndex = Math.floor(i / 4);
      const bitOffset = (i % 4) * 2;
      indexBytes[byteIndex] |= bestIndex << bitOffset;
    }

    // Write 4 bytes directly
    output[offset + 4] = indexBytes[0];
    output[offset + 5] = indexBytes[1];
    output[offset + 6] = indexBytes[2];
    output[offset + 7] = indexBytes[3];
  }

  private luminance(c: { r: number; g: number; b: number }): number {
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  }

  private rgb888To565(r: number, g: number, b: number): number {
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  }

  private colorDistanceSq(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
    const dr = a.r - b.r;
    const dg = a.g - b.g;
    const db = a.b - b.b;
    return dr * dr + dg * dg + db * db;
  }

  /**
   * Build a complete DDS file with header
   */
  private buildDdsFile(dxtData: Buffer, width: number, height: number): Buffer {
    const headerSize = 128;
    const ddsFile = Buffer.alloc(headerSize + dxtData.length);

    // DDS magic
    ddsFile.writeUInt32LE(DDS_MAGIC, 0);

    // Header size (always 124)
    ddsFile.writeUInt32LE(124, 4);

    // Flags
    const flags = DDSD_CAPS | DDSD_HEIGHT | DDSD_WIDTH | DDSD_PIXELFORMAT | DDSD_LINEARSIZE;
    ddsFile.writeUInt32LE(flags, 8);

    // Height
    ddsFile.writeUInt32LE(height, 12);

    // Width
    ddsFile.writeUInt32LE(width, 16);

    // Pitch/LinearSize (for DXT5: width * height)
    ddsFile.writeUInt32LE(dxtData.length, 20);

    // Depth (0)
    ddsFile.writeUInt32LE(0, 24);

    // MipMapCount (1)
    ddsFile.writeUInt32LE(1, 28);

    // Reserved (11 DWORDs)
    // Already zero from alloc

    // Pixel format structure at offset 76
    // Size (32)
    ddsFile.writeUInt32LE(32, 76);

    // Flags (DDPF_FOURCC)
    ddsFile.writeUInt32LE(DDPF_FOURCC, 80);

    // FourCC (DXT5)
    ddsFile.writeUInt32LE(FOURCC_DXT5, 84);

    // RGB bit count (0 for compressed)
    ddsFile.writeUInt32LE(0, 88);

    // R/G/B/A masks (0 for compressed)
    // Already zero

    // Caps at offset 108
    ddsFile.writeUInt32LE(DDSCAPS_TEXTURE, 108);

    // Caps2, Caps3, Caps4, Reserved2
    // Already zero

    // Copy compressed data after header
    dxtData.copy(ddsFile, headerSize);

    return ddsFile;
  }

  // Sprite sheet configuration (matches existing portrait-atlas.json format)
  private readonly SPRITE_CONFIG = {
    portraitWidth: 256,
    portraitHeight: 256,
    gridColumns: 10,
    gridRows: 10,
    portraitsPerSheet: 100
  };

  /**
   * Generate sprite sheets from custom portraits for distribution
   * Creates PNG sprite sheets and a JSON atlas file
   */
  async generateSpriteSheets(
    outputDir: string,
    options?: {
      year?: number;
      prefix?: string;
      progressCallback?: (current: number, total: number, message: string) => void;
    }
  ): Promise<{
    success: boolean;
    sheetsGenerated: number;
    atlasPath?: string;
    sheetPaths?: string[];
    error?: string;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const prefix = options?.prefix || 'custom-portraits';
      const progressCallback = options?.progressCallback;

      // Get portraits to include
      let portraits = this.getAllPortraits();
      if (options?.year) {
        portraits = portraits.filter(p => p.year === options.year);
      }

      if (portraits.length === 0) {
        return { success: true, sheetsGenerated: 0, sheetPaths: [] };
      }

      progressCallback?.(0, portraits.length, 'Starting sprite sheet generation...');

      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Calculate number of sheets needed
      const numSheets = Math.ceil(portraits.length / this.SPRITE_CONFIG.portraitsPerSheet);
      const sheetPaths: string[] = [];
      const atlasEntries: Array<{
        pid: number;
        playerName: string | null;
        sheet: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }> = [];

      // Generate each sheet
      for (let sheetIndex = 0; sheetIndex < numSheets; sheetIndex++) {
        const startIdx = sheetIndex * this.SPRITE_CONFIG.portraitsPerSheet;
        const endIdx = Math.min(startIdx + this.SPRITE_CONFIG.portraitsPerSheet, portraits.length);
        const sheetPortraits = portraits.slice(startIdx, endIdx);

        progressCallback?.(
          startIdx,
          portraits.length,
          `Generating sheet ${sheetIndex + 1} of ${numSheets}...`
        );

        const { sheetBuffer, entries } = await this.generateSingleSheet(
          sheetPortraits,
          sheetIndex
        );

        // Save sheet
        const sheetFilename = `${prefix}-sheet-${sheetIndex}.png`;
        const sheetPath = path.join(outputDir, sheetFilename);
        fs.writeFileSync(sheetPath, sheetBuffer);
        sheetPaths.push(sheetPath);

        // Add entries to atlas
        atlasEntries.push(...entries);

        console.log(`[CustomPortraitService] Generated ${sheetFilename} with ${sheetPortraits.length} portraits`);
      }

      // Generate atlas JSON
      const atlas = {
        version: '1.0.0',
        config: this.SPRITE_CONFIG,
        sheets: numSheets,
        generated: new Date().toISOString(),
        portraits: atlasEntries
      };

      const atlasFilename = `${prefix}-atlas.json`;
      const atlasPath = path.join(outputDir, atlasFilename);
      fs.writeFileSync(atlasPath, JSON.stringify(atlas, null, 2));

      progressCallback?.(portraits.length, portraits.length, 'Complete!');

      console.log(`[CustomPortraitService] Generated ${numSheets} sprite sheets with ${portraits.length} portraits`);

      return {
        success: true,
        sheetsGenerated: numSheets,
        atlasPath,
        sheetPaths
      };
    } catch (error) {
      console.error('[CustomPortraitService] Sprite sheet generation failed:', error);
      return {
        success: false,
        sheetsGenerated: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate a single sprite sheet
   */
  private async generateSingleSheet(
    portraits: Omit<CustomPortrait, 'imageData'>[],
    sheetIndex: number
  ): Promise<{
    sheetBuffer: Buffer;
    entries: Array<{
      pid: number;
      playerName: string | null;
      sheet: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }> {
    const { portraitWidth, portraitHeight, gridColumns, gridRows } = this.SPRITE_CONFIG;
    const sheetWidth = portraitWidth * gridColumns;
    const sheetHeight = portraitHeight * gridRows;

    // Create empty sheet (transparent background)
    const sheet = sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Prepare composites for all portraits
    const composites: Array<{ input: Buffer; left: number; top: number }> = [];
    const entries: Array<{
      pid: number;
      playerName: string | null;
      sheet: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    for (let i = 0; i < portraits.length; i++) {
      const portrait = portraits[i];
      const gridX = i % gridColumns;
      const gridY = Math.floor(i / gridColumns);
      const x = gridX * portraitWidth;
      const y = gridY * portraitHeight;

      // Get portrait image and resize to 256x256
      const fullPortrait = userDatabaseService.getCustomPortrait(portrait.pid);
      if (!fullPortrait) continue;

      // Resize from 512x512 to 256x256
      const resizedBuffer = await sharp(fullPortrait.imageData)
        .resize(portraitWidth, portraitHeight, { fit: 'cover' })
        .png()
        .toBuffer();

      composites.push({
        input: resizedBuffer,
        left: x,
        top: y
      });

      entries.push({
        pid: portrait.pid,
        playerName: portrait.playerName,
        sheet: sheetIndex,
        x,
        y,
        width: portraitWidth,
        height: portraitHeight
      });
    }

    // Composite all portraits onto sheet
    const sheetBuffer = await sheet.composite(composites).png().toBuffer();

    return { sheetBuffer, entries };
  }

  /**
   * Get available years that have custom portraits
   */
  getAvailableYears(): number[] {
    const portraits = this.getAllPortraits();
    const years = new Set<number>();
    for (const p of portraits) {
      if (p.year) years.add(p.year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }
}

// Export singleton instance
export const customPortraitService = new CustomPortraitService();
export default CustomPortraitService;
