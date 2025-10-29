/**
 * Quick test to verify PLPO face number padding is working
 */

const fs = require('fs');
const path = require('path');

// Load PID mapping
const pidMappingPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');
const pidMappingContent = fs.readFileSync(pidMappingPath, 'utf-8');

const plpoToPidMapping = new Map();
const pidLines = pidMappingContent.split('\n');
for (let i = 1; i < pidLines.length; i++) {
    const line = pidLines[i].trim();
    if (!line) continue;
    const [pidStr, type, portrait] = line.split(',');
    const pid = parseInt(pidStr, 10);
    if (!isNaN(pid) && portrait) {
        const plpo = portrait.trim();
        if (!plpoToPidMapping.has(plpo)) {
            plpoToPidMapping.set(plpo, pid);
        }
    }
}

console.log('=== TESTING PLPO FACE NUMBER PADDING ===\n');

// Test cases from real data
const testCases = [
    { input: 'gen_5_M_M_005', expected: 'plpo_generic_5_005' },
    { input: 'gen_6_B_G_04', expected: 'plpo_generic_6_004' },  // Should pad to 004
    { input: 'gen_2_B_N_02', expected: 'plpo_generic_2_002' },  // Should pad to 002
    { input: 'gen_7_A_B_1', expected: 'plpo_generic_7_001' },   // Should pad to 001
];

for (const testCase of testCases) {
    const genericHeadName = testCase.input;
    const parts = genericHeadName.toLowerCase().split('_');
    const skinTone = parts[1];
    const faceNumber = parts[parts.length - 1].padStart(3, '0'); // Pad to 3 digits
    const plpoName = `plpo_generic_${skinTone}_${faceNumber}`;

    const mappedPID = plpoToPidMapping.get(plpoName);

    console.log(`Input: ${genericHeadName}`);
    console.log(`  Generated PLPO: ${plpoName}`);
    console.log(`  Expected PLPO: ${testCase.expected}`);
    console.log(`  Match: ${plpoName === testCase.expected ? 'YES' : 'NO'}`);
    console.log(`  Mapped PID: ${mappedPID || 'NOT FOUND'}`);
    console.log('');
}

console.log('=== SUMMARY ===');
console.log(`Total PLPO->PID mappings loaded: ${plpoToPidMapping.size}`);
