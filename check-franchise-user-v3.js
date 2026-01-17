// Check FranchiseUser table fields - Get actual values

async function checkFranchiseUser() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get Team table first to decode team references
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  const recordIndexToTeam = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
      recordIndexToTeam.set(team.index, {
        name: team.ShortName,
        city: team.LongName,
        teamIndex: team.TeamIndex
      });
    }
  }

  console.log('=== FranchiseUser Table - Actual Values ===\n');
  const franchiseUserTable = franchise.getTableByName('FranchiseUser');
  if (franchiseUserTable) {
    await franchiseUserTable.readRecords();

    for (const rec of franchiseUserTable.records) {
      if (rec.isEmpty) continue;
      console.log('FranchiseUser record', rec.index, ':');

      // Direct field access for specific fields
      const fields = franchiseUserTable.header.fields;
      console.log('  Fields available:', fields.map(f => f.name).join(', '));

      // Get Team field value directly
      try {
        const teamVal = rec.Team;
        console.log('\n  Team (raw):', teamVal);
        if (teamVal && teamVal.length === 32) {
          const recordIndex = parseInt(teamVal.slice(-8), 2);
          const teamInfo = recordIndexToTeam.get(recordIndex);
          console.log('  Team (decoded):', teamInfo || 'Unknown');
        }
      } catch (e) {
        console.log('  Team error:', e.message);
      }

      // Check TeamSetting
      try {
        const teamSetting = rec.TeamSetting;
        console.log('  TeamSetting (raw):', teamSetting);
        if (teamSetting && teamSetting.length === 32) {
          const recordIndex = parseInt(teamSetting.slice(-8), 2);
          const teamInfo = recordIndexToTeam.get(recordIndex);
          console.log('  TeamSetting (decoded):', teamInfo || 'Unknown');
        }
      } catch (e) {
        console.log('  TeamSetting error:', e.message);
      }

      // Check UserEntity
      try {
        console.log('  UserEntity:', rec.UserEntity);
      } catch (e) {
        console.log('  UserEntity error:', e.message);
      }

      // Check any *Team* fields
      for (const field of fields) {
        if (field.name.includes('Team') || field.name.includes('User') || field.name.includes('Control')) {
          try {
            const val = rec[field.name];
            if (val !== undefined && val !== null && !field.name.includes('Setting') && field.name !== 'Team') {
              console.log(`  ${field.name}:`, val);
            }
          } catch (e) {}
        }
      }
      console.log('');
    }
  }

  // Also check UserEntity table directly
  console.log('=== UserEntity Table ===\n');
  const userEntityTable = franchise.getTableByName('UserEntity');
  if (userEntityTable) {
    await userEntityTable.readRecords();
    console.log('Records:', userEntityTable.records.length);

    for (const rec of userEntityTable.records) {
      if (rec.isEmpty) continue;
      console.log('\nUserEntity record', rec.index, ':');

      const fields = userEntityTable.header.fields;
      console.log('  Fields:', fields.map(f => f.name).join(', '));

      // Try to get team-related values
      for (const field of fields) {
        try {
          const val = rec[field.name];
          if (val !== undefined && val !== null) {
            console.log(`  ${field.name}:`, val);
          }
        } catch (e) {}
      }
    }
  }
}

checkFranchiseUser().catch(console.error);
