/**
 * Franchise File IPC Handlers
 * Handles loading, parsing, and saving franchise files
 */

import { ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

const Franchise = require('madden-franchise');

// Load college lookup CSV at module initialization
// Source: data/lookups/college_lookup.csv
let collegeMap: Map<number, string> | null = null;

function loadCollegeLookup(): Map<number, string> {
  if (collegeMap) return collegeMap;

  collegeMap = new Map();

  try {
    // Get path relative to app resources
    // In dev: __dirname is .vite/build, CSV is copied to .vite/build/data/lookups/
    // In prod: app.getAppPath() points to resources, CSV is at resources/data/lookups/
    const csvPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'lookups', 'college_lookup.csv')
      : path.join(__dirname, 'data', 'lookups', 'college_lookup.csv');

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [idStr, name] = line.split(',');
      const id = parseInt(idStr, 10);

      if (!isNaN(id) && name) {
        collegeMap.set(id, name.trim());
      }
    }

    console.log(`[Franchise] Loaded ${collegeMap.size} colleges from CSV`);
  } catch (error) {
    console.error('[Franchise] Error loading college lookup CSV:', error);
  }

  return collegeMap;
}

// Load PID to Portrait mapping (for generic faces)
// Source: data/lookups/PID_Portrait_Mapping.csv
let pidPortraitMapping: Map<string, number> | null = null; // PLPO -> PID

function loadPIDPortraitMapping(): Map<string, number> {
  if (pidPortraitMapping) return pidPortraitMapping;

  pidPortraitMapping = new Map();

  try {
    const csvPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'lookups', 'PID_Portrait_Mapping.csv')
      : path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [pidStr, type, portrait] = line.split(',');
      const pid = parseInt(pidStr, 10);

      if (!isNaN(pid) && portrait) {
        // Map PLPO -> first PID found (there can be multiple PIDs per PLPO)
        const plpo = portrait.trim();
        if (!pidPortraitMapping.has(plpo)) {
          pidPortraitMapping.set(plpo, pid);
        }
      }
    }

    console.log(`[Franchise] Loaded ${pidPortraitMapping.size} PLPO->PID mappings`);
  } catch (error) {
    console.error('[Franchise] Error loading PID portrait mapping:', error);
  }

  return pidPortraitMapping;
}

// Load franchise-to-roster college ID mapping
// Source: data/franchise-college-mapping.json (built by comparing roster and franchise files)
let franchiseCollegeMapping: Map<number, number> | null = null;

function loadFranchiseCollegeMapping(): Map<number, number> {
  if (franchiseCollegeMapping) return franchiseCollegeMapping;

  franchiseCollegeMapping = new Map();

  try {
    // Get path relative to app resources
    const mappingPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'franchise-college-mapping.json')
      : path.join(__dirname, 'data', 'franchise-college-mapping.json');

    const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
    const mappingArray = JSON.parse(mappingContent);

    // Build Map: franchise ID → roster ID
    for (const entry of mappingArray) {
      franchiseCollegeMapping.set(entry.franchiseId, entry.rosterId);
    }

    console.log(`[Franchise] Loaded ${franchiseCollegeMapping.size} franchise-to-roster college ID mappings`);
  } catch (error) {
    console.error('[Franchise] Error loading franchise college mapping JSON:', error);
  }

  return franchiseCollegeMapping;
}

// Load franchise-to-roster PID mapping
// Source: data/franchise-pid-mapping.json (built by comparing roster and franchise files)
let franchisePIDMapping: Map<number, number> | null = null;

function loadFranchisePIDMapping(): Map<number, number> {
  if (franchisePIDMapping) return franchisePIDMapping;

  franchisePIDMapping = new Map();

  try {
    // Get path relative to app resources
    const mappingPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'franchise-pid-mapping.json')
      : path.join(__dirname, 'data', 'franchise-pid-mapping.json');

    const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
    const mappingArray = JSON.parse(mappingContent);

    // Build Map: franchise PID → roster PID
    for (const entry of mappingArray) {
      franchisePIDMapping.set(entry.franchisePID, entry.rosterPID);
    }

    console.log(`[Franchise] Loaded ${franchisePIDMapping.size} franchise-to-roster PID mappings`);
  } catch (error) {
    console.error('[Franchise] Error loading franchise PID mapping JSON:', error);
  }

  return franchisePIDMapping;
}

// Load franchise-to-roster team ID mapping
// Source: data/franchise-team-mapping.json (built by comparing roster and franchise files)
let franchiseTeamMapping: Map<number, number> | null = null;

function loadFranchiseTeamMapping(): Map<number, number> {
  if (franchiseTeamMapping) return franchiseTeamMapping;

  franchiseTeamMapping = new Map();

  try {
    // Get path relative to app resources
    const mappingPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'franchise-team-mapping.json')
      : path.join(__dirname, 'data', 'franchise-team-mapping.json');

    const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
    const mappingArray = JSON.parse(mappingContent);

    // Build Map: franchise team ID → roster team ID
    for (const entry of mappingArray) {
      franchiseTeamMapping.set(entry.franchiseTeam, entry.rosterTeam);
    }

    console.log(`[Franchise] Loaded ${franchiseTeamMapping.size} franchise-to-roster team mappings`);
  } catch (error) {
    console.error('[Franchise] Error loading franchise team mapping JSON:', error);
  }

  return franchiseTeamMapping;
}

