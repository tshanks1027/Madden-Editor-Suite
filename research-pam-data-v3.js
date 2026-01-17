/**
 * Research script V3 - Focus on PEPS field and look for actual PAM data
 */

const path = require('path');
const fs = require('fs');

const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));

const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const MAPPING_CSV = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');
const ALL_PLAYER_CSV = path.join(__dirname, 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv');

async function analyzeAssetMapping() {
  console.log('='.repeat(80));
  console.log('PAM RESEARCH V3 - PEPS Field Analysis + Race Correlation');
  console.log('='.repeat(80));
  console.log();

  try {
    console.log('[1/5] Loading roster file...');
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

    // Load ALL_PLAYER_LOOKUP.csv to see what PAM values exist there
    console.log('[2/5] Loading ALL_PLAYER_LOOKUP.csv...');
    const allPlayerCSV = fs.readFileSync(ALL_PLAYER_CSV, 'utf-8');
    const allPlayerLines = allPlayerCSV.split('\n').filter(line => line.trim());
    console.log('      Total lines:', allPlayerLines.length);

    // Parse header
    const headers = allPlayerLines[0].split(',');
    console.log('      Headers:', headers.join(', '));
    console.log();

    // Find PAM column index
    const pamIndex = headers.findIndex(h => h.toUpperCase() === 'PAM');
    const pidIndex = headers.findIndex(h => h.toUpperCase() === 'PID');
    const nameIndex = headers.findIndex(h => h.toUpperCase().includes('NAME'));

    console.log('[3/5] Analyzing ALL_PLAYER_LOOKUP.csv PAM data...');
    console.log(`      PAM column index: ${pamIndex}`);
    console.log(`      PID column index: ${pidIndex}`);
    console.log(`      Name column index: ${nameIndex}`);
    console.log();

    // Sample PAM values from the CSV
    const pamSamples = [];
    const genPAMSamples = [];

    for (let i = 1; i < Math.min(100, allPlayerLines.length); i++) {
      const cols = allPlayerLines[i].split(',');
      if (cols.length > pamIndex && cols[pamIndex]) {
        const pam = cols[pamIndex].trim();
        if (pam.startsWith('gen_')) {
          if (genPAMSamples.length < 20) {
            genPAMSamples.push({
              pid: cols[pidIndex],
              name: cols[nameIndex],
              pam: pam
            });
          }
        } else if (pam && pamSamples.length < 20) {
          pamSamples.push({
            pid: cols[pidIndex],
            name: cols[nameIndex],
            pam: pam
          });
        }
      }
    }

    console.log('      Sample NON-generic PAMs:');
    pamSamples.forEach(s => {
      console.log(`        PID:${s.pid.padEnd(6)} | ${s.name.padEnd(30)} | PAM: ${s.pam}`);
    });
    console.log();

    console.log('      Sample GENERIC (gen_*) PAMs:');
    genPAMSamples.forEach(s => {
      console.log(`        PID:${s.pid.padEnd(6)} | ${s.name.padEnd(30)} | PAM: ${s.pam}`);
    });
    console.log();

    // Analyze gen_X_Y_Z format
    console.log('[4/5] Analyzing generic PAM format (gen_X_Y_Z)...');
    console.log();

    const genPAMFormat = genPAMSamples.map(s => {
      const parts = s.pam.split('_');
      return {
        name: s.name,
        full: s.pam,
        race: parts[1],   // First number
        bodyType: parts[2], // Letter (B=Build?)
        feature: parts[3],  // Letter (N=?)
        number: parts[4]    // Sequential number
      };
    });

    console.log('      Generic PAM breakdown:');
    console.log('      Format: gen_{RACE}_{BUILD}_{FEATURE}_{NUM}');
    console.log();
    genPAMFormat.forEach(p => {
      console.log(`        ${p.name.padEnd(30)} | ${p.full}`);
      console.log(`          Race:${p.race.padEnd(2)} Build:${p.bodyType} Feature:${p.feature} Num:${p.number}`);
    });
    console.log();

    // Analyze PGID (Race field) distribution
    console.log('[5/5] Analyzing PGID (Possible Race Field) in roster...');
    console.log();

    // Group players by skin tone ranges
    const pgidRanges = {
      '0-999': [],
      '1000-1999': [],
      '2000-2999': [],
      '3000-3999': [],
      '4000-4999': [],
      '5000+': []
    };

    players.forEach(p => {
      const pgid = p.PGID;
      const name = `${p.PFNA} ${p.PLNA}`;
      const peps = p.PEPS;

      if (pgid < 1000) pgidRanges['0-999'].push({ name, pgid, peps });
      else if (pgid < 2000) pgidRanges['1000-1999'].push({ name, pgid, peps });
      else if (pgid < 3000) pgidRanges['2000-2999'].push({ name, pgid, peps });
      else if (pgid < 4000) pgidRanges['3000-3999'].push({ name, pgid, peps });
      else if (pgid < 5000) pgidRanges['4000-4999'].push({ name, pgid, peps });
      else pgidRanges['5000+'].push({ name, pgid, peps });
    });

    Object.entries(pgidRanges).forEach(([range, playerList]) => {
      console.log(`      PGID Range ${range}: ${playerList.length} players`);
      if (playerList.length > 0) {
        const samples = playerList.slice(0, 5);
        samples.forEach(p => {
          console.log(`        ${p.name.padEnd(30)} PGID:${p.pgid.toString().padEnd(6)} PEPS:${p.peps}`);
        });
      }
      console.log();
    });

    // Check if PEPS contains the PGID value
    console.log('='.repeat(80));
    console.log('PEPS FORMAT ANALYSIS');
    console.log('='.repeat(80));
    console.log();

    const pepsAnalysis = players.slice(0, 50).map(p => {
      const peps = p.PEPS || '';
      const parts = peps.split('_');
      const lastPart = parts[parts.length - 1];
      const pgid = p.PGID;

      return {
        name: `${p.PFNA} ${p.PLNA}`,
        peps: peps,
        pgid: pgid,
        pepsNumber: lastPart,
        match: parseInt(lastPart) === pgid
      };
    });

    console.log('PEPS format: {LastName}{FirstName}_{PGID}');
    console.log();
    console.log('Sample verification (first 20):');
    pepsAnalysis.slice(0, 20).forEach(p => {
      const matchStr = p.match ? '✓ MATCH' : '✗ MISMATCH';
      console.log(`  ${p.name.padEnd(30)} PEPS:${p.peps.padEnd(35)} ${matchStr}`);
    });
    console.log();

    const matchCount = pepsAnalysis.filter(p => p.match).length;
    console.log(`Match rate: ${matchCount}/${pepsAnalysis.length} (${(matchCount/pepsAnalysis.length*100).toFixed(1)}%)`);
    console.log();

    // Now cross-reference PGID with ALL_PLAYER_LOOKUP to find PAM
    console.log('='.repeat(80));
    console.log('CROSS-REFERENCE: Roster PGID → ALL_PLAYER_LOOKUP PAM');
    console.log('='.repeat(80));
    console.log();

    // Build lookup map from ALL_PLAYER_LOOKUP.csv
    const pidToPAM = new Map();
    for (let i = 1; i < allPlayerLines.length; i++) {
      const cols = allPlayerLines[i].split(',');
      if (cols.length > Math.max(pidIndex, pamIndex)) {
        const pid = parseInt(cols[pidIndex]);
        const pam = cols[pamIndex]?.trim();
        if (pid && pam) {
          pidToPAM.set(pid, pam);
        }
      }
    }

    console.log(`Built PAM lookup with ${pidToPAM.size} entries`);
    console.log();

    // Match roster players with PAM data
    const matches = [];
    for (const player of players.slice(0, 100)) {
      const pgid = player.PGID;
      const pam = pidToPAM.get(pgid);

      if (pam) {
        matches.push({
          name: `${player.PFNA} ${player.PLNA}`,
          pgid: pgid,
          peps: player.PEPS,
          pam: pam,
          isGeneric: pam.startsWith('gen_')
        });
      }
    }

    console.log(`Found ${matches.length} PAM matches in first 100 players`);
    console.log();

    // Separate generic vs real PAMs
    const genericMatches = matches.filter(m => m.isGeneric);
    const realMatches = matches.filter(m => !m.isGeneric);

    console.log(`Generic PAMs: ${genericMatches.length}`);
    console.log(`Real PAMs: ${realMatches.length}`);
    console.log();

    if (genericMatches.length > 0) {
      console.log('Sample GENERIC PAM players:');
      genericMatches.slice(0, 10).forEach(m => {
        console.log(`  ${m.name.padEnd(30)} PGID:${m.pgid.toString().padEnd(6)} PAM:${m.pam}`);
      });
      console.log();
    }

    if (realMatches.length > 0) {
      console.log('Sample REAL PAM players:');
      realMatches.slice(0, 10).forEach(m => {
        console.log(`  ${m.name.padEnd(30)} PGID:${m.pgid.toString().padEnd(6)} PAM:${m.pam}`);
      });
      console.log();
    }

    // Analyze generic PAM race codes
    if (genericMatches.length > 0) {
      console.log('='.repeat(80));
      console.log('GENERIC PAM RACE CODE ANALYSIS');
      console.log('='.repeat(80));
      console.log();

      const raceDistribution = {};
      genericMatches.forEach(m => {
        const parts = m.pam.split('_');
        const raceCode = parts[1];
        if (!raceDistribution[raceCode]) {
          raceDistribution[raceCode] = [];
        }
        raceDistribution[raceCode].push(m);
      });

      console.log('Race codes found in generic PAMs:');
      Object.entries(raceDistribution).sort().forEach(([code, playerList]) => {
        console.log();
        console.log(`  Race Code: ${code} (${playerList.length} players)`);
        playerList.slice(0, 5).forEach(p => {
          console.log(`    ${p.name.padEnd(30)} ${p.pam}`);
        });
      });
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeAssetMapping().then(() => {
  console.log();
  console.log('='.repeat(80));
  console.log('ANALYSIS COMPLETE');
  console.log('='.repeat(80));
  process.exit(0);
});
