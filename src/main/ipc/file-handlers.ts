import { ipcMain, dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { mainWindow } from '../../main';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  extension: string;
  lastModified: Date;
}

// File system operations
ipcMain.handle('file:read', async (event, filePath: string): Promise<Buffer> => {
  try {
    const data = await fs.readFile(filePath);
    return data;
  } catch (error) {
    throw new Error(`Failed to read file: ${error}`);
  }
});

ipcMain.handle('file:write', async (event, filePath: string, data: Buffer): Promise<void> => {
  try {
    // Create backup before writing
    await createBackup(filePath);
    await fs.writeFile(filePath, data);
  } catch (error) {
    throw new Error(`Failed to write file: ${error}`);
  }
});

ipcMain.handle('file:exists', async (event, filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('file:stat', async (event, filePath: string): Promise<FileInfo> => {
  try {
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      extension: path.extname(filePath),
      lastModified: stats.mtime
    };
  } catch (error) {
    throw new Error(`Failed to get file stats: ${error}`);
  }
});

ipcMain.handle('file:list-directory', async (event, dirPath: string): Promise<FileInfo[]> => {
  try {
    const entries = await fs.readdir(dirPath);
    const fileInfos: FileInfo[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stats = await fs.stat(fullPath);
        if (stats.isFile()) {
          fileInfos.push({
            path: fullPath,
            name: entry,
            size: stats.size,
            extension: path.extname(entry),
            lastModified: stats.mtime
          });
        }
      } catch {
        // Skip files that can't be accessed
        continue;
      }
    }

    return fileInfos.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw new Error(`Failed to list directory: ${error}`);
  }
});

// File dialog operations
ipcMain.handle('file:show-open-dialog', async (event, options: Electron.OpenDialogOptions) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Open Madden File',
      filters: [
        { name: 'Roster Files', extensions: ['ros'] },
        { name: 'Franchise Files', extensions: ['fra'] },
        { name: 'Draft Class Files', extensions: ['dcl'] },
        { name: 'Uniform Files', extensions: ['uni'] },
        { name: 'All Madden Files', extensions: ['ros', 'fra', 'dcl', 'uni', 'dds'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile'],
      ...options
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to show open dialog: ${error}`);
  }
});

ipcMain.handle('file:show-save-dialog', async (event, options: Electron.SaveDialogOptions) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save Madden File',
      filters: [
        { name: 'Roster Files', extensions: ['ros'] },
        { name: 'Franchise Files', extensions: ['fra'] },
        { name: 'Draft Class Files', extensions: ['dcl'] },
        { name: 'Uniform Files', extensions: ['uni'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      ...options
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to show save dialog: ${error}`);
  }
});

// Backup operations
async function createBackup(filePath: string): Promise<string> {
  try {
    const backupDir = path.join(path.dirname(filePath), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    const fileName = path.basename(filePath, path.extname(filePath));
    const extension = path.extname(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${fileName}_${timestamp}${extension}`);

    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (exists) {
      await fs.copyFile(filePath, backupPath);
    }

    return backupPath;
  } catch (error) {
    throw new Error(`Failed to create backup: ${error}`);
  }
}

ipcMain.handle('file:create-backup', async (event, filePath: string): Promise<string> => {
  return createBackup(filePath);
});

ipcMain.handle('file:list-backups', async (event, filePath: string): Promise<FileInfo[]> => {
  try {
    const backupDir = path.join(path.dirname(filePath), 'backups');
    const fileName = path.basename(filePath, path.extname(filePath));

    const entries = await fs.readdir(backupDir);
    const backups: FileInfo[] = [];

    for (const entry of entries) {
      if (entry.startsWith(fileName)) {
        const fullPath = path.join(backupDir, entry);
        const stats = await fs.stat(fullPath);
        backups.push({
          path: fullPath,
          name: entry,
          size: stats.size,
          extension: path.extname(entry),
          lastModified: stats.mtime
        });
      }
    }

    return backups.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  } catch (error) {
    return []; // Return empty array if backup directory doesn't exist
  }
});

// File validation
ipcMain.handle('file:validate-madden-file', async (event, filePath: string): Promise<{
  isValid: boolean;
  fileType: string;
  version?: number;
  errors: string[];
}> => {
  try {
    const data = await fs.readFile(filePath);
    const errors: string[] = [];

    if (data.length < 32) {
      errors.push('File too small to contain valid header');
      return { isValid: false, fileType: 'unknown', errors };
    }

    // Read file signature
    const signature = data.subarray(0, 4).toString('ascii');
    let fileType = 'unknown';
    let version: number | undefined;

    switch (signature) {
      case 'ROS\0':
        fileType = 'roster';
        version = data.readUInt32LE(4);
        break;
      case 'FRAN':
        fileType = 'franchise';
        version = data.readUInt32LE(4);
        break;
      case 'DRAF':
        fileType = 'draft';
        version = data.readUInt32LE(4);
        break;
      case 'UNIF':
        fileType = 'uniform';
        version = data.readUInt32LE(4);
        break;
      case 'DDS ':
        fileType = 'texture';
        // DDS files don't have our version system
        break;
      default:
        errors.push(`Unknown file signature: ${signature}`);
    }

    // Basic size validation
    if (data.length >= 8) {
      const declaredSize = data.readUInt32LE(8);
      if (declaredSize !== data.length) {
        errors.push(`File size mismatch: declared ${declaredSize}, actual ${data.length}`);
      }
    }

    return {
      isValid: errors.length === 0,
      fileType,
      version,
      errors
    };
  } catch (error) {
    return {
      isValid: false,
      fileType: 'unknown',
      errors: [`Failed to validate file: ${error}`]
    };
  }
});