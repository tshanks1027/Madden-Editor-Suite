/**
 * Roster File Parser
 *
 * Parses Madden roster files using the madden-franchise package.
 * Extracts player data from the PLAY table and converts to editable format.
 *
 * Source: Adapted from madden-franchise by bep713 (MIT License)
 * Reference: RESEARCH_FINDINGS.md section 2.1
 */

const Franchise = require('madden-franchise');

/**
 * Parse a Madden roster file
 * @param {string} filePath - Absolute path to roster file
 * @returns {Promise<Object>} Parsed roster data with players array
 */
async function parseRosterFile(filePath) {
  console.log('[RosterParser] ===== START PARSE =====');
  console.log('[RosterParser] File path:', filePath);

  try {
    console.log('[RosterParser] Step 1: Calling Franchise.create()...');
    const franchise = await Franchise.create(filePath);
    console.log('[RosterParser] Step 2: Franchise created successfully');

    console.log('[RosterParser] Step 3: Checking schema...');
    console.log('[RosterParser] File ready, game year:', franchise.schema.meta.gameYear);

    // Get the Player table
    console.log('[RosterParser] Step 4: Getting Player table...');
    const playerTable = franchise.getTableByName('Player');
    console.log('[RosterParser] Step 5: Player table retrieved:', !!playerTable);

    if (!playerTable) {
      throw new Error('Player table not found in roster file');
    }

    // Read all records from the table
    console.log('[RosterParser] Step 6: Reading records...');
    await playerTable.readRecords();
    console.log('[RosterParser] Step 7: Records read successfully');

    console.log('[RosterParser] Found Player table with', playerTable.records.length, 'records');

    // Extract player data
    const players = [];

    for (const record of playerTable.records) {
      // Extract all player fields
      const player = {
        // Identity
        PGID: record.PlayerId || record.index,
        PLNA: record.LastName || '',
        PFNA: record.FirstName || '',

        // Basic Info
        PPOS: record.Position || 0,
        TGID: record.TeamId || 0,
        POVR: record.Overall || 0,
        PAGE: record.Age || 21,
        PYER: record.YearsPro || 0,
        PJEN: record.JerseyNum || 0,

        // Physical Attributes
        PHGT: record.Height || 72,
        PWGT: record.Weight || 200,

        // Core Ratings
        PSPD: record.Speed || 50,
        PACC: record.Acceleration || 50,
        PSTR: record.Strength || 50,
        PAGI: record.Agility || 50,
        PAWR: record.Awareness || 50,
        PJMP: record.Jumping || 50,
        PSTA: record.Stamina || 50,
        PINJ: record.Injury || 50,
        PTGH: record.Toughness || 50,

        // Passing
        PTHP: record.ThrowPower || 50,
        PTHA: record.ThrowAccuracyShort || 50,
        PTAM: record.ThrowAccuracyMid || 50,
        PTAD: record.ThrowAccuracyDeep || 50,
        PTOR: record.ThrowOnTheRun || 50,
        PTUP: record.ThrowUnderPressure || 50,

        // Receiving
        PCTH: record.Catching || 50,
        PDRR: record.ShortRouteRunning || 50,
        PMRR: record.MediumRouteRunning || 50,
        PDRR: record.DeepRouteRunning || 50,
        PLCI: record.CatchInTraffic || 50,
        PSPC: record.SpectacularCatch || 50,

        // Rushing
        PCAR: record.Carrying || 50,
        PBTK: record.BreakTackle || 50,
        PELU: record.Elusiveness || 50,
        PJUK: record.Juke || 50,
        PSPN: record.Spin || 50,
        PLSM: record.Stiffarm || 50,
        PTRK: record.Trucking || 50,

        // Blocking
        PPBK: record.PassBlock || 50,
        PPBS: record.PassBlockStrength || 50,
        PPBF: record.PassBlockFinesse || 50,
        PRBK: record.RunBlock || 50,
        PRBS: record.RunBlockStrength || 50,
        PRBF: record.RunBlockFinesse || 50,
        PLBK: record.LeadBlock || 50,
        PIBL: record.ImpactBlocking || 50,

        // Defense
        PTAK: record.Tackle || 50,
        PHIT: record.HitPower || 50,
        PPOW: record.PowerMoves || 50,
        PFMS: record.FinesseMoves || 50,
        PBSG: record.BlockShedding || 50,
        PPRC: record.Pursuit || 50,
        PPLA: record.PlayRecognition || 50,

        // Coverage
        PMCV: record.ManCoverage || 50,
        PZCV: record.ZoneCoverage || 50,
        PPRZ: record.Press || 50,

        // Kicking
        PKPR: record.KickPower || 50,
        PKAC: record.KickAccuracy || 50,
        PKRT: record.KickReturn || 50,

        // Special
        PRET: record.Return || 50,

        // Mental
        PLPE: record.PlayAction || 50,

        // Background
        PCOL: record.CollegeId || 0,
        PHSN: record.HomeState || 0,
        PHTN: record.Hometown || '',

        // Player ID (for faces)
        PSXP: record.PLYR_ASSETNAME || 0,

        // Contract
        PCON: record.ContractLength || 0,
        PCSA: record.ContractSalary || 0,
        PCSB: record.ContractBonus || 0,

        // Development
        PDPI: record.PlayerSchemefit || 0,
        PTSA: record.TotalSalary || 0,
        PYRP: record.YearsWithTeam || 0,

        // Store original record for reference
        _originalRecord: record
      };

      players.push(player);
    }

    console.log('[RosterParser] Successfully parsed', players.length, 'players');

    return {
      version: franchise.schema.meta.gameYear,
      playerCount: players.length,
      players: players,
      teams: [], // TODO: Extract team data if needed
      _franchise: franchise // Keep reference for saving
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
 * Save roster file with modified player data
 * @param {string} filePath - Path to save file
 * @param {Array} players - Modified player array
 * @param {Object} originalData - Original parsed data with _franchise reference
 * @returns {Promise<void>}
 */
async function saveRosterFile(filePath, players, originalData) {
  try {
    console.log('[RosterParser] Saving roster file to:', filePath);

    const franchise = originalData._franchise;

    if (!franchise) {
      throw new Error('Original franchise data not found - cannot save');
    }

    // Get player table
    const playerTable = franchise.getTableByName('Player');

    if (!playerTable) {
      throw new Error('Player table not found');
    }

    // Update each player record
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const record = playerTable.records[i];

      if (!record) {
        console.warn('[RosterParser] Skipping player at index', i, '- no matching record');
        continue;
      }

      // Update fields that were edited
      // (Only update fields that exist in the schema)
      if (record.FirstName !== undefined) record.FirstName = player.PFNA;
      if (record.LastName !== undefined) record.LastName = player.PLNA;
      if (record.Position !== undefined) record.Position = player.PPOS;
      if (record.TeamId !== undefined) record.TeamId = player.TGID;
      if (record.Overall !== undefined) record.Overall = player.POVR;
      if (record.Age !== undefined) record.Age = player.PAGE;
      if (record.JerseyNum !== undefined) record.JerseyNum = player.PJEN;

      // Physical
      if (record.Height !== undefined) record.Height = player.PHGT;
      if (record.Weight !== undefined) record.Weight = player.PWGT;

      // Core Ratings
      if (record.Speed !== undefined) record.Speed = player.PSPD;
      if (record.Acceleration !== undefined) record.Acceleration = player.PACC;
      if (record.Strength !== undefined) record.Strength = player.PSTR;
      if (record.Agility !== undefined) record.Agility = player.PAGI;
      if (record.Awareness !== undefined) record.Awareness = player.PAWR;
      if (record.Jumping !== undefined) record.Jumping = player.PJMP;
      if (record.Stamina !== undefined) record.Stamina = player.PSTA;
      if (record.Injury !== undefined) record.Injury = player.PINJ;
      if (record.Toughness !== undefined) record.Toughness = player.PTGH;

      // Passing
      if (record.ThrowPower !== undefined) record.ThrowPower = player.PTHP;
      if (record.ThrowAccuracyShort !== undefined) record.ThrowAccuracyShort = player.PTHA;
      if (record.ThrowAccuracyMid !== undefined) record.ThrowAccuracyMid = player.PTAM;
      if (record.ThrowAccuracyDeep !== undefined) record.ThrowAccuracyDeep = player.PTAD;

      // Receiving
      if (record.Catching !== undefined) record.Catching = player.PCTH;
      if (record.Carrying !== undefined) record.Carrying = player.PCAR;

      // Add more field mappings as needed...
    }

    // Save the file
    await franchise.save(filePath);

    console.log('[RosterParser] Successfully saved roster file');

  } catch (error) {
    console.error('[RosterParser] Error saving roster file:', error);
    throw new Error(`Failed to save roster file: ${error.message}`);
  }
}

module.exports = {
  parseRosterFile,
  saveRosterFile
};
