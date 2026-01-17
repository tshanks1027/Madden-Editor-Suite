/**
 * Generate Portrait Mapping for a specific year
 *
 * Creates a mapping file showing:
 * - Historical player name -> Recyclable PLPO -> DDS filename
 *
 * Usage: node generate-portrait-mapping.js <year> [draft|roster]
 */
const fs = require('fs');
const path = require('path');

// Get year from command line
const year = parseInt(process.argv[2]) || 1995;
const mode = process.argv[3] || 'both'; // 'draft', 'roster', or 'both'

console.log(`\nGenerating portrait mapping for ${year} (${mode})\n`);

// Load recyclable PIDs
function loadRecyclablePIDs() {
  const csvPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const recyclable = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 6) continue;

    const pid = parseInt(parts[0], 10);
    if (isNaN(pid)) continue;

    const playerName = parts[1] || '';
    const type = parts[2] || 'player';
    const portrait = parts[3] || '';
    const pam = parts[4] || '';
    const race = parseInt(parts[5], 10) || 0;

    if (playerName.includes('(R)')) {
      recyclable.push({
        pid,
        playerName: playerName.replace(/\s*\(R\)\s*$/, '').trim(),
        type,
        plpo: portrait,
        ddsFilename: portrait ? `${portrait}.dds` : null,
        pam,
        race
      });
    }
  }

  return recyclable;
}

// Load player data
function loadPlayers() {
  const csvPath = path.join(__dirname, 'data/lookups/ALL_PLAYER_LOOKUP.csv');
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const players = [];

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCSVLine(line);
    if (parts.length < 22) continue;

    const fromYear = parseInt(parts[14], 10) || 0;
    const toYear = parseInt(parts[15], 10) || fromYear;
    if (fromYear === 0) continue;

    players.push({
      lastName: parts[0] || '',
      firstName: parts[1] || '',
      college: parts[2] || '',
      position: parts[6] || '',
      pid: parts[8] ? parseInt(parts[8], 10) : null,
      pam: parts[9] || '',
      plpo: parts[11] || '',
      fromYear,
      toYear,
      race: parseInt(parts[21], 10) || 0
    });
  }

  return players;
}

// Get draft class (rookies entering in this year)
function getDraftClass(players, year) {
  return players.filter(p => p.fromYear === year);
}

// Get roster (all players active in this year)
function getRoster(players, year) {
  return players.filter(p => p.fromYear <= year && p.toYear >= year);
}

// Check if player has real portrait (their own PID in game, not recyclable)
function hasRealPortrait(player, recyclablePIDs) {
  if (!player.pid) return false;
  return !recyclablePIDs.find(r => r.pid === player.pid);
}

// Generate mapping
const recyclable = loadRecyclablePIDs();
const allPlayers = loadPlayers();

console.log(`Loaded ${recyclable.length} recyclable PIDs`);
console.log(`Loaded ${allPlayers.length} total players\n`);

// Sort recyclable by type (PLAYERS first, legends last) then by PLPO
recyclable.sort((a, b) => {
  if (a.type !== b.type) return a.type === 'player' ? -1 : 1; // Players first!
  return (a.plpo || '').localeCompare(b.plpo || '');
});

// Track used PIDs
const usedPIDs = new Set();

