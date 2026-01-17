/**
 * Research script to extract PID and PAM data from Madden roster file
 * and cross-reference with PID_Portrait_Mapping.csv
 */

const path = require('path');
const fs = require('fs');

// Load the MaddenRosterHelper (same as RosterParser.js uses)
const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));

// Path to the official roster file
const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';

// Path to the PID_Portrait_Mapping.csv
const MAPPING_CSV = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');

async function analyzeRosterPAM() {
  console.log('='.repeat(80));
  console.log('PAM DATA RESEARCH - Madden 26 Roster Analysis');
  console.log('='.repeat(80));
  console.log();

  try {
    // Load the roster file
    console.log('[1/4] Loading roster file...');
    console.log('      File:', ROSTER_FILE);
    const helper = new MaddenRosterHelper();
    const file = await helper.load(ROSTER_FILE);
    console.log('      ✓ Loaded successfully');
    console.log();

    // Get player table
    const playerTable = file.PLAY;
    if (!playerTable) {
      throw new Error('PLAY table not found in roster file');
    }

    console.log('[2/4] Extracting player data...');
    console.log('      Total players:', playerTable.records.length);

    // Extract all players with their PID and PAM
    const players = [];
    for (const record of playerTable.records) {
      const player = {};
      for (const fieldName in record.fields) {
        player[fieldName] = record.fields[fieldName].value;
      }
      players.push(player);
    }

    // Find the field names for PID and PAM
    const samplePlayer = players[0];
    const allFields = Object.keys(samplePlayer).sort();

    console.log('      Sample player fields (first 50):');
    console.log('      ', allFields.slice(0, 50).join(', '));
    console.log();

    // Search for PID and PAM related fields
    const pidFields = allFields.filter(f =>
      f.toUpperCase().includes('PID') ||
      f.toUpperCase().includes('PHOTO') ||
      f.toUpperCase().includes('PLPO')
    );

    const pamFields = allFields.filter(f =>
      f.toUpperCase().includes('PAM') ||
      f.toUpperCase().includes('ASSET')
    );

    const raceFields = allFields.filter(f =>
      f.toUpperCase().includes('RACE') ||
      f.toUpperCase().includes('SKIN') ||
      f.toUpperCase().includes('PGID')
    );

    console.log('[3/4] Identifying PID/PAM/Race fields...');
    console.log('      Potential PID fields:', pidFields.length > 0 ? pidFields.join(', ') : 'NONE FOUND');
    console.log('      Potential PAM fields:', pamFields.length > 0 ? pamFields.join(', ') : 'NONE FOUND');
    console.log('      Potential Race fields:', raceFields.length > 0 ? raceFields.join(', ') : 'NONE FOUND');
    console.log();

    // Sample some actual values
    console.log('[4/4] Analyzing sample data...');
    console.log();
    console.log('      First 20 Players - PID/PAM/Race Analysis:');
    console.log('      ' + '-'.repeat(75));

    for (let i = 0; i < Math.min(20, players.length); i++) {
      const p = players[i];
      const name = `${p.PFNA || '???'} ${p.PLNA || '???'}`.padEnd(25);

      // Get all potentially relevant field values
      const pidVals = pidFields.map(f => `${f}:${p[f]}`).join(' | ');
      const pamVals = pamFields.map(f => `${f}:${p[f]}`).join(' | ');
      const raceVals = raceFields.map(f => `${f}:${p[f]}`).join(' | ');

      console.log(`      ${i.toString().padStart(2)}. ${name}`);
      if (pidVals) console.log(`          PID:  ${pidVals}`);
      if (pamVals) console.log(`          PAM:  ${pamVals}`);
      if (raceVals) console.log(`          RACE: ${raceVals}`);
      console.log();
    }

    // Now analyze the full dataset
    console.log();
    console.log('='.repeat(80));
    console.log('STATISTICAL ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    // If we found PAM/PID fields, analyze them
    if (pidFields.length > 0) {
      const pidField = pidFields[0]; // Use first match
      console.log(`[PID Field: ${pidField}]`);

      const pidValues = players.map(p => p[pidField]).filter(v => v != null);
      const uniquePIDs = new Set(pidValues);

      console.log(`  Total PID values: ${pidValues.length}`);
      console.log(`  Unique PIDs: ${uniquePIDs.size}`);
      console.log(`  Range: ${Math.min(...pidValues)} - ${Math.max(...pidValues)}`);
      console.log();

      // Sample distribution
      const pidSample = Array.from(uniquePIDs).slice(0, 20);
      console.log(`  Sample PIDs (first 20 unique):`, pidSample.join(', '));
      console.log();
    }

    if (pamFields.length > 0) {
      const pamField = pamFields[0]; // Use first match
      console.log(`[PAM Field: ${pamField}]`);

      const pamValues = players.map(p => p[pamField]).filter(v => v != null && v !== '');
      const uniquePAMs = new Set(pamValues);

      console.log(`  Total PAM values: ${pamValues.length}`);
      console.log(`  Unique PAMs: ${uniquePAMs.size}`);
      console.log();

      // Check for gen_X_Y_Z pattern
      const genPAMs = pamValues.filter(v => typeof v === 'string' && v.startsWith('gen_'));
      console.log(`  PAMs matching 'gen_*' pattern: ${genPAMs.length}`);

      if (genPAMs.length > 0) {
        const uniqueGenPAMs = new Set(genPAMs);
        console.log(`  Unique 'gen_*' PAMs: ${uniqueGenPAMs.size}`);
        console.log(`  Sample 'gen_*' PAMs (first 10):`, Array.from(uniqueGenPAMs).slice(0, 10).join(', '));
      }
      console.log();

      // Sample of other PAMs
      const nonGenPAMs = pamValues.filter(v => typeof v === 'string' && !v.startsWith('gen_'));
      if (nonGenPAMs.length > 0) {
        const uniqueNonGen = new Set(nonGenPAMs);
        console.log(`  Non-generic PAMs: ${uniqueNonGen.size}`);
        console.log(`  Sample non-gen PAMs (first 10):`, Array.from(uniqueNonGen).slice(0, 10).join(', '));
      }
      console.log();
    }

    if (raceFields.length > 0) {
      const raceField = raceFields[0]; // Use first match
      console.log(`[Race Field: ${raceField}]`);

      const raceValues = players.map(p => p[raceField]).filter(v => v != null);
      const raceCounts = {};

      raceValues.forEach(v => {
        raceCounts[v] = (raceCounts[v] || 0) + 1;
      });

      console.log(`  Race distribution:`);
      Object.entries(raceCounts).sort((a, b) => a[0] - b[0]).forEach(([race, count]) => {
        const pct = (count / raceValues.length * 100).toFixed(1);
        console.log(`    ${race}: ${count.toString().padStart(4)} players (${pct}%)`);
      });
      console.log();
    }

    // Cross-reference with PID_Portrait_Mapping.csv
    console.log('='.repeat(80));
    console.log('CROSS-REFERENCE WITH PID_Portrait_Mapping.csv');
    console.log('='.repeat(80));
    console.log();

    const csvData = fs.readFileSync(MAPPING_CSV, 'utf-8');
    const csvLines = csvData.split('\n').filter(line => line.trim());
    const headers = csvLines[0].split(',');

    console.log('[Mapping CSV Info]');
    console.log(`  Total rows: ${csvLines.length - 1}`);
    console.log(`  Headers: ${headers.join(', ')}`);
    console.log();

    // Parse CSV
    const mappings = [];
    for (let i = 1; i < csvLines.length; i++) {
      const cols = csvLines[i].split(',');
      mappings.push({
        PID: parseInt(cols[0]),
        PlayerName: cols[1],
        Type: cols[2],
        Portrait: cols[3],
        PAM: cols[4]
      });
    }

    // Find matches
    if (pidFields.length > 0 && pamFields.length > 0) {
      const pidField = pidFields[0];
      const pamField = pamFields[0];

      console.log('[Matching Analysis]');
      console.log();

      let matchCount = 0;
      let matchExamples = [];

      for (const player of players.slice(0, 100)) { // Check first 100 players
        const pid = player[pidField];
        const pam = player[pamField];

        const mapping = mappings.find(m => m.PID === pid);
        if (mapping) {
          matchCount++;

          const name = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();
          const raceVal = raceFields.length > 0 ? player[raceFields[0]] : 'N/A';

          if (matchExamples.length < 10) {
            matchExamples.push({
              name,
              pid,
              rosterPAM: pam,
              mappingPAM: mapping.PAM,
              race: raceVal,
              match: pam === mapping.PAM
            });
          }
        }
      }

      console.log(`  Matches found in first 100 players: ${matchCount}`);
      console.log();
      console.log(`  Sample matches (first 10):`);
      console.log('  ' + '-'.repeat(75));

      matchExamples.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.name.padEnd(25)} PID:${m.pid}`);
        console.log(`     Roster PAM: ${m.rosterPAM || 'null'}`);
        console.log(`     Mapping PAM: ${m.mappingPAM || 'null'}`);
        console.log(`     Race: ${m.race}`);
        console.log(`     PAM Match: ${m.match ? '✓ YES' : '✗ NO'}`);
        console.log();
      });
    }

    console.log('='.repeat(80));
    console.log('RESEARCH COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the analysis
analyzeRosterPAM().then(() => {
  console.log('\nDone!');
  process.exit(0);
});
