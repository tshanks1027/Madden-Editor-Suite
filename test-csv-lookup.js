/**
 * Simple test to verify CSV parsing works correctly
 */
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'data', 'lookups', 'ROSTER_lookup.csv');

function normalizeName(name) {
  return name
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

console.log('Loading CSV:', csvPath);
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.trim().split('\n');

console.log(`Total lines: ${lines.length}`);
console.log('Header:', lines[0].substring(0, 200));

// Build cache
const cache = new Map();
let parsedCount = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = parseCSVLine(line);
  if (parts.length < 70) continue;

  const year = parseInt(parts[0].trim());
  const playerName = parts[2].trim();

  const normalizedName = normalizeName(playerName);
  const key = `${normalizedName}_${year}`;

  if (!cache.has(key)) {
    cache.set(key, []);
  }
  cache.get(key).push({
    year,
    playerName,
    povr: parts[13].trim(),
    archetype: parts[14].trim(),
    pspd: parts[15].trim(),
    pacc: parts[16].trim(),
    pthp: parts[22].trim()
  });

  parsedCount++;
}

console.log(`\nParsed ${parsedCount} entries`);
console.log(`Cache has ${cache.size} unique keys`);

// Test specific lookups
console.log('\n=== TEST LOOKUPS ===');

const tests = [
  { name: 'Andrew Luck', draftYear: 2012 },  // Rookie year 2013
  { name: 'Joe Burrow', draftYear: 2020 },    // Rookie year 2021
  { name: 'Jedrick Wills', draftYear: 2020 }, // Rookie year 2021
  { name: 'Tristan Wirfs', draftYear: 2020 }, // Rookie year 2021
];

for (const test of tests) {
  const rookieYear = test.draftYear + 1;
  const normalizedName = normalizeName(test.name);
  const key = `${normalizedName}_${rookieYear}`;
  const data = cache.get(key);

  console.log(`\n${test.name} (Draft ${test.draftYear}):`);
  console.log(`  Lookup key: "${key}"`);

  if (data && data.length > 0) {
    console.log(`  FOUND: OVR=${data[0].povr}, Archetype=${data[0].archetype}`);
    console.log(`         Speed=${data[0].pspd}, Accel=${data[0].pacc}, ThrowPower=${data[0].pthp}`);
  } else {
    console.log(`  NOT FOUND`);
    // Try to find similar keys
    const lastName = normalizedName.split(' ')[1] || '';
    const similar = Array.from(cache.keys()).filter(k => k.includes(lastName)).slice(0, 5);
    console.log(`  Similar keys with "${lastName}":`, similar);
  }
}

// Show some 2012 draft class entries (should be in 2013 rookie year)
console.log('\n=== SAMPLE 2013 ENTRIES ===');
const keys2013 = Array.from(cache.keys()).filter(k => k.endsWith('_2013'));
console.log(`Found ${keys2013.length} entries from 2013`);
console.log('First 10:', keys2013.slice(0, 10));
