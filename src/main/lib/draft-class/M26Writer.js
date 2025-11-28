/**
 * M26 Draft Class Writer
 *
 * Writes prospect data to M26 draft class binary format
 * M26 block structure: 4296 bytes (0x10C8) per prospect
 * - First 4096 bytes (0x1000): Visual JSON data (appearance)
 * - Last 200 bytes (0xC8): Attribute binary data (player stats)
 */

const fs = require('fs');
const path = require('path');

const BLOCK_SIZE = 4296; // 0x10C8 - CORRECT value (was incorrectly 4322)
const ATTRIBUTE_DATA_SIZE = 200; // 0xC8 bytes per attribute section (4296 - 4096 = 200)
const ATTRIBUTE_OFFSET = 0x1000; // 4096 bytes into each block (visual section size)

/**
 * Write M26 draft class file
 * @param {Buffer} originalBuffer - Original file buffer (for preserving structure)
 * @param {Array} prospects - Array of prospect objects with modified data
 * @param {Object} header - File header info
 * @returns {Buffer} Modified file buffer
 */
function writeM26DraftClass(originalBuffer, prospects, header) {
  // Create a copy of the original buffer to preserve all unchanged data
  const modifiedBuffer = Buffer.from(originalBuffer);

  console.log(`[M26Writer] ====================================`);
  console.log(`[M26Writer] Writing ${prospects.length} prospects`);
  console.log(`[M26Writer] dataStartOffset: 0x${header.dataStartOffset.toString(16)}`);
  console.log(`[M26Writer] Buffer size: ${originalBuffer.length} bytes`);

  // IMPORTANT: The game determines draft order by BLOCK POSITION in the file
  // Block 0 = Pick 1, Block 1 = Pick 2, etc.
  // The draftPick field at 0x4e is for "pick within round" (1-32), NOT overall pick
  //
  // DO NOT SORT - write prospects in the exact order they appear in the grid
  // The frontend sends them in grid display order, which IS the draft order
  const sortedProspects = prospects; // Use array as-is, no sorting

  console.log(`[M26Writer] Writing prospects in grid order (block position = draft order)`);
  console.log(`[M26Writer] First 5 prospects to write:`);
  for (let i = 0; i < Math.min(5, sortedProspects.length); i++) {
    console.log(`  Block ${i} (Pick ${i+1}): ${sortedProspects[i].firstName} ${sortedProspects[i].lastName}`);
  }

  // Debug first 5 prospects with full data
  for (let i = 0; i < Math.min(5, sortedProspects.length); i++) {
    console.log(`[M26Writer] Prospect #${i + 1} received:`);
    console.log(`  firstName: ${sortedProspects[i].firstName}`);
    console.log(`  lastName: ${sortedProspects[i].lastName}`);
    console.log(`  position: ${sortedProspects[i].position}`);
    console.log(`  speed: ${sortedProspects[i].speed}`);
    console.log(`  throwPower: ${sortedProspects[i].throwPower}`);
    console.log(`  awareness: ${sortedProspects[i].awareness}`);
    console.log(`  PEPS: ${sortedProspects[i].PEPS}`);
    console.log(`  bodyType: ${sortedProspects[i].bodyType}`);
    console.log(`  college: ${sortedProspects[i].college}`);
    console.log(`  age: ${sortedProspects[i].age}`);
    console.log(`  heightInches: ${sortedProspects[i].heightInches}`);
    console.log(`  weight: ${sortedProspects[i].weight}`);
  }

  let prospectsWritten = 0;
  let prospectsSkipped = 0;
  let prospectsWithoutPEPS = 0;

  for (let i = 0; i < sortedProspects.length; i++) {
    const prospect = sortedProspects[i];
    const blockStart = header.dataStartOffset + (i * BLOCK_SIZE);
    const attributeOffset = blockStart + ATTRIBUTE_OFFSET;

    // Skip if past end of file
    if (attributeOffset + ATTRIBUTE_DATA_SIZE > modifiedBuffer.length) {
      console.warn(`[M26Writer] Skipping prospect ${i + 1} - would exceed file size`);
      console.warn(`[M26Writer]   attributeOffset: ${attributeOffset}, bufferSize: ${modifiedBuffer.length}`);
      prospectsSkipped++;
      break;
    }

    // Write attribute data for this prospect at blockStart + 0x1000
    writeM26AttributeData(modifiedBuffer, attributeOffset, prospect, i);

    // Update visual JSON if PEPS or bodyType were modified
    const hasPEPS = prospect.PEPS !== undefined && prospect.PEPS !== null;
    const hasBodyType = prospect.bodyType !== undefined && prospect.bodyType !== null;

    if (i < 3) {
      console.log(`[M26Writer] Prospect #${i + 1} - hasPEPS: ${hasPEPS}, hasBodyType: ${hasBodyType}`);
    }

    if (hasPEPS || hasBodyType) {
      updateM26VisualJSON(modifiedBuffer, blockStart, prospect);
      prospectsWritten++;
    } else {
      prospectsWithoutPEPS++;
    }
  }

  console.log(`[M26Writer] === WRITE SUMMARY ===`);
  console.log(`[M26Writer] Total prospects received: ${sortedProspects.length}`);
  console.log(`[M26Writer] Prospects with PEPS/bodyType written: ${prospectsWritten}`);
  console.log(`[M26Writer] Prospects without PEPS/bodyType: ${prospectsWithoutPEPS}`);
  console.log(`[M26Writer] Prospects skipped (file size): ${prospectsSkipped}`);

  // VERIFICATION: Read back first 5 prospects to confirm data was written
  console.log(`[M26Writer] VERIFICATION - Reading back first 5 prospects from buffer:`);
  for (let v = 0; v < Math.min(5, sortedProspects.length); v++) {
    const blockVStart = header.dataStartOffset + (v * BLOCK_SIZE);
    const attrVOffset = blockVStart + 0x1000; // Attribute section at block + 0x1000
    const firstNameV = modifiedBuffer.toString('ascii', attrVOffset, attrVOffset + 0x11).replace(/\0/g, '').trim();
    const lastNameV = modifiedBuffer.toString('ascii', attrVOffset + 0x11, attrVOffset + 0x26).replace(/\0/g, '').trim();
    const positionV = modifiedBuffer[attrVOffset + 0x4a];
    const draftPickV = modifiedBuffer[attrVOffset + 0x4e];
    const speedV = modifiedBuffer[attrVOffset + 0x7B];

    console.log(`[M26Writer]   Prospect #${v + 1}: ${firstNameV} ${lastNameV} | pos=${positionV} | draftPick=${draftPickV} | spd=${speedV}`);
    console.log(`[M26Writer]   EXPECTED: ${sortedProspects[v].firstName} ${sortedProspects[v].lastName} | draftPick=${sortedProspects[v].draftPick}`);
  }

  console.log(`[M26Writer] Write complete`);
  return modifiedBuffer;
}

