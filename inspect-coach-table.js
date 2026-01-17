/**
 * Inspect Coach Table Structure
 *
 * Check how free agent coaches vs signed coaches are stored
 * and whether we can safely add/remove coaches
 */

const { create } = require('madden-franchise');
const fs = require('fs');

async function inspectCoachTable(filePath) {
  console.log('='.repeat(80));
  console.log('COACH TABLE STRUCTURE INSPECTION');
  console.log('='.repeat(80));

  const franchise = await create(filePath);

  const coachTable = franchise.getTableByName('Coach');
  if (!coachTable) {
    console.log('Coach table not found!');
    return;
  }

  await coachTable.readRecords();

  console.log(`\nTotal records: ${coachTable.records.length}`);
  const nonEmpty = coachTable.records.filter(r => !r.isEmpty);
  const empty = coachTable.records.filter(r => r.isEmpty);
  console.log(`Non-empty: ${nonEmpty.length}`);
  console.log(`Empty (available slots): ${empty.length}`);

  // Group by ContractStatus
  const byStatus = {};
  const byPosition = {};
  const byTeam = {};

  for (const coach of nonEmpty) {
    const status = coach.ContractStatus || 'Unknown';
    const position = coach.Position || 'Unknown';
    const teamIndex = coach.TeamIndex;

    byStatus[status] = (byStatus[status] || 0) + 1;
    byPosition[position] = (byPosition[position] || 0) + 1;

    if (teamIndex !== undefined) {
      if (teamIndex >= 32) {
        byTeam['Non-NFL (32+)'] = (byTeam['Non-NFL (32+)'] || 0) + 1;
      } else {
        byTeam[`Team ${teamIndex}`] = (byTeam[`Team ${teamIndex}`] || 0) + 1;
      }
    }
  }

  console.log('\n--- By Contract Status ---');
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('\n--- By Position ---');
  for (const [pos, count] of Object.entries(byPosition)) {
    console.log(`  ${pos}: ${count}`);
  }

  console.log('\n--- Team Distribution ---');
  console.log(`  Unique teams: ${Object.keys(byTeam).length}`);

  // Sample free agents if any
  console.log('\n--- Sample Free Agent Coaches ---');
  const freeAgents = nonEmpty.filter(c =>
    c.ContractStatus === 'FreeAgent' ||
    c.ContractStatus === 'ContractStatus:FreeAgent' ||
    c.TeamIndex >= 32
  );

  console.log(`Found ${freeAgents.length} potential free agent coaches`);

  for (const fa of freeAgents.slice(0, 5)) {
    console.log(`  ${fa.FirstName} ${fa.LastName} - ${fa.Position} - Team: ${fa.TeamIndex} - Status: ${fa.ContractStatus}`);
  }

  // Sample signed coaches
  console.log('\n--- Sample Signed Coaches ---');
  const signed = nonEmpty.filter(c =>
    c.ContractStatus === 'Signed' ||
    c.ContractStatus === 'ContractStatus:Signed'
  );

  console.log(`Found ${signed.length} signed coaches`);

  for (const s of signed.slice(0, 5)) {
    console.log(`  ${s.FirstName} ${s.LastName} - ${s.Position} - Team: ${s.TeamIndex} - Status: ${s.ContractStatus}`);
  }

  // Check for empty record slots
  console.log('\n--- Empty Record Slots ---');
  console.log(`Available empty slots: ${empty.length}`);
  if (empty.length > 0) {
    console.log(`First empty slot index: ${empty[0].index}`);
    console.log('These can be used to ADD new coaches');
  } else {
    console.log('WARNING: No empty slots - cannot add new coaches without expanding table');
  }

  // List all fields on a coach record
  console.log('\n--- Coach Record Fields ---');
  if (nonEmpty.length > 0) {
    const sample = nonEmpty[0];
    const fields = Object.keys(sample).filter(k =>
      !k.startsWith('_') &&
      typeof sample[k] !== 'function'
    );
    console.log(`Total fields: ${fields.length}`);
    console.log('Fields:');
    for (const f of fields.sort()) {
      const val = sample[f];
      const display = val !== undefined && val !== null ? String(val).substring(0, 50) : '(empty)';
      console.log(`  ${f}: ${display}`);
    }
  }
}

const filePath = process.argv[2] || 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';

if (!fs.existsSync(filePath)) {
  console.log('Usage: node inspect-coach-table.js <franchise-file>');
  process.exit(1);
}

inspectCoachTable(filePath).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
