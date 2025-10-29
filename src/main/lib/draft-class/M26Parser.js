/**
 * M26 Draft Class Parser
 *
 * Madden 26 uses a different structure from M25:
 * - 4296-byte blocks (not 4322)
 * - Variable-length JSON visual data
 * - Prospects span 1-4 blocks depending on visual data size
 * - No fixed prospect size - must scan for next prospect
 */

const FileParser = require('./FileParser');
const fs = require('fs');
const path = require('path');

const BLOCK_SIZE = 4296;
const ATTRIBUTE_DATA_SIZE = 226; // 0xE2 bytes - same as M25
const JSON_START_MARKER = Buffer.from('{"bodyType"');

/**
 * Parse M26 draft class file
 * @param {Buffer} buffer - File buffer
 * @param {Object} header - Parsed header info
 * @returns {Array} Array of prospect objects
 */
function parseM26Prospects(buffer, header) {
  const prospects = [];

  console.log(`[M26Parser] Starting parse at offset 0x${header.dataStartOffset.toString(16)}`);
  console.log(`[M26Parser] File size: ${buffer.length} bytes`);

  // M26 Structure: Each prospect occupies exactly ONE 4296-byte block
  // Attributes are ALWAYS at block_start + 0x1000 (4096 bytes)
  // Prospects WITH visual data: JSON at block_start, attributes at block_start + 0x1000
  // Prospects WITHOUT visual data: Empty/null at block_start, attributes at block_start + 0x1000

  const totalProspects = 402; // Fixed capacity in M26 files

  for (let prospectNum = 0; prospectNum < totalProspects; prospectNum++) {
    const blockStart = header.dataStartOffset + (prospectNum * BLOCK_SIZE);
    const attributeOffset = blockStart + 0x1000; // 4096 bytes

    // Check if we're past end of file
    if (attributeOffset + ATTRIBUTE_DATA_SIZE > buffer.length) {
      console.log(`[M26Parser] Reached end of file at prospect ${prospectNum + 1}`);
      break;
    }

    // Try to parse visual JSON (if present)
    // Search for ANY JSON block starting with { (not just {"bodyType")
    // Some prospects start with {"genericHeadName" instead
    let visuals = null;
    let jsonStartIndex = blockStart;
    while (jsonStartIndex < blockStart + 0x1000 && buffer[jsonStartIndex] !== 123) {
      jsonStartIndex++;
    }
    if (jsonStartIndex >= blockStart + 0x1000 || buffer[jsonStartIndex] !== 123) {
      jsonStartIndex = -1;
    }

    if (jsonStartIndex !== -1 && jsonStartIndex < blockStart + 0x1000) {
      // This prospect has visual data
      let braceCount = 0;
      let jsonEnd = -1;

      for (let i = jsonStartIndex; i < buffer.length; i++) {
        const char = String.fromCharCode(buffer[i]);
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonEnd !== -1) {
        const jsonString = buffer.toString('utf8', jsonStartIndex, jsonEnd);
        try {
          visuals = JSON.parse(jsonString);
          // Debug logging for first 10 prospects to see what fields exist
          if (prospectNum < 10) {
            console.log(`\n[M26Parser] === Prospect #${prospectNum + 1} Visuals ===`);
            console.log('All keys:', Object.keys(visuals));
            console.log('assetName:', visuals.assetName);
            console.log('genericHeadName:', visuals.genericHeadName);
            console.log('bodyType:', visuals.bodyType);
            console.log('Full JSON:', JSON.stringify(visuals, null, 2));
          }
        } catch (e) {
          console.warn(`[M26Parser] Failed to parse visual JSON for prospect ${prospectNum + 1}`);
        }
      }
    }

    // Parse attribute data (ALWAYS at +0x1000 offset)
    const attributeData = buffer.subarray(attributeOffset, attributeOffset + ATTRIBUTE_DATA_SIZE);
    const attributes = parseM26AttributeData(attributeData);

    // DEBUG: For first 3 prospects, dump the entire block to find assetName location
    if (false && prospectNum < 3) {
      const fs = require('fs');
      const path = require('path');
      const logFile = path.join(process.cwd(), `M26_prospect_${prospectNum + 1}_dump.txt`);

      let dumpText = `\n=== PROSPECT #${prospectNum + 1} FULL BLOCK DUMP ===\n`;
      dumpText += `Name: ${attributes.firstName} ${attributes.lastName}\n`;
      dumpText += `PID: ${attributes.PID}\n`;
      dumpText += `Block offset: 0x${blockStart.toString(16)}\n\n`;

      // Dump the entire 4296-byte block as hex + ASCII
      for (let offset = 0; offset < BLOCK_SIZE; offset += 16) {
        const chunk = buffer.subarray(blockStart + offset, Math.min(blockStart + offset + 16, blockStart + BLOCK_SIZE));
        const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
        const ascii = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
        dumpText += `0x${offset.toString(16).padStart(4, '0')}: ${hex.padEnd(48)} | ${ascii}\n`;
      }

      fs.writeFileSync(logFile, dumpText);
      console.log(`[M26Parser] Wrote full block dump for prospect #${prospectNum + 1} to ${logFile}`);
    }

    // Populate PEPS - prioritize assetName (player-specific) over genericHeadName (generic)
    if (visuals) {
      // assetName = player-specific face (e.g., "AdomitisCal_22250")
      // genericHeadName = generic face (e.g., "p_gen_head_white_1")
      if (visuals.assetName) {
        attributes.PEPS = visuals.assetName;
        // Debug log for first 5 prospects with assetName
        if (prospectNum < 5) {
          console.log(`[M26Parser] Prospect #${prospectNum + 1} - Using assetName: ${visuals.assetName}`);
        }
      } else if (visuals.genericHeadName) {
        attributes.PEPS = visuals.genericHeadName;
        if (prospectNum < 5) {
          console.log(`[M26Parser] Prospect #${prospectNum + 1} - Using genericHeadName: ${visuals.genericHeadName}`);
        }
      }
    }

    // Combine visual and attribute data
    const prospect = {
      ...attributes,
      visuals,
      draftPosition: prospectNum, // Track position in file for reordering (0-indexed)
      index: prospectNum // Backward compatibility
    };

    prospects.push(prospect);

    if ((prospectNum + 1) % 100 === 0) {
      console.log(`[M26Parser] Parsed ${prospectNum + 1} prospects...`);
    }
  }

  console.log(`[M26Parser] Completed: ${prospects.length} prospects parsed`);
  return prospects;
}

