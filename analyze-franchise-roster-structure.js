/**
 * Comprehensive analysis of franchise file roster structure
 * Compare CAREER-REAL vs CAREER-2011THROWBACKV09
 *
 * Key question: How are players associated with teams?
 * MFT uses Player.TeamIndex to match Team.TeamIndex
 */

const CAREER_REAL = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL';
const CAREER_2011 = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';

async function analyzeFile(filePath, label) {
  const mf = await import('madden-franchise');
  const franchise = await mf.create(filePath);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`ANALYZING: ${label}`);
  console.log(`Path: ${filePath}`);
  console.log('='.repeat(60));

  // === 1. Load Team table ===
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  console.log(`\n--- TEAM TABLE (UniqueId 637929298) ---`);
  console.log(`Total records: ${teamTable.records.length}`);

  // Build TeamIndex -> Team name mapping
  const teamIndexToName = new Map();
  const teamIndexToRecordIdx = new Map();

  for (let i = 0; i < teamTable.records.length; i++) {
    const team = teamTable.records[i];
    if (team.isEmpty) continue;

    const teamIndex = team.TeamIndex;
    const name = team.ShortName || team.DisplayName || team.LongName || 'UNKNOWN';
    const abbreviation = team.DisplayName || '';

    teamIndexToName.set(teamIndex, { name, abbreviation, recordIndex: i });
    teamIndexToRecordIdx.set(teamIndex, i);

    // Show first 35 (NFL teams + special)
    if (i < 35) {
      console.log(`  records[${i.toString().padStart(2)}]: TeamIndex=${teamIndex?.toString().padStart(2) || 'N/A'}, Name="${name}" (${abbreviation})`);
    }
  }

  // === 2. Find and Load Player table ===
  console.log(`\n--- PLAYER TABLE ---`);

  // Try multiple ways to find Player table
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    // List all tables to find it
    console.log('Player table not found by name. Looking for it...');
    const allTables = franchise.tables || [];
    for (const table of allTables) {
      if (table.name && table.name.includes('Player')) {
        console.log(`  Found: ${table.name} (tableId: ${table.header?.tableId}, uniqueId: ${table.header?.uniqueId})`);
      }
    }
    // Try getAllTablesByName like MFT does
    const playerTables = franchise.getAllTablesByName('Player');
    if (playerTables && playerTables.length > 0) {
      playerTable = playerTables[0];
      console.log(`Found via getAllTablesByName: ${playerTable.name}`);
    }
  }

  if (!playerTable) {
    console.log('Could not find Player table!');
    return null;
  }

  await playerTable.readRecords();
  console.log(`Found! Total records: ${playerTable.records.length}`);

  // Count players per TeamIndex
  const playersByTeamIndex = new Map();

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    // Skip deleted/invalid players
    const status = player.ContractStatus;
    if (status === 'Deleted' || status === 'None') continue;

    const teamIndex = player.TeamIndex;
    if (teamIndex === undefined) continue;

    if (!playersByTeamIndex.has(teamIndex)) {
      playersByTeamIndex.set(teamIndex, []);
    }
    playersByTeamIndex.get(teamIndex).push({
      name: `${player.FirstName} ${player.LastName}`,
      position: player.Position,
      overall: player.OverallRating || player.Overall,
      recordIndex: player.index
    });
  }

  // Show player counts by TeamIndex
  console.log(`\nPlayers by TeamIndex:`);
  const sortedTeamIndices = [...playersByTeamIndex.keys()].sort((a, b) => a - b);
  for (const teamIdx of sortedTeamIndices) {
    const players = playersByTeamIndex.get(teamIdx);
    const teamInfo = teamIndexToName.get(teamIdx);
    const teamName = teamInfo ? `${teamInfo.name} (${teamInfo.abbreviation})` : 'UNKNOWN TEAM';
    const samples = players.slice(0, 3).map(p => p.name).join(', ');

    console.log(`  TeamIndex ${teamIdx.toString().padStart(2)}: ${players.length.toString().padStart(3)} players - ${teamName}`);
    console.log(`      Sample: ${samples}...`);
  }

  // === 3. Check Team references to Roster Arrays ===
  console.log(`\n--- TEAM ROSTER REFERENCES ---`);

  // Check first few teams for roster array references
  for (let i = 0; i < Math.min(6, teamTable.records.length); i++) {
    const team = teamTable.records[i];
    if (team.isEmpty) continue;

    const teamName = team.ShortName || team.LongName;
    const teamIdx = team.TeamIndex;

    // Try to find roster reference
    try {
      const rosterRef = team.getReferenceDataByKey ? team.getReferenceDataByKey('Roster') : null;
      if (rosterRef && rosterRef.tableId) {
        console.log(`  Team[${i}] "${teamName}" (TeamIndex=${teamIdx}): Roster -> tableId=${rosterRef.tableId}, rowNumber=${rosterRef.rowNumber}`);

        // Try to read the roster array
        const rosterArray = franchise.getTableById(rosterRef.tableId);
        if (rosterArray) {
          await rosterArray.readRecords();
          const roster = rosterArray.records[rosterRef.rowNumber];
          if (roster) {
            const arraySize = roster.arraySize || 0;
            console.log(`      Roster array has ${arraySize} slots`);
          }
        }
      }
    } catch (e) {
      // No Roster field, try other fields
    }
  }

  // === 4. Look at Browns and Ravens specifically ===
  console.log(`\n--- KEY TEAMS FOR RELOCATION ---`);

  // Find Browns (TeamIndex=4) and Ravens (TeamIndex=24)
  const brownsIdx = 4;
  const ravensIdx = 24;

  const brownsTeamInfo = teamIndexToName.get(brownsIdx);
  const ravensTeamInfo = teamIndexToName.get(ravensIdx);

  console.log(`\nBrowns (TeamIndex=${brownsIdx}):`);
  console.log(`  Team record: records[${brownsTeamInfo?.recordIndex}]`);
  console.log(`  Name: ${brownsTeamInfo?.name} (${brownsTeamInfo?.abbreviation})`);
  console.log(`  Player count: ${playersByTeamIndex.get(brownsIdx)?.length || 0}`);
  if (playersByTeamIndex.get(brownsIdx)) {
    const brownsPlayers = playersByTeamIndex.get(brownsIdx);
    console.log(`  Sample players:`);
    brownsPlayers.slice(0, 5).forEach(p => console.log(`    - ${p.name} (${p.position}) at Player records[${p.recordIndex}]`));
  }

  console.log(`\nRavens (TeamIndex=${ravensIdx}):`);
  console.log(`  Team record: records[${ravensTeamInfo?.recordIndex}]`);
  console.log(`  Name: ${ravensTeamInfo?.name} (${ravensTeamInfo?.abbreviation})`);
  console.log(`  Player count: ${playersByTeamIndex.get(ravensIdx)?.length || 0}`);
  if (playersByTeamIndex.get(ravensIdx)) {
    const ravensPlayers = playersByTeamIndex.get(ravensIdx);
    console.log(`  Sample players:`);
    ravensPlayers.slice(0, 5).forEach(p => console.log(`    - ${p.name} (${p.position}) at Player records[${p.recordIndex}]`));
  }

  // === 5. Summary ===
  console.log(`\n--- SUMMARY FOR ${label} ---`);
  console.log(`Total teams in file: ${teamTable.records.filter(r => !r.isEmpty).length}`);
  console.log(`Total players in file: ${playerTable.records.filter(r => !r.isEmpty).length}`);
  console.log(`Active TeamIndex range: ${Math.min(...playersByTeamIndex.keys())} to ${Math.max(...playersByTeamIndex.keys())}`);

  return {
    teamIndexToName,
    playersByTeamIndex,
    teamTable,
    playerTable,
    franchise
  };
}