/**
 * Write attribute data for a single prospect
 * @param {Buffer} buffer - File buffer to write to
 * @param {number} offset - Offset where attribute data starts
 * @param {Object} prospect - Prospect data
 * @param {number} prospectIndex - Index of this prospect in the array (0-based)
 */
function writeM26AttributeData(buffer, offset, prospect, prospectIndex) {
  // Debug logging for first 3 prospects - comprehensive attribute dump
  if (prospectIndex < 3) {
    console.log(`\n[M26Writer] === WRITING PROSPECT ${prospectIndex + 1}: ${prospect.firstName} ${prospect.lastName} ===`);
    console.log('[M26Writer] CRITICAL - Overall Rating:');
    console.log(`  overall: ${prospect.overall} <-- THIS IS WHAT GETS WRITTEN TO 0x51`);
    console.log('[M26Writer] All QB-related properties:');
    console.log(`  speed: ${prospect.speed}`);
    console.log(`  acceleration: ${prospect.acceleration}`);
    console.log(`  awareness: ${prospect.awareness}`);
    console.log(`  throwPower: ${prospect.throwPower}`);
    console.log(`  throwAccuracyDeep: ${prospect.throwAccuracyDeep}`);
    console.log(`  throwAccuracyMid: ${prospect.throwAccuracyMid}`);
    console.log(`  throwAccuracyShort: ${prospect.throwAccuracyShort}`);
    console.log(`  throwOnTheRun: ${prospect.throwOnTheRun}`);
    console.log(`  throwUnderPressure: ${prospect.throwUnderPressure}`);
    console.log(`  position: ${prospect.position}`);
    console.log(`  injury: ${prospect.injury}`);
    console.log(`  PEPS: ${prospect.PEPS}`);
    console.log(`  bodyType: ${prospect.bodyType}`);

    // Also log keys to see what properties exist
    const keys = Object.keys(prospect);
    console.log(`[M26Writer] Prospect has ${keys.length} properties`);
    // Log rating-related keys
    const ratingKeys = keys.filter(k =>
      k.includes('throw') || k.includes('speed') || k.includes('acceleration') ||
      k.includes('awareness') || k.includes('PSPD') || k.includes('PTAD') || k.includes('PTHP')
    );
    console.log(`[M26Writer] Rating-related keys: ${ratingKeys.join(', ')}`);
  }

  // String fields (first name and last name)
  if (prospect.firstName) {
    if (typeof prospect.firstName !== 'string') {
      console.error(`[M26Writer] ERROR at prospect index ${prospectIndex}:`);
      console.error(`  firstName is type ${typeof prospect.firstName}, value:`, prospect.firstName);
      console.error(`  Full prospect object:`, prospect);
      throw new Error(`firstName must be a string, got ${typeof prospect.firstName}`);
    }
    const firstName = prospect.firstName.slice(0, 0x11).padEnd(0x11, '\0');
    buffer.write(firstName, offset, 0x11, 'ascii');
  }

  if (prospect.lastName) {
    if (typeof prospect.lastName !== 'string') {
      console.error(`[M26Writer] ERROR at prospect index ${prospectIndex}:`);
      console.error(`  lastName is type ${typeof prospect.lastName}, value:`, prospect.lastName);
      console.error(`  Full prospect object:`, prospect);
      throw new Error(`lastName must be a string, got ${typeof prospect.lastName}`);
    }
    const lastName = prospect.lastName.slice(0, 0x15).padEnd(0x15, '\0');
    buffer.write(lastName, offset + 0x11, 0x15, 'ascii');
  }

  // Basic info fields
  if (prospect.homeState !== undefined) buffer[offset + 0x26] = prospect.homeState;
  if (prospect.college !== undefined) buffer[offset + 0x42] = prospect.college;
  if (prospect.age !== undefined) buffer[offset + 0x46] = prospect.age;
  if (prospect.heightInches !== undefined) buffer[offset + 0x47] = prospect.heightInches;
  if (prospect.weight !== undefined) buffer[offset + 0x48] = Math.max(0, prospect.weight - 160);
  if (prospect.position !== undefined) buffer[offset + 0x4a] = prospect.position;
  if (prospect.archetype !== undefined) buffer[offset + 0x4b] = prospect.archetype;
  if (prospect.jerseyNum !== undefined) buffer[offset + 0x4c] = prospect.jerseyNum;

  // Draft order fields - preserve values from original file
  // M26 structure: 0x4d = draftable flag
  //                0x4e = pick number within round (1-32 for drafted)
  //                0x50 = round number (1-7 for drafted, 63 for UDFA)
  if (prospect.draftable !== undefined) buffer[offset + 0x4d] = prospect.draftable;
  if (prospect.draftPick !== undefined && prospect.draftPick !== null) {
    buffer[offset + 0x4e] = prospect.draftPick;
  }
  if (prospect.draftRound !== undefined && prospect.draftRound !== null) {
    buffer[offset + 0x50] = prospect.draftRound;
  }

  // Also log details for first 10 prospects
  if (prospectIndex < 10) {
    console.log(`[M26Writer] === WRITING PROSPECT ${prospectIndex} ===`);
    console.log(`  Block: ${prospectIndex}, Offset: 0x${offset.toString(16)}`);
    console.log(`  Name: ${prospect.firstName} ${prospect.lastName}`);
    console.log(`  draftPick being written: ${prospect.draftPick}`);
  }

  if (prospect.devTrait !== undefined) buffer[offset + 0x8c] = prospect.devTrait;
  if (prospect.PID !== undefined) buffer.writeUInt16LE(prospect.PID, offset + 0x92);
  // PEPS is stored in visuals JSON, not in binary attributes

  // Write Overall Rating to 0x51
  // The game uses this for display AND calculation verification
  // If prospect.overall is provided, write it; otherwise calculate from ratings
  if (prospect.overall !== undefined && prospect.overall !== null) {
    buffer[offset + 0x51] = Math.max(0, Math.min(99, prospect.overall));
    if (prospectIndex < 3) {
      console.log(`[M26Writer] Writing OVR ${prospect.overall} to offset 0x51`);
    }
  }

  // Write all ratings using the correct M26 byte offsets
  // Core Physical Attributes
  if (prospect.speed !== undefined) buffer[offset + 0x7B] = prospect.speed;
  if (prospect.acceleration !== undefined) buffer[offset + 0x52] = prospect.acceleration;
  if (prospect.agility !== undefined) buffer[offset + 0x53] = prospect.agility;
  if (prospect.strength !== undefined) buffer[offset + 0x7F] = prospect.strength;
  if (prospect.awareness !== undefined) buffer[offset + 0x54] = prospect.awareness;
  if (prospect.jumping !== undefined) buffer[offset + 0x62] = prospect.jumping;
  if (prospect.stamina !== undefined) buffer[offset + 0x7D] = prospect.stamina;
  if (prospect.changeOfDirection !== undefined) buffer[offset + 0x5C] = prospect.changeOfDirection;
  if (prospect.toughness !== undefined) buffer[offset + 0x88] = prospect.toughness;
  if (prospect.injury !== undefined) buffer[offset + 0x60] = prospect.injury; // CORRECT: Game reads injury from 0x60

  // Ball Carrier Attributes
  if (prospect.carrying !== undefined) buffer[offset + 0x59] = prospect.carrying;
  if (prospect.ballCarrierVision !== undefined) buffer[offset + 0x55] = prospect.ballCarrierVision;
  if (prospect.breakTackle !== undefined) buffer[offset + 0x58] = prospect.breakTackle;
  if (prospect.trucking !== undefined) buffer[offset + 0x89] = prospect.trucking;
  if (prospect.stiffArm !== undefined) buffer[offset + 0x7E] = prospect.stiffArm;
  if (prospect.spinMove !== undefined) buffer[offset + 0x7C] = prospect.spinMove;
  if (prospect.jukeMove !== undefined) buffer[offset + 0x61] = prospect.jukeMove;

  // Receiving Attributes
  if (prospect.catching !== undefined) buffer[offset + 0x5A] = prospect.catching;
  if (prospect.catchInTraffic !== undefined) buffer[offset + 0x5B] = prospect.catchInTraffic;
  if (prospect.spectacularCatch !== undefined) buffer[offset + 0x7A] = prospect.spectacularCatch;
  if (prospect.shortRouteRunning !== undefined) buffer[offset + 0x75] = prospect.shortRouteRunning;
  if (prospect.mediumRouteRunning !== undefined) buffer[offset + 0x74] = prospect.mediumRouteRunning;
  if (prospect.deepRouteRunning !== undefined) buffer[offset + 0x73] = prospect.deepRouteRunning;
  if (prospect.release !== undefined) buffer[offset + 0x72] = prospect.release;

  // Throwing Attributes (QB)
  if (prospect.throwPower !== undefined) buffer[offset + 0x86] = prospect.throwPower; // CORRECT: Game reads throwPower from 0x86
  if (prospect.throwAccuracyShort !== undefined) buffer[offset + 0x84] = prospect.throwAccuracyShort;
  if (prospect.throwAccuracyMid !== undefined) buffer[offset + 0x82] = prospect.throwAccuracyMid;  // CONFIRMED: 0x82 is TAM (original file analysis)
  if (prospect.throwAccuracyDeep !== undefined) buffer[offset + 0x81] = prospect.throwAccuracyDeep;
  if (prospect.throwOnTheRun !== undefined) buffer[offset + 0x85] = prospect.throwOnTheRun;
  if (prospect.throwUnderPressure !== undefined) buffer[offset + 0x87] = prospect.throwUnderPressure;
  if (prospect.playAction !== undefined) buffer[offset + 0x6D] = prospect.playAction;
  if (prospect.breakSack !== undefined) buffer[offset + 0x57] = prospect.breakSack;

  // Blocking Attributes
  if (prospect.passBlock !== undefined) buffer[offset + 0x6B] = prospect.passBlock;
  if (prospect.passBlockPower !== undefined) buffer[offset + 0x69] = prospect.passBlockPower;
  if (prospect.passBlockFinesse !== undefined) buffer[offset + 0x6A] = prospect.passBlockFinesse;
  if (prospect.runBlock !== undefined) buffer[offset + 0x78] = prospect.runBlock;
  if (prospect.runBlockPower !== undefined) buffer[offset + 0x77] = prospect.runBlockPower;
  if (prospect.runBlockFinesse !== undefined) buffer[offset + 0x76] = prospect.runBlockFinesse;
  if (prospect.leadBlock !== undefined) buffer[offset + 0x66] = prospect.leadBlock;
  if (prospect.impactBlocking !== undefined) buffer[offset + 0x5F] = prospect.impactBlocking;

  // Defensive Attributes
  if (prospect.tackle !== undefined) buffer[offset + 0x80] = prospect.tackle;
  if (prospect.hitPower !== undefined) buffer[offset + 0x5E] = prospect.hitPower;
  if (prospect.powerMoves !== undefined) buffer[offset + 0x6F] = prospect.powerMoves;
  if (prospect.finesseMoves !== undefined) buffer[offset + 0x5D] = prospect.finesseMoves;
  if (prospect.blockShedding !== undefined) buffer[offset + 0x56] = prospect.blockShedding;
  if (prospect.pursuit !== undefined) buffer[offset + 0x71] = prospect.pursuit;
  if (prospect.playRecognition !== undefined) buffer[offset + 0x6E] = prospect.playRecognition;
  if (prospect.manCoverage !== undefined) buffer[offset + 0x68] = prospect.manCoverage;
  if (prospect.zoneCoverage !== undefined) buffer[offset + 0x8A] = prospect.zoneCoverage;
  if (prospect.pressCoverage !== undefined) buffer[offset + 0x70] = prospect.pressCoverage;

  // Special Teams
  if (prospect.kickPower !== undefined) buffer[offset + 0x64] = prospect.kickPower;
  if (prospect.kickAccuracy !== undefined) buffer[offset + 0x63] = prospect.kickAccuracy;
  if (prospect.kickReturn !== undefined) buffer[offset + 0x65] = prospect.kickReturn;
  if (prospect.longSnap !== undefined) buffer[offset + 0x8B] = prospect.longSnap;

  // CRITICAL: Write 42-byte binary assetName field for REAL player assets
  // This is a SEPARATE binary field at the END of the 200-byte player data section
  // Offset: 200 - 42 = 158 (0x9E)
  // Real assets (like "WilliamsCaleb_14500") go here, NOT in visuals JSON
  // Generic assets (like "gen_7_B_G_005") go to visuals.genericHeadName only
  let newPEPS = prospect.PEPS || prospect.visuals?.genericHeadName || null;

  // CRITICAL FIX: Ensure newPEPS is a string before calling .toUpperCase()
  if (newPEPS !== null && newPEPS !== undefined && typeof newPEPS !== 'string') {
    console.error(`[M26Writer] ERROR at prospect ${prospectIndex}: PEPS is not a string!`);
    console.error(`  Type: ${typeof newPEPS}, Value:`, newPEPS);
    console.error(`  prospect.PEPS:`, prospect.PEPS, `(type: ${typeof prospect.PEPS})`);
    console.error(`  prospect.visuals?.genericHeadName:`, prospect.visuals?.genericHeadName);
    newPEPS = null; // Reset to null to skip this field
  }

  if (newPEPS !== undefined && newPEPS !== null && typeof newPEPS === 'string') {
    const isGenericAsset = newPEPS.toUpperCase().startsWith('GEN_');

    if (!isGenericAsset) {
      // Real player asset - write to 42-byte binary assetName field
      const assetNameStr = newPEPS.slice(0, 42).padEnd(42, '\0');
      buffer.write(assetNameStr, offset + 0x9E, 42, 'ascii');

      if (prospectIndex === 0) {
        console.log(`[M26Writer] ✓ Writing real asset to binary assetName field: "${newPEPS}"`);
        console.log(`[M26Writer]   Offset: 0x${(offset + 0x9E).toString(16)}, Length: 42 bytes`);
      }
    }
    // Generic assets don't go in binary field - only in visuals.genericHeadName
  }
}

