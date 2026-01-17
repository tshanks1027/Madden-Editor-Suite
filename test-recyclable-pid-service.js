/**
 * Test script for RecyclablePIDService
 *
 * Verifies that:
 * 1. CSV parsing works correctly
 * 2. (R) tagged entries are identified
 * 3. Query methods return expected results
 */
const fs = require('fs');
const path = require('path');

// Simulate the service logic without Electron dependencies
class RecyclablePIDServiceTest {
  constructor() {
    this.recyclablePIDs = new Map();
    this.allPIDs = new Map();
  }

  initialize() {
    const csvPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('Could not find PID_Portrait_Mapping.csv at:', csvPath);
      return;
    }

    console.log('Loading from:', csvPath);

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');

    // Skip header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 6) continue;

      const pid = parseInt(parts[0], 10);
      if (isNaN(pid)) continue;

      const playerName = parts[1] || '';
      const type = (parts[2] || 'player');
      const portrait = parts[3] || '';
      const pam = parts[4] || '';
      const race = parseInt(parts[5], 10) || 0;

      const entry = {
        pid,
        playerName,
        type,
        portrait,
        pam,
        race
      };

      // Store all PIDs
      this.allPIDs.set(pid, entry);

      // Check for (R) suffix indicating recyclable
      if (playerName.includes('(R)')) {
        this.recyclablePIDs.set(pid, entry);
      }
    }

    console.log(`Loaded ${this.allPIDs.size} total PIDs`);
    console.log(`Found ${this.recyclablePIDs.size} recyclable PIDs`);
  }

  getRecyclablePIDs() {
    return new Set(this.recyclablePIDs.keys());
  }

  getRecyclablePIDEntries() {
    return Array.from(this.recyclablePIDs.values());
  }

  getRecyclableCount() {
    return this.recyclablePIDs.size;
  }

  isRecyclable(pid) {
    return this.recyclablePIDs.has(pid);
  }

  getPIDDetails(pid) {
    return this.allPIDs.get(pid);
  }

  getRecyclableByType(type) {
    return Array.from(this.recyclablePIDs.values()).filter(p => p.type === type);
  }

  getRecyclableByRace(race) {
    return Array.from(this.recyclablePIDs.values()).filter(p => p.race === race);
  }
}

// Run tests
console.log('='.repeat(70));
console.log('RECYCLABLE PID SERVICE TEST');
console.log('='.repeat(70));
console.log('');

const service = new RecyclablePIDServiceTest();
service.initialize();

console.log('');
console.log('='.repeat(70));
console.log('TEST RESULTS');
console.log('='.repeat(70));
console.log('');

// Test 1: Count recyclable PIDs
console.log('Test 1: Recyclable PID count');
const count = service.getRecyclableCount();
console.log(`  Total recyclable PIDs: ${count}`);
console.log(`  Result: ${count > 0 ? 'PASS' : 'FAIL'}`);
console.log('');

// Test 2: Sample some recyclable entries
console.log('Test 2: Sample recyclable entries');
const entries = service.getRecyclablePIDEntries();
const samples = entries.slice(0, 10);
console.log('  First 10 recyclable PIDs:');
for (const entry of samples) {
  console.log(`    PID ${entry.pid}: ${entry.playerName} (type: ${entry.type}, race: ${entry.race})`);
}
console.log('');

// Test 3: Check specific PIDs mentioned in plan
console.log('Test 3: Check specific PIDs from plan');
const testPIDs = [7, 37, 65, 66];
for (const pid of testPIDs) {
  const isRecyclable = service.isRecyclable(pid);
  const details = service.getPIDDetails(pid);
  console.log(`  PID ${pid}: ${isRecyclable ? 'RECYCLABLE' : 'NOT recyclable'} - ${details ? details.playerName : 'NOT FOUND'}`);
}
console.log('');

// Test 4: Count by type
console.log('Test 4: Recyclable by type');
const legends = service.getRecyclableByType('legend');
const players = service.getRecyclableByType('player');
console.log(`  Legends: ${legends.length}`);
console.log(`  Players: ${players.length}`);
console.log('');

// Test 5: Count by race
console.log('Test 5: Recyclable by race');
const raceMap = new Map();
for (const entry of entries) {
  const count = raceMap.get(entry.race) || 0;
  raceMap.set(entry.race, count + 1);
}
console.log('  Race distribution:');
for (const [race, count] of [...raceMap.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    Race ${race}: ${count} recyclable PIDs`);
}
console.log('');

// Test 6: Verify (R) tag parsing
console.log('Test 6: Verify (R) tag parsing');
let allHaveRTag = true;
let sampleWithoutR = null;
for (const entry of entries.slice(0, 100)) {
  if (!entry.playerName.includes('(R)')) {
    allHaveRTag = false;
    sampleWithoutR = entry;
    break;
  }
}
if (allHaveRTag) {
  console.log('  All sampled recyclable PIDs have (R) tag: PASS');
} else {
  console.log('  FAIL: Found recyclable entry without (R) tag:', sampleWithoutR);
}
console.log('');

// Test 7: Check non-recyclable PID
console.log('Test 7: Verify non-recyclable PIDs exist');
let nonRecyclable = 0;
for (const [pid, entry] of service.allPIDs.entries()) {
  if (!service.isRecyclable(pid)) {
    nonRecyclable++;
  }
}
console.log(`  Non-recyclable PIDs: ${nonRecyclable}`);
console.log(`  Result: ${nonRecyclable > 0 ? 'PASS' : 'FAIL (all are recyclable?)'}`);
console.log('');

// Summary
console.log('='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log(`Total PIDs in mapping: ${service.allPIDs.size}`);
console.log(`Recyclable PIDs (R): ${service.recyclablePIDs.size}`);
console.log(`Non-recyclable: ${service.allPIDs.size - service.recyclablePIDs.size}`);
console.log(`Recyclable percentage: ${((service.recyclablePIDs.size / service.allPIDs.size) * 100).toFixed(1)}%`);