/**
 * Parse M26 attribute data (DIFFERENT structure from M25!)
 * M26 stores attributes BEFORE JSON in each 4296-byte block
 *
 * @param {Buffer} attributeData - Attribute buffer (starts at block + 0x1000)
 * @returns {Object} Prospect attributes
 */
function parseM26AttributeData(attributeData) {
  const attributes = {};

  try {
    // String fields (NO assetName field in M26!)
    const firstName = attributeData.toString('ascii', 0, 0x11).replace(/\0/g, '').trim();
    const lastName = attributeData.toString('ascii', 0x11, 0x26).replace(/\0/g, '').trim();
    // HomeTown field contains state code + "PLACEHOLDER" text
    // Skip homeTown parsing for now since it's placeholder data
    const homeTown = '';  // M26 files have placeholder hometown data

    attributes.firstName = firstName;
    attributes.lastName = lastName;
    attributes.homeTown = homeTown;

    // M26-specific field locations (reverse-engineered through systematic analysis)
    attributes.homeState = attributeData[0x26] || 0;  // Confirmed ✓ (byte before PLACEHOLDER)
    attributes.college = attributeData[0x42] || 0;  // Confirmed ✓ (single byte, not uint16!)
    attributes.age = attributeData[0x46];  // Confirmed ✓
    attributes.heightInches = attributeData[0x47];  // Confirmed ✓
    attributes.weight = attributeData[0x48] + 160;  // Confirmed ✓ (stored as weight-160)
    attributes.position = attributeData[0x4a];  // Confirmed ✓

    // Fields still being mapped:
    attributes.archetype = attributeData[0x4b] || 0;  // Likely archetype
    attributes.jerseyNum = attributeData[0x4c] || 0;  // Likely jersey or year
    attributes.draftable = 1;  // Assumed draftable
    attributes.draftPick = attributeData[0x4e] || 0;  // Likely pick number
    attributes.draftRound = 0;  // Not yet found
    attributes.devTrait = attributeData[0x8c] || 0;  // Confirmed ✓ (0=Normal, 1=Star, 2=Superstar, 3=X-Factor)

    // PID (Player ID) - stored at 0x92 as uint16LE
    attributes.PID = attributeData.readUInt16LE(0x92) || 0;  // Confirmed ✓

    // PEPS (Player Equipment Preset System) - stored in visuals JSON as genericHeadName
    attributes.PEPS = null;  // Will be populated from visuals.genericHeadName by frontend

    // M26 Attribute Mapping (reverse-engineered from binary analysis)
    // Ratings are NOT sequential - M26 uses a different byte order than M25
    // Mapped using Garrett Nussmeier & Fernando Mendoza as reference players

    // Core Physical Attributes
    attributes.speed = attributeData[0x7B] || 0;
    attributes.acceleration = attributeData[0x52] || 0;
    attributes.agility = attributeData[0x53] || 0;
    attributes.strength = attributeData[0x7F] || 0;
    attributes.awareness = attributeData[0x54] || 0;
    attributes.jumping = attributeData[0x62] || 0;
    attributes.stamina = attributeData[0x7D] || 0;
    attributes.changeOfDirection = attributeData[0x5C] || 0;
    attributes.toughness = attributeData[0x88] || 0;

    // Ball Carrier Attributes
    attributes.carrying = attributeData[0x59] || 0;
    attributes.ballCarrierVision = attributeData[0x55] || 0;
    attributes.breakTackle = attributeData[0x58] || 0;
    attributes.trucking = attributeData[0x89] || 0;
    attributes.stiffArm = attributeData[0x7E] || 0;
    attributes.spinMove = attributeData[0x7C] || 0;
    attributes.jukeMove = attributeData[0x61] || 0;

    // Receiving Attributes
    attributes.catching = attributeData[0x5A] || 0;
    attributes.catchInTraffic = attributeData[0x5B] || 0;
    attributes.spectacularCatch = attributeData[0x7A] || 0;
    attributes.shortRouteRunning = attributeData[0x75] || 0;
    attributes.mediumRouteRunning = attributeData[0x74] || 0;
    attributes.deepRouteRunning = attributeData[0x73] || 0;
    attributes.release = attributeData[0x72] || 0;

    // Throwing Attributes (QB)
    attributes.throwPower = attributeData[0x86] || 0; // CORRECT: Game reads throwPower from 0x86
    attributes.throwAccuracyShort = attributeData[0x84] || 0;
    attributes.throwAccuracyMid = attributeData[0x82] || 0;
    attributes.throwAccuracyDeep = attributeData[0x81] || 0;
    attributes.throwOnTheRun = attributeData[0x85] || 0;
    attributes.throwUnderPressure = attributeData[0x87] || 0;
    attributes.playAction = attributeData[0x6D] || 0;
    attributes.breakSack = attributeData[0x57] || 0;

    // Blocking Attributes
    attributes.passBlock = attributeData[0x6B] || 0;
    attributes.passBlockPower = attributeData[0x69] || 0;
    attributes.passBlockFinesse = attributeData[0x6A] || 0;
    attributes.runBlock = attributeData[0x78] || 0;
    attributes.runBlockPower = attributeData[0x77] || 0;
    attributes.runBlockFinesse = attributeData[0x76] || 0;
    attributes.leadBlock = attributeData[0x66] || 0;
    attributes.impactBlocking = attributeData[0x5F] || 0;
    attributes.injury = attributeData[0x60]; // CORRECT: Game reads injury from 0x60

    // Defensive Attributes
    attributes.tackle = attributeData[0x80] || 0;
    attributes.hitPower = attributeData[0x5E] || 0;
    attributes.powerMoves = attributeData[0x6F] || 0;
    attributes.finesseMoves = attributeData[0x5D] || 0;
    attributes.blockShedding = attributeData[0x56] || 0;
    attributes.pursuit = attributeData[0x71] || 0;
    attributes.playRecognition = attributeData[0x6E] || 0;
    attributes.manCoverage = attributeData[0x68] || 0;
    attributes.zoneCoverage = attributeData[0x8A] || 0;
    attributes.pressCoverage = attributeData[0x70] || 0;

    // Special Teams
    attributes.kickPower = attributeData[0x64] || 0;
    attributes.kickAccuracy = attributeData[0x63] || 0;
    attributes.kickReturn = attributeData[0x65] || 0;
    attributes.longSnap = attributeData[0x50] || 0; // CORRECT: Long snap at 0x50

    // Calculate overall from speed (placeholder - should be calculated properly)
    attributes.overall = attributes.speed || 0;

  } catch (error) {
    console.error('[M26Parser] Error parsing attribute data:', error.message);
  }

  return attributes;
}

module.exports = {
  parseM26Prospects,
  parseM26AttributeData
};
