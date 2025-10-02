/**
 * Madden 26 FBCHUNKS Roster File Parser
 *
 * Uses proven code from Head Coach Editor (madden-file-tools package)
 * This is the WORKING implementation that successfully parses Madden roster files.
 *
 * Source: madden-file-tools v2.9.1 (MIT License)
 * GitHub: https://github.com/bep713/madden-file-tools
 */

// Use madden-file-tools - dynamically located based on environment
const path = require('path');

// Try to find madden-file-tools in multiple locations (dev vs packaged)
let MaddenRosterHelper;
try {
  // First try: Local vendor directory (if we bundle it)
  const vendorPath = path.join(__dirname, '..', 'vendor', 'madden-file-tools');
  MaddenRosterHelper = require(path.join(vendorPath, 'helpers', 'MaddenRosterHelper'));
} catch (err1) {
  try {
    // Second try: Additional working directories from environment
    const additionalDirs = process.env.ADDITIONAL_WORKING_DIRS || '';
    const dirs = additionalDirs.split(';').filter(d => d.trim());

    if (dirs.length > 0) {
      // Use the first additional directory (madden-file-tools/helpers)
      MaddenRosterHelper = require(path.join(dirs[0], 'MaddenRosterHelper'));
    } else {
      throw new Error('ADDITIONAL_WORKING_DIRS not configured');
    }
  } catch (err2) {
    // Third try: Fallback to external location (development only)
    const externalPath = path.join('C:', 'Users', 'tshan', 'OneDrive', 'Documents', 'Madden Files', 'Madden 26', 'Tools', 'Head Coach Editor', 'resources', 'node_modules', 'madden-file-tools');
    MaddenRosterHelper = require(path.join(externalPath, 'helpers', 'MaddenRosterHelper'));
  }
}

/**
 * Parse a Madden FBCHUNKS roster file
 * @param {string} filePath - Absolute path to roster file
 * @returns {Promise<Object>} Parsed roster data with players array
 */
async function parseRosterFile(filePath) {
  console.log('[RosterParser] ===== START ROSTER PARSE =====');
  console.log('[RosterParser] File path:', filePath);

  try {
    const helper = new MaddenRosterHelper();

    // Load the roster file using proven MaddenRosterHelper
    console.log('[RosterParser] Loading roster with MaddenRosterHelper...');
    const file = await helper.load(filePath);

    console.log('[RosterParser] Roster loaded successfully');
    console.log('[RosterParser] Found', file.tables.length, 'tables');

    // List all table names
    const tableNames = file.tables.map(t => t.name);
    console.log('[RosterParser] Tables:', tableNames.join(', '));

    // Get player table (PLAY in TDB2 format)
    const playerTable = file.PLAY;

    if (!playerTable) {
      console.error('[RosterParser] Available tables:', tableNames.join(', '));
      throw new Error('PLAY table not found in roster file');
    }

    console.log('[RosterParser] Found PLAY table with', playerTable.records.length, 'players');

    // Extract player data
    const players = [];
    for (const record of playerTable.records) {
      const player = {};

      // Convert TDB2 fields to plain object
      for (const fieldName in record.fields) {
        player[fieldName] = record.fields[fieldName].value;
      }

      players.push(player);
    }

    console.log('[RosterParser] Successfully extracted', players.length, 'players');

    // Log sample player
    if (players.length > 0) {
      const sample = players[0];
      console.log('[RosterParser] Sample player:', {
        firstName: sample.PFNA,
        lastName: sample.PLNA,
        overall: sample.POVR,
        position: sample.PPOS
      });
    }

    // Store file and helper in global scope for saving later
    global.rosterFile = file;
    global.rosterHelper = helper;

    return {
      version: 2026, // Madden 26
      playerCount: players.length,
      players: players,
      teams: [] // TODO: Extract team data from TEAM table
    };

  } catch (error) {
    console.error('[RosterParser] ===== ERROR IN PARSE =====');
    console.error('[RosterParser] Error type:', error.constructor.name);
    console.error('[RosterParser] Error message:', error.message);
    console.error('[RosterParser] Error stack:', error.stack);
    console.error('[RosterParser] ===========================');
    throw new Error(`Failed to parse roster file: ${error.message}`);
  }
}

/**
 * Save roster file (not yet implemented)
 */
async function saveRosterFile(filePath, players) {
  console.log('[RosterParser] ===== START ROSTER SAVE =====');
  console.log('[RosterParser] Output path:', filePath);

  try {
    if (!global.rosterHelper || !global.rosterFile) {
      throw new Error('No roster file loaded - must load before saving');
    }

    const helper = global.rosterHelper;
    const file = global.rosterFile;

    // Update player values in the TDB2 file
    const playerTable = file.PLAY;

    console.log('[RosterParser] Updating', players.length, 'player records');
    let fieldsUpdated = 0;

    for (let i = 0; i < players.length && i < playerTable.records.length; i++) {
      const record = playerTable.records[i];
      const playerData = players[i];

      // Update each field (exclude PLAYERPIC - it's a virtual field for display only)
      for (const fieldName in playerData) {
        if (fieldName === 'PLAYERPIC') {
          continue; // Skip virtual field
        }
        if (record.fields[fieldName]) {
          record.fields[fieldName].value = playerData[fieldName];
          fieldsUpdated++;
        }
      }
    }

    console.log('[RosterParser] Updated', fieldsUpdated, 'field values');
    console.log('[RosterParser] Original record has', Object.keys(playerTable.records[0].fields).length, 'fields - all preserved');

    // Save using MaddenRosterHelper
    await helper.save(filePath);

    console.log('[RosterParser] Roster saved successfully');
    console.log('[RosterParser] ===========================');

  } catch (error) {
    console.error('[RosterParser] ===== ERROR IN SAVE =====');
    console.error('[RosterParser] Error:', error.message);
    console.error('[RosterParser] ========================');
    throw new Error(`Failed to save roster file: ${error.message}`);
  }
}

module.exports = {
  parseRosterFile,
  saveRosterFile
};
