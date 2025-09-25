import { ipcMain, app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

export interface AppSettings {
  // General settings
  theme: 'dark' | 'light' | 'auto';
  language: string;
  autoSave: boolean;
  backupEnabled: boolean;
  maxBackups: number;

  // File paths
  defaultMaddenPath: string;
  backupDirectory: string;
  exportDirectory: string;

  // Editor preferences
  showLineNumbers: boolean;
  enableValidation: boolean;
  showTooltips: boolean;
  confirmDeletions: boolean;

  // Performance settings
  enableCache: boolean;
  maxCacheSize: number; // in MB
  enableGPUAcceleration: boolean;

  // Web scraping settings
  enableWebScraping: boolean;
  scrapingCacheExpiry: number; // in hours
  maxScrapingRetries: number;

  // Uniform editor settings
  uniformPreviewQuality: 'low' | 'medium' | 'high';
  enableRealTimePreview: boolean;
  textureCompressionLevel: number;

  // Update settings
  checkForUpdates: boolean;
  autoDownloadUpdates: boolean;
  updateChannel: 'stable' | 'beta' | 'dev';

  // Privacy settings
  enableTelemetry: boolean;
  enableCrashReports: boolean;
  shareUsageData: boolean;
}

const defaultSettings: AppSettings = {
  // General settings
  theme: 'dark',
  language: 'en',
  autoSave: true,
  backupEnabled: true,
  maxBackups: 10,

  // File paths
  defaultMaddenPath: '',
  backupDirectory: '',
  exportDirectory: '',

  // Editor preferences
  showLineNumbers: true,
  enableValidation: true,
  showTooltips: true,
  confirmDeletions: true,

  // Performance settings
  enableCache: true,
  maxCacheSize: 500, // 500 MB
  enableGPUAcceleration: true,

  // Web scraping settings
  enableWebScraping: true,
  scrapingCacheExpiry: 24, // 24 hours
  maxScrapingRetries: 3,

  // Uniform editor settings
  uniformPreviewQuality: 'medium',
  enableRealTimePreview: true,
  textureCompressionLevel: 5,

  // Update settings
  checkForUpdates: true,
  autoDownloadUpdates: false,
  updateChannel: 'stable',

  // Privacy settings
  enableTelemetry: false, // Disabled by default for privacy
  enableCrashReports: true,
  shareUsageData: false
};

class SettingsManager {
  private settings: AppSettings = { ...defaultSettings };
  private settingsPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.settingsPath = path.join(userDataPath, 'settings.json');
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // Set default paths based on common Madden installation locations
    const defaultMaddenPaths = [
      'C:\\Program Files (x86)\\EA Games\\Madden NFL 25',
      'C:\\Program Files\\EA Games\\Madden NFL 25',
      'C:\\Games\\Madden NFL 25',
      path.join(app.getPath('documents'), 'EA Games', 'Madden NFL 25')
    ];

    // Find the first existing path
    for (const maddenPath of defaultMaddenPaths) {
      try {
        if (require('fs').existsSync(maddenPath)) {
          this.settings.defaultMaddenPath = maddenPath;
          break;
        }
      } catch {
        // Continue checking other paths
      }
    }

    // Set default backup and export directories
    const documentsPath = app.getPath('documents');
    this.settings.backupDirectory = path.join(documentsPath, 'Madden Editor Backups');
    this.settings.exportDirectory = path.join(documentsPath, 'Madden Editor Exports');
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf8');
      const loadedSettings = JSON.parse(data);

      // Merge with defaults to handle new settings
      this.settings = {
        ...defaultSettings,
        ...loadedSettings
      };
    } catch (error) {
      // If settings file doesn't exist or is corrupted, use defaults
      console.log('Using default settings:', error);
      await this.save();
    }
  }

  async save(): Promise<void> {
    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });

      // Write settings with pretty formatting
      await fs.writeFile(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2),
        'utf8'
      );
    } catch (error) {
      throw new Error(`Failed to save settings: ${error}`);
    }
  }

  get(): AppSettings {
    return { ...this.settings };
  }

  async set(newSettings: Partial<AppSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    await this.save();
  }

  async reset(): Promise<void> {
    this.settings = { ...defaultSettings };
    this.initializeDefaults();
    await this.save();
  }

  getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  async setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    this.settings[key] = value;
    await this.save();
  }
}

// Global settings manager
const settingsManager = new SettingsManager();

// Initialize settings when main process starts
settingsManager.load().catch(console.error);

// Settings IPC handlers
ipcMain.handle('settings:get-all', async (): Promise<AppSettings> => {
  return settingsManager.get();
});

ipcMain.handle('settings:set-all', async (event, settings: Partial<AppSettings>): Promise<void> => {
  await settingsManager.set(settings);
});

