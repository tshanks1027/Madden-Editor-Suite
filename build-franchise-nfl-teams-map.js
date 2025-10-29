const fs = require('fs');
const path = require('path');

// Read team_lookup.csv to get the correct TGID -> Team name mapping
const csvPath = path.join(__dirname, 'data', 'lookups', 'team_lookup.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split('\n');

console.log('Building franchise TeamIndex -> Team Name mapping...\n');

// Parse CSV (skip header)
const mapping = {};
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const [tgid, teamName] = line.split(',');
  const tgidNum = parseInt(tgid);

  if (!isNaN(tgidNum) && tgidNum >= 1 && tgidNum <= 32) {
    // Franchise TeamIndex is 0-based, roster TGID is 1-based
    const franchiseTeamIndex = tgidNum - 1;
    mapping[franchiseTeamIndex] = teamName.trim();
    console.log(`Franchise TeamIndex ${franchiseTeamIndex} = ${teamName} (roster TGID ${tgidNum})`);
  }
}

console.log(`\nBuilt ${Object.keys(mapping).length} team mappings`);

// Write to JSON
const outputPath = path.join(__dirname, 'data', 'franchise-teamindex-names.json');
fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
console.log(`\nWrote mapping to ${outputPath}`);
