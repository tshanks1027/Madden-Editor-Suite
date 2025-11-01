/**
 * CSV IPC Handlers
 *
 * IPC handlers for CSV import/export operations.
 * Allows users to export roster/draft class data to CSV for external editing
 * and import CSV data back in a format that can be saved to game files.
 */

import { ipcMain, dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV(data: any[], headers: string[]): string {
  if (!data || data.length === 0) {
    return headers.join(',');
  }

  // Escape CSV field value (handle commas, quotes, newlines)
  const escapeField = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  // Build CSV rows
  const rows: string[] = [];

  // Header row
  rows.push(headers.join(','));

  // Data rows
  for (const row of data) {
    const values = headers.map(header => escapeField(row[header]));
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

/**
 * Parse CSV string to array of objects
 */
function parseCSV(csvContent: string): { headers: string[], rows: any[] } {
  const lines = csvContent.split('\n');
  const headers: string[] = [];
  const rows: any[] = [];

  if (lines.length === 0) {
    return { headers, rows };
  }

  // Parse header line
  const headerLine = lines[0];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];

    if (char === '"') {
      if (inQuotes && headerLine[i + 1] === '"') {
        // Escaped quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      headers.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  // Push last field
  headers.push(currentField.trim());

  // Parse data rows
  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim();
    if (!line) continue; // Skip empty lines

    const fields: string[] = [];
    currentField = '';
    inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    // Push last field
    fields.push(currentField);

    // Create row object
    const row: any = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = fields[i] || '';

      // Try to convert to number if possible
      if (value !== '' && !isNaN(Number(value))) {
        row[header] = Number(value);
      } else {
        row[header] = value;
      }
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Handle: csv:export-roster
 * Export roster data to CSV file
 */
ipcMain.handle('csv:export-roster', async (event, playerData: any[], defaultPath?: string) => {
  try {
    console.log('[csv-handlers] Exporting roster to CSV:', playerData.length, 'players');

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Roster to CSV',
      defaultPath: defaultPath || 'roster_export.csv',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Export canceled' };
    }

    // Get all unique field names from player data
    const allFields = new Set<string>();
    for (const player of playerData) {
      Object.keys(player).forEach(key => allFields.add(key));
    }
    const headers = Array.from(allFields).sort();

    // Convert to CSV
    const csvContent = arrayToCSV(playerData, headers);

    // Write to file
    await fs.writeFile(result.filePath, csvContent, 'utf-8');

    console.log('[csv-handlers] Roster exported successfully to:', result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (error: any) {
    console.error('[csv-handlers] Error exporting roster:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: csv:import-roster
 * Import roster data from CSV file
 */
ipcMain.handle('csv:import-roster', async (event) => {
  try {
    console.log('[csv-handlers] Importing roster from CSV');

    // Show open dialog
    const result = await dialog.showOpenDialog({
      title: 'Import Roster from CSV',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Import canceled' };
    }

    const filePath = result.filePaths[0];
    console.log('[csv-handlers] Reading CSV from:', filePath);

    // Read CSV file
    const csvContent = await fs.readFile(filePath, 'utf-8');

    // Parse CSV
    const { headers, rows } = parseCSV(csvContent);

    console.log('[csv-handlers] Parsed', rows.length, 'rows with', headers.length, 'columns');

    return { success: true, data: rows, headers, filePath };
  } catch (error: any) {
    console.error('[csv-handlers] Error importing roster:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: csv:export-draft
 * Export draft class data to CSV file
 */
ipcMain.handle('csv:export-draft', async (event, prospectData: any[], defaultPath?: string) => {
  try {
    console.log('[csv-handlers] Exporting draft class to CSV:', prospectData.length, 'prospects');

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Export Draft Class to CSV',
      defaultPath: defaultPath || 'draft_class_export.csv',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, message: 'Export canceled' };
    }

    // Get all unique field names from prospect data
    const allFields = new Set<string>();
    for (const prospect of prospectData) {
      Object.keys(prospect).forEach(key => allFields.add(key));
    }
    const headers = Array.from(allFields).sort();

    // Convert to CSV
    const csvContent = arrayToCSV(prospectData, headers);

    // Write to file
    await fs.writeFile(result.filePath, csvContent, 'utf-8');

    console.log('[csv-handlers] Draft class exported successfully to:', result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (error: any) {
    console.error('[csv-handlers] Error exporting draft class:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: csv:import-draft
 * Import draft class data from CSV file
 */
ipcMain.handle('csv:import-draft', async (event) => {
  try {
    console.log('[csv-handlers] Importing draft class from CSV');

    // Show open dialog
    const result = await dialog.showOpenDialog({
      title: 'Import Draft Class from CSV',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: 'Import canceled' };
    }

    const filePath = result.filePaths[0];
    console.log('[csv-handlers] Reading CSV from:', filePath);

    // Read CSV file
    const csvContent = await fs.readFile(filePath, 'utf-8');

    // Parse CSV
    const { headers, rows } = parseCSV(csvContent);

    console.log('[csv-handlers] Parsed', rows.length, 'rows with', headers.length, 'columns');

    return { success: true, data: rows, headers, filePath };
  } catch (error: any) {
    console.error('[csv-handlers] Error importing draft class:', error);
    return { success: false, error: error.message };
  }
});

console.log('[csv-handlers] CSV IPC handlers registered');