ipcMain.handle('settings:get', async (event, key: keyof AppSettings): Promise<any> => {
  return settingsManager.getSetting(key);
});

ipcMain.handle('settings:set', async (event, key: keyof AppSettings, value: any): Promise<void> => {
  await settingsManager.setSetting(key as any, value);
});

ipcMain.handle('settings:reset', async (): Promise<void> => {
  await settingsManager.reset();
});

// Validate and create directories
ipcMain.handle('settings:validate-paths', async (): Promise<{
  maddenPath: boolean;
  backupDirectory: boolean;
  exportDirectory: boolean;
}> => {
  const settings = settingsManager.get();

  const results = {
    maddenPath: false,
    backupDirectory: false,
    exportDirectory: false
  };

  // Check Madden path
  if (settings.defaultMaddenPath) {
    try {
      await fs.access(settings.defaultMaddenPath);
      results.maddenPath = true;
    } catch {
      results.maddenPath = false;
    }
  }

  // Check/create backup directory
  try {
    await fs.mkdir(settings.backupDirectory, { recursive: true });
    results.backupDirectory = true;
  } catch {
    results.backupDirectory = false;
  }

  // Check/create export directory
  try {
    await fs.mkdir(settings.exportDirectory, { recursive: true });
    results.exportDirectory = true;
  } catch {
    results.exportDirectory = false;
  }

  return results;
});

// Import/Export settings
ipcMain.handle('settings:export', async (event, filePath: string): Promise<void> => {
  try {
    const settings = settingsManager.get();
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to export settings: ${error}`);
  }
});

ipcMain.handle('settings:import', async (event, filePath: string): Promise<void> => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const importedSettings = JSON.parse(data);

    // Validate imported settings structure
    const validatedSettings: Partial<AppSettings> = {};
    for (const [key, value] of Object.entries(importedSettings)) {
      if (key in defaultSettings) {
        validatedSettings[key as keyof AppSettings] = value as any;
      }
    }

    await settingsManager.set(validatedSettings);
  } catch (error) {
    throw new Error(`Failed to import settings: ${error}`);
  }
});

// Get system information for settings validation
ipcMain.handle('settings:get-system-info', async (): Promise<{
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
  userDataPath: string;
  documentsPath: string;
  desktopPath: string;
}> => {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    electronVersion: process.versions.electron,
    appVersion: app.getVersion(),
    userDataPath: app.getPath('userData'),
    documentsPath: app.getPath('documents'),
    desktopPath: app.getPath('desktop')
  };
});

// Performance monitoring settings
ipcMain.handle('settings:get-performance-info', async (): Promise<{
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
  gpuFeatureStatus: Electron.GPUFeatureStatus;
}> => {
  const { app } = require('electron');

  return {
    cpuUsage: process.cpuUsage(),
    memoryUsage: process.memoryUsage(),
    gpuFeatureStatus: app.getGPUFeatureStatus()
  };
});

// Theme and appearance helpers
ipcMain.handle('settings:get-theme-info', async (): Promise<{
  systemTheme: 'light' | 'dark';
  shouldUseDarkColors: boolean;
  isHighContrastColorScheme: boolean;
}> => {
  const { nativeTheme } = require('electron');

  return {
    systemTheme: nativeTheme.themeSource === 'dark' ? 'dark' : 'light',
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    isHighContrastColorScheme: nativeTheme.shouldUseHighContrastColors
  };
});

// Settings validation
function validateSettings(settings: Partial<AppSettings>): string[] {
  const errors: string[] = [];

  if (settings.maxBackups && (settings.maxBackups < 1 || settings.maxBackups > 100)) {
    errors.push('Max backups must be between 1 and 100');
  }

  if (settings.maxCacheSize && (settings.maxCacheSize < 10 || settings.maxCacheSize > 10000)) {
    errors.push('Max cache size must be between 10 MB and 10 GB');
  }

  if (settings.scrapingCacheExpiry && (settings.scrapingCacheExpiry < 1 || settings.scrapingCacheExpiry > 168)) {
    errors.push('Scraping cache expiry must be between 1 and 168 hours');
  }

  if (settings.textureCompressionLevel && (settings.textureCompressionLevel < 1 || settings.textureCompressionLevel > 10)) {
    errors.push('Texture compression level must be between 1 and 10');
  }

  return errors;
}

ipcMain.handle('settings:validate', async (event, settings: Partial<AppSettings>): Promise<{
  isValid: boolean;
  errors: string[];
}> => {
  const errors = validateSettings(settings);
  return {
    isValid: errors.length === 0,
    errors
  };
});

// Export settings manager for other modules
export { settingsManager, AppSettings };

// Save settings on app quit
app.on('before-quit', () => {
  settingsManager.save().catch(console.error);
});