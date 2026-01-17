/**
 * Research script V2 - More thorough field search for PAM/PID data
 */

const path = require('path');
const fs = require('fs');

const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));

const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const MAPPING_CSV = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');

async function deepAnalyze() {
  console.log('='.repeat(80));
  console.log('PAM DATA RESEARCH V2 - Deep Field Analysis');
  console.log('='.repeat(80));
  console.log();

  try {
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

    // Get ALL field names
    const allFields = Object.keys(players[0]).sort();

    console.log('[2/3] ALL FIELDS IN PLAYER TABLE:');
    console.log('      Total fields:', allFields.length);
    console.log();

    // Print all fields in a readable format
    const cols = 4;
    for (let i = 0; i < allFields.length; i += cols) {
      const row = allFields.slice(i, i + cols);
      console.log('      ' + row.map(f => f.padEnd(12)).join(' '));
    }
    console.log();

    // Now sample values for some players to understand the data
    console.log('[3/3] SAMPLE DATA FROM FIRST 10 PLAYERS:');
    console.log('      Looking for fields that might be PAM/PID...');
    console.log();

    // Focus on fields that might contain asset/portrait data
    const interestingFields = allFields.filter(f =>
      f.length >= 3 && f.length <= 5 && // Most Madden fields are 4 chars
      !f.startsWith('P') || // Or fields starting with P (player-related)
      f.toUpperCase().includes('ASSET') ||
      f.toUpperCase().includes('PORT')
    );

    // Sample 10 real NFL players
    const realPlayers = players.filter(p => {
      const name = `${p.PFNA} ${p.PLNA}`.trim();
      // Known NFL stars
      return name.includes('Mahomes') ||
             name.includes('Allen') ||
             name.includes('Brady') ||
             name.includes('Kelce') ||
             name.includes('Hopkins') ||
             name.includes('Smith');
    }).slice(0, 10);

    console.log('      Found', realPlayers.length, 'recognizable NFL players');
    console.log();

    for (const player of realPlayers) {
      const name = `${player.PFNA} ${player.PLNA}`.padEnd(30);
      console.log(`      ${name}`);

      // Show ALL fields and values for this player
      const sortedKeys = Object.keys(player).sort();
      for (let i = 0; i < sortedKeys.length; i += 3) {
        const batch = sortedKeys.slice(i, i + 3);
        const line = batch.map(k => {
          const val = player[k];
          const valStr = typeof val === 'string' ? `"${val}"` : val;
          return `${k}:${valStr}`;
        }).join(' | ');
        console.log(`        ${line}`);
      }
      console.log();
    }

    // Now specifically look for string fields that might contain gen_ pattern
    console.log('='.repeat(80));
    console.log('SEARCHING FOR STRING FIELDS WITH "gen_" PATTERN');
    console.log('='.repeat(80));
    console.log();

    const stringFields = allFields.filter(f => {
      const val = players[0][f];
      return typeof val === 'string' && val.length > 0;
    });

    console.log('String fields found:', stringFields.length);
    console.log('Fields:', stringFields.join(', '));
    console.log();

    for (const field of stringFields) {
      const samples = players.slice(0, 20).map(p => p[field]).filter((v, i, a) => a.indexOf(v) === i);
      console.log(`Field: ${field}`);
      console.log(`  Unique values in first 20 players:`, samples.slice(0, 10).join(', '));

      // Check if any contain 'gen_'
      const hasGen = samples.some(v => v && v.includes('gen_'));
      if (hasGen) {
        console.log(`  ⭐ CONTAINS gen_ PATTERN!`);
        const genSamples = samples.filter(v => v && v.includes('gen_'));
        console.log(`  gen_ samples:`, genSamples.slice(0, 5).join(', '));
      }
      console.log();
    }

    // Cross-reference PGID with mapping
    console.log('='.repeat(80));
    console.log('PGID ANALYSIS - POSSIBLE PID FIELD?');
    console.log('='.repeat(80));
    console.log();

    const csvData = fs.readFileSync(MAPPING_CSV, 'utf-8');
    const csvLines = csvData.split('\n').filter(line => line.trim());
    const mappings = [];
    for (let i = 1; i < csvLines.length; i++) {
      const cols = csvLines[i].split(',');
      if (cols.length >= 5) {
        mappings.push({
          PID: parseInt(cols[0]),
          PlayerName: cols[1],
          Type: cols[2],
          Portrait: cols[3],
          PAM: cols[4]
        });
      }
    }

    console.log('Mapping CSV entries:', mappings.length);
    console.log();

    // Check if PGID values match any PID in the mapping
    const pgidValues = players.map(p => p.PGID).filter(v => v != null);
    const uniquePGIDs = Array.from(new Set(pgidValues)).sort((a, b) => a - b);

    console.log('Unique PGID values:', uniquePGIDs.length);
    console.log('PGID range:', Math.min(...uniquePGIDs), '-', Math.max(...uniquePGIDs));
    console.log();

    // Find matches
    let matchCount = 0;
    const matchExamples = [];

    for (const player of players.slice(0, 200)) {
      const pgid = player.PGID;
      const mapping = mappings.find(m => m.PID === pgid);

      if (mapping) {
        matchCount++;
        if (matchExamples.length < 20) {
          matchExamples.push({
            name: `${player.PFNA} ${player.PLNA}`,
            pgid: pgid,
            mappingName: mapping.PlayerName,
            mappingPAM: mapping.PAM,
            mappingPortrait: mapping.Portrait
          });
        }
      }
    }

    console.log('Matches found (first 200 players):', matchCount);
    console.log();

    if (matchExamples.length > 0) {
      console.log('MATCHED PLAYERS (PGID = PID in mapping):');
      console.log('-'.repeat(80));
      matchExamples.forEach(m => {
        console.log(`PGID: ${m.pgid.toString().padEnd(6)} | Roster: ${m.name.padEnd(30)} | Mapping: ${m.mappingName}`);
        console.log(`         PAM: ${m.mappingPAM} | Portrait: ${m.mappingPortrait}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

deepAnalyze().then(() => {
  console.log('Done!');
  process.exit(0);
});
