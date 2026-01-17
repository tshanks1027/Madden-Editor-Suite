/**
 * Debug script to dump ALL fields of Coach records for a specific team
 */
const { create } = require('madden-franchise');

async function debugCoachFields(filePath, teamIndex = 0) {
  console.log('Loading franchise file:', filePath);
  console.log('Looking for coaches with TeamIndex:', teamIndex);

  const franchise = await create(filePath);

  // Get Coach table
  let coachTable = franchise.getTableByUniqueId(1864063867);
  if (!coachTable) {
    coachTable = franchise.getTableByName('Coach');
  }

  if (!coachTable) {
    console.log('Could not find Coach table!');
    return;
  }

  await coachTable.readRecords();
  console.log(`\nLoaded ${coachTable.records.length} coach records`);

  // Get field names from the table header/schema
  const fieldNames = [];
  if (coachTable.header && coachTable.header.fieldNames) {
    fieldNames.push(...coachTable.header.fieldNames);
  } else if (coachTable._fields) {
    for (const f of coachTable._fields) {
      fieldNames.push(f.name);
    }
  } else if (coachTable.records.length > 0) {
    // Try to get from record's _fieldsArray
    const firstRec = coachTable.records[0];
    if (firstRec._fieldsArray) {
      for (const f of firstRec._fieldsArray) {
        fieldNames.push(f.name || f.key);
      }
    }
  }

  console.log(`\n=== FIELD NAMES (${fieldNames.length} fields) ===`);
  console.log(fieldNames.join(', '));

  // Find coaches for the specified team
  const teamCoaches = coachTable.records.filter(r => {
    if (r.isEmpty) return false;
    return r.TeamIndex === teamIndex;
  });

  console.log(`\nFound ${teamCoaches.length} coaches for TeamIndex ${teamIndex}`);

  // Dump each HeadCoach with ALL fields
  console.log('\n\n=== HEAD COACHES FOR TEAM ' + teamIndex + ' ===');

  for (const coach of teamCoaches) {
    const position = coach.Position;
    const isHC = position === 0 || position === 'HeadCoach' || String(position).includes('HeadCoach');

    if (!isHC) continue;

    console.log(`\n--- ${coach.FirstName} ${coach.LastName} (index: ${coach.index}) ---`);

    // Access fields by name
    for (const field of fieldNames) {
      try {
        const val = coach[field];
        if (val !== undefined && val !== '' && val !== null) {
          const display = typeof val === 'object' ? JSON.stringify(val) : val;
          console.log(`  ${field}: ${display}`);
        }
      } catch (e) {
        // Skip fields that error
      }
    }
  }

  // Also check if Team table has a Coach reference
  console.log('\n\n=== CHECKING TEAM TABLE FOR COACH REFERENCES ===');
  let teamTable = franchise.getTableByUniqueId(2079398721);
  if (!teamTable) {
    teamTable = franchise.getTableByName('Team');
  }

  if (teamTable) {
    await teamTable.readRecords();

    // Get team field names
    const teamFieldNames = [];
    if (teamTable.records.length > 0 && teamTable.records[0]._fieldsArray) {
      for (const f of teamTable.records[0]._fieldsArray) {
        teamFieldNames.push(f.name || f.key);
      }
    }

    const team = teamTable.records.find(t => t.TeamIndex === teamIndex && !t.isEmpty);
    if (team) {
      console.log(`\nTeam ${teamIndex} - Fields containing 'coach', 'HC', or 'head':`);
      for (const field of teamFieldNames) {
        const lower = field.toLowerCase();
        if (lower.includes('coach') || lower.includes('hc') || lower.includes('head')) {
          try {
            console.log(`  ${field}: ${team[field]}`);
          } catch (e) {
            // Skip
          }
        }
      }

      // Also print all team field names to find the coach reference
      console.log(`\nAll Team field names (${teamFieldNames.length}):`);
      console.log(teamFieldNames.join(', '));
    }
  }
}

// Run with command line args
const filePath = process.argv[2];
const teamIndex = parseInt(process.argv[3] || '0', 10);

if (!filePath) {
  console.error('Usage: node debug-coach-fields.js <franchise-file> [teamIndex]');
  process.exit(1);
}

debugCoachFields(filePath, teamIndex).catch(err => console.error('Error:', err));
