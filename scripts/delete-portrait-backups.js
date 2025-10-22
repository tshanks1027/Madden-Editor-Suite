/**
 * Delete all portrait backup files (.backup)
 * Run this after verifying resized portraits look good
 */

const fs = require('fs');
const path = require('path');

const PORTRAIT_DIRS = [
  path.join(__dirname, '..', 'data', 'portraits', 'generic'),
  path.join(__dirname, '..', 'data', 'portraits', 'legends'),
  path.join(__dirname, '..', 'data', 'portraits', 'players'),
];

function deleteBackupsInDir(dirPath, categoryName) {
  if (!fs.existsSync(dirPath)) {
    console.warn(`[${categoryName}] Directory not found:`, dirPath);
    return 0;
  }

  const backups = fs.readdirSync(dirPath).filter(f => f.endsWith('.backup'));
  console.log(`[${categoryName}] Found ${backups.length} backup files`);

  let deleted = 0;
  let totalSize = 0;

  for (const backup of backups) {
    const backupPath = path.join(dirPath, backup);
    try {
      const stats = fs.statSync(backupPath);
      totalSize += stats.size;
      fs.unlinkSync(backupPath);
      deleted++;
    } catch (error) {
      console.error(`[${categoryName}] Error deleting ${backup}:`, error.message);
    }
  }

  const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
  console.log(`[${categoryName}] Deleted ${deleted} backups (freed ${sizeMB} MB)\n`);

  return deleted;
}

function deleteAllBackups() {
  console.log('Deleting portrait backup files...\n');

  let totalDeleted = 0;
  totalDeleted += deleteBackupsInDir(PORTRAIT_DIRS[0], 'GENERIC');
  totalDeleted += deleteBackupsInDir(PORTRAIT_DIRS[1], 'LEGENDS');
  totalDeleted += deleteBackupsInDir(PORTRAIT_DIRS[2], 'PLAYERS');

  console.log(`Total backups deleted: ${totalDeleted}`);
}

deleteAllBackups();
