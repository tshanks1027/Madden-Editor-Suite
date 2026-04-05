/**
 * Coach Portrait Service
 *
 * Manages coach portrait images using sprite sheets.
 * Similar to PortraitSpriteService but specifically for coach portraits.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

import sharp from 'sharp';

interface CoachAtlasEntry {
  pid: number;
  filename: string;
  sheet: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CoachAtlas {
  version: string;
  type: string;
  config: {
    portraitWidth: number;
    portraitHeight: number;
    gridColumns: number;
    gridRows: number;
  };
  sheets: number;
  coaches: CoachAtlasEntry[];
}

export interface CoachSpriteInfo {
  sheetPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CoachPortraitService {
  private atlas: CoachAtlas | null = null;
  private portraitMap: Map<number, CoachAtlasEntry> = new Map();
  private spritesDir: string;
  private atlasPath: string;
  private initialized = false;

  constructor() {
    // Sprite sheets directory - check multiple locations
    const possibleSpritesPaths = [
      path.join(__dirname, 'data', 'coach-sprites'),  // Packaged: __dirname is .vite/build
      path.join(app.getAppPath(), '.vite', 'build', 'data', 'coach-sprites'),  // Packaged build
      path.join(process.resourcesPath || '', 'app', '.vite', 'build', 'data', 'coach-sprites'),  // Packaged with resourcesPath
      path.join(process.cwd(), 'data', 'coach-sprites'),  // Dev mode
      path.join(app.getAppPath(), 'data', 'coach-sprites'),
      path.join(app.getAppPath(), '..', '..', 'data', 'coach-sprites'), // For unpacked ASAR
      path.join(__dirname, '..', '..', 'data', 'coach-sprites'),
    ];

    this.spritesDir = possibleSpritesPaths.find(p => fs.existsSync(p)) || possibleSpritesPaths[0];

    // Atlas file path
    const possibleAtlasPaths = [
      path.join(__dirname, 'data', 'coach-atlas.json'),  // Packaged: __dirname is .vite/build
      path.join(app.getAppPath(), '.vite', 'build', 'data', 'coach-atlas.json'),  // Packaged build
      path.join(process.resourcesPath || '', 'app', '.vite', 'build', 'data', 'coach-atlas.json'),  // Packaged with resourcesPath
      path.join(process.cwd(), 'data', 'coach-atlas.json'),  // Dev mode
      path.join(app.getAppPath(), 'data', 'coach-atlas.json'),
      path.join(app.getAppPath(), '..', '..', 'data', 'coach-atlas.json'),
      path.join(__dirname, '..', '..', 'data', 'coach-atlas.json'),
    ];

    this.atlasPath = possibleAtlasPaths.find(p => fs.existsSync(p)) || possibleAtlasPaths[0];

    console.log('[CoachPortraitService] Sprites directory:', this.spritesDir);
    console.log('[CoachPortraitService] Sprites directory exists:', fs.existsSync(this.spritesDir));
    console.log('[CoachPortraitService] Atlas path:', this.atlasPath);
    console.log('[CoachPortraitService] Atlas file exists:', fs.existsSync(this.atlasPath));
  }

  /**
   * Initialize coach portrait service and load atlas
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[CoachPortraitService] Initializing coach portrait service...');

    // Load atlas JSON
    if (!fs.existsSync(this.atlasPath)) {
      console.error('[CoachPortraitService] Atlas file not found:', this.atlasPath);
      return;
    }

    try {
      const atlasData = fs.readFileSync(this.atlasPath, 'utf8');
      this.atlas = JSON.parse(atlasData);

      if (!this.atlas) {
        console.error('[CoachPortraitService] Failed to parse atlas JSON');
        return;
      }

      console.log(`[CoachPortraitService] Loaded atlas with ${this.atlas.coaches.length} coach portraits across ${this.atlas.sheets} sheets`);

      // Build coach portrait lookup map (PID → entry)
      for (const entry of this.atlas.coaches) {
        this.portraitMap.set(entry.pid, entry);
      }

      this.initialized = true;
      console.log('[CoachPortraitService] Coach portrait map initialized with', this.portraitMap.size, 'entries');
    } catch (err) {
      console.error('[CoachPortraitService] Error loading atlas:', err);
    }
  }

  /**
   * Get sprite portrait info by coach PID
   * @param pid Coach Portrait ID
   * @returns Sprite sheet info or null
   */
  public getPortraitByPID(pid: number): CoachSpriteInfo | null {
    if (!this.initialized || !this.atlas) {
      console.warn('[CoachPortraitService] Service not initialized');
      return null;
    }

    // Ensure PID is a number (defensive - Maps use strict equality)
    const numericPid = typeof pid === 'string' ? parseInt(pid as unknown as string, 10) : Number(pid);
    if (isNaN(numericPid)) {
      console.warn(`[CoachPortraitService] Invalid PID: ${pid}`);
      return null;
    }

    const entry = this.portraitMap.get(numericPid);
    console.log(`[CoachPortraitService] PID ${numericPid} -> ${entry ? entry.filename : 'NOT FOUND'}`);

    if (!entry) {
      return null;
    }

    return {
      sheetPath: path.join(this.spritesDir, `coach-sheet-${entry.sheet}.png`),
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height
    };
  }

  /**
   * Check if coach portrait exists for given PID
   * @param pid Coach Portrait ID
   * @returns True if portrait exists
   */
  public hasPortrait(pid: number): boolean {
    // Ensure PID is numeric (Maps use strict equality)
    const numericPid = typeof pid === 'string' ? parseInt(pid as unknown as string, 10) : Number(pid);
    if (isNaN(numericPid)) {
      return false;
    }
    return this.portraitMap.has(numericPid);
  }

  /**
   * Get all available coach PIDs
   * @returns Array of coach PIDs with portraits
   */
  public getAvailablePIDs(): number[] {
    return Array.from(this.portraitMap.keys());
  }

  /**
   * Get service status
   * @returns Initialization status and stats
   */
  public getStatus() {
    return {
      initialized: this.initialized,
      spritesDir: this.spritesDir,
      atlasPath: this.atlasPath,
      portraitCount: this.portraitMap.size,
      sheets: this.atlas?.sheets || 0
    };
  }

  /**
   * Get all coach portraits with their sprite info
   * @returns Array of coach entries with PID and sprite location
   */
  public getAllCoachPortraits(): CoachSpriteInfo[] {
    if (!this.initialized || !this.atlas) {
      return [];
    }

    return this.atlas.coaches.map(coach => ({
      ...coach,
      sheetPath: path.join(this.spritesDir, `coach-sheet-${coach.sheet}.png`)
    }));
  }

  /**
   * Search coach portraits by PIDs and return with images
   * @param pids Array of PIDs to get portraits for
   * @returns Array of portraits with base64 images
   */
  public async getPortraitsWithImages(pids: number[]): Promise<Array<{ pid: number; imageData: string }>> {
    const results: Array<{ pid: number; imageData: string }> = [];
    let errorCount = 0;
    let firstError: any = null;

    console.log(`[CoachPortraitService] getPortraitsWithImages called with ${pids.length} PIDs`);
    console.log(`[CoachPortraitService] spritesDir: ${this.spritesDir}`);
    console.log(`[CoachPortraitService] initialized: ${this.initialized}`);

    for (const pid of pids) {
      const info = this.getPortraitByPID(pid);
      if (!info) {
        errorCount++;
        if (errorCount === 1) {
          console.log(`[CoachPortraitService] First PID ${pid} has no info`);
        }
        continue;
      }

      // Log first path attempt
      if (results.length === 0 && errorCount === 0) {
        console.log(`[CoachPortraitService] First sheet path: ${info.sheetPath}`);
        console.log(`[CoachPortraitService] File exists: ${fs.existsSync(info.sheetPath)}`);
        console.log(`[CoachPortraitService] Extract region: x=${info.x}, y=${info.y}, w=${info.width}, h=${info.height}`);
      }

      try {
        const imageBuffer = await sharp(info.sheetPath)
          .extract({
            left: info.x,
            top: info.y,
            width: info.width,
            height: info.height
          })
          .png()
          .toBuffer();

        const base64Image = imageBuffer.toString('base64');
        results.push({
          pid,
          imageData: `data:image/png;base64,${base64Image}`
        });
      } catch (err) {
        errorCount++;
        if (!firstError) {
          firstError = err;
          console.error(`[CoachPortraitService] First extraction error for PID ${pid}:`, err);
        }
      }
    }

    console.log(`[CoachPortraitService] Loaded ${results.length} portraits, ${errorCount} errors`);
    if (errorCount > 0 && firstError) {
      console.log(`[CoachPortraitService] First error was:`, firstError.message);
    }

    return results;
  }

  /**
   * Extract coach portrait as PNG buffer
   * @param pid Coach Portrait ID
   * @param upscale Whether to upscale to 512x512 for DDS export
   * @returns PNG buffer or null
   */
  public async extractPortraitByPID(pid: number, upscale = false): Promise<Buffer | null> {
    try {
      const info = this.getPortraitByPID(pid);
      if (!info) {
        return null;
      }

      // Verify sprite sheet exists
      if (!fs.existsSync(info.sheetPath)) {
        console.error('[CoachPortraitService] Sprite sheet not found:', info.sheetPath);
        return null;
      }

      // Extract region from sprite sheet
      let image = sharp(info.sheetPath).extract({
        left: info.x,
        top: info.y,
        width: info.width,
        height: info.height
      });

      // Upscale to 512x512 if requested (for DDS export)
      if (upscale && (info.width !== 512 || info.height !== 512)) {
        image = image.resize(512, 512, {
          kernel: sharp.kernel.lanczos3 // High quality upscaling
        });
      }

      return await image.png().toBuffer();
    } catch (err) {
      console.error('[CoachPortraitService] Error extracting portrait:', err);
      return null;
    }
  }

  /**
   * Export a coach portrait as DDS file
   * @param pid Coach Portrait ID
   * @param outputPath Output directory
   * @returns Result with file path or error
   */
  public async exportPortraitAsDDS(pid: number, outputPath: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Debug: log first export attempt
      const info = this.getPortraitByPID(pid);
      if (!info) {
        console.log(`[CoachPortraitService] exportPortraitAsDDS: No info for PID ${pid}, initialized=${this.initialized}, mapSize=${this.portraitMap.size}`);
        return { success: false, error: `No portrait info for coach PID ${pid}` };
      }

      // Check if sheet exists
      if (!fs.existsSync(info.sheetPath)) {
        console.log(`[CoachPortraitService] Sheet NOT FOUND: ${info.sheetPath}`);
        console.log(`[CoachPortraitService] spritesDir: ${this.spritesDir}`);
        return { success: false, error: `Sheet not found: ${info.sheetPath}` };
      }

      // Extract and upscale portrait
      const pngBuffer = await this.extractPortraitByPID(pid, true);
      if (!pngBuffer) {
        return { success: false, error: `Failed to extract portrait for coach PID ${pid}` };
      }

      // Get raw RGBA pixels
      const { data: rgbaData, info: sharpInfo } = await sharp(pngBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      console.log(`[CoachPortraitService] Exporting coach PID ${pid}: ${sharpInfo.width}x${sharpInfo.height}`);

      // Compress to DXT5
      const dxt5Data = this.compressToDxt5(rgbaData, sharpInfo.width, sharpInfo.height);

      // Build DDS file
      const ddsBuffer = this.buildDdsFile(dxt5Data, sharpInfo.width, sharpInfo.height);

      // Ensure output directory exists
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // Write file - just the PID number to match in-game format
      const filename = `${pid}.dds`;
      const filePath = path.join(outputPath, filename);
      fs.writeFileSync(filePath, ddsBuffer);

      console.log(`[CoachPortraitService] Exported coach portrait to ${filePath}`);
      return { success: true, filePath };
    } catch (err) {
      console.error('[CoachPortraitService] Error exporting coach portrait as DDS:', err);
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Compress RGBA data to DXT5 format (BC3)
   * Simple implementation - quality is acceptable for portraits
   */
  private compressToDxt5(rgbaData: Buffer, width: number, height: number): Buffer {
    // DXT5 block size is 4x4 pixels = 16 bytes output per block
    const blocksX = Math.ceil(width / 4);
    const blocksY = Math.ceil(height / 4);
    const outputSize = blocksX * blocksY * 16;
    const output = Buffer.alloc(outputSize);

    let outPos = 0;

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        // Extract 4x4 block of RGBA pixels
        const block: number[][] = [];
        for (let py = 0; py < 4; py++) {
          for (let px = 0; px < 4; px++) {
            const x = bx * 4 + px;
            const y = by * 4 + py;
            const idx = (y * width + x) * 4;

            if (x < width && y < height) {
              block.push([
                rgbaData[idx],     // R
                rgbaData[idx + 1], // G
                rgbaData[idx + 2], // B
                rgbaData[idx + 3]  // A
              ]);
            } else {
              block.push([0, 0, 0, 255]); // Padding for edge blocks
            }
          }
        }

        // Compress alpha (DXT5 uses interpolated alpha)
        const alphaBlock = this.compressDxt5Alpha(block);
        alphaBlock.copy(output, outPos);
        outPos += 8;

        // Compress color (same as DXT1)
        const colorBlock = this.compressDxt1Color(block);
        colorBlock.copy(output, outPos);
        outPos += 8;
      }
    }

    return output;
  }

  /**
   * Compress alpha channel for DXT5 block
   */
  private compressDxt5Alpha(block: number[][]): Buffer {
    const result = Buffer.alloc(8);

    // Find min/max alpha
    let minAlpha = 255;
    let maxAlpha = 0;
    for (const pixel of block) {
      minAlpha = Math.min(minAlpha, pixel[3]);
      maxAlpha = Math.max(maxAlpha, pixel[3]);
    }

    result[0] = maxAlpha;
    result[1] = minAlpha;

    // Generate alpha indices (3 bits each, 16 pixels = 48 bits = 6 bytes)
    let indices = 0n;
    for (let i = 0; i < 16; i++) {
      const alpha = block[i][3];
      let idx = 0;

      if (maxAlpha !== minAlpha) {
        // 8-alpha mode
        if (alpha >= maxAlpha) {
          idx = 0;
        } else if (alpha <= minAlpha) {
          idx = 1;
        } else {
          // Interpolate
          const range = maxAlpha - minAlpha;
          const normalized = (alpha - minAlpha) / range;
          idx = Math.round(normalized * 6) + 1;
          if (idx > 7) idx = 7;
        }
      }

      indices |= BigInt(idx) << BigInt(i * 3);
    }

    // Pack 48 bits into 6 bytes
    for (let i = 0; i < 6; i++) {
      result[2 + i] = Number((indices >> BigInt(i * 8)) & 0xffn);
    }

    return result;
  }

  /**
   * Compress RGB color for DXT1/DXT5 block
   */
  private compressDxt1Color(block: number[][]): Buffer {
    const result = Buffer.alloc(8);

    // Find min/max colors (simplified - use first and last distinct colors)
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

    // Convert to RGB565
    const color0 = this.rgb888to565(maxR, maxG, maxB);
    const color1 = this.rgb888to565(minR, minG, minB);

    result.writeUInt16LE(color0, 0);
    result.writeUInt16LE(color1, 2);

    // Generate color indices (2 bits each, 16 pixels = 32 bits = 4 bytes)
    let indices = 0;
    for (let i = 0; i < 16; i++) {
      const [r, g, b] = block[i];
      let idx = 0;

      if (color0 !== color1) {
        // Calculate distances to each palette color
        const d0 = Math.abs(r - maxR) + Math.abs(g - maxG) + Math.abs(b - maxB);
        const d1 = Math.abs(r - minR) + Math.abs(g - minG) + Math.abs(b - minB);

        // Interpolated colors
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

  /**
   * Convert RGB888 to RGB565
   */
  private rgb888to565(r: number, g: number, b: number): number {
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  }

  /**
   * Build DDS file with header
   */
  private buildDdsFile(dxt5Data: Buffer, width: number, height: number): Buffer {
    const headerSize = 128; // DDS_HEADER size
    const header = Buffer.alloc(headerSize);

    // Magic number "DDS "
    header.write('DDS ', 0, 4, 'ascii');

    // DDS_HEADER
    header.writeUInt32LE(124, 4);  // dwSize
    header.writeUInt32LE(0x000A1007, 8);  // dwFlags: CAPS | HEIGHT | WIDTH | PIXELFORMAT | MIPMAPCOUNT | LINEARSIZE
    header.writeUInt32LE(height, 12);  // dwHeight
    header.writeUInt32LE(width, 16);   // dwWidth
    header.writeUInt32LE(dxt5Data.length, 20);  // dwPitchOrLinearSize
    header.writeUInt32LE(0, 24);  // dwDepth
    header.writeUInt32LE(1, 28);  // dwMipMapCount

    // DDS_PIXELFORMAT at offset 76
    header.writeUInt32LE(32, 76);  // dwSize
    header.writeUInt32LE(0x4, 80);  // dwFlags: DDPF_FOURCC
    header.write('DXT5', 84, 4, 'ascii');  // dwFourCC

    // dwCaps at offset 108
    header.writeUInt32LE(0x1000, 108);  // DDSCAPS_TEXTURE

    // Combine header and data
    return Buffer.concat([header, dxt5Data]);
  }
}

// Export singleton instance
export const coachPortraitService = new CoachPortraitService();
