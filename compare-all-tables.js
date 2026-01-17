/**
 * Compare ALL tables between 3 roster files to find where head number is stored
 */

const path = require('path');

async function compare() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const files = [
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official', head: 128 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST1', head: 34 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST2', head: 189 }
  ];

  const loadedFiles = [];

  for (const fileInfo of files) {
    console.log(`Loading ${fileInfo.path.split('/').pop()}...`);
    const helper = new MaddenRosterHelper();
    const file = await helper.load(fileInfo.path);
    loadedFiles.push({ name: fileInfo.path.split('/').pop(), file, head: fileInfo.head });
  }

  // Get Payton Turner's PGID from first file
  let turnerPGID = null;
  const playTable = loadedFiles[0].file.PLAY;
  for (const record of playTable.records) {
    if (record.fields['PFNA']?.value === 'Payton' && record.fields['PLNA']?.value === 'Turner') {
      turnerPGID = record.fields['PGID']?.value;
      console.log(`\nPayton Turner PGID: ${turnerPGID}`);
      break;
    }
  }

  // Compare each table
  console.log('\n=== COMPARING ALL TABLES ===\n');

  const tableNames = loadedFiles[0].file.tables.map(t => t.name);

  for (const tableName of tableNames) {
    const table1 = loadedFiles[0].file[tableName];
    const table2 = loadedFiles[1].file[tableName];
    const table3 = loadedFiles[2].file[tableName];

    if (!table1 || !table2 || !table3) continue;

    let differences = 0;

    // Compare record counts
    if (table1.records.length !== table2.records.length || table2.records.length !== table3.records.length) {
      console.log(`${tableName}: Record count differs - ${table1.records.length} / ${table2.records.length} / ${table3.records.length}`);
      differences++;
    }

    // For tables with PGID, find Turner's record
    if (tableName !== 'PLAY' && table1.records.length > 0 && table1.records[0].fields['PGID']) {
      for (let i = 0; i < table1.records.length; i++) {
        const r1 = table1.records[i];
        if (r1.fields['PGID']?.value === turnerPGID) {
          // Find corresponding records in other files
          const r2 = table2.records.find(r => r.fields['PGID']?.value === turnerPGID);
          const r3 = table3.records.find(r => r.fields['PGID']?.value === turnerPGID);

          if (r2 && r3) {
            // Compare all fields
            for (const field in r1.fields) {
              const v1 = r1.fields[field]?.value;
              const v2 = r2.fields[field]?.value;
              const v3 = r3.fields[field]?.value;

              if (v1 !== v2 || v2 !== v3) {
                console.log(`${tableName}.${field} for Turner: ${v1} / ${v2} / ${v3}`);
                differences++;
              }
            }
          }
        }
      }
    }

    // For BLOB table, compare raw
    if (tableName === 'BLOB') {
      const r1 = table1.records[0];
      const r2 = table2.records[0];
      const r3 = table3.records[0];

      for (const field in r1.fields) {
        const v1 = r1.fields[field]?.value;
        const v2 = r2.fields[field]?.value;
        const v3 = r3.fields[field]?.value;

        if (v1 !== v2 || v2 !== v3) {
          const preview1 = typeof v1 === 'string' ? v1.substring(0, 50) : v1;
          const preview2 = typeof v2 === 'string' ? v2.substring(0, 50) : v2;
          const preview3 = typeof v3 === 'string' ? v3.substring(0, 50) : v3;
          console.log(`${tableName}.${field} differs`);
          if (typeof v1 === 'string' && v1.length > 100) {
            console.log(`  Lengths: ${v1.length} / ${v2.length} / ${v3.length}`);
          } else {
            console.log(`  Values: ${preview1} / ${preview2} / ${preview3}`);
          }
          differences++;
        }
      }
    }

    if (differences === 0 && tableName !== 'PLAY') {
      // console.log(`${tableName}: No differences`);
    }
  }

  // Check if BLOB has any data that could contain head numbers
  console.log('\n=== CHECKING BLOB TABLE ===\n');

  const blob1 = loadedFiles[0].file.BLOB.records[0];
  for (const field in blob1.fields) {
    const val = blob1.fields[field]?.value;
    console.log(`${field}: type=${typeof val}, length=${typeof val === 'string' ? val.length : 'N/A'}`);
    if (typeof val === 'string' && val.length < 200) {
      console.log(`  Value: ${val}`);
    }
  }
}

compare().catch(console.error);
