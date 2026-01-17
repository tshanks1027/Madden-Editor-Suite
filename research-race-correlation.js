/**
 * Race Correlation Research - Analyze Race field vs PAM race codes
 */

const path = require('path');
const fs = require('fs');

const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));

const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const ALL_PLAYER_CSV = path.join(__dirname, 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv');

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

async function analyzeRaceCorrelation() {
  console.log('='.repeat(80));
  console.log('RACE CORRELATION ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  try {
    // Load roster
    console.log('[1/3] Loading roster file...');
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
    console.log('      Total players:', players.length);
    console.log();

    // Load ALL_PLAYER_LOOKUP
    console.log('[2/3] Loading ALL_PLAYER_LOOKUP.csv...');
    const allPlayerCSV = fs.readFileSync(ALL_PLAYER_CSV, 'utf-8');
    const allPlayerLines = allPlayerCSV.split('\n').filter(line => line.trim());

    const headers = parseCSV(allPlayerLines[0]);
    const photoIDIndex = headers.findIndex(h => h.toLowerCase().includes('photoid'));
    const pamIndex = headers.findIndex(h => h.toLowerCase().includes('player assets'));
    const raceIndex = headers.findIndex(h => h.toLowerCase() === 'race');
    const firstNameIndex = headers.findIndex(h => h.toLowerCase().includes('first'));
    const lastNameIndex = headers.findIndex(h => h.toLowerCase().includes('last'));

    // Build comprehensive lookup
    const playerData = new Map();

    for (let i = 1; i < allPlayerLines.length; i++) {
      const cols = parseCSV(allPlayerLines[i]);
      if (cols.length > Math.max(photoIDIndex, pamIndex, raceIndex)) {
        const photoID = cols[photoIDIndex]?.trim();
        const pam = cols[pamIndex]?.trim();
        const race = cols[raceIndex]?.trim();
        const firstName = cols[firstNameIndex]?.trim();
        const lastName = cols[lastNameIndex]?.trim();

        if (photoID && photoID !== '') {
          const pidNum = parseInt(photoID);
          if (!isNaN(pidNum)) {
            playerData.set(pidNum, {
              photoID: pidNum,
              pam: pam || null,
              race: race || null,
              firstName: firstName || null,
              lastName: lastName || null
            });
          }
        }
      }
    }

    console.log(`      Loaded ${playerData.size} player records from CSV`);
    console.log();

    // Analyze race values
    console.log('[3/3] Analyzing Race field values...');
    console.log();

    const raceDistribution = new Map();
    const raceWithPAM = new Map();

    for (const [pid, data] of playerData) {
      if (data.race) {
        raceDistribution.set(data.race, (raceDistribution.get(data.race) || 0) + 1);

        if (data.pam) {
          if (!raceWithPAM.has(data.race)) {
            raceWithPAM.set(data.race, []);
          }
          raceWithPAM.get(data.race).push(data);
        }
      }
    }

    console.log('Race field distribution in ALL_PLAYER_LOOKUP.csv:');
    console.log('-'.repeat(80));

    // Sort by race value
    const sortedRaces = Array.from(raceDistribution.entries()).sort();

    for (const [race, count] of sortedRaces) {
      const withPAM = raceWithPAM.get(race)?.length || 0;
      console.log(`  Race "${race}": ${count} players (${withPAM} have PAM)`);
    }
    console.log();

    // Now analyze PAM race codes
    console.log('='.repeat(80));
    console.log('PAM RACE CODE ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    const pamRaceCodeDist = new Map();

    for (const [pid, data] of playerData) {
      if (data.pam && data.pam.startsWith('gen_')) {
        const parts = data.pam.split('_');
        const raceCode = parts[1];

        if (!pamRaceCodeDist.has(raceCode)) {
          pamRaceCodeDist.set(raceCode, {
            count: 0,
            byRace: new Map()
          });
        }

        const entry = pamRaceCodeDist.get(raceCode);
        entry.count++;

        if (data.race) {
          entry.byRace.set(data.race, (entry.byRace.get(data.race) || 0) + 1);
        }
      }
    }

    console.log('PAM Race Code distribution (gen_ format):');
    console.log('-'.repeat(80));

    const sortedPAMRaces = Array.from(pamRaceCodeDist.entries()).sort((a, b) => a[0] - b[0]);

    for (const [code, data] of sortedPAMRaces) {
      console.log(`  PAM Race Code ${code}: ${data.count} players`);

      if (data.byRace.size > 0) {
        console.log('    CSV Race field breakdown:');
        const sortedByRace = Array.from(data.byRace.entries()).sort((a, b) => b[1] - a[1]);
        for (const [race, count] of sortedByRace) {
          const pct = (count / data.count * 100).toFixed(1);
          console.log(`      "${race}": ${count} (${pct}%)`);
        }
      }
      console.log();
    }

    // Sample players for each PAM race code
    console.log('='.repeat(80));
    console.log('SAMPLE PLAYERS BY PAM RACE CODE');
    console.log('='.repeat(80));
    console.log();

    for (const [code, data] of sortedPAMRaces) {
      console.log(`PAM Race Code ${code}:`);

      const samples = [];
      for (const [pid, playerInfo] of playerData) {
        if (playerInfo.pam && playerInfo.pam.startsWith('gen_')) {
          const parts = playerInfo.pam.split('_');
          if (parts[1] === code && samples.length < 10) {
            samples.push(playerInfo);
          }
        }
      }

      samples.forEach(s => {
        const name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
        console.log(`  ${name.padEnd(35)} Race:"${s.race || 'N/A'}" PAM:${s.pam}`);
      });
      console.log();
    }

    // Check what actual roster players have
    console.log('='.repeat(80));
    console.log('ROSTER PLAYERS - RACE ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    const rosterWithData = [];
    for (const player of players.slice(0, 500)) {
      const pgid = player.PGID;
      const data = playerData.get(pgid);

      if (data) {
        rosterWithData.push({
          name: `${player.PFNA} ${player.PLNA}`,
          pgid: pgid,
          peps: player.PEPS,
          csvRace: data.race,
          pam: data.pam,
          pamRaceCode: data.pam?.startsWith('gen_') ? data.pam.split('_')[1] : null
        });
      }
    }

    console.log(`Roster players with CSV data: ${rosterWithData.length} / 500`);
    console.log();

    // Group by CSV race
    const rosterByRace = new Map();
    rosterWithData.forEach(p => {
      if (p.csvRace) {
        if (!rosterByRace.has(p.csvRace)) {
          rosterByRace.set(p.csvRace, []);
        }
        rosterByRace.get(p.csvRace).push(p);
      }
    });

    console.log('Roster players grouped by CSV Race field:');
    console.log('-'.repeat(80));

    for (const [race, playerList] of Array.from(rosterByRace.entries()).sort()) {
      console.log();
      console.log(`CSV Race "${race}": ${playerList.length} players`);

      // Count PAM race codes
      const pamCodes = new Map();
      playerList.forEach(p => {
        if (p.pamRaceCode) {
          pamCodes.set(p.pamRaceCode, (pamCodes.get(p.pamRaceCode) || 0) + 1);
        }
      });

      if (pamCodes.size > 0) {
        console.log('  PAM race codes used:');
        for (const [code, count] of Array.from(pamCodes.entries()).sort()) {
          console.log(`    Code ${code}: ${count} players`);
        }
      }

      // Sample players
      console.log('  Sample players:');
      playerList.slice(0, 5).forEach(p => {
        const pamInfo = p.pamRaceCode ? `PAM Race:${p.pamRaceCode}` : 'No generic PAM';
        console.log(`    ${p.name.padEnd(30)} ${pamInfo}`);
      });
    }

    console.log();
    console.log('='.repeat(80));
    console.log('CONCLUSION');
    console.log('='.repeat(80));
    console.log();
    console.log('The CSV "Race" field appears to contain text descriptions, not numeric codes.');
    console.log('PAM race codes in gen_X_Y_Z format use numeric codes.');
    console.log('There should be a correlation, but we need to see the actual values to confirm.');
    console.log();

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeRaceCorrelation().then(() => {
  console.log('Done!');
  process.exit(0);
});
