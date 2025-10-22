/**
 * Add PLPO column to FullData_Lookup.csv
 * Generates PLPO keys from FirstName + LastName
 */

const fs = require('fs');
const path = require('path');

const inputFile = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Lookups\\FullData_Lookup.csv';
const outputFile = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Lookups\\FullData_Lookup_with_PLPO.csv';

console.log('Reading FullData_Lookup.csv...');
const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

const outputLines = [];

// Process header
const header = lines[0].trim();
const newHeader = header + ',PLPO';
outputLines.push(newHeader);

console.log('Processing rows...');
let processedCount = 0;
let genericCount = 0;
let realPlayerCount = 0;

// Process data rows
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length < 8) {
    // Invalid row, keep as is
    outputLines.push(line);
    continue;
  }

  const lastName = parts[0];
  const firstName = parts[1];
  const photoID = parts[7];

  let plpo = '';

  // Check if this is a Generic Face
  if (lastName === 'Generic' && firstName === 'Face') {
    // For generic faces, we'll assign them generic PLPO keys
    // Generic portraits are named like plpo_generic_1_001_morphed, etc.
    // For now, leave blank - we'll handle generics separately
    plpo = '';
    genericCount++;
  } else if (lastName && firstName) {
    // Real player - generate PLPO from name
    // Format: plpo_LastNameFirstName (all lowercase, no spaces)
    const cleanLastName = lastName.replace(/[^a-zA-Z]/g, '');
    const cleanFirstName = firstName.replace(/[^a-zA-Z]/g, '');
    plpo = `plpo_${cleanLastName}${cleanFirstName}`.toLowerCase();
    realPlayerCount++;
  }

  outputLines.push(line + ',' + plpo);
  processedCount++;

  if (processedCount % 1000 === 0) {
    console.log(`Processed ${processedCount} rows...`);
  }
}

console.log('\nProcessing complete!');
console.log(`Total rows processed: ${processedCount}`);
console.log(`Real players: ${realPlayerCount}`);
console.log(`Generic faces: ${genericCount}`);

// Write output file
console.log(`\nWriting to: ${outputFile}`);
fs.writeFileSync(outputFile, outputLines.join('\n'), 'utf-8');
console.log('Done!');

// Show some sample PLPOs
console.log('\n=== Sample PLPO entries (first 10 real players) ===');
let count = 0;
for (let i = 1; i < lines.length && count < 10; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  const lastName = parts[0];
  const firstName = parts[1];
  const photoID = parts[7];

  if (lastName !== 'Generic') {
    const cleanLastName = lastName.replace(/[^a-zA-Z]/g, '');
    const cleanFirstName = firstName.replace(/[^a-zA-Z]/g, '');
    const plpo = `plpo_${cleanLastName}${cleanFirstName}`.toLowerCase();
    console.log(`PID ${photoID}: ${firstName} ${lastName} -> ${plpo}`);
    count++;
  }
}
