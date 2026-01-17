/**
 * Test PortraitAssignmentService for year 1995
 */
const fs = require('fs');
const path = require('path');

// Simulate RecyclablePIDService
class RecyclablePIDServiceTest {
  constructor() {
    this.recyclablePIDs = new Map();
    this.allPIDs = new Map();
  }

  initialize() {
    const csvPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

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

      const entry = { pid, playerName, type, portrait, pam, race };
      this.allPIDs.set(pid, entry);

      if (playerName.includes('(R)')) {
        this.recyclablePIDs.set(pid, entry);
      }
    }
  }

  isRecyclable(pid) {
    return this.recyclablePIDs.has(pid);
  }

  getRecyclableCount() {
    return this.recyclablePIDs.size;
  }

  allocateRecyclablePID(preferredRace, usedPIDs) {
    const available = Array.from(this.recyclablePIDs.values())
      .filter(p => !usedPIDs || !usedPIDs.has(p.pid));

    if (available.length === 0) return undefined;

    if (preferredRace !== undefined) {
      const raceMatched = available.find(p => p.race === preferredRace);
      if (raceMatched) return raceMatched;
    }
    return available[0];
  }
}

// Simulate PortraitAssignmentService
class PortraitAssignmentServiceTest {
  constructor(recyclableService) {
    this.recyclableService = recyclableService;
    this.allPlayers = [];
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  initialize() {
    const csvPath = path.join(__dirname, 'data/lookups/ALL_PLAYER_LOOKUP.csv');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
      if (parts.length < 22) continue;

      const lastName = parts[0] || '';
      const firstName = parts[1] || '';
      const college = parts[2] || '';
      const position = parts[6] || '';
      const pidStr = parts[8];
      const pam = parts[9] || '';
      const plpo = parts[11] || '';
      const fromStr = parts[14];
      const toStr = parts[15];
      const raceStr = parts[21];

      const pid = pidStr ? parseInt(pidStr, 10) : null;
      const fromYear = parseInt(fromStr, 10) || 0;
      const toYear = parseInt(toStr, 10) || fromYear;
      const race = parseInt(raceStr, 10) || 0;

      if (fromYear === 0) continue;

      this.allPlayers.push({
        lastName,
        firstName,
        college,
        position,
        pid: isNaN(pid) ? null : pid,
        pam,
        race,
        fromYear,
        toYear,
        plpo
      });
    }
  }

  getPlayersForYear(year) {
    return this.allPlayers.filter(p => p.fromYear <= year && p.toYear >= year);
  }

  assignPortraits(year) {
    const assignments = [];
    const usedPIDs = new Set();
    const players = this.getPlayersForYear(year);

    // First: Assign real portraits
    for (const player of players) {
      if (player.pid !== null && !this.recyclableService.isRecyclable(player.pid)) {
        assignments.push({
          player,
          assignedPID: player.pid,
          assignmentType: 'real'
        });
        usedPIDs.add(player.pid);
      }
    }

    // Second: Assign recyclable PIDs
    const needsGeneric = players.filter(p =>
      p.pid === null || this.recyclableService.isRecyclable(p.pid)
    );

    for (const player of needsGeneric) {
      const recyclable = this.recyclableService.allocateRecyclablePID(player.race, usedPIDs);
      if (recyclable) {
        assignments.push({
          player,
          assignedPID: recyclable.pid,
          assignmentType: 'recyclable',
          recycledFrom: recyclable.playerName
        });
        usedPIDs.add(recyclable.pid);
      }
    }

    return assignments;
  }
}

// Run test
console.log('='.repeat(70));
console.log('PORTRAIT ASSIGNMENT TEST FOR 1995');
console.log('='.repeat(70));
console.log('');

// Initialize services
const recyclableService = new RecyclablePIDServiceTest();
recyclableService.initialize();
console.log(`Recyclable PIDs available: ${recyclableService.getRecyclableCount()}`);

const assignmentService = new PortraitAssignmentServiceTest(recyclableService);
assignmentService.initialize();
console.log(`Total players in database: ${assignmentService.allPlayers.length}`);
console.log('');

// Test year 1995
const year = 1995;
const players = assignmentService.getPlayersForYear(year);
console.log(`Players active in ${year}: ${players.length}`);
console.log('');

// Sample players
console.log('Sample players from 1995:');
const samples = players.slice(0, 20);
for (const p of samples) {
  console.log(`  ${p.firstName} ${p.lastName} (${p.position}) - PID: ${p.pid || 'NONE'}, Race: ${p.race}`);
}
console.log('');

// Check for specific 1995 draft class players
const draftClass1995 = players.filter(p => p.fromYear === 1995);
console.log(`1995 Draft Class (rookies): ${draftClass1995.length}`);

// Check for pics we have
const picsDir = 'C:/Users/tshan/Documents/Portraits/Player/1995/Pics';
let pngFiles = [];
if (fs.existsSync(picsDir)) {
  pngFiles = fs.readdirSync(picsDir).filter(f => f.endsWith('.png'));
  console.log(`PNG files in Pics folder: ${pngFiles.length}`);
  console.log('');

  // Try to match PNG names to players
  console.log('Matching PNG files to player data:');
  for (const png of pngFiles) {
    const name = png.replace('.png', '');
    const parts = name.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    // Find matching player
    const match = players.find(p =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastName.toLowerCase() === lastName.toLowerCase()
    );

    if (match) {
      console.log(`  ✓ ${name} -> PID: ${match.pid || 'NONE'}, PLPO: ${match.plpo || 'NONE'}`);
    } else {
      console.log(`  ✗ ${name} -> NO MATCH FOUND`);
    }
  }
}

console.log('');

// Run assignment
console.log('='.repeat(70));
console.log('RUNNING PORTRAIT ASSIGNMENT');
console.log('='.repeat(70));
console.log('');

const assignments = assignmentService.assignPortraits(year);

const realCount = assignments.filter(a => a.assignmentType === 'real').length;
const recyclableCount = assignments.filter(a => a.assignmentType === 'recyclable').length;
const unassigned = players.length - assignments.length;

console.log(`Total assignments: ${assignments.length}`);
console.log(`  Real portraits: ${realCount}`);
console.log(`  Recyclable assigned: ${recyclableCount}`);
console.log(`  Unassigned: ${unassigned}`);
console.log('');

// Show some recyclable assignments
console.log('Sample recyclable assignments:');
const recyclableAssignments = assignments.filter(a => a.assignmentType === 'recyclable').slice(0, 10);
for (const a of recyclableAssignments) {
  console.log(`  ${a.player.firstName} ${a.player.lastName} -> PID ${a.assignedPID} (was: ${a.recycledFrom})`);
}
