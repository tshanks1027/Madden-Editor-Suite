import { ipcMain } from 'electron';
import Database from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { app } from 'electron';

// SQLite database wrapper with promises
class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'madden-editor.db');
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new Database.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create tables
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    // Settings table
    await run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Recent files table
    await run(`
      CREATE TABLE IF NOT EXISTS recent_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER,
        last_opened DATETIME DEFAULT CURRENT_TIMESTAMP,
        display_name TEXT
      )
    `);

    // Cached roster data
    await run(`
      CREATE TABLE IF NOT EXISTS cached_rosters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        file_hash TEXT NOT NULL,
        player_count INTEGER,
        version INTEGER,
        cached_data TEXT NOT NULL,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Scraped data cache
    await run(`
      CREATE TABLE IF NOT EXISTS scraped_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_url TEXT NOT NULL,
        data_type TEXT NOT NULL,
        season_year INTEGER,
        data_content TEXT NOT NULL,
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `);

    // User preferences
    await run(`
      CREATE TABLE IF NOT EXISTS preferences (
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (category, key)
      )
    `);

    // Create indexes for performance
    await run('CREATE INDEX IF NOT EXISTS idx_recent_files_opened ON recent_files(last_opened DESC)');
    await run('CREATE INDEX IF NOT EXISTS idx_scraped_data_type ON scraped_data(data_type, season_year)');
    await run('CREATE INDEX IF NOT EXISTS idx_cached_rosters_hash ON cached_rosters(file_hash)');
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      this.db!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    const get = promisify(this.db.get.bind(this.db));
    return get(sql, params);
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    const all = promisify(this.db.all.bind(this.db));
    return all(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const run = promisify(this.db.run.bind(this.db));
    await run(sql, params);
  }
}

// Global database instance
const dbManager = new DatabaseManager();

// Initialize database when main process starts
dbManager.initialize().catch(console.error);

// Database IPC handlers
ipcMain.handle('db:get-setting', async (event, key: string): Promise<string | null> => {
  try {
    const result = await dbManager.get('SELECT value FROM settings WHERE key = ?', [key]);
    return result ? result.value : null;
  } catch (error) {
    throw new Error(`Failed to get setting: ${error}`);
  }
});

ipcMain.handle('db:set-setting', async (event, key: string, value: string): Promise<void> => {
  try {
    await dbManager.run(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [key, value]
    );
  } catch (error) {
    throw new Error(`Failed to set setting: ${error}`);
  }
});

ipcMain.handle('db:get-recent-files', async (event): Promise<any[]> => {
  try {
    return await dbManager.all(
      'SELECT * FROM recent_files ORDER BY last_opened DESC LIMIT 10'
    );
  } catch (error) {
    throw new Error(`Failed to get recent files: ${error}`);
  }
});

ipcMain.handle('db:add-recent-file', async (event, fileInfo: {
  filePath: string;
  fileType: string;
  fileSize: number;
  displayName?: string;
}): Promise<void> => {
  try {
    await dbManager.run(
      `INSERT OR REPLACE INTO recent_files
       (file_path, file_type, file_size, display_name, last_opened)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [fileInfo.filePath, fileInfo.fileType, fileInfo.fileSize, fileInfo.displayName || null]
    );

    // Keep only the last 20 recent files
    await dbManager.run(`
      DELETE FROM recent_files
      WHERE id NOT IN (
        SELECT id FROM recent_files
        ORDER BY last_opened DESC
        LIMIT 20
      )
    `);
  } catch (error) {
    throw new Error(`Failed to add recent file: ${error}`);
  }
});

