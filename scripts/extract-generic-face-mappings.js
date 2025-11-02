/**
 * Extract PID → Generic Face mappings from a Madden roster file
 *
 * Usage: node scripts/extract-generic-face-mappings.js <roster-file-path>
 */

const fs = require('fs');
const path = require('path');

// Import the roster parser
const { parseRosterFile } = require('../src/main/parsers/RosterParser');

async function extractGenericFaceMappings(rosterPath) {
  console.log(`Parsing roster file: ${rosterPath}`);

  try {
    // Parse the roster file
    const rosterData = await parseRosterFile(rosterPath);
    const players = rosterData.players;

    console.log(`Found ${players.length} players in roster`);

    // Log sample player fields to understand the structure
    if (players.length > 0) {
      const sampleFields = Object.keys(players[0]).slice(0, 30);
      console.log('\nSample player fields:', sampleFields.join(', '));
      console.log('\nChecking for face-related fields in first player:');
      console.log('  PSXP (PID):', players[0].PSXP);
      console.log('  PEPS:', players[0].PEPS);
      console.log('  PAMA:', players[0].PAMA);
      console.log('  PAM:', players[0].PAM);
    }

    // Extract PID and face mappings
    const mappings = [];
    const genericFaceCounts = new Map();
    const allFaceFormats = new Set();

    for (const player of players) {
      const pid = player.PSXP || player.PID || 0;
      // Check PEPS field (player equipment/appearance)
      const peps = player.PEPS || '';
      const pama = player.PAMA || player.PAM || '';
      const firstName = player.PFNA || player.firstName || '';
      const lastName = player.PLNA || player.lastName || '';

      // Track all face formats encountered (first 100 chars)
      if (peps) allFaceFormats.add(peps.substring(0, 100));
      if (pama) allFaceFormats.add(pama.substring(0, 100));

      // Use whichever field has data
      const faceData = peps || pama;

      // Process ALL players with PIDs >= 3300 (generic PID range)
      // OR players with explicit generic indicators in face data
      const isGenericPID = pid >= 3300;
      const hasGenericFaceData = faceData && (faceData.includes('gen_') || faceData.includes('generic'));

      if (pid && faceData && (isGenericPID || hasGenericFaceData)) {
        // Convert face code to PLPO format for the atlas
        let plpoName = '';

        if (faceData.startsWith('gen_')) {
          // Format: gen_5_M_M_005 or similar
          const parts = faceData.split('_');
          if (parts.length >= 5) {
            const ethnicity = parts[1];
            const faceNum = parts[4];
            plpoName = `plpo_generic_${ethnicity}_${faceNum}`;
          } else if (parts.length >= 3) {
            // Simpler format
            plpoName = `plpo_${faceData}`;
          }
        } else if (faceData.startsWith('generic_')) {
          // Already in generic format, just add plpo_ prefix
          plpoName = `plpo_${faceData}`;
        } else if (faceData.includes('generic')) {
          plpoName = faceData.startsWith('plpo_') ? faceData : `plpo_${faceData}`;
        } else if (isGenericPID) {
          // Generic PID but face data doesn't contain "generic"
          // Keep the raw face data as-is (might be a PLPO name already)
          plpoName = faceData;
        }

        if (plpoName) {
          mappings.push({
            pid: pid,
            name: `${firstName} ${lastName}`.trim() || 'Generic Face',
            faceData: faceData,
            plpo: plpoName
          });

          // Track generic face usage
          const count = genericFaceCounts.get(plpoName) || 0;
          genericFaceCounts.set(plpoName, count + 1);
        }
      }
    }

    // Show sample of face formats found
    console.log('\n=== SAMPLE FACE FORMATS FOUND ===');
    const sampleFormats = Array.from(allFaceFormats).slice(0, 20);
    sampleFormats.forEach(format => console.log(format));

    console.log(`\nExtracted ${mappings.length} generic face mappings`);
    console.log(`Unique generic faces used: ${genericFaceCounts.size}`);

    // Sort by PID
    mappings.sort((a, b) => a.pid - b.pid);

    // Output as CSV format for PID_Portrait_Mapping.csv
    console.log('\n=== CSV FORMAT OUTPUT ===\n');
    for (const mapping of mappings) {
      console.log(`${mapping.pid},${mapping.name || 'Generic Face'},generic,${mapping.plpo}`);
    }

    // Save to file
    const outputPath = path.join(__dirname, '..', 'data', 'extracted-generic-mappings.csv');
    const csvContent = 'PID,Player Name,Type,Portrait\n' +
      mappings.map(m => `${m.pid},${m.name || 'Generic Face'},generic,${m.plpo}`).join('\n');

    fs.writeFileSync(outputPath, csvContent, 'utf8');
    console.log(`\nSaved mappings to: ${outputPath}`);

    // Show some statistics
    console.log('\n=== STATISTICS ===');
    console.log(`Total players in roster: ${players.length}`);
    console.log(`Players with generic faces: ${mappings.length}`);
    console.log(`PID range: ${mappings[0]?.pid} - ${mappings[mappings.length - 1]?.pid}`);

    // Show face usage distribution
    console.log('\n=== MOST USED GENERIC FACES ===');
    const sortedFaces = Array.from(genericFaceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [face, count] of sortedFaces) {
      console.log(`${face}: ${count} players`);
    }

    return mappings;

  } catch (error) {
    console.error('Error parsing roster file:', error);
    throw error;
  }
}

// Main execution
const rosterPath = process.argv[2] || 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENTEST';

if (!fs.existsSync(rosterPath)) {
  console.error(`Roster file not found: ${rosterPath}`);
  process.exit(1);
}

extractGenericFaceMappings(rosterPath)
  .then(() => {
    console.log('\n✓ Extraction complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Extraction failed:', error);
    process.exit(1);
  });
