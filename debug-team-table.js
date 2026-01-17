/**
 * Debug the Team table structure
 */
const { create } = require('madden-franchise');

async function debugTeamTable() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get Team table
  let teamTable = franchise.getTableByUniqueId(2079398721);
  if (!teamTable) {
    console.log('Table by ID 2079398721 not found, trying by name...');
    teamTable = franchise.getTableByName('Team');
  }

  if (!teamTable) {
    console.log('ERROR: Could not find Team table!');
    console.log('\nAvailable tables:');
    for (const t of franchise.tables.slice(0, 20)) {
      console.log(`  ${t.name || 'unnamed'}`);
    }
    return;
  }

  await teamTable.readRecords();

  console.log('\n=== TEAM TABLE INFO ===');
  console.log('Table name:', teamTable.name);
  console.log('Total records:', teamTable.records.length);
  console.log('Non-empty records:', teamTable.records.filter(r => !r.isEmpty).length);

  // Get first non-empty record and show all fields
  const firstTeam = teamTable.records.find(r => !r.isEmpty);

  if (!firstTeam) {
    console.log('ERROR: No non-empty team records!');
    return;
  }

  // Try to get all fields
  if (firstTeam._fieldsArray) {
    console.log('\n=== TEAM FIELDS (from _fieldsArray) ===');
    for (const field of firstTeam._fieldsArray) {
      const name = field.name || field.key || field._key;
      const val = field.value;
      const display = typeof val === 'string' && val.length > 50 ? val.slice(0, 50) + '...' : val;
      console.log(`${name}: ${display}`);
    }
  }

  // Also try direct field access
  console.log('\n=== DIRECT FIELD ACCESS ===');
  const testFields = [
    'TeamIndex', 'teamIndex', 'TEAM_INDEX', 'Team_Index',
    'ShortName', 'shortName', 'SHORT_NAME', 'Abbrev', 'Abbreviation',
    'LongName', 'longName', 'LONG_NAME', 'Name', 'DisplayName',
    'NickName', 'CityName', 'City'
  ];

  for (const field of testFields) {
    try {
      const val = firstTeam[field];
      if (val !== undefined) {
        console.log(`${field}: ${val}`);
      }
    } catch (e) {}
  }

  // Show first 5 teams
  console.log('\n=== FIRST 5 NON-EMPTY TEAMS ===');
  let count = 0;
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (++count > 5) break;

    console.log(`\nRecord ${team.index}:`);

    // Try various ways to get team info
    try {
      console.log(`  TeamIndex: ${team.TeamIndex}`);
    } catch (e) {}
    try {
      console.log(`  ShortName: ${team.ShortName}`);
    } catch (e) {}
    try {
      console.log(`  LongName: ${team.LongName}`);
    } catch (e) {}
    try {
      console.log(`  DisplayName: ${team.DisplayName}`);
    } catch (e) {}
  }

  // Check if TeamIndex < 32 condition is the problem
  console.log('\n=== ALL TeamIndex VALUES ===');
  const teamIndices = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    try {
      const ti = team.TeamIndex;
      if (ti !== undefined) {
        teamIndices.push({ record: team.index, teamIndex: ti });
      }
    } catch (e) {}
  }

  console.log(`Found ${teamIndices.length} teams with TeamIndex`);
  if (teamIndices.length > 0) {
    console.log('TeamIndex values:', teamIndices.slice(0, 40).map(t => t.teamIndex).join(', '));
  }
}

debugTeamTable().catch(console.error);
