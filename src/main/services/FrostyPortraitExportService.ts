/**
 * FrostyPortraitExportService
 *
 * Exports portrait assignments as PLPO-named DDS files for Frosty import.
 *
 * Workflow:
 * 1. Get assignments for a year (from PortraitImportService)
 * 2. Copy source images to output folder with PLPO filenames
 * 3. Generate manifest for reference
 * 4. User imports entire folder into Frosty
 */

import * as fs from 'fs';
import * as path from 'path';
import { portraitImportService, PortraitImport } from './PortraitImportService';

export interface ExportResult {
  success: boolean;
  outputPath: string;
  exportedCount: number;
  errors: string[];
  manifest: ExportManifest;
}

export interface ExportManifest {
  year: number;
  type: 'draft' | 'roster' | 'both';
  exportedAt: string;
  totalExported: number;
  assignments: Array<{
    historicalPlayer: string;
    plpo: string;
    pid: number;
    position?: string;
    raceMatch: boolean;
  }>;
}

class FrostyPortraitExportService {
  /**
   * Export all assignments for a year
   */
  async exportForYear(
    year: number,
    outputPath: string,
    type?: 'draft' | 'roster'
  ): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      outputPath,
      exportedCount: 0,
      errors: [],
      manifest: {
        year,
        type: type || 'both',
        exportedAt: new Date().toISOString(),
        totalExported: 0,
        assignments: []
      }
    };

    // Get assignments
    const assignments = portraitImportService.getAssignments(year, type);

    if (assignments.length === 0) {
      result.success = false;
      result.errors.push(`No assignments found for ${year}${type ? ` (${type})` : ''}`);
      return result;
    }

    // Create output directory
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Export each assignment
    for (const assignment of assignments) {
      try {
        const exported = await this.exportSingleAssignment(assignment, outputPath);
        if (exported) {
          result.exportedCount++;
          result.manifest.assignments.push({
            historicalPlayer: assignment.historicalPlayer,
            plpo: assignment.assignedPLPO,
            pid: assignment.assignedPID,
            position: assignment.position,
            raceMatch: assignment.raceMatch
          });
        }
      } catch (error) {
        result.errors.push(`Failed to export ${assignment.historicalPlayer}: ${error}`);
      }
    }

    result.manifest.totalExported = result.exportedCount;

    // Write manifest
    const manifestPath = path.join(outputPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2));

    // Also write a simple CSV for quick reference
    const csvPath = path.join(outputPath, 'assignments.csv');
    const csvLines = ['Historical Player,PLPO,PID,Position,Race Match'];
    for (const a of result.manifest.assignments) {
      csvLines.push(`"${a.historicalPlayer}",${a.plpo},${a.pid},${a.position || ''},${a.raceMatch}`);
    }
    fs.writeFileSync(csvPath, csvLines.join('\n'));

    console.log(`[FrostyPortraitExportService] Exported ${result.exportedCount} portraits to ${outputPath}`);
    return result;
  }

  /**
   * Export a single assignment
   */
  private async exportSingleAssignment(
    assignment: PortraitImport,
    outputPath: string
  ): Promise<boolean> {
    const sourcePath = assignment.sourceImagePath;

    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      console.warn(`[FrostyPortraitExportService] Source not found: ${sourcePath}`);
      return false;
    }

    // Determine output filename
    // If source is DDS, keep as DDS
    // If source is PNG/JPG, keep original extension (user can convert separately)
    const sourceExt = path.extname(sourcePath).toLowerCase();
    const outputFilename = `${assignment.assignedPLPO}${sourceExt}`;
    const outputFilePath = path.join(outputPath, outputFilename);

    // Copy file
    fs.copyFileSync(sourcePath, outputFilePath);
    return true;
  }

  /**
   * Export with automatic DDS naming (for files that are already DDS)
   */
  async exportWithDDSNaming(
    year: number,
    outputPath: string,
    type?: 'draft' | 'roster'
  ): Promise<ExportResult> {
    const result: ExportResult = {
      success: true,
      outputPath,
      exportedCount: 0,
      errors: [],
      manifest: {
        year,
        type: type || 'both',
        exportedAt: new Date().toISOString(),
        totalExported: 0,
        assignments: []
      }
    };

    const assignments = portraitImportService.getAssignments(year, type);

    if (assignments.length === 0) {
      result.success = false;
      result.errors.push(`No assignments found for ${year}`);
      return result;
    }

    // Create output directory
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Export each assignment with .dds extension
    for (const assignment of assignments) {
      const sourcePath = assignment.sourceImagePath;

      if (!fs.existsSync(sourcePath)) {
        result.errors.push(`Source not found: ${assignment.historicalPlayer}`);
        continue;
      }

      // Force .dds extension for Frosty
      const outputFilename = `${assignment.assignedPLPO}.dds`;
      const outputFilePath = path.join(outputPath, outputFilename);

      try {
        fs.copyFileSync(sourcePath, outputFilePath);
        result.exportedCount++;
        result.manifest.assignments.push({
          historicalPlayer: assignment.historicalPlayer,
          plpo: assignment.assignedPLPO,
          pid: assignment.assignedPID,
          position: assignment.position,
          raceMatch: assignment.raceMatch
        });
      } catch (error) {
        result.errors.push(`Failed to copy ${assignment.historicalPlayer}: ${error}`);
      }
    }

    result.manifest.totalExported = result.exportedCount;

    // Write manifest
    const manifestPath = path.join(outputPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2));

    console.log(`[FrostyPortraitExportService] Exported ${result.exportedCount} DDS files to ${outputPath}`);
    return result;
  }

  /**
   * Create a manifest from existing assignments without copying files
   */
  createManifest(
    year: number,
    type?: 'draft' | 'roster'
  ): ExportManifest {
    const assignments = portraitImportService.getAssignments(year, type);

    return {
      year,
      type: type || 'both',
      exportedAt: new Date().toISOString(),
      totalExported: assignments.length,
      assignments: assignments.map(a => ({
        historicalPlayer: a.historicalPlayer,
        plpo: a.assignedPLPO,
        pid: a.assignedPID,
        position: a.position,
        raceMatch: a.raceMatch
      }))
    };
  }

  /**
   * Get export preview (what would be exported)
   */
  getExportPreview(
    year: number,
    type?: 'draft' | 'roster'
  ): {
    count: number;
    assignments: Array<{
      historicalPlayer: string;
      plpo: string;
      sourceExists: boolean;
    }>;
  } {
    const assignments = portraitImportService.getAssignments(year, type);

    return {
      count: assignments.length,
      assignments: assignments.map(a => ({
        historicalPlayer: a.historicalPlayer,
        plpo: a.assignedPLPO,
        sourceExists: fs.existsSync(a.sourceImagePath)
      }))
    };
  }
}

// Singleton instance
export const frostyPortraitExportService = new FrostyPortraitExportService();