function generateMapping(players, label) {
  console.log('='.repeat(70));
  console.log(`${label} - ${players.length} players`);
  console.log('='.repeat(70));

  const mapping = [];
  let realCount = 0;
  let assignedCount = 0;
  let unassignedCount = 0;

  // Sort players: by race (for better matching), then name
  players.sort((a, b) => {
    if (a.race !== b.race) return b.race - a.race; // Higher race values first (more recyclable options)
    return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
  });

  for (const player of players) {
    const fullName = `${player.firstName} ${player.lastName}`;

    // Check if player has real portrait
    if (hasRealPortrait(player, recyclable)) {
      mapping.push({
        historicalPlayer: fullName,
        position: player.position,
        race: player.race,
        type: 'REAL',
        recyclablePLPO: player.plpo || 'N/A',
        ddsFilename: player.plpo ? `${player.plpo}.dds` : 'N/A',
        recycledFrom: 'Has own portrait'
      });
      realCount++;
      continue;
    }

    // Find matching recyclable PID by race
    const available = recyclable.filter(r => !usedPIDs.has(r.pid));
    let match = available.find(r => r.race === player.race);

    // If no race match, use any available
    if (!match && available.length > 0) {
      match = available[0];
    }

    if (match) {
      usedPIDs.add(match.pid);
      mapping.push({
        historicalPlayer: fullName,
        position: player.position,
        race: player.race,
        type: 'RECYCLABLE',
        recyclablePLPO: match.plpo,
        ddsFilename: match.ddsFilename,
        recycledFrom: match.playerName
      });
      assignedCount++;
    } else {
      mapping.push({
        historicalPlayer: fullName,
        position: player.position,
        race: player.race,
        type: 'UNASSIGNED',
        recyclablePLPO: null,
        ddsFilename: null,
        recycledFrom: 'No slots available'
      });
      unassignedCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Real portraits: ${realCount}`);
  console.log(`  Recyclable assigned: ${assignedCount}`);
  console.log(`  Unassigned: ${unassignedCount}`);
  console.log(`  Recyclable remaining: ${recyclable.length - usedPIDs.size}`);
  console.log('');

  // Show sample mappings
  console.log('Sample mappings (first 20):');
  for (const m of mapping.slice(0, 20)) {
    if (m.type === 'REAL') {
      console.log(`  [REAL] ${m.historicalPlayer} (${m.position}) -> ${m.recyclablePLPO}`);
    } else if (m.type === 'RECYCLABLE') {
      console.log(`  ${m.historicalPlayer} (${m.position}) -> ${m.ddsFilename} (was: ${m.recycledFrom})`);
    } else {
      console.log(`  [UNASSIGNED] ${m.historicalPlayer} (${m.position})`);
    }
  }
  console.log('');

  return mapping;
}

// Generate mappings based on mode
let draftMapping = [];
let rosterMapping = [];

if (mode === 'draft' || mode === 'both') {
  const draftClass = getDraftClass(allPlayers, year);
  draftMapping = generateMapping(draftClass, `${year} DRAFT CLASS`);
}

if (mode === 'roster' || mode === 'both') {
  // Reset used PIDs for roster if doing both
  if (mode === 'both') {
    usedPIDs.clear();
  }
  const roster = getRoster(allPlayers, year);
  rosterMapping = generateMapping(roster, `${year} ROSTER`);
}

// Save mapping to JSON
const outputDir = path.join(__dirname, 'data', 'portrait-mappings');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const output = {
  year,
  generatedAt: new Date().toISOString(),
  draftClass: mode === 'draft' || mode === 'both' ? draftMapping : undefined,
  roster: mode === 'roster' || mode === 'both' ? rosterMapping : undefined
};

const outputPath = path.join(outputDir, `${year}-portrait-mapping.json`);
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nMapping saved to: ${outputPath}`);

// Also create a simple CSV for easy editing
const csvLines = ['Historical Player,Position,Race,Type,DDS Filename,Recycled From'];
const allMappings = [...(draftMapping || []), ...(rosterMapping || [])];

// Remove duplicates (same player might be in draft and roster)
const seen = new Set();
for (const m of allMappings) {
  const key = m.historicalPlayer;
  if (seen.has(key)) continue;
  seen.add(key);

  csvLines.push([
    m.historicalPlayer,
    m.position,
    m.race,
    m.type,
    m.ddsFilename || '',
    m.recycledFrom || ''
  ].join(','));
}

const csvPath = path.join(outputDir, `${year}-portrait-mapping.csv`);
fs.writeFileSync(csvPath, csvLines.join('\n'));
console.log(`CSV saved to: ${csvPath}`);
