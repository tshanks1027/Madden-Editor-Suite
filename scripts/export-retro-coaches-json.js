/**
 * Export Retro Coaches to JSON (Full Career with Positions)
 *
 * Reads all retro coach JSON files (1966-2024) and creates a consolidated
 * JSON file with all coaches and their year-by-year data INCLUDING:
 * - HC years with stats
 * - OC/DC years (no stats, just team assignment)
 *
 * Filters:
 * - No split coaches (names with / or multiple names)
 * - Excludes coaches already in CoachPAM_lookup.csv (in-game coaches)
 */

const fs = require('fs');
const path = require('path');

const RETRO_COACHES_DIR = path.join(__dirname, '..', 'data', 'retro', 'coaches');
const COACH_LOOKUP_FILE = path.join(__dirname, '..', 'data', 'lookups', 'CoachPAM_lookup.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'lookups', 'retro-coaches-database.json');

// Load in-game coaches to exclude them
const inGameCoaches = new Set();
const coachLookupContent = fs.readFileSync(COACH_LOOKUP_FILE, 'utf8');
const lookupLines = coachLookupContent.split('\n').slice(1); // Skip header

for (const line of lookupLines) {
  if (!line.trim()) continue;
  const parts = line.split(',');
  const lastName = (parts[0] || '').trim().toLowerCase();
  const firstName = (parts[1] || '').trim().toLowerCase();
  if (lastName) {
    inGameCoaches.add(`${lastName}_${firstName}`);
  }
}

console.log(`Loaded ${inGameCoaches.size} in-game coaches to exclude`);

// Check if a coach name looks like a split coach
function isSplitCoach(firstName, lastName) {
  const fullName = `${firstName} ${lastName}`;
  if (fullName.includes('/')) return true;
  if (fullName.includes(' and ')) return true;
  if (fullName.includes('&')) return true;
  if (lastName.split(' ').length > 1 && !lastName.includes('-')) return true;
  return false;
}

// Check if coach is in-game
function isInGameCoach(firstName, lastName) {
  const key = `${lastName.toLowerCase()}_${firstName.toLowerCase()}`;
  return inGameCoaches.has(key);
}

// Read all retro coach files
const files = fs.readdirSync(RETRO_COACHES_DIR)
  .filter(f => f.endsWith('.json'))
  .sort((a, b) => parseInt(a) - parseInt(b));

console.log(`Found ${files.length} retro coach files`);

// Build coach database - ALL positions (HC, OC, DC)
const coaches = new Map(); // key -> { coach data, seasons: [] }
let skippedSplit = 0;
let skippedInGame = 0;

function processCoach(coachData, year, teamAbbr, teamIndex, position) {
  if (!coachData || !coachData.lastName) return false;

  const firstName = coachData.firstName || '';
  const lastName = coachData.lastName;

  // Skip split coaches
  if (isSplitCoach(firstName, lastName)) {
    skippedSplit++;
    return false;
  }

  // Skip in-game coaches
  if (isInGameCoach(firstName, lastName)) {
    skippedInGame++;
    return false;
  }

  const key = `${lastName}_${firstName}`.toLowerCase();

  if (!coaches.has(key)) {
    coaches.set(key, {
      firstName: firstName,
      lastName: lastName,
      seasons: []
    });
  }

  // Add season record
  const seasonData = {
    year,
    team: teamAbbr,
    teamIndex,
    position
  };

  // Only add stats for HC positions
  if (position === 'HC') {
    seasonData.careerWins = coachData.careerWins || 0;
    seasonData.careerLosses = coachData.careerLosses || 0;
    seasonData.careerTies = coachData.careerTies || 0;
    seasonData.playoffWins = coachData.playoffWins || 0;
    seasonData.playoffLosses = coachData.playoffLosses || 0;
    seasonData.superBowlWins = coachData.superBowlWins || 0;
    seasonData.yearsAsHC = coachData.yearsAsHC || 0;
    seasonData.yearsWithTeam = coachData.yearsWithTeam || 0;
  }

  coaches.get(key).seasons.push(seasonData);
  return true;
}

for (const file of files) {
  const year = parseInt(file.replace('.json', ''));
  const filePath = path.join(RETRO_COACHES_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const team of data.teams || []) {
    const teamAbbr = team.teamAbbr;
    const teamIndex = team.teamIndex;

    // Process all coach positions
    processCoach(team.headCoach, year, teamAbbr, teamIndex, 'HC');
    processCoach(team.offensiveCoordinator, year, teamAbbr, teamIndex, 'OC');
    processCoach(team.defensiveCoordinator, year, teamAbbr, teamIndex, 'DC');
  }
}

console.log(`Skipped: ${skippedSplit} split coaches, ${skippedInGame} in-game coaches`);
console.log(`Processed ${coaches.size} unique retro coaches`);

// Convert to array and add computed fields
const coachArray = [];
let totalSeasons = 0;
let hcSeasonCount = 0;
let coordSeasonCount = 0;

for (const [key, coachData] of coaches) {
  // Sort seasons by year
  coachData.seasons.sort((a, b) => a.year - b.year);

  // Get career span
  const years = coachData.seasons.map(s => s.year);
  const careerFrom = Math.min(...years);
  const careerTo = Math.max(...years);

  // Get positions held
  const positions = [...new Set(coachData.seasons.map(s => s.position))];

  // Get final career stats (from most recent HC season)
  const hcSeasons = coachData.seasons.filter(s => s.position === 'HC');
  const finalStats = hcSeasons.length > 0
    ? hcSeasons[hcSeasons.length - 1]
    : { careerWins: 0, careerLosses: 0, careerTies: 0, playoffWins: 0, playoffLosses: 0, superBowlWins: 0 };

  coachArray.push({
    firstName: coachData.firstName,
    lastName: coachData.lastName,
    careerFrom,
    careerTo,
    positions,
    careerWins: finalStats.careerWins || 0,
    careerLosses: finalStats.careerLosses || 0,
    careerTies: finalStats.careerTies || 0,
    playoffWins: finalStats.playoffWins || 0,
    playoffLosses: finalStats.playoffLosses || 0,
    superBowlWins: finalStats.superBowlWins || 0,
    seasons: coachData.seasons
  });

  totalSeasons += coachData.seasons.length;
  hcSeasonCount += hcSeasons.length;
  coordSeasonCount += coachData.seasons.filter(s => s.position !== 'HC').length;
}

// Sort by last name
coachArray.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

// Write output
const output = {
  generated: new Date().toISOString(),
  totalCoaches: coachArray.length,
  totalSeasons: totalSeasons,
  hcSeasons: hcSeasonCount,
  coordSeasons: coordSeasonCount,
  yearRange: { from: 1966, to: 2024 },
  note: 'Includes all positions (HC/OC/DC). Only HC positions have stats.',
  coaches: coachArray
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

console.log(`\nExport complete!`);
console.log(`  Coaches: ${coachArray.length}`);
console.log(`  Total seasons: ${totalSeasons}`);
console.log(`  HC seasons: ${hcSeasonCount}`);
console.log(`  OC/DC seasons: ${coordSeasonCount}`);
console.log(`  Output: ${OUTPUT_FILE}`);

// Show sample with multiple positions
console.log('\nSample coaches with multiple positions:');
const multiPos = coachArray.filter(c => c.positions.length > 1).slice(0, 5);
for (const coach of multiPos) {
  console.log(`  ${coach.firstName} ${coach.lastName}: ${coach.careerFrom}-${coach.careerTo}, positions: ${coach.positions.join('/')}, ${coach.seasons.length} seasons`);
}
