/**
 * FINAL PAM Research - Comprehensive Analysis
 */

const path = require('path');
const fs = require('fs');

const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));

const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const ALL_PLAYER_CSV = path.join(__dirname, 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv');
const PID_MAPPING_CSV = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');

function parseCSV(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function finalAnalysis() {
  console.log('='.repeat(80));
  console.log('FINAL PAM RESEARCH - Complete Analysis');
  console.log('='.repeat(80));
  console.log();

  try {
    // Load roster
    console.log('[1/4] Loading roster file...');
    const helper = new MaddenRosterHelper();
    const file = await helper.load(ROSTER_FILE);
    const playerTable = file.PLAY;

    const players = [];
    for (const record of playerTable.records) {
      const player = {};
      for (const fieldName in record.fields) {
        player[fieldName] = record.fields[fieldName].value;
      }
      players.push(player);
    }
    console.log('      Roster players:', players.length);
    console.log();

    // Load ALL_PLAYER_LOOKUP
    console.log('[2/4] Loading ALL_PLAYER_LOOKUP.csv...');
    const allPlayerCSV = fs.readFileSync(ALL_PLAYER_CSV, 'utf-8');
    const allPlayerLines = allPlayerCSV.split('\n').filter(line => line.trim());

    const headers = parseCSV(allPlayerLines[0]);
    const photoIDIndex = headers.findIndex(h => h.toLowerCase().includes('photoid'));
    const pamIndex = headers.findIndex(h => h.toLowerCase().includes('player assets') || h === 'Player Assets ID');
    const raceIndex = headers.findIndex(h => h.toLowerCase() === 'race');
    const firstNameIndex = headers.findIndex(h => h.toLowerCase().includes('first'));
    const lastNameIndex = headers.findIndex(h => h.toLowerCase().includes('last'));

    console.log('      Column indices:');
    console.log(`        PhotoID: ${photoIDIndex} (${headers[photoIDIndex]})`);
    console.log(`        PAM: ${pamIndex} (${headers[pamIndex]})`);
    console.log(`        Race: ${raceIndex} (${headers[raceIndex]})`);
    console.log(`        First Name: ${firstNameIndex} (${headers[firstNameIndex]})`);
    console.log(`        Last Name: ${lastNameIndex} (${headers[lastNameIndex]})`);
    console.log();

    // Build lookup by PhotoID
    const photoIDToPAM = new Map();
    const photoIDToRace = new Map();

    for (let i = 1; i < allPlayerLines.length; i++) {
      const cols = parseCSV(allPlayerLines[i]);
      if (cols.length > Math.max(photoIDIndex, pamIndex, raceIndex)) {
        const photoID = cols[photoIDIndex]?.trim();
        const pam = cols[pamIndex]?.trim();
        const race = cols[raceIndex]?.trim();

        if (photoID && photoID !== '') {
          const pidNum = parseInt(photoID);
          if (!isNaN(pidNum)) {
            if (pam && pam !== '') {
              photoIDToPAM.set(pidNum, pam);
            }
            if (race && race !== '') {
              photoIDToRace.set(pidNum, race);
            }
          }
        }
      }
    }

    console.log(`      Built PAM lookup: ${photoIDToPAM.size} entries`);
    console.log(`      Built Race lookup: ${photoIDToRace.size} entries`);
    console.log();

    // Analyze roster players
    console.log('[3/4] Cross-referencing roster with lookup data...');
    console.log();

    const matches = [];
    const mismatches = [];

    for (const player of players.slice(0, 200)) {
      const pgid = player.PGID;
      const name = `${player.PFNA} ${player.PLNA}`;
      const peps = player.PEPS;

      const pam = photoIDToPAM.get(pgid);
      const race = photoIDToRace.get(pgid);

      if (pam) {
        matches.push({
          name,
          pgid,
          peps,
          pam,
          race,
          isGeneric: pam.startsWith('gen_')
        });
      } else {
        mismatches.push({ name, pgid, peps });
      }
    }

    console.log(`      Matches found: ${matches.length} / 200`);
    console.log(`      No PAM found: ${mismatches.length} / 200`);
    console.log();

    // Separate generic and real
    const genericMatches = matches.filter(m => m.isGeneric);
    const realMatches = matches.filter(m => !m.isGeneric);

    console.log(`      Generic PAMs: ${genericMatches.length}`);
    console.log(`      Real PAMs: ${realMatches.length}`);
    console.log();

    // Display results
    console.log('[4/4] DETAILED RESULTS');
    console.log('='.repeat(80));
    console.log();

    if (realMatches.length > 0) {
      console.log('REAL NFL PLAYER PAMs (Actual scanned faces):');
      console.log('-'.repeat(80));
      realMatches.slice(0, 20).forEach(m => {
        console.log(`  ${m.name.padEnd(30)} PGID:${m.pgid.toString().padEnd(6)} Race:${(m.race || 'N/A').padEnd(3)} PAM:${m.pam}`);
      });
      console.log();
    }

    if (genericMatches.length > 0) {
      console.log('GENERIC PAMs (Procedurally generated faces):');
      console.log('-'.repeat(80));
      console.log('Format: gen_{RACE}_{BUILD}_{FEATURE}_{NUM}');
      console.log();

      // Analyze race codes in generic PAMs
      const raceCodeMap = {};
      genericMatches.forEach(m => {
        const parts = m.pam.split('_');
        const raceCode = parts[1];
        if (!raceCodeMap[raceCode]) {
          raceCodeMap[raceCode] = [];
        }
        raceCodeMap[raceCode].push(m);
      });

      Object.entries(raceCodeMap).sort((a, b) => a[0] - b[0]).forEach(([code, playerList]) => {
        console.log(`  Race Code ${code}: ${playerList.length} players`);
        playerList.slice(0, 3).forEach(p => {
          console.log(`    ${p.name.padEnd(30)} Race:${(p.race || 'N/A').padEnd(3)} PAM:${p.pam}`);
        });
        console.log();
      });
    }

    // Now check PID_Portrait_Mapping.csv
    console.log('='.repeat(80));
    console.log('PID_Portrait_Mapping.csv ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    const pidMappingCSV = fs.readFileSync(PID_MAPPING_CSV, 'utf-8');
    const pidMappingLines = pidMappingCSV.split('\n').filter(line => line.trim());

    console.log(`Total entries: ${pidMappingLines.length - 1}`);
    console.log();

    // Sample generic mappings
    const genericMappings = [];
    for (let i = 1; i < Math.min(50, pidMappingLines.length); i++) {
      const cols = pidMappingLines[i].split(',');
      if (cols.length >= 5 && cols[4].startsWith('gen_')) {
        genericMappings.push({
          PID: cols[0],
          Name: cols[1],
          Type: cols[2],
          Portrait: cols[3],
          PAM: cols[4]
        });
      }
    }

    console.log('Sample generic mappings from PID_Portrait_Mapping.csv:');
    genericMappings.slice(0, 10).forEach(m => {
      console.log(`  PID:${m.PID.padEnd(6)} ${m.Name.padEnd(20)} PAM:${m.PAM}`);
    });
    console.log();

    // Analyze the gen_ format
    console.log('Generic PAM Format Breakdown:');
    const formatAnalysis = genericMappings.slice(0, 20).map(m => {
      const parts = m.PAM.split('_');
      return {
        full: m.PAM,
        race: parts[1],
        build: parts[2],
        feature: parts[3],
        num: parts[4]
      };
    });

    console.log();
    formatAnalysis.forEach(f => {
      console.log(`  ${f.full.padEnd(25)} → Race:${f.race} Build:${f.build} Feature:${f.feature} Num:${f.num}`);
    });
    console.log();

    // Race code hypothesis
    console.log('='.repeat(80));
    console.log('RACE CODE HYPOTHESIS');
    console.log('='.repeat(80));
    console.log();
    console.log('Based on the user\'s suggestion:');
    console.log('  Race code 1 = White/Light skin');
    console.log('  Higher race codes = Darker skin tones');
    console.log();

    const uniqueRaceCodes = new Set();
    genericMappings.forEach(m => {
      const parts = m.PAM.split('_');
      uniqueRaceCodes.add(parts[1]);
    });

    console.log(`Unique race codes found in PID_Portrait_Mapping: ${Array.from(uniqueRaceCodes).sort().join(', ')}`);
    console.log();

    console.log('Cross-referencing with ALL_PLAYER_LOOKUP Race field...');
    console.log();

    // Sample players with known race and see their PAM race code
    const raceCorrelation = matches.filter(m => m.race && m.isGeneric).slice(0, 30);

    if (raceCorrelation.length > 0) {
      console.log('Players with both CSV Race field and generic PAM:');
      console.log('-'.repeat(80));

      raceCorrelation.forEach(p => {
        const parts = p.pam.split('_');
        const pamRaceCode = parts[1];
        console.log(`  ${p.name.padEnd(30)} CSV Race:"${p.race}" PAM Race Code:${pamRaceCode}`);
      });
    } else {
      console.log('No players found with both CSV Race and generic PAM in sample.');
    }

    console.log();
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log();
    console.log('KEY FINDINGS:');
    console.log('1. Roster field PGID = PhotoID in ALL_PLAYER_LOOKUP.csv');
    console.log('2. PEPS field format: {LastName}{FirstName}_{PGID}');
    console.log('3. PLPO field = 99 for all players (not used as PID)');
    console.log('4. PAM values exist in ALL_PLAYER_LOOKUP.csv "Player Assets ID" column');
    console.log('5. Generic PAM format: gen_{RACE}_{BUILD}_{FEATURE}_{NUM}');
    console.log('6. PID_Portrait_Mapping.csv contains generic face mappings for created players');
    console.log();
    console.log(`Total roster players analyzed: 200`);
    console.log(`Players with PAM data: ${matches.length}`);
    console.log(`  - Real NFL faces: ${realMatches.length}`);
    console.log(`  - Generic faces: ${genericMatches.length}`);
    console.log();

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

finalAnalysis().then(() => {
  console.log('Analysis complete!');
  process.exit(0);
});