ipcMain.handle('franchise:select-file', async (event) => {
  const result = await dialog.showOpenDialog({
    title: 'Select Franchise File',
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile'],
    modal: true
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('franchise:load-file', async (_event, filePath: string) => {
  console.log('[Franchise] Loading file:', filePath);

  try {
    // Use Franchise.create() with M26 override for better file detection
    // Source: madden-franchise README - new way for v3.3.0+
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26  // Help library detect M26 files correctly
    });

    console.log('[Franchise] File loaded successfully');
    console.log('[Franchise] Game year:', franchise.schema?.meta?.gameYear);
    console.log('[Franchise] Tables count:', franchise.tables?.length || 0);

    // Get basic metadata
    const metadata = {
      filePath,
      fileName: path.basename(filePath),
      schemaVersion: franchise.schema?.meta?.major + '.' + franchise.schema?.meta?.minor,
      gameYear: franchise.schema?.meta?.gameYear,
      tables: franchise.tables ? franchise.tables.map((t: any) => t.name) : []
    };

    return {
      success: true,
      metadata
    };
  } catch (error: any) {
    console.error('[Franchise] Error loading file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Franchise attribute name to roster field code mapping
const FRANCHISE_TO_ROSTER_FIELD_MAP: Record<string, string> = {
  'LastName': 'PLNA',
  'FirstName': 'PFNA',
  'PresentationId': 'PSXP',
  'PLYR_ASSETNAME': 'PLAYERPIC',
  'PLYR_PORTRAIT': 'PEPS',
  'Position': 'PPOS',
  'YearsPro': 'PYRP',
  'TeamIndex': 'TGID',
  'JerseyNum': 'PJEN',
  'College': 'PCOL',
  'Age': 'PAGE',
  'Height': 'PHGT',
  'Weight': 'PWGT',
  'Hometown': 'PHTN',
  'HomeState': 'PHSN',
  'OverallRating': 'POVR',
  'AccelerationRating': 'PACC',
  'AgilityRating': 'PAGI',
  'AwarenessRating': 'PAWR',
  'BCVisionRating': 'PBCV',
  'BlockSheddingRating': 'PBSG',
  'BreakSackRating': 'PBSK',
  'BreakTackleRating': 'PBKT',
  'CarryingRating': 'PCAR',
  'CatchInTrafficRating': 'PLCI',
  'CatchingRating': 'PCTH',
  'ChangeOfDirectionRating': 'PELU',
  'ConfidenceRating': 'PCON',
  'DeepRouteRunningRating': 'PDRR',
  'FinesseMovesRating': 'PFMS',
  'HitPowerRating': 'PLHT',
  'ImpactBlockingRating': 'PLIB',
  'InjuryRating': 'PINJ',
  'JukeMoveRating': 'PLJM',
  'JumpingRating': 'PJMP',
  'KickAccuracyRating': 'PKAC',
  'KickPowerRating': 'PKPR',
  'KickReturnRating': 'PKRT',
  'LeadBlockRating': 'PLBK',
  'ManCoverageRating': 'PLMC',
  'MediumRouteRunningRating': 'PMRR',
  'PassBlockingRating': 'PPBK',
  'PassBlockFinesseRating': 'PPBF',
  'PassBlockStrengthRating': 'PPBS',
  'PlayActionRating': 'PPLA',
  'PowerMovesRating': 'PLPM',
  'PressRating': 'PLPE',
  'PursuitRating': 'PPRC',
  'ReleaseRating': 'PREL',
  'RunBlockingRating': 'PRBK',
  'RunBlockFinesseRating': 'PRBF',
  'RunBlockStrengthRating': 'PRBS',
  'ShortRouteRunningRating': 'PSRR',
  'SpectacularCatchRating': 'PLSC',
  'SpeedRating': 'PLSP',
  'SpinMoveRating': 'PSPD',
  'StaminaRating': 'PSTA',
  'StrengthRating': 'PSTR',
  'StiffArmRating': 'PLSA',
  'TackleRating': 'PTAK',
  'ThrowAccuracyDeepRating': 'PTAD',
  'ThrowAccuracyMidRating': 'PTAM',
  'ThrowAccuracyShortRating': 'PTAS',
  'ThrowOnTheRunRating': 'PTOR',
  'ThrowPowerRating': 'PTHP',
  'ThrowUnderPressureRating': 'PTUP',
  'ToughnessRating': 'PTGH',
  'TruckingRating': 'PTRK',
  'ZoneCoverageRating': 'PZCV'
};

ipcMain.handle('franchise:get-table-data', async (_event, filePath: string, tableName: string) => {
  console.log('[Franchise] Getting table data:', tableName);

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Get ALL tables with this name (not just the first one)
    const tables = franchise.getAllTablesByName ? franchise.getAllTablesByName(tableName) : [franchise.getTableByName(tableName)];

    if (!tables || tables.length === 0) {
      throw new Error(`Table ${tableName} not found`);
    }

    console.log('[Franchise] Found', tables.length, 'table(s) with name', tableName);

    let allRecords: any[] = [];

    // Read records from all table instances
    for (const table of tables) {
      if (!table) continue;

      // Read all records first
      await table.readRecords();

      const activeRecords = table.records.filter((r: any) => !r.isEmpty);

      console.log(`[Franchise] Processing ${activeRecords.length} active records from ${tableName}`);

      // Process records using fieldsArray pattern
      // Source: madden-franchise-editor TableEditorView.js line 331
      const processedRecords: any[] = [];

      // Load college lookup map and franchise-to-roster mappings
      const colleges = loadCollegeLookup();
      const collegeMapping = loadFranchiseCollegeMapping();
      const pidMapping = loadFranchisePIDMapping();
      const teamMapping = loadFranchiseTeamMapping();

      for (const record of activeRecords) {
        const data: any = {};

        // Use fieldsArray - field.value has enum values already converted
        for (const field of record.fieldsArray) {
          let value = field.value;

          // DEBUG: Log College field specifically
          if (field.key === 'College') {
            console.log(`[Franchise DEBUG] College field - key: ${field.key}, value type: ${typeof value}, value: ${value}`);
          }

          // Handle binary string fallback from failed enum conversion
          // Binary strings like "10000000000000000000011110110000" indicate enum lookup failed
          if (typeof value === 'string' && value.match(/^[01]{32}$/)) {
            // Parse binary string to integer
            const binaryInt = parseInt(value, 2);

            // Extract ID by masking off high bit (0x80000000)
            // The lower bits contain the actual enum/reference index
            const enumIndex = binaryInt & 0x7FFFFFFF;

            // For College field, use CSV lookup
            // Source: data/lookups/college_lookup.csv
            if (field.key === 'College') {
              const collegeName = colleges.get(enumIndex);
              if (collegeName) {
                value = collegeName;
                console.log(`[Franchise] College binary → CSV lookup: ${enumIndex} -> ${value}`);
              } else {
                console.log(`[Franchise] College ID ${enumIndex} not found in CSV (${colleges.size} entries)`);
              }
            } else {
              // For other enum fields, try the enum members (though they may be empty for M26)
              if (field.offset?.enum?._members?.[enumIndex]) {
                value = field.offset.enum._members[enumIndex].name;
                console.log(`[Franchise] Converted binary ${field.key}: ${enumIndex} -> ${value}`);
              } else {
                console.log(`[Franchise] Binary ${field.key}: index ${enumIndex} not found in enum (${field.offset?.enum?._members?.length || 0} members)`);
              }
            }
          }

          // Map franchise attribute name to roster field code
          const fieldCode = FRANCHISE_TO_ROSTER_FIELD_MAP[field.key] || field.key;
          data[fieldCode] = value;
        }

        // CRITICAL: M26 College field encoding - extract last 8 bits from 32-bit binary string
        // Source: Testing with CAREER-TEST franchise file - last 8 bits give franchise college ID
        // M26 changed College from enum to external reference requiring franchise→roster mapping then CSV lookup
        if (data.PCOL && typeof data.PCOL === 'string' && data.PCOL.match(/^[01]{32}$/)) {
          const last8Bits = data.PCOL.substring(24);  // Extract last 8 bits
          const franchiseCollegeId = parseInt(last8Bits, 2);  // Parse as binary to get franchise ID

          console.log(`[Franchise] College binary detected: ${data.PCOL.slice(0, 10)}...${data.PCOL.slice(-10)}`);
          console.log(`[Franchise] Last 8 bits: ${last8Bits} = franchise ID ${franchiseCollegeId}`);

          // Map franchise ID to roster ID, then look up college name
          const rosterCollegeId = collegeMapping.get(franchiseCollegeId);
          if (rosterCollegeId !== undefined) {
            const collegeName = colleges.get(rosterCollegeId);
            if (collegeName) {
              data.PCOL = collegeName;
              console.log(`[Franchise] College converted: franchise ID ${franchiseCollegeId} → roster ID ${rosterCollegeId} → ${collegeName}`);
            } else {
              console.log(`[Franchise] Roster college ID ${rosterCollegeId} not found in CSV (have ${colleges.size} entries)`);
              data.PCOL = franchiseCollegeId; // Store franchise ID if name not found
            }
          } else {
            console.log(`[Franchise] Franchise college ID ${franchiseCollegeId} not in mapping (have ${collegeMapping.size} entries)`);
            data.PCOL = franchiseCollegeId; // Store franchise ID if not in mapping
          }
        }

        // CRITICAL: M26 PresentationId (PID) encoding - map franchise PID to roster PID
        // Source: Franchise files use different PID values than roster files
        // Need to map franchise PID → roster PID for portrait lookup to work
        if (data.PSXP && typeof data.PSXP === 'number') {
          const franchisePID = data.PSXP;
          const rosterPID = pidMapping.get(franchisePID);

          if (rosterPID !== undefined) {
            data.PSXP = rosterPID;
            console.log(`[Franchise] PID converted: franchise PID ${franchisePID} → roster PID ${rosterPID}`);
          } else {
            console.log(`[Franchise] Franchise PID ${franchisePID} not in mapping (have ${pidMapping.size} entries)`);
          }
        }

        // CRITICAL: M26 Team ID encoding - map franchise team ID to roster team ID
        // Source: Franchise files use different team IDs than roster files
        // Need to map franchise TGID → roster team ID for team filter and display to work
        if (data.TGID !== undefined && data.TGID !== null && typeof data.TGID === 'number') {
          const franchiseTeamID = data.TGID;
          const rosterTeamID = teamMapping.get(franchiseTeamID);

          if (rosterTeamID !== undefined) {
            data.TGID = rosterTeamID;
            console.log(`[Franchise] Team converted: franchise team ${franchiseTeamID} → roster team ${rosterTeamID}`);
          } else {
            console.log(`[Franchise] Franchise team ${franchiseTeamID} not in mapping (have ${teamMapping.size} entries)`);
          }
        }

        // CRITICAL: For Coach table, also copy direct properties as fallback
        // Some properties like FirstName, LastName, TeamIndex are accessible directly but not in fieldsArray
        if (tableName === 'Coach') {
          const directProps = [
            // Basic Info
            'FirstName', 'LastName', 'Name', 'Position', 'Age', 'TeamIndex', 'Portrait',
            // Contract
            'ContractStatus', 'ContractLength', 'ContractSalary', 'ContractYearsRemaining', 'SeasonsWithTeam',
            // Career Stats
            'CareerWins', 'CareerLosses', 'CareerTies',
            'CareerPlayoffWins', 'CareerPlayoffLosses', 'CareerPlayoffsMade',
            'CareerSuperbowlWins', 'CareerSuperbowlLosses',
            'CareerPointsFor', 'CareerPointsAgainst',
            'CareerLongWinStreak', 'CareerWinSeasons', 'CareerProBowlPlayers',
            'CareerBigWinMargin', 'CareerBigLossMargin',
            // Season Stats
            'SeasWins', 'SeasLosses', 'SeasTies',
            'SeasPointsFor', 'SeasPointsAgainst',
            'SeasWinStreak', 'SeasLongWinStreak',
            'SeasBigWinMargin', 'SeasBigLossMargin',
            // Coaching Attributes & Ratings
            'Level', 'ExperiencePoints', 'Archetype',
            'COACH_OFFENSE', 'COACH_DEFENSE',
            'COACH_DB', 'COACH_DL', 'COACH_LB', 'COACH_K',
            'COACH_OFFENSETYPE', 'COACH_DEFENSETYPE',
            'COACH_OFFTENDENCYRUNPASS', 'COACH_DEFTENDENCYRUNPASS',
            'COACH_OFFTENDENCYAGGRESSCONSERV', 'COACH_DEFTENDENCYAGGRESSCONSERV',
            'COACH_DEMEANOR', 'COACH_ADAPTIVE_AI',
            'Personality', 'TeamBuilding', 'TradingTendency',
            'LegacyScore', 'YearlyAwardCount', 'AwardPoints',
            // Win Streaks
            'RegularWinStreak', 'SuperbowlWinStreak', 'WCPlayoffWinStreak',
            'DivPlayoffWinStreak', 'ConfPlayoffWinStreak', 'WinSeasStreak'
          ];
          for (const prop of directProps) {
            if (record[prop] !== undefined && data[prop] === undefined) {
              data[prop] = record[prop];
            }
          }
        }

        // CRITICAL: For Team table, also copy direct properties as fallback
        // TeamIndex and other key properties are accessible directly but may not extract properly from fieldsArray
        if (tableName === 'Team') {
          const directProps = [
            'TeamIndex', 'DisplayName', 'LongName', 'ShortName', 'CityName',
            'SeasonWins', 'SeasonLosses', 'SeasonTies',
            'HomeWin', 'HomeLoss', 'HomeTie',
            'AwayWin', 'AwayLoss', 'AwayTie',
            'TGID'
          ];
          for (const prop of directProps) {
            if (record[prop] !== undefined && data[prop] === undefined) {
              data[prop] = record[prop];
            }
          }
        }

        processedRecords.push(data);
      }

      allRecords = allRecords.concat(processedRecords);
    }

    console.log('[Franchise] Retrieved', allRecords.length, 'total active records from', tableName);

    // Debug: Log first record to see what fields we're actually returning
    if (allRecords.length > 0) {
      console.log('[Franchise] First record keys:', Object.keys(allRecords[0]));
      console.log('[Franchise] First record PCOL:', allRecords[0].PCOL);
      console.log('[Franchise] First record TGID:', allRecords[0].TGID);
      console.log('[Franchise] First record PHTN:', allRecords[0].PHTN);
      console.log('[Franchise] First record sample:', JSON.stringify(allRecords[0]).slice(0, 500));
    }

    return {
      success: true,
      records: allRecords,
      count: allRecords.length
    };
  } catch (error: any) {
    console.error('[Franchise] Error getting table data:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('franchise:get-draft-class', async (_event, filePath: string) => {
  console.log('[Franchise] Getting draft class data');

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Load DraftPlayer table
    const draftPlayerTable = franchise.getTableByName('DraftPlayer');
    if (!draftPlayerTable) {
      console.log('[Franchise] DraftPlayer table not found');
      return { success: false, error: 'DraftPlayer table not found' };
    }

    // Load Player table
    const playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      console.log('[Franchise] Player table not found');
      return { success: false, error: 'Player table not found' };
    }

    await draftPlayerTable.readRecords();
    await playerTable.readRecords();

    const draftRecords = draftPlayerTable.records.filter((r: any) => !r.isEmpty);
    console.log(`[Franchise] Found ${draftRecords.length} draft prospects`);

    // Load lookup mappings
    const colleges = loadCollegeLookup();
    const collegeMapping = loadFranchiseCollegeMapping();
    const pidMapping = loadFranchisePIDMapping();
    const teamMapping = loadFranchiseTeamMapping();
    const plpoToPidMapping = loadPIDPortraitMapping();

    const prospects: any[] = [];

    for (const draftRecord of draftRecords) {
      // Get the Player reference from DraftPlayer table
      // The reference is stored in field.referenceData.rowNumber
      const playerField = draftRecord.fieldsArray.find((f: any) => f.key === 'Player');

      if (!playerField || !playerField.referenceData) {
        console.log('[Franchise] No player reference found for draft prospect');
        continue;
      }

      const playerRowIndex = playerField.referenceData.rowNumber;
      const playerRecord = playerTable.records[playerRowIndex];

      if (!playerRecord || playerRecord.isEmpty) {
        console.log(`[Franchise] Could not resolve player at row ${playerRowIndex}`);
        continue;
      }

      // Filter: Only include players who haven't been drafted yet
      // YearsPro = 0 means they haven't played a professional year
      // YearDrafted < 0 means they're in a future draft (negative years are future drafts)
      if (playerRecord.YearsPro !== 0) {
        continue; // Skip players who have already played (YearsPro > 0)
      }

      // Build combined data from both tables
      const prospectData: any = {};

      // Add player data (names, ratings, etc.)
      for (const field of playerRecord.fieldsArray) {
        let value = field.value;

        // Skip PID and PEPS fields - we'll override them later for generic faces
        if (field.key === 'PresentationId' || field.key === 'PLYR_PORTRAIT') {
          continue;
        }

        // Handle M26 College field encoding FIRST (before other binary string handling)
        if (field.key === 'College') {
          if (typeof value === 'string' && value.match(/^[01]{32}$/)) {
            // Extract last 8 bits for franchise college ID
            const last8Bits = value.substring(24);
            const franchiseCollegeId = parseInt(last8Bits, 2);

            // Map franchise ID → roster ID → college name
            const rosterCollegeId = collegeMapping.get(franchiseCollegeId);
            if (rosterCollegeId !== undefined) {
              const collegeName = colleges.get(rosterCollegeId);
              if (collegeName) {
                value = collegeName;
                console.log(`[Franchise Draft] College resolved: ${franchiseCollegeId} → ${rosterCollegeId} → ${collegeName}`);
              } else {
                console.log(`[Franchise Draft] Roster college ID ${rosterCollegeId} not found in CSV`);
                value = `College ${franchiseCollegeId}`;
              }
            } else {
              console.log(`[Franchise Draft] Franchise college ID ${franchiseCollegeId} not in mapping`);
              value = `College ${franchiseCollegeId}`;
            }
          } else if (typeof value === 'number') {
            // Direct numeric college ID
            const collegeName = colleges.get(value);
            if (collegeName) {
              value = collegeName;
            }
          }
        } else if (typeof value === 'string' && value.match(/^[01]{32}$/)) {
          // Handle other binary string enums
          const binaryInt = parseInt(value, 2);
          const enumIndex = binaryInt & 0x7FFFFFFF;

          if (field.offset?.enum?._members?.[enumIndex]) {
            value = field.offset.enum._members[enumIndex].name;
          }
        }

        // Map franchise field names to roster field codes
        const fieldCode = FRANCHISE_TO_ROSTER_FIELD_MAP[field.key] || field.key;
        prospectData[fieldCode] = value;
      }

      // Handle Generic Face PID mapping for draft prospects
      // Draft prospects use generic faces, need to map GenericHeadAssetName → PLPO → PID
      let genericHeadName = prospectData.GenericHeadAssetName || prospectData.PLYR_GENERICHEAD;

      if (genericHeadName && typeof genericHeadName === 'string') {
        // Convert generic head name to PLPO format
        // GenericHeadAssetName format: "gen_7_B_G_005" or similar
        // PLPO format: "plpo_generic_7_005"

        // Extract the number parts from gen_X_Y_Z_NNN
        const parts = genericHeadName.toLowerCase().split('_');
        if (parts.length >= 3) {
          // Try to construct PLPO name
          // Format: plpo_generic_{skinTone}_{faceNumber}
          const skinTone = parts[1]; // e.g., "7"
          const faceNumber = parts[parts.length - 1].padStart(3, '0'); // Pad to 3 digits: "04" -> "004"

          const plpoName = `plpo_generic_${skinTone}_${faceNumber}`;

          // Look up PID for this PLPO
          const mappedPID = plpoToPidMapping.get(plpoName);
          if (mappedPID) {
            prospectData.PSXP = mappedPID;
            prospectData.PEPS = plpoName;
            console.log(`[Franchise Draft] ✓ Mapped: ${genericHeadName} → ${plpoName} → PID ${mappedPID}`);
          } else {
            // Fallback: use first PID from mapping for generic_1_001
            const fallbackPLPO = 'plpo_generic_1_001';
            const fallbackPID = plpoToPidMapping.get(fallbackPLPO) || 0;
            prospectData.PSXP = fallbackPID;
            prospectData.PEPS = fallbackPLPO; // Use fallback PLPO, not the missing one
            console.log(`[Franchise Draft] ⚠ PLPO ${plpoName} not in mapping, using fallback ${fallbackPLPO} (PID ${fallbackPID})`);
          }
        } else {
          // Can't parse generic head name, use defaults
          prospectData.PSXP = 0;
          prospectData.PEPS = genericHeadName;
        }
      } else {
        // No generic head set, use generic fallback
        prospectData.PSXP = 0;
        prospectData.PEPS = 'plpo_generic_1_001';
      }

      // Skip team mapping for draft prospects - they don't have teams yet
      // Just remove TGID entirely so it doesn't show in the grid
      delete prospectData.TGID;

      // Add draft-specific data from DraftPlayer table
      prospectData.DraftPosition = draftRecord.DraftPosition;
      prospectData.TrueOverallRanking = draftRecord.TrueOverallRanking;
      prospectData.CombineOverallGrade = draftRecord.CombineOverallGrade;
      prospectData.CombineFortyYardDash = draftRecord.CombineFortyYardDash;
      prospectData.CombineBenchPress = draftRecord.CombineBenchPress;
      prospectData.CombineVerticalJump = draftRecord.CombineVerticalJump;
      prospectData.CombineBroadJump = draftRecord.CombineBroadJump;
      prospectData.CombineThreeConeDrill = draftRecord.CombineThreeConeDrill;
      prospectData.CombineTwentyYardShuttle = draftRecord.CombineTwentyYardShuttle;

      prospects.push(prospectData);
    }

    console.log(`[Franchise] Successfully resolved ${prospects.length} draft prospects`);

    // Debug: Log first prospect to verify data
    if (prospects.length > 0) {
      const firstProspect = prospects[0];
      console.log(`[Franchise Draft] First prospect:`, {
        name: `${firstProspect.PFNA} ${firstProspect.PLNA}`,
        college: firstProspect.PCOL,
        hometown: firstProspect.PHTN,
        PID: firstProspect.PSXP,
        PLPO: firstProspect.PEPS
      });
    }

    return {
      success: true,
      records: prospects,
      count: prospects.length
    };
  } catch (error: any) {
    console.error('[Franchise] Error getting draft class:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('franchise:get-college-lookup', async (_event, filePath: string) => {
  console.log('[Franchise] Getting college lookup data');

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Try to find the College table
    const collegeTables = franchise.getAllTablesByName ? franchise.getAllTablesByName('College') : [franchise.getTableByName('College')];

    if (!collegeTables || collegeTables.length === 0) {
      console.log('[Franchise] College table not found');
      return { success: false, error: 'College table not found' };
    }

    console.log('[Franchise] Found', collegeTables.length, 'College table(s)');

    const colleges: any[] = [];

    for (const table of collegeTables) {
      if (!table) continue;

      await table.readRecords();

      const activeRecords = table.records.filter((r: any) => !r.isEmpty);

      console.log('[Franchise] College table has', activeRecords.length, 'records');
      console.log('[Franchise] College table schema attributes:', table.schema.attributes.map((a: any) => a.name).slice(0, 20));

      for (let i = 0; i < activeRecords.length; i++) {
        const record = activeRecords[i];

        // Try to get the college name
        const name = record.Name || record.SchoolName || record.CollegeName || record.DisplayName || `College ${i}`;

        // Debug: log record at index 1968
        if (i === 1968) {
          console.log(`[Franchise] College record at rowNumber 1968:`, {
            index: i,
            name: name,
            allFields: Object.keys(record.fields || {})
          });
        }

        colleges.push({
          id: i,
          name: name
        });
      }
    }

    console.log('[Franchise] Extracted', colleges.length, 'colleges');
    console.log('[Franchise] Sample colleges:', colleges.slice(0, 10).map(c => `${c.id}: ${c.name}`));

    return {
      success: true,
      colleges
    };
  } catch (error: any) {
    console.error('[Franchise] Error getting college lookup:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Reverse mapping: Roster field code → Franchise attribute name
// Source: Built from FRANCHISE_TO_ROSTER_FIELD_MAP for save operations
const ROSTER_TO_FRANCHISE_FIELD_MAP: Record<string, string> = Object.entries(FRANCHISE_TO_ROSTER_FIELD_MAP)
  .reduce((acc, [franchiseName, rosterCode]) => {
    acc[rosterCode] = franchiseName;
    return acc;
  }, {} as Record<string, string>);

ipcMain.handle('franchise:save-file', async (_event, filePath: string, updates: any, savePath?: string) => {
  console.log('[Franchise] Saving file to:', savePath || filePath);

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Handle both legacy array format and new object format
    // Legacy: updates is an array of player updates
    // New: updates is { players: [], coaches: [] }
    let playerUpdates: any[] = [];
    let coachUpdates: any[] = [];

    if (Array.isArray(updates)) {
      // Legacy format - just players
      playerUpdates = updates;
      console.log('[Franchise] Received', playerUpdates.length, 'player updates (legacy format)');
    } else if (updates && typeof updates === 'object') {
      // New format - object with players and coaches
      playerUpdates = updates.players || [];
      coachUpdates = updates.coaches || [];
      console.log('[Franchise] Received', playerUpdates.length, 'player updates and', coachUpdates.length, 'coach updates');
    }

    // Apply player updates to Player table
    if (playerUpdates.length > 0) {
      const playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        throw new Error('Player table not found');
      }

      await playerTable.readRecords();

      console.log('[Franchise] Applying updates to', playerUpdates.length, 'players');

      // Apply each update to corresponding record
      for (let i = 0; i < playerUpdates.length && i < playerTable.records.length; i++) {
        const record = playerTable.records[i];
        if (!record || record.isEmpty) continue;

        const playerUpdate = playerUpdates[i];
        if (!playerUpdate) continue;

        // Convert roster field codes back to franchise field names and apply
        for (const rosterFieldCode in playerUpdate) {
          // Map roster code to franchise name (e.g., PLNA → LastName)
          const franchiseFieldName = ROSTER_TO_FRANCHISE_FIELD_MAP[rosterFieldCode] || rosterFieldCode;

          // Only update if field exists on record
          if (record[franchiseFieldName] !== undefined) {
            const newValue = playerUpdate[rosterFieldCode];
            const oldValue = record[franchiseFieldName];

            // Skip binary strings (unconverted enum values from parsers)
            if (typeof newValue === 'string' && newValue.match(/^[01]{32}$/)) {
              if (i < 3) {
                console.log(`[Franchise] Player ${i}: Skipping binary string field ${franchiseFieldName}: ${newValue.substring(0, 20)}...`);
              }
              continue;
            }

            // Only log if value actually changed (reduce noise)
            if (oldValue !== newValue) {
              console.log(`[Franchise] Player ${i}: ${franchiseFieldName} = ${oldValue} → ${newValue}`);
            }

            record[franchiseFieldName] = newValue;
          }
        }
      }

      console.log('[Franchise] All player updates applied');
    }

    // Apply coach updates to Coach table
    if (coachUpdates.length > 0) {
      const coachTable = franchise.getTableByName('Coach');
      if (!coachTable) {
        console.warn('[Franchise] Coach table not found - skipping coach updates');
      } else {
        await coachTable.readRecords();

        console.log('[Franchise] Applying updates to', coachUpdates.length, 'coaches');

        // Whitelist of coach fields that can be safely saved
        // Source: Team Staff and Free Agent Coaches grid columns (franchise-editor.js)
        const saveableCoachFields = new Set([
          'Portrait', 'FirstName', 'LastName', 'Name', 'Position', 'Age', 'TeamIndex',
          'ContractLength', 'ContractSalary', 'ContractStatus', 'ContractYearsRemaining',
          'SeasonsWithTeam', 'Level', 'ExperiencePoints', 'Archetype',
          'CareerWins', 'CareerLosses', 'CareerTies',
          'CareerPlayoffWins', 'CareerPlayoffLosses', 'CareerPlayoffsMade',
          'CareerSuperbowlWins', 'CareerSuperbowlLosses',
          'CareerPointsFor', 'CareerPointsAgainst',
          'SeasWins', 'SeasLosses', 'SeasTies',
          'SeasPointsFor', 'SeasPointsAgainst',
          'COACH_OFFENSE', 'COACH_DEFENSE', 'COACH_DB', 'COACH_DL', 'COACH_LB', 'COACH_K',
          'Personality', 'TeamBuilding', 'TradingTendency'
        ]);

        // Apply each update to corresponding record
        for (let i = 0; i < coachUpdates.length && i < coachTable.records.length; i++) {
          const record = coachTable.records[i];
          if (!record || record.isEmpty) continue;

          const coachUpdate = coachUpdates[i];
          if (!coachUpdate) continue;

          // Apply coach fields directly (Coach table uses direct property names, not field codes)
          for (const fieldName in coachUpdate) {
            // Skip fields not in whitelist
            if (!saveableCoachFields.has(fieldName)) {
              continue;
            }

            const newValue = coachUpdate[fieldName];

            // Skip binary strings (unconverted enum values)
            if (typeof newValue === 'string' && newValue.match(/^[01]{32}$/)) {
              console.log(`[Franchise] Skipping binary string field: ${fieldName}`);
              continue;
            }

            // Only update if field exists on record
            if (record[fieldName] !== undefined) {
              const oldValue = record[fieldName];

              // Only log if value actually changed (reduce noise)
              if (oldValue !== newValue) {
                console.log(`[Franchise] Coach ${i}: ${fieldName} = ${oldValue} → ${newValue}`);
              }

              record[fieldName] = newValue;
            }
          }
        }

        console.log('[Franchise] All coach updates applied');
      }
    }

    // Clean up any remaining binary strings in ALL records before saving
    console.log('[Franchise] Cleaning up binary strings before save...');
    let cleanedCount = 0;

    // Clean Player table
    const playerTable = franchise.getTableByName('Player');
    if (playerTable) {
      const playerRecords = playerTable.records;
      for (let i = 0; i < playerRecords.length; i++) {
        const record = playerRecords[i];
        if (!record || record.isEmpty) continue;

        // Check all fields in the record
        for (const field of record.fieldsArray) {
          const value = record[field.key];

          // If value is a 32-bit binary string, set to null/0
          if (typeof value === 'string' && value.match(/^[01]{32}$/)) {
            record[field.key] = 0; // Use 0 as safe default for numeric enum fields
            cleanedCount++;

            if (cleanedCount <= 5) {
              console.log(`[Franchise] Cleaned binary string from Player ${i}, field ${field.key}`);
            }
          }
        }
      }
    }

    // Clean Coach table
    const coachTable = franchise.getTableByName('Coach');
    if (coachTable) {
      const coachRecords = coachTable.records;
      for (let i = 0; i < coachRecords.length; i++) {
        const record = coachRecords[i];
        if (!record || record.isEmpty) continue;

        // Check all fields in the record
        for (const field of record.fieldsArray) {
          const value = record[field.key];

          // If value is a 32-bit binary string, set to null/0
          if (typeof value === 'string' && value.match(/^[01]{32}$/)) {
            record[field.key] = 0; // Use 0 as safe default
            cleanedCount++;

            if (cleanedCount <= 5) {
              console.log(`[Franchise] Cleaned binary string from Coach ${i}, field ${field.key}`);
            }
          }
        }
      }
    }

    console.log(`[Franchise] Cleaned ${cleanedCount} binary string values`);

    // Save the franchise file
    console.log('[Franchise] Saving file...');
    await new Promise((resolve, reject) => {
      franchise.save(savePath || filePath, (err: any) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    console.log('[Franchise] File saved successfully');

    return {
      success: true
    };
  } catch (error: any) {
    console.error('[Franchise] Error saving file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('franchise:get-team-roster', async (_event, { filePath, teamIndex }: { filePath: string, teamIndex: number }) => {
  console.log(`[Franchise] Loading roster for team ${teamIndex} from ${filePath}`);

  try {
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Get Team table (use index 1 for M26)
    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    // Find the requested team
    const team = teamTable.records.find((r: any) => !r.isEmpty && r.TeamIndex === teamIndex);
    if (!team) {
      throw new Error(`Team with index ${teamIndex} not found`);
    }

    console.log(`[Franchise] Found team: ${team.DisplayName || team.LongName}`);

    // Get Player table
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // Filter players by TeamIndex
    const teamPlayers = playerTable.records
      .map((record: any, index: number) => ({ record, index }))
      .filter(({ record }: any) => !record.isEmpty && record.TeamIndex === teamIndex)
      .map(({ record, index }: any) => ({
        recordIndex: index, // CRITICAL: Store for save operations
        firstName: record.FirstName || '',
        lastName: record.LastName || '',
        position: record.Position || '',
        overall: record.Overall || 0,
        age: record.Age || 0,
        yearsPro: record.YearsPro || 0,
        jerseyNum: record.JerseyNum || 0,
        contractStatus: record.ContractStatus || '',
        college: record.College || '',
        teamIndex: record.TeamIndex,
        height: record.Height || 0,
        weight: record.Weight || 0
      }));

    console.log(`[Franchise] Found ${teamPlayers.length} players for team ${teamIndex}`);

    return {
      success: true,
      teamInfo: {
        teamIndex: team.TeamIndex,
        displayName: team.DisplayName || team.LongName || 'Unknown',
        city: team.CityName || '',
        abbreviation: team.TEAM_ABBR || '',
        wins: team.SeasonWins || 0,
        losses: team.SeasonLosses || 0,
        ties: team.SeasonTies || 0
      },
      players: teamPlayers
    };
  } catch (error: any) {
    console.error('[Franchise] Error loading team roster:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('franchise:save-team-changes', async (_event, { filePath, changes }: { filePath: string, changes: any[] }) => {
  console.log(`[Franchise] Saving ${changes.length} team roster changes to ${filePath}`);

  try {
    // CRITICAL: Create backup FIRST
    const backupPath = `${filePath}.backup-${Date.now()}`;
    console.log(`[Franchise] Creating backup: ${backupPath}`);
    fs.copyFileSync(filePath, backupPath);
    console.log(`[Franchise] ✓ Backup created successfully`);

    // Load franchise file
    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26
    });

    // Get Player table
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    console.log(`[Franchise] Applying ${changes.length} changes to Player table...`);

    // Apply each change
    for (const change of changes) {
      const { recordIndex, field, oldValue, newValue } = change;

      // Get the player record
      const record = playerTable.records[recordIndex];
      if (!record || record.isEmpty) {
        console.warn(`[Franchise] Warning: Record ${recordIndex} not found or empty`);
        continue;
      }

      // Map frontend field names to franchise field names
      const FIELD_NAME_MAP: Record<string, string> = {
        'firstName': 'FirstName',
        'lastName': 'LastName',
        'position': 'Position',
        'overall': 'Overall',
        'age': 'Age',
        'yearsPro': 'YearsPro',
        'jerseyNum': 'JerseyNum',
        'contractStatus': 'ContractStatus',
        'college': 'College',
        'height': 'Height',
        'weight': 'Weight'
      };

      const franchiseFieldName = FIELD_NAME_MAP[field] || field;

      // Only update if field exists on record
      if (record[franchiseFieldName] !== undefined) {
        const currentValue = record[franchiseFieldName];

        console.log(`[Franchise] Player ${recordIndex}: ${franchiseFieldName} = ${currentValue} → ${newValue}`);

        record[franchiseFieldName] = newValue;
      } else {
        console.warn(`[Franchise] Field ${franchiseFieldName} not found on record ${recordIndex}`);
      }
    }

    console.log(`[Franchise] All changes applied, saving file...`);

    // Save the franchise file
    await new Promise((resolve, reject) => {
      franchise.save(filePath, (err: any) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    console.log(`[Franchise] ✓ File saved successfully`);
    console.log(`[Franchise] Backup retained at: ${backupPath}`);

    return {
      success: true,
      backupPath: backupPath,
      changesApplied: changes.length
    };

  } catch (error: any) {
    console.error('[Franchise] Error saving team changes:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
