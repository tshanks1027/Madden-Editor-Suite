/**
 * Dump ALL field names from Coach table via internal _fieldsArray
 */
const { create } = require('madden-franchise');

async function dumpCoachFields() {
  const workingFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';

  console.log('Loading 2011 Throwback file...');
  const franchise = await create(workingFile);

  // Get Coach table
  let coachTable = franchise.getTableByUniqueId(1864063867);
  if (!coachTable) coachTable = franchise.getTableByName('Coach');
  await coachTable.readRecords();

  console.log('\n=== COACH TABLE ===');
  console.log('Table name:', coachTable.name);
  console.log('Total records:', coachTable.records.length);

  // Find a head coach
  const sampleCoach = coachTable.records.find(r => {
    if (r.isEmpty) return false;
    // Try to access Position field
    try {
      return r.Position === 'HeadCoach' || r.Position === 0;
    } catch (e) {
      return false;
    }
  });

  if (!sampleCoach) {
    console.log('No head coach found');
    return;
  }

  console.log('\n=== SAMPLE HEAD COACH ===');
  console.log('Index:', sampleCoach.index);

  // Access _fieldsArray directly
  if (sampleCoach._fieldsArray) {
    console.log('\n=== FIELDS FROM _fieldsArray ===');
    for (const field of sampleCoach._fieldsArray) {
      const name = field.name || field.key || field._key;
      const value = field.value;
      console.log(`${name}: ${value}`);
    }
  }

  // Also try accessing known fields directly
  console.log('\n=== DIRECT FIELD ACCESS ===');
  const knownFields = [
    'FirstName', 'LastName', 'Position', 'TeamIndex', 'ContractStatus',
    'Age', 'Portrait', 'AssetName', 'PresentationId', 'CharacterVisuals',
    'PCMT', 'CommentaryId', 'CareerWins', 'CareerLosses'
  ];

  for (const field of knownFields) {
    try {
      const val = sampleCoach[field];
      console.log(`${field}: ${val}`);
    } catch (e) {
      console.log(`${field}: [error]`);
    }
  }

  // Check the table header for field definitions
  console.log('\n=== TABLE HEADER FIELDS ===');
  if (coachTable.header) {
    console.log('Header keys:', Object.keys(coachTable.header).join(', '));
    if (coachTable.header.recordWords) {
      console.log('Record words:', coachTable.header.recordWords);
    }
    if (coachTable.header.fieldNames) {
      console.log('Field names:', coachTable.header.fieldNames);
    }
  }

  // Check table._fields
  if (coachTable._fields) {
    console.log('\n=== TABLE _fields ===');
    for (const f of coachTable._fields) {
      console.log(`  ${f.name || f.key}: type=${f.type}, bits=${f.bits || 'n/a'}`);
    }
  }

  // Try getFields()
  try {
    const fields = coachTable.getFields ? coachTable.getFields() : null;
    if (fields) {
      console.log('\n=== getFields() ===');
      console.log(JSON.stringify(fields, null, 2).slice(0, 2000));
    }
  } catch (e) {}

  // Check loadedOffsets or schema
  if (coachTable._schema) {
    console.log('\n=== TABLE _schema ===');
    console.log(JSON.stringify(coachTable._schema, null, 2).slice(0, 2000));
  }
}

dumpCoachFields().catch(console.error);
