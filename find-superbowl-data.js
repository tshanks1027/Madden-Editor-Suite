/**
 * Find where Super Bowl history is stored in franchise files
 */
const Franchise = require('madden-franchise');

async function findChampData() {
  const f = await Franchise.create('C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL');

  const team = f.getTableByName('Team');
  await team.readRecords();
  const teamRec = team.records.find(r => r.isEmpty === false);

  console.log('=== Team History Fields ===');

  // Get TeamHistory value
  const teamHistory = teamRec.TeamHistory;
  console.log('TeamHistory:', teamHistory);

  // Get HistoryEntries reference
  const historyEntries = teamRec.HistoryEntries;
  console.log('HistoryEntries:', historyEntries);

  // Try to follow the reference
  const histRef = teamRec.getReferenceDataByKey('HistoryEntries');
  console.log('HistoryEntries ref:', histRef);

  const teamHistRef = teamRec.getReferenceDataByKey('TeamHistory');
  console.log('TeamHistory ref:', teamHistRef);

  // Check TeamHistory table directly
  console.log('\n=== TeamHistory Table ===');
  const teamHistTable = f.getTableByName('TeamHistory');
  if (teamHistTable) {
    await teamHistTable.readRecords();
    const nonEmpty = teamHistTable.records.filter(r => r.isEmpty === false);
    console.log('TeamHistory records:', nonEmpty.length);
    if (nonEmpty.length > 0) {
      const r = nonEmpty[0];
      console.log('Fields:', r.fields ? Object.keys(r.fields).join(', ') : 'no fields prop');
      // Try getFieldByKey for common championship fields
      const testFields = ['SuperBowlWins', 'SuperBowlLosses', 'ChampionshipWins', 'DivisionTitles', 'ConferenceTitles', 'PlayoffAppearances'];
      for (const tf of testFields) {
        try {
          const val = r.getValueByKey(tf);
          if (val !== undefined) console.log('  ' + tf + ':', val);
        } catch(e) {}
      }
    }
  } else {
    console.log('TeamHistory table not found');
  }

  // Look for all tables with "champion" or "superbowl" in field names
  console.log('\n=== Searching all tables for championship-related fields ===');
  const tables = f.tables || [];

  for (const table of tables) {
    const name = table.name || '';
    // Skip array tables and internal reaction tables
    if (name.includes('[]') || name.includes('Reaction') || name.includes('Event')) continue;

    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => r.isEmpty === false);
      if (nonEmpty.length === 0) continue;

      const sample = nonEmpty[0];
      if (sample.fields) {
        const fieldNames = Object.keys(sample.fields);
        const champFields = fieldNames.filter(fn => {
          const fl = fn.toLowerCase();
          return fl.includes('champ') || fl.includes('superbowl') || fl.includes('super_bowl') ||
                 fl.includes('title') || fl.includes('trophy');
        });

        if (champFields.length > 0) {
          console.log('\n' + name + ':');
          for (const cf of champFields) {
            console.log('  ' + cf + ':', sample.getValueByKey(cf));
          }
        }
      }
    } catch (e) {
      // Skip tables that can't be read
    }
  }

  // Check LeagueHistoryAward more carefully
  console.log('\n=== LeagueHistoryAward Deep Dive ===');
  const lha = f.getTableByName('LeagueHistoryAward');
  if (lha) {
    await lha.readRecords();
    console.log('Total records:', lha.records.length);
    console.log('Non-empty:', lha.records.filter(r => r.isEmpty === false).length);

    // Check the schema/header
    if (lha.header) {
      console.log('Header info available');
    }

    // Look at first record even if "empty"
    if (lha.records.length > 0) {
      const first = lha.records[0];
      if (first.fields) {
        console.log('Fields:', Object.keys(first.fields).join(', '));
      }
    }
  }

  // Check Award table
  console.log('\n=== Award Table ===');
  const award = f.getTableByName('Award');
  if (award) {
    await award.readRecords();
    const nonEmpty = award.records.filter(r => r.isEmpty === false);
    console.log('Award records:', nonEmpty.length, 'non-empty');
  }

  // Check PlayerAward table
  console.log('\n=== PlayerAward Table ===');
  const playerAward = f.getTableByName('PlayerAward');
  if (playerAward) {
    await playerAward.readRecords();
    const nonEmpty = playerAward.records.filter(r => r.isEmpty === false);
    console.log('PlayerAward records:', nonEmpty.length, 'non-empty');
    if (nonEmpty.length > 0) {
      const r = nonEmpty[0];
      if (r.fields) {
        console.log('Fields:', Object.keys(r.fields).slice(0, 20).join(', '));
      }
    }
  }
}

findChampData().catch(e => console.error(e));
