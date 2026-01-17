// RESEARCH: Deep investigation into Team table fields
// The library might be hiding fields - need to find the actual team data
// NO CODING - RESEARCH ONLY

async function investigateTeamFieldsDeep() {
  const FranchiseModule = await import('madden-franchise');
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('DEEP TEAM FIELDS INVESTIGATION');
  console.log('='.repeat(80));

  const franchise = await FranchiseModule.create(filePath);

  // Get the main Team table (id=5917 based on previous output)
  const teamTable = franchise.getTableById(5917);
  await teamTable.readRecords();

  console.log(`\nTeam table has ${teamTable.records.length} records`);
  console.log(`Non-empty: ${teamTable.records.filter(r => !r.isEmpty).length}`);

  // Get a team record
  const team = teamTable.records.find(r => !r.isEmpty);
  if (team) {
    console.log('\n--- Team record structure ---');

    // Check all properties including hidden ones
    const allProps = Object.getOwnPropertyNames(team);
    console.log(`\nAll property names (${allProps.length}):`);
    console.log(allProps.join(', '));

    // Check prototype
    const proto = Object.getPrototypeOf(team);
    if (proto) {
      const protoProps = Object.getOwnPropertyNames(proto);
      console.log(`\nPrototype properties (${protoProps.length}):`);
      console.log(protoProps.join(', '));
    }

    // Try to access common team fields directly
    console.log('\n--- Attempting direct field access ---');
    const possibleFields = [
      'TeamIndex', 'ShortName', 'LongName', 'DisplayName', 'Abbreviation',
      'CityName', 'NickName', 'Roster', 'TEAM_ABBREVIATION', 'TEAM_SHORTNAME',
      'TEAM_LONGNAME', 'TEAM_NICKNAME', 'TEAM_CITYNAME', 'TeamName'
    ];

    for (const field of possibleFields) {
      try {
        const value = team[field];
        console.log(`  ${field}: ${value} (type: ${typeof value})`);
      } catch (e) {
        console.log(`  ${field}: ERROR - ${e.message}`);
      }
    }

    // Check if there's a _fields or _data property
    console.log('\n--- Checking internal properties ---');
    if (team._fields) {
      console.log('_fields:', Object.keys(team._fields));
    }
    if (team._data) {
      console.log('_data type:', typeof team._data);
    }
    if (team.fields) {
      console.log('fields:', Object.keys(team.fields));
    }

    // Try to iterate record
    console.log('\n--- Trying enumerable properties ---');
    for (const key in team) {
      try {
        const val = team[key];
        if (typeof val !== 'function') {
          console.log(`  ${key}: ${val}`);
        }
      } catch (e) {
        console.log(`  ${key}: ERROR`);
      }
    }
  }

  // Check table schema
  console.log('\n' + '-'.repeat(80));
  console.log('TABLE SCHEMA INVESTIGATION:');
  console.log('-'.repeat(80));

  if (teamTable.schema) {
    console.log('Has schema');
    if (teamTable.schema.fields) {
      const schemaFields = teamTable.schema.fields;
      console.log(`Schema fields: ${Object.keys(schemaFields).length}`);
      const fieldNames = Object.keys(schemaFields).slice(0, 20);
      console.log('First 20:', fieldNames.join(', '));
    }
  }

  if (teamTable.header) {
    console.log('\nTable header info:');
    const headerFields = Object.keys(teamTable.header);
    console.log(headerFields.join(', '));
  }

  // Now look at a DIFFERENT Team table - the one with more data
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING AT ALTERNATIVE TEAM TABLES:');
  console.log('='.repeat(80));

  // Team (id=4996) had only 1 record - let's check that
  const team4996 = franchise.getTableById(4996);
  if (team4996) {
    await team4996.readRecords();
    console.log(`\nTeam (id=4996): ${team4996.records.filter(r => !r.isEmpty).length} non-empty`);

    const rec = team4996.records.find(r => !r.isEmpty);
    if (rec) {
      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      console.log(`Fields: ${fields.join(', ')}`);
    }
  }

  // TeamSetting (id=4172) had 34 records - might have team-specific data
  const teamSetting = franchise.getTableById(4172);
  if (teamSetting) {
    await teamSetting.readRecords();
    console.log(`\nTeamSetting (id=4172): ${teamSetting.records.filter(r => !r.isEmpty).length} non-empty`);

    const rec = teamSetting.records.find(r => !r.isEmpty);
    if (rec) {
      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      console.log(`Fields: ${fields.join(', ')}`);

      // Show some values
      for (const f of fields.slice(0, 15)) {
        try {
          console.log(`  ${f}: ${rec[f]}`);
        } catch (e) {
          // skip
        }
      }
    }
  }

  // Look for tables that might have player-team associations
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR PLAYER-TEAM LINK TABLES:');
  console.log('='.repeat(80));

  const linkCandidates = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('playerteam') ||
      t.name.toLowerCase().includes('teamplayer') ||
      t.name.toLowerCase().includes('rosterplayer') ||
      t.name.toLowerCase().includes('playerroster') ||
      t.name.toLowerCase().includes('activerost')
    )
  );

  console.log(`Found ${linkCandidates.length} potential link tables`);

  for (const table of linkCandidates) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${table.name} (id=${table.header?.tableId}): ${nonEmpty} non-empty`);

      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
        console.log(`  Fields: ${fields.join(', ')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Search ALL tables for ones that have both Player and Team references
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING ALL TABLES FOR PLAYER+TEAM REFERENCES:');
  console.log('='.repeat(80));

  let playerTeamTables = [];

  for (const table of franchise.tables) {
    if (!table.name) continue;

    try {
      await table.readRecords();
      if (!table.records || table.records.length === 0) continue;

      const rec = table.records.find(r => !r.isEmpty);
      if (!rec) continue;

      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));

      const hasPlayer = fields.some(f => f.toLowerCase().includes('player'));
      const hasTeam = fields.some(f => f.toLowerCase().includes('team'));

      if (hasPlayer && hasTeam) {
        playerTeamTables.push({
          name: table.name,
          tableId: table.header?.tableId,
          nonEmpty: table.records.filter(r => !r.isEmpty).length,
          fields: fields
        });
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`\nTables with both Player and Team fields: ${playerTeamTables.length}`);

  for (const t of playerTeamTables.slice(0, 15)) {
    console.log(`\n${t.name} (id=${t.tableId}): ${t.nonEmpty} records`);
    const playerFields = t.fields.filter(f => f.toLowerCase().includes('player'));
    const teamFields = t.fields.filter(f => f.toLowerCase().includes('team'));
    console.log(`  Player fields: ${playerFields.join(', ')}`);
    console.log(`  Team fields: ${teamFields.join(', ')}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

investigateTeamFieldsDeep().catch(console.error);
