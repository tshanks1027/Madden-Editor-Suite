/**
 * Developer Portraits Management Script
 *
 * Manages portraits that the developer bundles with the app.
 * These use PIDs in range 11000-11999.
 *
 * Usage:
 *   node scripts/manage-developer-portraits.js add <image_path> <player_id> [player_name]
 *   node scripts/manage-developer-portraits.js list
 *   node scripts/manage-developer-portraits.js remove <pid>
 *   node scripts/manage-developer-portraits.js build-sprites
 *
 * Examples:
 *   node scripts/manage-developer-portraits.js add ./my-portrait.png 24656 "Todd Shanks"
 *   node scripts/manage-developer-portraits.js list
 *   node scripts/manage-developer-portraits.js build-sprites
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Database = require('better-sqlite3');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const DEV_PORTRAITS_DIR = path.join(DATA_DIR, 'developer-portraits');
const DEV_ATLAS_PATH = path.join(DATA_DIR, 'developer-portrait-atlas.json');
const DEV_SPRITES_DIR = path.join(DATA_DIR, 'developer-sprites');
const PLAYERS_DB_PATH = path.join(DATA_DIR, 'players.db');

// PID Range for developer portraits
const DEV_PID_START = 11000;
const DEV_PID_END = 11999;

// Sprite sheet config (same as main portraits)
const PORTRAIT_WIDTH = 256;
const PORTRAIT_HEIGHT = 256;
const GRID_COLUMNS = 10;
const GRID_ROWS = 10;
const PORTRAITS_PER_SHEET = GRID_COLUMNS * GRID_ROWS;

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(DEV_PORTRAITS_DIR)) {
    fs.mkdirSync(DEV_PORTRAITS_DIR, { recursive: true });
    console.log(`Created: ${DEV_PORTRAITS_DIR}`);
  }
  if (!fs.existsSync(DEV_SPRITES_DIR)) {
    fs.mkdirSync(DEV_SPRITES_DIR, { recursive: true });
    console.log(`Created: ${DEV_SPRITES_DIR}`);
  }
}

// Load or initialize the atlas
function loadAtlas() {
  if (fs.existsSync(DEV_ATLAS_PATH)) {
    return JSON.parse(fs.readFileSync(DEV_ATLAS_PATH, 'utf8'));
  }
  return {
    version: '1.0.0',
    config: {
      portraitWidth: PORTRAIT_WIDTH,
      portraitHeight: PORTRAIT_HEIGHT,
      gridColumns: GRID_COLUMNS,
      gridRows: GRID_ROWS
    },
    sheets: 0,
    portraits: []
  };
}

// Save the atlas
function saveAtlas(atlas) {
  fs.writeFileSync(DEV_ATLAS_PATH, JSON.stringify(atlas, null, 2));
  console.log(`Updated: ${DEV_ATLAS_PATH}`);
}

// Get next available PID in developer range
function getNextAvailablePid(atlas) {
  const usedPids = new Set(atlas.portraits.map(p => p.pid));
  for (let pid = DEV_PID_START; pid <= DEV_PID_END; pid++) {
    if (!usedPids.has(pid)) {
      return pid;
    }
  }
  throw new Error(`No available PIDs in developer range (${DEV_PID_START}-${DEV_PID_END})`);
}

// Add a portrait
async function addPortrait(imagePath, playerId, playerName) {
  ensureDirectories();

  // Validate image exists
  if (!fs.existsSync(imagePath)) {
    console.error(`Error: Image not found: ${imagePath}`);
    process.exit(1);
  }

  // Load atlas
  const atlas = loadAtlas();

  // Check if player already has a portrait
  const existingIndex = atlas.portraits.findIndex(p => p.playerId === playerId);
  if (existingIndex !== -1) {
    console.log(`Player ${playerId} already has a developer portrait (PID ${atlas.portraits[existingIndex].pid})`);
    console.log('Remove it first with: node scripts/manage-developer-portraits.js remove <pid>');
    return;
  }

  // Get next PID
  const pid = getNextAvailablePid(atlas);
  console.log(`Assigning PID ${pid} to player ${playerId}${playerName ? ` (${playerName})` : ''}`);

  // Process image - resize to 256x256
  const outputFilename = `dev_portrait_${pid}.png`;
  const outputPath = path.join(DEV_PORTRAITS_DIR, outputFilename);

  await sharp(imagePath)
    .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, { fit: 'cover' })
    .png()
    .toFile(outputPath);

  console.log(`Saved: ${outputPath}`);

  // Add to atlas (position will be set during sprite build)
  atlas.portraits.push({
    id: `dev_${pid}`,
    pid: pid,
    playerId: playerId,
    playerName: playerName || null,
    filename: outputFilename,
    category: 'developer',
    sheet: -1, // Will be set during build
    x: 0,
    y: 0,
    width: PORTRAIT_WIDTH,
    height: PORTRAIT_HEIGHT,
    addedAt: new Date().toISOString()
  });

  saveAtlas(atlas);

  // Update database
  updateDatabase(playerId, pid, playerName);

  console.log(`\nSuccessfully added developer portrait:`);
  console.log(`  Player ID: ${playerId}`);
  console.log(`  PID: ${pid}`);
  console.log(`  Name: ${playerName || '(not specified)'}`);
  console.log(`\nRun 'node scripts/manage-developer-portraits.js build-sprites' to generate sprite sheets.`);
}

// Update the bundled_developer_portraits table in players.db
function updateDatabase(playerId, pid, playerName) {
  if (!fs.existsSync(PLAYERS_DB_PATH)) {
    console.warn(`Warning: players.db not found at ${PLAYERS_DB_PATH}`);
    console.warn('Run scripts/create-database.js first to create the database.');
    return;
  }

  const db = new Database(PLAYERS_DB_PATH);

  try {
    // Check if table exists
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_developer_portraits'"
    ).get();

    if (!tableExists) {
      console.log('Creating bundled_developer_portraits table...');
      db.exec(`
        CREATE TABLE bundled_developer_portraits (
          player_id INTEGER PRIMARY KEY,
          pid INTEGER NOT NULL,
          player_name TEXT,
          added_at TEXT DEFAULT (datetime('now'))
        )
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_dev_portraits_pid ON bundled_developer_portraits(pid)`);
    }

    // Insert or replace
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO bundled_developer_portraits (player_id, pid, player_name, added_at)
      VALUES (?, ?, ?, datetime('now'))
    `);
    stmt.run(playerId, pid, playerName);

    console.log(`Updated players.db: player ${playerId} -> PID ${pid}`);
  } finally {
    db.close();
  }
}

// List all developer portraits
function listPortraits() {
  const atlas = loadAtlas();

  if (atlas.portraits.length === 0) {
    console.log('No developer portraits found.');
    return;
  }

  console.log(`\nDeveloper Portraits (${atlas.portraits.length} total):\n`);
  console.log('PID      Player ID    Player Name               Added');
  console.log('-------  -----------  ------------------------  -------------------');

  for (const p of atlas.portraits) {
    const name = (p.playerName || '').padEnd(24);
    const addedAt = p.addedAt ? p.addedAt.substring(0, 19) : 'Unknown';
    console.log(`${p.pid}     ${String(p.playerId).padEnd(11)}  ${name}  ${addedAt}`);
  }
}

// Remove a portrait
function removePortrait(pid) {
  const atlas = loadAtlas();

  const index = atlas.portraits.findIndex(p => p.pid === pid);
  if (index === -1) {
    console.error(`Error: No developer portrait found with PID ${pid}`);
    process.exit(1);
  }

  const portrait = atlas.portraits[index];

  // Remove image file
  const imagePath = path.join(DEV_PORTRAITS_DIR, portrait.filename);
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
    console.log(`Deleted: ${imagePath}`);
  }

  // Remove from atlas
  atlas.portraits.splice(index, 1);
  saveAtlas(atlas);

  // Remove from database
  if (fs.existsSync(PLAYERS_DB_PATH)) {
    const db = new Database(PLAYERS_DB_PATH);
    try {
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_developer_portraits'"
      ).get();

      if (tableExists) {
        db.prepare('DELETE FROM bundled_developer_portraits WHERE pid = ?').run(pid);
        console.log(`Removed from players.db: PID ${pid}`);
      }
    } finally {
      db.close();
    }
  }

  console.log(`\nRemoved developer portrait: PID ${pid} (Player ${portrait.playerId})`);
  console.log(`\nRun 'node scripts/manage-developer-portraits.js build-sprites' to rebuild sprite sheets.`);
}

// Import portrait from user's custom-players.db
async function importFromUserDb(userPid, playerId, playerName) {
  ensureDirectories();

  // Find user database
  const userDataPaths = [
    path.join(process.env.APPDATA || '', 'madden-editor-suite', 'user-database', 'custom-players.db'),
    path.join(process.env.HOME || '', '.config', 'madden-editor-suite', 'user-database', 'custom-players.db'),
    path.join(process.env.HOME || '', 'Library', 'Application Support', 'madden-editor-suite', 'user-database', 'custom-players.db'),
  ];

  const userDbPath = userDataPaths.find(p => fs.existsSync(p));
  if (!userDbPath) {
    console.error('Error: Could not find user custom-players.db');
    console.log('Searched in:', userDataPaths);
    process.exit(1);
  }

  console.log(`Found user database: ${userDbPath}`);

  const userDb = new Database(userDbPath, { readonly: true });

  try {
    // Get the portrait from user database
    const row = userDb.prepare(
      'SELECT image_data, player_name, database_player_id FROM custom_portraits WHERE pid = ?'
    ).get(userPid);

    if (!row) {
      console.error(`Error: No portrait found with PID ${userPid} in user database`);
      process.exit(1);
    }

    // Use provided values or fall back to user db values
    const finalPlayerId = playerId || row.database_player_id;
    const finalPlayerName = playerName || row.player_name;

    if (!finalPlayerId) {
      console.error('Error: No player ID available. Provide it as an argument.');
      process.exit(1);
    }

    // Load atlas
    const atlas = loadAtlas();

    // Check if player already has a portrait
    const existingIndex = atlas.portraits.findIndex(p => p.playerId === finalPlayerId);
    if (existingIndex !== -1) {
      console.log(`Player ${finalPlayerId} already has a developer portrait (PID ${atlas.portraits[existingIndex].pid})`);
      console.log('Remove it first with: node scripts/manage-developer-portraits.js remove <pid>');
      return;
    }

    // Get next PID
    const pid = getNextAvailablePid(atlas);
    console.log(`Assigning PID ${pid} to player ${finalPlayerId}${finalPlayerName ? ` (${finalPlayerName})` : ''}`);

    // Save image to developer-portraits folder
    const outputFilename = `dev_portrait_${pid}.png`;
    const outputPath = path.join(DEV_PORTRAITS_DIR, outputFilename);

    // The image_data is a Buffer - resize to 256x256
    await sharp(row.image_data)
      .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, { fit: 'cover' })
      .png()
      .toFile(outputPath);

    console.log(`Saved: ${outputPath}`);

    // Add to atlas
    atlas.portraits.push({
      id: `dev_${pid}`,
      pid: pid,
      playerId: finalPlayerId,
      playerName: finalPlayerName || null,
      filename: outputFilename,
      category: 'developer',
      sheet: -1,
      x: 0,
      y: 0,
      width: PORTRAIT_WIDTH,
      height: PORTRAIT_HEIGHT,
      addedAt: new Date().toISOString()
    });

    saveAtlas(atlas);

    // Update database
    updateDatabase(finalPlayerId, pid, finalPlayerName);

    console.log(`\nSuccessfully imported from user database:`);
    console.log(`  User PID: ${userPid} -> Developer PID: ${pid}`);
    console.log(`  Player ID: ${finalPlayerId}`);
    console.log(`  Name: ${finalPlayerName || '(not specified)'}`);
    console.log(`\nRun 'node scripts/manage-developer-portraits.js build-sprites' to generate sprite sheets.`);
  } finally {
    userDb.close();
  }
}

// Import ALL portraits from user's custom-players.db
async function importAllFromUserDb() {
  ensureDirectories();

  // Find user database
  const userDataPaths = [
    path.join(process.env.APPDATA || '', 'madden-editor-suite', 'user-database', 'custom-players.db'),
    path.join(process.env.HOME || '', '.config', 'madden-editor-suite', 'user-database', 'custom-players.db'),
    path.join(process.env.HOME || '', 'Library', 'Application Support', 'madden-editor-suite', 'user-database', 'custom-players.db'),
  ];

  const userDbPath = userDataPaths.find(p => fs.existsSync(p));
  if (!userDbPath) {
    console.error('Error: Could not find user custom-players.db');
    process.exit(1);
  }

  console.log(`Found user database: ${userDbPath}`);

  const userDb = new Database(userDbPath, { readonly: true });

  try {
    // Get all portraits that have database_player_id (linked to bundled DB)
    const rows = userDb.prepare(
      'SELECT pid, image_data, player_name, database_player_id FROM custom_portraits WHERE database_player_id IS NOT NULL AND database_player_id > 0'
    ).all();

    if (rows.length === 0) {
      console.log('No portraits with linked database players found.');
      return;
    }

    console.log(`Found ${rows.length} portraits with linked database players.\n`);

    const atlas = loadAtlas();
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const playerId = row.database_player_id;
      const playerName = row.player_name;

      // Check if already exists
      const exists = atlas.portraits.some(p => p.playerId === playerId);
      if (exists) {
        console.log(`  Skipping ${playerName || playerId} - already exists`);
        skipped++;
        continue;
      }

      // Get next PID
      const pid = getNextAvailablePid(atlas);

      // Save image
      const outputFilename = `dev_portrait_${pid}.png`;
      const outputPath = path.join(DEV_PORTRAITS_DIR, outputFilename);

      await sharp(row.image_data)
        .resize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT, { fit: 'cover' })
        .png()
        .toFile(outputPath);

      // Add to atlas
      atlas.portraits.push({
        id: `dev_${pid}`,
        pid: pid,
        playerId: playerId,
        playerName: playerName || null,
        filename: outputFilename,
        category: 'developer',
        sheet: -1,
        x: 0,
        y: 0,
        width: PORTRAIT_WIDTH,
        height: PORTRAIT_HEIGHT,
        addedAt: new Date().toISOString()
      });

      // Update database
      updateDatabase(playerId, pid, playerName);

      console.log(`  Imported: ${playerName || playerId} -> PID ${pid}`);
      imported++;
    }

    saveAtlas(atlas);

    console.log(`\nImport complete: ${imported} imported, ${skipped} skipped`);
    console.log(`\nRun 'node scripts/manage-developer-portraits.js build-sprites' to generate sprite sheets.`);
  } finally {
    userDb.close();
  }
}

// Build sprite sheets from individual portraits
async function buildSprites() {
  ensureDirectories();

  const atlas = loadAtlas();

  if (atlas.portraits.length === 0) {
    console.log('No developer portraits to build.');
    return;
  }

  console.log(`Building sprite sheets for ${atlas.portraits.length} developer portraits...`);

  // Calculate number of sheets needed
  const numSheets = Math.ceil(atlas.portraits.length / PORTRAITS_PER_SHEET);

  // Sort portraits by PID for consistent ordering
  atlas.portraits.sort((a, b) => a.pid - b.pid);

  // Process each sheet
  for (let sheetIndex = 0; sheetIndex < numSheets; sheetIndex++) {
    const sheetWidth = GRID_COLUMNS * PORTRAIT_WIDTH;
    const sheetHeight = GRID_ROWS * PORTRAIT_HEIGHT;

    // Create composite operations
    const composites = [];
    const startIdx = sheetIndex * PORTRAITS_PER_SHEET;
    const endIdx = Math.min(startIdx + PORTRAITS_PER_SHEET, atlas.portraits.length);

    for (let i = startIdx; i < endIdx; i++) {
      const portrait = atlas.portraits[i];
      const localIdx = i - startIdx;
      const col = localIdx % GRID_COLUMNS;
      const row = Math.floor(localIdx / GRID_COLUMNS);
      const x = col * PORTRAIT_WIDTH;
      const y = row * PORTRAIT_HEIGHT;

      // Update atlas entry
      portrait.sheet = sheetIndex;
      portrait.x = x;
      portrait.y = y;

      // Add to composites
      const imagePath = path.join(DEV_PORTRAITS_DIR, portrait.filename);
      if (fs.existsSync(imagePath)) {
        composites.push({
          input: imagePath,
          left: x,
          top: y
        });
      } else {
        console.warn(`Warning: Image not found: ${imagePath}`);
      }
    }

    // Create the sprite sheet
    const sheetPath = path.join(DEV_SPRITES_DIR, `developer-sheet-${sheetIndex}.png`);

    await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite(composites)
      .png()
      .toFile(sheetPath);

    console.log(`Created: ${sheetPath} (${endIdx - startIdx} portraits)`);
  }

  // Update atlas with sheet count
  atlas.sheets = numSheets;
  saveAtlas(atlas);

  console.log(`\nSprite build complete: ${numSheets} sheet(s) created.`);
  console.log('\nDon\'t forget to run the build to include these in the packaged app.');
}

// Main CLI handler
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'add':
      if (args.length < 3) {
        console.error('Usage: node scripts/manage-developer-portraits.js add <image_path> <player_id> [player_name]');
        process.exit(1);
      }
      await addPortrait(args[1], parseInt(args[2]), args[3]);
      break;

    case 'list':
      listPortraits();
      break;

    case 'remove':
      if (args.length < 2) {
        console.error('Usage: node scripts/manage-developer-portraits.js remove <pid>');
        process.exit(1);
      }
      removePortrait(parseInt(args[1]));
      break;

    case 'build-sprites':
      await buildSprites();
      break;

    case 'import':
      if (args.length < 2) {
        console.error('Usage: node scripts/manage-developer-portraits.js import <user_pid> [player_id] [player_name]');
        process.exit(1);
      }
      await importFromUserDb(parseInt(args[1]), args[2] ? parseInt(args[2]) : null, args[3]);
      break;

    case 'import-all':
      await importAllFromUserDb();
      break;

    default:
      console.log(`
Developer Portraits Management Script

Commands:
  add <image_path> <player_id> [player_name]
    Add a new developer portrait from an image file

  import <user_pid> [player_id] [player_name]
    Import a single portrait from your user database by its PID
    (player_id and player_name default to user db values if not specified)

  import-all
    Import ALL portraits from your user database that are linked to database players

  list
    List all developer portraits

  remove <pid>
    Remove a developer portrait by PID

  build-sprites
    Generate sprite sheets from individual portraits

Examples:
  node scripts/manage-developer-portraits.js add ./todd-shanks.png 24656 "Todd Shanks"
  node scripts/manage-developer-portraits.js import 12155
  node scripts/manage-developer-portraits.js import-all
  node scripts/manage-developer-portraits.js list
  node scripts/manage-developer-portraits.js build-sprites

PID Range: ${DEV_PID_START}-${DEV_PID_END} (reserved for developer portraits)
Sprite Size: ${PORTRAIT_WIDTH}x${PORTRAIT_HEIGHT}
Grid: ${GRID_COLUMNS}x${GRID_ROWS} (${PORTRAITS_PER_SHEET} portraits per sheet)
      `);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