ipcMain.handle('db:cache-roster', async (event, rosterInfo: {
  filePath: string;
  fileHash: string;
  playerCount: number;
  version: number;
  cachedData: any;
}): Promise<void> => {
  try {
    await dbManager.run(
      `INSERT OR REPLACE INTO cached_rosters
       (file_path, file_hash, player_count, version, cached_data, cached_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        rosterInfo.filePath,
        rosterInfo.fileHash,
        rosterInfo.playerCount,
        rosterInfo.version,
        JSON.stringify(rosterInfo.cachedData)
      ]
    );
  } catch (error) {
    throw new Error(`Failed to cache roster: ${error}`);
  }
});

ipcMain.handle('db:get-cached-roster', async (event, filePath: string, fileHash: string): Promise<any | null> => {
  try {
    const result = await dbManager.get(
      'SELECT * FROM cached_rosters WHERE file_path = ? AND file_hash = ?',
      [filePath, fileHash]
    );

    if (result) {
      return {
        ...result,
        cached_data: JSON.parse(result.cached_data)
      };
    }
    return null;
  } catch (error) {
    throw new Error(`Failed to get cached roster: ${error}`);
  }
});

ipcMain.handle('db:store-scraped-data', async (event, scrapedInfo: {
  sourceUrl: string;
  dataType: string;
  seasonYear: number;
  dataContent: any;
  expiresAt?: Date;
}): Promise<void> => {
  try {
    await dbManager.run(
      `INSERT OR REPLACE INTO scraped_data
       (source_url, data_type, season_year, data_content, scraped_at, expires_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        scrapedInfo.sourceUrl,
        scrapedInfo.dataType,
        scrapedInfo.seasonYear,
        JSON.stringify(scrapedInfo.dataContent),
        scrapedInfo.expiresAt?.toISOString() || null
      ]
    );
  } catch (error) {
    throw new Error(`Failed to store scraped data: ${error}`);
  }
});

ipcMain.handle('db:get-scraped-data', async (event, dataType: string, seasonYear: number): Promise<any | null> => {
  try {
    const result = await dbManager.get(
      `SELECT * FROM scraped_data
       WHERE data_type = ? AND season_year = ?
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       ORDER BY scraped_at DESC
       LIMIT 1`,
      [dataType, seasonYear]
    );

    if (result) {
      return {
        ...result,
        data_content: JSON.parse(result.data_content)
      };
    }
    return null;
  } catch (error) {
    throw new Error(`Failed to get scraped data: ${error}`);
  }
});

ipcMain.handle('db:set-preference', async (event, category: string, key: string, value: string): Promise<void> => {
  try {
    await dbManager.run(
      `INSERT OR REPLACE INTO preferences
       (category, key, value, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [category, key, value]
    );
  } catch (error) {
    throw new Error(`Failed to set preference: ${error}`);
  }
});

ipcMain.handle('db:get-preference', async (event, category: string, key: string): Promise<string | null> => {
  try {
    const result = await dbManager.get(
      'SELECT value FROM preferences WHERE category = ? AND key = ?',
      [category, key]
    );
    return result ? result.value : null;
  } catch (error) {
    throw new Error(`Failed to get preference: ${error}`);
  }
});

ipcMain.handle('db:get-preferences', async (event, category: string): Promise<Record<string, string>> => {
  try {
    const results = await dbManager.all(
      'SELECT key, value FROM preferences WHERE category = ?',
      [category]
    );

    const preferences: Record<string, string> = {};
    for (const row of results) {
      preferences[row.key] = row.value;
    }

    return preferences;
  } catch (error) {
    throw new Error(`Failed to get preferences: ${error}`);
  }
});

// Clean up expired data
ipcMain.handle('db:cleanup', async (event): Promise<void> => {
  try {
    // Remove expired scraped data
    await dbManager.run(
      'DELETE FROM scraped_data WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP'
    );

    // Remove old cached rosters (older than 30 days)
    await dbManager.run(
      `DELETE FROM cached_rosters
       WHERE cached_at < datetime('now', '-30 days')`
    );

    // Remove old recent files (older than 90 days)
    await dbManager.run(
      `DELETE FROM recent_files
       WHERE last_opened < datetime('now', '-90 days')`
    );
  } catch (error) {
    throw new Error(`Failed to cleanup database: ${error}`);
  }
});

// Database statistics
ipcMain.handle('db:get-stats', async (event): Promise<{
  recentFiles: number;
  cachedRosters: number;
  scrapedDataEntries: number;
  preferences: number;
}> => {
  try {
    const [recentFiles, cachedRosters, scrapedData, preferences] = await Promise.all([
      dbManager.get('SELECT COUNT(*) as count FROM recent_files'),
      dbManager.get('SELECT COUNT(*) as count FROM cached_rosters'),
      dbManager.get('SELECT COUNT(*) as count FROM scraped_data'),
      dbManager.get('SELECT COUNT(*) as count FROM preferences')
    ]);

    return {
      recentFiles: recentFiles.count,
      cachedRosters: cachedRosters.count,
      scrapedDataEntries: scrapedData.count,
      preferences: preferences.count
    };
  } catch (error) {
    throw new Error(`Failed to get database stats: ${error}`);
  }
});

// Export database manager for other modules
export { dbManager };

// Cleanup on app quit
app.on('before-quit', () => {
  dbManager.close().catch(console.error);
});