/**
 * Draft Class Service Integration Test
 *
 * Tests the draft class service layer and IPC integration.
 * Validates that all components work together correctly.
 *
 * Usage: node test-service.js
 */

const path = require('path');
const fs = require('fs');

// Import DraftClassParser directly
const DraftClassParser = require('./DraftClassParser.js');
const {
  readDraftClass,
  validateDraftClass,
  getDraftClassInfo,
  exportToJSON,
  getAttributeDefinitions
} = DraftClassParser;

// Test file path
const TEST_FILE = path.join(
  'C:',
  'Users',
  'tshan',
  'OneDrive',
  'Documents',
  'Madden Files',
  'KNuttZFranchiseSandBox',
  'Madden Files',
  'CAREERDRAFT-2026DRAFT7RND'
);

// Output path for JSON export
const OUTPUT_JSON = path.join(__dirname, 'test-output.json');

/**
 * Run all tests
 */
async function runTests() {
  console.log('=================================================');
  console.log('DRAFT CLASS SERVICE INTEGRATION TEST');
  console.log('=================================================\n');

  const results = {
    timestamp: new Date().toISOString(),
    testFile: TEST_FILE,
    tests: {}
  };

  try {
    // Test 1: Validate file
    console.log('[TEST 1] Validating draft class file...');
    const validation = validateDraftClass(TEST_FILE);
    results.tests.validation = {
      success: validation.valid,
      result: validation
    };

    if (validation.valid) {
      console.log('  ✓ File is valid');
      console.log(`    - Signature: ${validation.signature}`);
      console.log(`    - Version: ${validation.version}`);
      console.log(`    - Year: ${validation.year}`);
      console.log(`    - Product: ${validation.product}`);
      console.log(`    - Compression: ${validation.compressionType}`);
    } else {
      console.log('  ✗ File validation failed:', validation.error);
      return results;
    }

    // Test 2: Get file info
    console.log('\n[TEST 2] Getting file information...');
    const info = getDraftClassInfo(TEST_FILE);
    results.tests.info = {
      success: info.valid,
      result: info
    };

    if (info.valid) {
      console.log('  ✓ File info retrieved');
      console.log(`    - Prospect count: ${info.prospectCount}`);
      console.log(`    - Game version: ${info.gameVersion}`);
      console.log(`    - File size: ${info.fileSize} bytes`);
      if (info.sampleProspects && info.sampleProspects.length > 0) {
        console.log('    - Sample prospects:');
        info.sampleProspects.forEach(p => {
          console.log(`      - ${p.name} (OVR: ${p.overall})`);
        });
      }
    } else {
      console.log('  ✗ Failed to get file info:', info.error);
    }

    // Test 3: Load full draft class
    console.log('\n[TEST 3] Loading draft class file...');
    const startTime = Date.now();
    const draftClass = readDraftClass(TEST_FILE);
    const loadTime = Date.now() - startTime;

    results.tests.load = {
      success: true,
      loadTime,
      prospectCount: draftClass.prospects.length,
      header: draftClass.header
    };

    console.log(`  ✓ Draft class loaded in ${loadTime}ms`);
    console.log(`    - Prospects: ${draftClass.prospects.length}`);
    console.log(`    - Header: ${JSON.stringify(draftClass.header, null, 2)}`);

    // Test 4: Verify prospect structure
    console.log('\n[TEST 4] Verifying prospect data structure...');
    const sampleProspect = draftClass.prospects[0];

    // Count all attributes (excluding index, offset, visuals)
    const attributeKeys = Object.keys(sampleProspect).filter(
      key => !['index', 'offset', 'visuals'].includes(key)
    );

    results.tests.structure = {
      success: true,
      totalAttributes: attributeKeys.length,
      sampleProspect: {
        name: `${sampleProspect.firstName} ${sampleProspect.lastName}`,
        position: sampleProspect.position,
        overall: sampleProspect.overall,
        college: sampleProspect.college,
        attributes: attributeKeys.length
      },
      attributeList: attributeKeys
    };

    console.log('  ✓ Prospect structure verified');
    console.log(`    - Total attributes: ${attributeKeys.length}`);
    console.log(`    - Sample: ${sampleProspect.firstName} ${sampleProspect.lastName}`);
    console.log(`      - Position: ${sampleProspect.position}`);
    console.log(`      - Overall: ${sampleProspect.overall}`);
    console.log(`      - Speed: ${sampleProspect.speed}`);
    console.log(`      - College: ${sampleProspect.college}`);
    console.log(`      - Height: ${sampleProspect.heightInches} inches`);
    console.log(`      - Weight: ${sampleProspect.weight} lbs`);

    // Test 5: Verify all 115 attributes are present
    console.log('\n[TEST 5] Checking for all expected attributes...');
    const expectedAttributes = [
      'firstName', 'lastName', 'homeState', 'homeTown', 'college', 'birthDate',
      'age', 'heightInches', 'weight', 'position', 'archetype', 'jerseyNum',
      'draftable', 'draftPick', 'draftRound', 'overall', 'acceleration', 'agility',
      'awareness', 'ballCarrierVision', 'blockShedding', 'breakSack', 'breakTackle',
      'carrying', 'catching', 'catchInTraffic', 'changeOfDirection', 'finesseMoves',
      'hitPower', 'impactBlocking', 'injury', 'jukeMove', 'jumping', 'kickAccuracy',
      'kickPower', 'kickReturn', 'leadBlock', 'manCoverage', 'passBlockFinesse',
      'passBlockPower', 'passBlock', 'personality', 'playAction', 'playRecognition',
      'powerMoves', 'pressCoverage', 'pursuit', 'release', 'shortRouteRunning',
      'mediumRouteRunning', 'deepRouteRunning', 'runBlockFinesse', 'runBlockPower',
      'runBlock', 'runningStyle', 'spectacularCatch', 'speed', 'spinMove', 'stamina',
      'stiffArm', 'strength', 'tackle', 'throwAccuracyDeep', 'throwAccuracyMid',
      'throwAccuracy', 'throwAccuracyShort', 'throwOnTheRun', 'throwPower',
      'throwUnderPressure', 'toughness', 'trucking', 'zoneCoverage', 'morale',
      'traitBigHitter', 'traitPossessionCatch', 'traitClutch', 'traitCoverBall',
      'traitDeepBall', 'traitDlBullRush', 'traitDlSpinMove', 'traitDlSwimMove',
      'traitDropsOpen', 'traitSidelineCatch', 'traitFightForYards', 'traitUnk1',
      'traitHighMotor', 'traitAggressiveCatch', 'traitPenalty', 'traitPlayBall',
      'traitPumpFake', 'traitLbStyle', 'traitSensePressure', 'traitUnk2',
      'traitStripBall', 'traitTackleLow', 'traitThrowAway', 'traitTightSpiral',
      'traitTendency', 'traitRunAfterCatch', 'devTrait', 'traitPredictability',
      'unkByte2', 'genericHead', 'handedness', 'portraitId', 'qbStyle', 'qbStance',
      'unk3', 'unk4', 'unk5', 'unk6', 'visMoveType', 'unk8', 'commentaryId', 'assetName'
    ];

    const missingAttributes = expectedAttributes.filter(
      attr => !(attr in sampleProspect)
    );

    results.tests.attributes = {
      success: missingAttributes.length === 0,
      expected: expectedAttributes.length,
      found: attributeKeys.length,
      missing: missingAttributes
    };

    if (missingAttributes.length === 0) {
      console.log('  ✓ All expected attributes present');
      console.log(`    - Expected: ${expectedAttributes.length}`);
      console.log(`    - Found: ${attributeKeys.length}`);
    } else {
      console.log('  ✗ Missing attributes:');
      missingAttributes.forEach(attr => console.log(`    - ${attr}`));
    }

    // Test 6: Export to JSON
    console.log('\n[TEST 6] Exporting to JSON...');
    try {
      exportToJSON(TEST_FILE, OUTPUT_JSON);
      const jsonSize = fs.statSync(OUTPUT_JSON).size;

      results.tests.export = {
        success: true,
        outputPath: OUTPUT_JSON,
        fileSize: jsonSize
      };

      console.log('  ✓ Export successful');
      console.log(`    - Output: ${OUTPUT_JSON}`);
      console.log(`    - Size: ${jsonSize} bytes`);
    } catch (error) {
      results.tests.export = {
        success: false,
        error: error.message
      };
      console.log('  ✗ Export failed:', error.message);
    }

    // Test 7: Get attribute definitions
    console.log('\n[TEST 7] Getting attribute definitions...');
    const definitions = getAttributeDefinitions();

    results.tests.definitions = {
      success: true,
      categories: {
        personal: definitions.personal.length,
        ratings: definitions.ratings.length,
        draft: definitions.draft.length
      },
      total: definitions.personal.length + definitions.ratings.length + definitions.draft.length
    };

    console.log('  ✓ Attribute definitions retrieved');
    console.log(`    - Personal: ${definitions.personal.length} fields`);
    console.log(`    - Ratings: ${definitions.ratings.length} fields`);
    console.log(`    - Draft: ${definitions.draft.length} fields`);

    // Summary
    console.log('\n=================================================');
    console.log('TEST SUMMARY');
    console.log('=================================================');

    const testResults = Object.entries(results.tests);
    const passedTests = testResults.filter(([_, test]) => test.success).length;
    const totalTests = testResults.length;

    console.log(`\nPassed: ${passedTests}/${totalTests}`);

    testResults.forEach(([name, test]) => {
      const status = test.success ? '✓' : '✗';
      console.log(`${status} ${name}`);
    });

    results.summary = {
      passed: passedTests,
      total: totalTests,
      success: passedTests === totalTests
    };

    return results;

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error);
    console.error('Stack:', error.stack);

    results.error = {
      message: error.message,
      stack: error.stack
    };

    return results;
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests()
    .then(results => {
      console.log('\n=================================================');
      console.log('Test complete!');
      console.log('=================================================\n');

      // Exit with appropriate code
      process.exit(results.summary?.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };
