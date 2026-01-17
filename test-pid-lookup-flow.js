// Direct test of PID lookup flow - simulates what CreatorService and RosterCreatorService do
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

console.log('=== PID LOOKUP FLOW TEST ===\n');

// Paths
const allPlayerPath = path.join(__dirname, 'data', 'lookups', 'ALL_PLAYER_LOOKUP.csv');
const pidMappingPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');

// Step 1: Load ALL_PLAYER_LOOKUP.csv (what CreatorService.loadMasterLookup does)
console.log('STEP 1: Loading ALL_PLAYER_LOOKUP.csv...');
const allPlayerContent = fs.readFileSync(allPlayerPath, 'utf-8');
const allPlayerParsed = Papa.parse(allPlayerContent, { header: true, skipEmptyLines: true });
console.log(`  Loaded ${allPlayerParsed.data.length} rows`);

// Build masterLookup cache
const masterLookup = new Map();
const stripMarkers = (name) => name.toLowerCase().replace(/[‡†*]+\d*/g, '').trim();

for (const entry of allPlayerParsed.data) {
  const firstName = entry['First Name'] || '';
  const lastName = entry['Last Name'] || '';
  const draftClass = entry['Draft Class'] || '';

  if (firstName && lastName && draftClass) {
    const key = `${stripMarkers(firstName)} ${stripMarkers(lastName)} ${draftClass}`;
    masterLookup.set(key, entry);
  }
}
console.log(`  Built masterLookup cache with ${masterLookup.size} entries\n`);

// Step 2: Check if Staubach is in masterLookup
console.log('STEP 2: Checking for Staubach in masterLookup...');
const staubachKey = 'roger staubach 1964';
if (masterLookup.has(staubachKey)) {
  const staubach = masterLookup.get(staubachKey);
  console.log(`  ✅ Found with key "${staubachKey}":`);
  console.log(`     PhotoID: ${staubach['PhotoID']}`);
  console.log(`     From: ${staubach['From']}, To: ${staubach['To']}`);
  console.log(`     Race: ${staubach['Race']}`);
  console.log(`     College/Univ: ${staubach['College/Univ']}`);
} else {
  console.log(`  ❌ NOT found with key "${staubachKey}"`);
  // Search manually
  for (const [key, entry] of masterLookup.entries()) {
    if (key.includes('staubach')) {
      console.log(`  Found with different key: "${key}"`);
    }
  }
}

// Step 3: Simulate findPlayerInMASTERLookup for 1970
console.log('\nSTEP 3: Simulating findPlayerInMASTERLookup("Roger", "Staubach", 1970)...');
const rosterYear = 1970;
let foundEntry = null;

for (const [key, entry] of masterLookup.entries()) {
  const entryFirst = stripMarkers(entry['First Name'] || '');
  const entryLast = stripMarkers(entry['Last Name'] || '');

  if (entryFirst === 'roger' && entryLast === 'staubach') {
    console.log(`  Name match found! Key: "${key}"`);

    const from = parseInt(entry['From']) || 0;
    const to = parseInt(entry['To']) || 0;

    console.log(`  Year range: From=${from}, To=${to}`);
    console.log(`  Checking: ${rosterYear} >= ${from} && ${rosterYear} <= ${to}`);

    if (from > 0 && to > 0) {
      if (rosterYear >= from && rosterYear <= to) {
        console.log(`  ✅ Year ${rosterYear} IS in range ${from}-${to}`);
        foundEntry = entry;
        break;
      } else {
        console.log(`  ❌ Year ${rosterYear} NOT in range ${from}-${to}`);
      }
    }
  }
}

if (foundEntry) {
  console.log(`\n  RESULT: Found entry with PhotoID=${foundEntry['PhotoID']}`);
} else {
  console.log(`\n  RESULT: ❌ NO ENTRY FOUND`);
}

// Step 4: Load PID_Portrait_Mapping.csv and build validPIDs (what RosterCreatorService does)
console.log('\nSTEP 4: Loading PID_Portrait_Mapping.csv and building validPIDs...');
const validPIDs = new Set();
const pidToRace = new Map();

const pidMappingContent = fs.readFileSync(pidMappingPath, 'utf-8');
const pidMappingParsed = Papa.parse(pidMappingContent, { header: true, skipEmptyLines: true });

for (const row of pidMappingParsed.data) {
  const pid = parseInt(row.PID);
  if (!isNaN(pid)) {
    validPIDs.add(pid);
    const race = parseInt(row.Race) || 0;
    if (race > 0) pidToRace.set(pid, race);
  }
}
console.log(`  Loaded ${validPIDs.size} PIDs from PID_Portrait_Mapping.csv`);

// Step 5: Extend validPIDs from ALL_PLAYER_LOOKUP.csv
console.log('\nSTEP 5: Extending validPIDs from ALL_PLAYER_LOOKUP.csv...');
let addedFromMaster = 0;
for (const row of allPlayerParsed.data) {
  const photoId = parseInt(row['PhotoID']);
  if (!isNaN(photoId) && photoId > 0) {
    if (!validPIDs.has(photoId)) {
      validPIDs.add(photoId);
      addedFromMaster++;
    }
    const race = parseInt(row['Race']);
    if (!isNaN(race) && race > 0 && !pidToRace.has(photoId)) {
      pidToRace.set(photoId, race);
    }
  }
}
console.log(`  Added ${addedFromMaster} new PIDs from ALL_PLAYER_LOOKUP.csv`);
console.log(`  Total validPIDs: ${validPIDs.size}`);

// Step 6: Check if PID 2966 is in validPIDs
console.log('\nSTEP 6: Checking if PID 2966 (Staubach) is valid...');
console.log(`  validPIDs.has(2966): ${validPIDs.has(2966)}`);
console.log(`  pidToRace.get(2966): ${pidToRace.get(2966)}`);

// Step 7: Simulate the full flow
console.log('\n=== FULL FLOW SIMULATION ===');
console.log('Simulating: Generate 1970 roster, process Roger Staubach\n');

// What CreatorService does
const lookupEntry = foundEntry; // from step 3
let matchedPID = 0;

if (lookupEntry) {
  const lookupPID = parseInt(lookupEntry['PhotoID']);
  if (!isNaN(lookupPID) && lookupPID > 0) {
    matchedPID = lookupPID;
    console.log(`CreatorService: Using PhotoID from lookup: ${matchedPID}`);
  }
} else {
  console.log(`CreatorService: ❌ No lookup entry found - would assign generic face`);
}

// What RosterCreatorService does
if (matchedPID > 0) {
  const existingPID = matchedPID; // This is what gets set as PSXP
  const hasValidPID = existingPID > 0 && validPIDs.has(existingPID);

  console.log(`\nRosterCreatorService:`);
  console.log(`  existingPID (PSXP): ${existingPID}`);
  console.log(`  validPIDs.has(${existingPID}): ${validPIDs.has(existingPID)}`);
  console.log(`  hasValidPID: ${hasValidPID}`);

  if (hasValidPID) {
    console.log(`  ✅ PRESERVE PID ${existingPID} - Staubach gets his real face!`);
  } else {
    console.log(`  ❌ PID NOT VALID - Would assign generic face`);
  }
}

console.log('\n=== TEST COMPLETE ===');
