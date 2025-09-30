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
  try {
    console.log('[RosterParser] Opening file:', filePath);

    // Open franchise file using madden-franchise
    const franchise = new Franchise(filePath);

    // Parse the file
    await franchise.on('ready', async () => {
      console.log('[RosterParser] File ready, game year:', franchise.schema.meta.gameYear);
    });

    // Wait for franchise to be ready
    if (!franchise.isLoaded) {
      await new Promise((resolve) => {
        franchise.on('ready', resolve);
      });
    }

    // Get the PLAY table (player data)
    const playerTable = franchise.getTableByName('Player');

    if (!playerTable) {
      throw new Error('Player table not found in roster file');
    }

    console.log('[RosterParser] Found Player table with', playerTable.records.length, 'records');

    // Extract player data
    const players = [];

    for (const record of playerTable.records) {
      // Extract all player fields
      const player = {
        // Identity
        PGID: record.fields.PlayerId || record.index,
        PLNA: record.fields.LastName || '',
        PFNA: record.fields.FirstName || '',

        // Basic Info
        PPOS: record.fields.Position || 0,
        TGID: record.fields.TeamId || 0,
        POVR: record.fields.Overall || 0,
        PAGE: record.fields.Age || 21,
        PYER: record.fields.YearsPro || 0,
        PJEN: record.fields.JerseyNum || 0,

        // Physical Attributes
        PHGT: record.fields.Height || 72,
        PWGT: record.fields.Weight || 200,

        // Core Ratings
        PSPD: record.fields.Speed || 50,
        PACC: record.fields.Acceleration || 50,
        PSTR: record.fields.Strength || 50,
        PAGI: record.fields.Agility || 50,
        PAWR: record.fields.Awareness || 50,
        PJMP: record.fields.Jumping || 50,
        PSTA: record.fields.Stamina || 50,
        PINJ: record.fields.Injury || 50,
        PTGH: record.fields.Toughness || 50,

        // Passing
        PTHP: record.fields.ThrowPower || 50,
        PTHA: record.fields.ThrowAccuracyShort || 50,
        PTAM: record.fields.ThrowAccuracyMid || 50,
        PTAD: record.fields.ThrowAccuracyDeep || 50,
        PTOR: record.fields.ThrowOnTheRun || 50,
        PTUP: record.fields.ThrowUnderPressure || 50,

        // Receiving
        PCTH: record.fields.Catching || 50,
        PDRR: record.fields.ShortRouteRunning || 50,
        PMRR: record.fields.MediumRouteRunning || 50,
        PDRR: record.fields.DeepRouteRunning || 50,
        PLCI: record.fields.CatchInTraffic || 50,
        PSPC: record.fields.SpectacularCatch || 50,

        // Rushing
        PCAR: record.fields.Carrying || 50,
        PBTK: record.fields.BreakTackle || 50,
        PELU: record.fields.Elusiveness || 50,
        PJUK: record.fields.Juke || 50,
        PSPN: record.fields.Spin || 50,
        PLSM: record.fields.Stiffarm || 50,
        PTRK: record.fields.Trucking || 50,

        // Blocking
        PPBK: record.fields.PassBlock || 50,
        PPBS: record.fields.PassBlockStrength || 50,
        PPBF: record.fields.PassBlockFinesse || 50,
        PRBK: record.fields.RunBlock || 50,
        PRBS: record.fields.RunBlockStrength || 50,
        PRBF: record.fields.RunBlockFinesse || 50,
        PLBK: record.fields.LeadBlock || 50,
        PIBL: record.fields.ImpactBlocking || 50,

        // Defense
        PTAK: record.fields.Tackle || 50,
        PHIT: record.fields.HitPower || 50,
        PPOW: record.fields.PowerMoves || 50,
        PFMS: record.fields.FinesseMoves || 50,
        PBSG: record.fields.BlockShedding || 50,
        PPRC: record.fields.Pursuit || 50,
        PPLA: record.fields.PlayRecognition || 50,

        // Coverage
        PMCV: record.fields.ManCoverage || 50,
        PZCV: record.fields.ZoneCoverage || 50,
        PPRZ: record.fields.Press || 50,

        // Kicking
        PKPR: record.fields.KickPower || 50,
        PKAC: record.fields.KickAccuracy || 50,
        PKRT: record.fields.KickReturn || 50,

        // Special
        PRET: record.fields.Return || 50,

        // Mental
        PLPE: record.fields.PlayAction || 50,

        // Background
        PCOL: record.fields.CollegeId || 0,
        PHSN: record.fields.HomeState || 0,
        PHTN: record.fields.Hometown || '',

        // Player ID (for faces)
        PSXP: record.fields.PLYR_ASSETNAME || 0,

        // Contract
        PCON: record.fields.ContractLength || 0,
        PCSA: record.fields.ContractSalary || 0,
        PCSB: record.fields.ContractBonus || 0,

        // Development
        PDPI: record.fields.PlayerSchemefit || 0,
        PTSA: record.fields.TotalSalary || 0,
        PYRP: record.fields.YearsWithTeam || 0,

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
    console.error('[RosterParser] Error parsing roster file:', error);
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
      if (record.fields.FirstName !== undefined) record.fields.FirstName = player.PFNA;
      if (record.fields.LastName !== undefined) record.fields.LastName = player.PLNA;
      if (record.fields.Position !== undefined) record.fields.Position = player.PPOS;
      if (record.fields.TeamId !== undefined) record.fields.TeamId = player.TGID;
      if (record.fields.Overall !== undefined) record.fields.Overall = player.POVR;
      if (record.fields.Age !== undefined) record.fields.Age = player.PAGE;
      if (record.fields.JerseyNum !== undefined) record.fields.JerseyNum = player.PJEN;

      // Physical
      if (record.fields.Height !== undefined) record.fields.Height = player.PHGT;
      if (record.fields.Weight !== undefined) record.fields.Weight = player.PWGT;

      // Core Ratings
      if (record.fields.Speed !== undefined) record.fields.Speed = player.PSPD;
      if (record.fields.Acceleration !== undefined) record.fields.Acceleration = player.PACC;
      if (record.fields.Strength !== undefined) record.fields.Strength = player.PSTR;
      if (record.fields.Agility !== undefined) record.fields.Agility = player.PAGI;
      if (record.fields.Awareness !== undefined) record.fields.Awareness = player.PAWR;
      if (record.fields.Jumping !== undefined) record.fields.Jumping = player.PJMP;
      if (record.fields.Stamina !== undefined) record.fields.Stamina = player.PSTA;
      if (record.fields.Injury !== undefined) record.fields.Injury = player.PINJ;
      if (record.fields.Toughness !== undefined) record.fields.Toughness = player.PTGH;

      // Passing
      if (record.fields.ThrowPower !== undefined) record.fields.ThrowPower = player.PTHP;
      if (record.fields.ThrowAccuracyShort !== undefined) record.fields.ThrowAccuracyShort = player.PTHA;
      if (record.fields.ThrowAccuracyMid !== undefined) record.fields.ThrowAccuracyMid = player.PTAM;
      if (record.fields.ThrowAccuracyDeep !== undefined) record.fields.ThrowAccuracyDeep = player.PTAD;

      // Receiving
      if (record.fields.Catching !== undefined) record.fields.Catching = player.PCTH;
      if (record.fields.Carrying !== undefined) record.fields.Carrying = player.PCAR;

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