async function main() {
  try {
    console.log('FRANCHISE ROSTER STRUCTURE ANALYSIS');
    console.log('===================================');
    console.log('Goal: Understand how to properly transfer players between teams');
    console.log('');

    // Analyze both files
    const realData = await analyzeFile(CAREER_REAL, 'CAREER-REAL (Clean franchise)');

    if (realData) {
      const modData = await analyzeFile(CAREER_2011, 'CAREER-2011THROWBACKV09 (Working mod)');
    }

    // Final conclusions
    console.log('\n' + '='.repeat(60));
    console.log('CONCLUSIONS');
    console.log('='.repeat(60));

    console.log(`
HOW TO TRANSFER PLAYERS FROM BROWNS TO RAVENS (1996 Relocation):

1. The Player table has a TeamIndex field on each player record
2. Players with TeamIndex=4 are Browns players
3. To move them to Ravens: change their TeamIndex to 24

The key is: Player.TeamIndex = 4 means "on Browns"
             Player.TeamIndex = 24 means "on Ravens"

To SWAP rosters:
  - Get all players where TeamIndex=4 (Browns) -> change to 24
  - Get all players where TeamIndex=24 (Ravens) -> change to 4

This is the same approach MFT uses in leagueEditorService.js
    `);

  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
  }
}

main();