/**
 * Update visual JSON data in the buffer
 * Handles updating PEPS (genericHeadName) and bodyType fields
 * @param {Buffer} buffer - File buffer to write to
 * @param {number} blockStart - Start offset of the 4296-byte block (0x10C8)
 * @param {Object} prospect - Prospect data with PEPS and/or bodyType
 */
function updateM26VisualJSON(buffer, blockStart, prospect) {
  const JSON_START_MARKER = Buffer.from('{"bodyType"');

  // Find existing JSON in this block
  const jsonStartIndex = buffer.indexOf(JSON_START_MARKER, blockStart);

  console.log(`[M26Writer] updateM26VisualJSON called for block at 0x${blockStart.toString(16)}`);
  console.log(`  PEPS to write: ${prospect.PEPS}`);
  console.log(`  bodyType to write: ${prospect.bodyType}`);
  console.log(`  JSON found at: 0x${jsonStartIndex.toString(16)}`);

  if (jsonStartIndex === -1 || jsonStartIndex >= blockStart + 0x1000) {
    // No visual JSON in this block - skip update
    console.log(`[M26Writer] No JSON found in this block - skipping`);
    return;
  }

  // Find the end of the JSON object
  let braceCount = 0;
  let jsonEnd = -1;

  for (let i = jsonStartIndex; i < blockStart + 0x1000; i++) {
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

  if (jsonEnd === -1) {
    console.warn('[M26Writer] Could not find end of JSON');
    return;
  }

  // Parse existing JSON
  const jsonString = buffer.toString('utf8', jsonStartIndex, jsonEnd);
  let visuals;

  try {
    visuals = JSON.parse(jsonString);
  } catch (e) {
    console.warn('[M26Writer] Failed to parse existing JSON:', e);
    return;
  }

  // Update fields
  let updated = false;

  // CRITICAL FIX: Check both prospect.PEPS and prospect.visuals.genericHeadName
  // The frontend updates visuals.genericHeadName, so prioritize that
  const logFile = path.join(process.cwd(), 'M26Writer_debug.log');
  const logMsg = `
=== PEPS UPDATE DEBUG ===
prospect.PEPS: ${prospect.PEPS}
prospect.visuals exists: ${!!prospect.visuals}
prospect.visuals.genericHeadName: ${prospect.visuals?.genericHeadName}
existing visuals.genericHeadName: ${visuals.genericHeadName}
`;
  fs.appendFileSync(logFile, logMsg);

  console.log(`[M26Writer] PEPS check - prospect.PEPS: ${prospect.PEPS}`);
  console.log(`[M26Writer] PEPS check - prospect.visuals exists: ${!!prospect.visuals}`);
  if (prospect.visuals) {
    console.log(`[M26Writer] PEPS check - prospect.visuals.genericHeadName: ${prospect.visuals.genericHeadName}`);
  }

  // Prioritize prospect.PEPS (new value) over visuals.genericHeadName (old template value)
  let newPEPS = prospect.PEPS || prospect.visuals?.genericHeadName || null;

  // CRITICAL FIX: Ensure newPEPS is a string (not a number, object, etc.)
  if (newPEPS !== null && newPEPS !== undefined && typeof newPEPS !== 'string') {
    console.error(`[M26Writer] ERROR: newPEPS is not a string! Type: ${typeof newPEPS}, Value:`, newPEPS);
    console.error(`[M26Writer] prospect.PEPS:`, prospect.PEPS, `(type: ${typeof prospect.PEPS})`);
    console.error(`[M26Writer] prospect.visuals?.genericHeadName:`, prospect.visuals?.genericHeadName, `(type: ${typeof prospect.visuals?.genericHeadName})`);
    newPEPS = null; // Reset to null to skip this field
  }

  if (prospect.PEPS) {
    console.log(`[M26Writer] Using prospect.PEPS: ${newPEPS}`);
    fs.appendFileSync(logFile, `Using prospect.PEPS: ${newPEPS}\n`);
  } else if (prospect.visuals?.genericHeadName) {
    console.log(`[M26Writer] Falling back to visuals.genericHeadName: ${newPEPS}`);
    fs.appendFileSync(logFile, `Falling back to visuals.genericHeadName: ${newPEPS}\n`);
  }

  if (newPEPS !== undefined && newPEPS !== null && typeof newPEPS === 'string') {
    // CRITICAL: Real assets go to BINARY assetName field (written in writeM26AttributeData)
    // Generic assets go to visuals.genericHeadName JSON field
    // Keep genericHeadName as fallback for real assets too
    const isGenericAsset = newPEPS.toUpperCase().startsWith('GEN_');

    if (isGenericAsset) {
      // Generic face - update genericHeadName in visuals JSON
      console.log(`[M26Writer] ✓ UPDATING genericHeadName (generic): ${visuals.genericHeadName} -> ${newPEPS}`);
      fs.appendFileSync(logFile, `✓ UPDATING genericHeadName (generic): ${visuals.genericHeadName} -> ${newPEPS}\n`);
      visuals.genericHeadName = newPEPS;
      updated = true;
    } else {
      // Real player asset - goes to BINARY field, keep genericHeadName as fallback
      console.log(`[M26Writer] ✓ Real asset "${newPEPS}" written to binary field, keeping genericHeadName: ${visuals.genericHeadName}`);
      fs.appendFileSync(logFile, `✓ Real asset "${newPEPS}" written to binary field, keeping genericHeadName: ${visuals.genericHeadName}\n`);
      // Don't modify visuals JSON for real assets - they go to binary field only
    }
  } else {
    console.log(`[M26Writer] ✗ NO PEPS VALUE TO UPDATE (newPEPS is ${newPEPS})`);
    fs.appendFileSync(logFile, `✗ NO PEPS VALUE TO UPDATE (newPEPS is ${newPEPS})\n`);
  }

  if (prospect.bodyType !== undefined && prospect.bodyType !== null) {
    console.log(`[M26Writer] Updating bodyType: ${visuals.bodyType} -> ${prospect.bodyType}`);
    visuals.bodyType = prospect.bodyType;
    updated = true;
  }

  if (!updated) {
    console.log(`[M26Writer] No updates needed for this prospect`);
    return;
  }

  // Re-serialize JSON
  const newJsonString = JSON.stringify(visuals);
  const newJsonBuffer = Buffer.from(newJsonString, 'utf8');

  // Find actual available space INCLUDING null padding after JSON
  // Madden pads JSON with 0x00 bytes - we can use this space for longer values
  let paddingEnd = jsonEnd;
  for (let i = jsonEnd; i < blockStart + 0x1000; i++) {
    if (buffer[i] === 0x00) {
      paddingEnd++;
    } else {
      break; // Stop at first non-null byte (start of attribute data)
    }
  }

  const availableSpace = paddingEnd - jsonStartIndex;

  fs.appendFileSync(logFile, `Old JSON length: ${jsonEnd - jsonStartIndex}\n`);
  fs.appendFileSync(logFile, `Padding bytes: ${paddingEnd - jsonEnd}\n`);
  fs.appendFileSync(logFile, `Total available space: ${availableSpace}\n`);
  fs.appendFileSync(logFile, `New JSON length: ${newJsonBuffer.length}\n`);

  console.log(`[M26Writer] Old JSON: ${jsonEnd - jsonStartIndex} bytes, Padding: ${paddingEnd - jsonEnd} bytes, Total available: ${availableSpace}`);
  console.log(`[M26Writer] New JSON length: ${newJsonBuffer.length}`);

  if (newJsonBuffer.length > availableSpace) {
    console.warn('[M26Writer] ⚠️  NEW JSON TOO LARGE - SKIPPING UPDATE ⚠️');
    console.warn(`  Available (including padding): ${availableSpace}, Needed: ${newJsonBuffer.length}`);
    console.warn(`  Difference: ${newJsonBuffer.length - availableSpace} bytes over`);
    return;
  }

  console.log(`[M26Writer] ✓ JSON fits! Writing to buffer...`);

  // Write new JSON and pad with zeros
  buffer.write(newJsonString, jsonStartIndex, newJsonBuffer.length, 'utf8');

  // Zero out remaining space (including old padding) to prevent garbage data
  for (let i = jsonStartIndex + newJsonBuffer.length; i < paddingEnd; i++) {
    buffer[i] = 0x00;
  }

  console.log(`[M26Writer] ✓ Successfully wrote updated JSON`);
  fs.appendFileSync(logFile, `✓ Successfully wrote ${newJsonBuffer.length} bytes, padded ${paddingEnd - (jsonStartIndex + newJsonBuffer.length)} bytes with zeros\n`);
}

module.exports = {
  writeM26DraftClass,
  writeM26AttributeData
};
