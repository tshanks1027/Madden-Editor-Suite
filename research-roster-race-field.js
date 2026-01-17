/**
 * Research roster file for race/skin tone fields
 */

const path = require('path');
const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));

const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';

async function findRaceField() {
  console.log('='.repeat(80));
  console.log('ROSTER FILE - RACE/SKIN TONE FIELD RESEARCH');
  console.log('='.repeat(80));
  console.log();

  try {
    console.log('Loading roster file...');
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

    console.log(`Total players: ${players.length}`);
    console.log();

    // Get all field names
    const allFields = Object.keys(players[0]).sort();

    console.log('ALL ROSTER FIELDS:');
    console.log('-'.repeat(80));

    // Print in columns
    const cols = 5;
    for (let i = 0; i < allFields.length; i += cols) {
      const row = allFields.slice(i, i + cols);
      console.log('  ' + row.map(f => f.padEnd(10)).join(' '));
    }
    console.log();

    // Look for fields that might be skin/race related
    const suspectFields = allFields.filter(f =>
      f.toLowerCase().includes('skin') ||
      f.toLowerCase().includes('race') ||
      f.toLowerCase().includes('tone') ||
      f.toLowerCase().includes('color') ||
      f.toLowerCase().includes('pcol') || // Player COLor?
      f.toLowerCase().includes('pski') || // Player SKIn?
      f === 'PGID' || // We know this is important
      f === 'POID'    // Player Object ID?
    );

    console.log('SUSPECT FIELDS (might be race/skin related):');
    console.log('-'.repeat(80));
    console.log(suspectFields.join(', '));
    console.log();

    // Analyze each suspect field
    for (const field of suspectFields) {
      console.log();
      console.log(`FIELD: ${field}`);
      console.log('-'.repeat(40));

      // Get unique values
      const values = players.map(p => p[field]);
      const uniqueValues = Array.from(new Set(values)).filter(v => v != null).sort((a, b) => a - b);

      console.log(`  Type: ${typeof values[0]}`);
      console.log(`  Unique values: ${uniqueValues.length}`);
      console.log(`  Range: ${Math.min(...uniqueValues)} - ${Math.max(...uniqueValues)}`);

      // Count distribution
      const distribution = {};
      values.forEach(v => {
        distribution[v] = (distribution[v] || 0) + 1;
      });

      // Show top 20 most common values
      const sorted = Object.entries(distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);

      console.log(`  Top values:`);
      sorted.forEach(([val, count]) => {
        const pct = (count / players.length * 100).toFixed(1);
        console.log(`    ${val}: ${count} (${pct}%)`);
      });

      // Sample players with different values
      if (uniqueValues.length <= 20) {
        console.log(`  Sample players by value:`);
        for (const val of uniqueValues.slice(0, 10)) {
          const sample = players.find(p => p[field] === val);
          if (sample) {
            const name = `${sample.PFNA} ${sample.PLNA}`.padEnd(30);
            console.log(`    ${field}=${val}: ${name} PGID:${sample.PGID}`);
          }
        }
      }
    }

    // Now let's look at PSKI specifically since it looks like Player SKIn
    console.log();
    console.log('='.repeat(80));
    console.log('PSKI FIELD DETAILED ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    const pskiValues = new Map();

    players.forEach(p => {
      const pski = p.PSKI;
      const name = `${p.PFNA} ${p.PLNA}`;
      const pgid = p.PGID;

      if (!pskiValues.has(pski)) {
        pskiValues.set(pski, []);
      }

      pskiValues.get(pski).push({ name, pgid });
    });

    console.log('PSKI Distribution:');
    for (const [val, playerList] of Array.from(pskiValues.entries()).sort((a, b) => a - b)) {
      console.log();
      console.log(`PSKI = ${val}: ${playerList.length} players`);
      console.log('  Sample players:');
      playerList.slice(0, 10).forEach(p => {
        console.log(`    ${p.name.padEnd(30)} PGID:${p.pgid}`);
      });
    }

    // Similarly for PCOL (might be Player COLor)
    console.log();
    console.log('='.repeat(80));
    console.log('PCOL FIELD DETAILED ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    const pcolValues = new Map();

    players.forEach(p => {
      const pcol = p.PCOL;
      const name = `${p.PFNA} ${p.PLNA}`;
      const pgid = p.PGID;

      if (!pcolValues.has(pcol)) {
        pcolValues.set(pcol, []);
      }

      pcolValues.get(pcol).push({ name, pgid });
    });

    // Show distribution by value ranges
    const pcolRanges = {
      '0-50': [],
      '51-100': [],
      '101-150': [],
      '151-200': [],
      '201-255': []
    };

    players.forEach(p => {
      const pcol = p.PCOL;
      const name = `${p.PFNA} ${p.PLNA}`;

      if (pcol <= 50) pcolRanges['0-50'].push(name);
      else if (pcol <= 100) pcolRanges['51-100'].push(name);
      else if (pcol <= 150) pcolRanges['101-150'].push(name);
      else if (pcol <= 200) pcolRanges['151-200'].push(name);
      else pcolRanges['201-255'].push(name);
    });

    console.log('PCOL Range Distribution:');
    for (const [range, playerList] of Object.entries(pcolRanges)) {
      if (playerList.length > 0) {
        console.log();
        console.log(`  Range ${range}: ${playerList.length} players`);
        console.log('    Samples:', playerList.slice(0, 5).join(', '));
      }
    }

    console.log();
    console.log('='.repeat(80));
    console.log('HYPOTHESIS TEST: PSKI might be skin tone (1=light, 2=dark)');
    console.log('='.repeat(80));
    console.log();

    const knownWhitePlayers = players.filter(p => {
      const name = `${p.PFNA} ${p.PLNA}`.toLowerCase();
      return name.includes('kelce') ||
             name.includes('ertz') ||
             name.includes('mccaffrey') ||
             name.includes('kupp') ||
             name.includes('brady');
    });

    const knownBlackPlayers = players.filter(p => {
      const name = `${p.PFNA} ${p.PLNA}`.toLowerCase();
      return name.includes('mahomes') ||
             name.includes('hopkins') ||
             name.includes('hill') ||
             name.includes('lamar') ||
             name.includes('jefferson');
    });

    console.log('Known white/light-skinned players:');
    knownWhitePlayers.forEach(p => {
      const name = `${p.PFNA} ${p.PLNA}`.padEnd(25);
      console.log(`  ${name} PSKI:${p.PSKI} PCOL:${p.PCOL} PGID:${p.PGID}`);
    });

    console.log();
    console.log('Known black/dark-skinned players:');
    knownBlackPlayers.forEach(p => {
      const name = `${p.PFNA} ${p.PLNA}`.padEnd(25);
      console.log(`  ${name} PSKI:${p.PSKI} PCOL:${p.PCOL} PGID:${p.PGID}`);
    });

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

findRaceField().then(() => {
  console.log();
  console.log('Research complete!');
  process.exit(0);
});
