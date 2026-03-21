/**
 * Rebuild gear atlas using EQUIPMENT_OPTIONS as source of truth
 * Maps game values to available PNG images
 */

const fs = require('fs');
const path = require('path');

// Load equipment options from RosterParser
const RosterParser = require('../src/main/parsers/RosterParser.js');
const EQUIPMENT_OPTIONS = RosterParser.EQUIPMENT_OPTIONS;

const SPRITES_DIR = path.join(__dirname, '..', 'data', 'gear-sprites');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'gear-atlas.json');

// Get all available PNG files
const pngFiles = fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png'));
console.log(`Found ${pngFiles.length} PNG files\n`);

// Create a map of simplified names to PNG files for fuzzy matching
const pngMap = {};
pngFiles.forEach(file => {
    const baseName = file.replace('vnty_nflgear_', '').replace('.png', '');
    pngMap[baseName] = file;
    pngMap[baseName.toLowerCase()] = file;
});

// Function to find matching image for a value
function findImage(value) {
    // Try exact match first
    if (pngMap[value]) return pngMap[value];

    // Try with vnty_nflgear_ prefix
    const withPrefix = `vnty_nflgear_${value}.png`;
    if (pngFiles.includes(withPrefix)) return withPrefix;

    // Try case-insensitive
    const lowerValue = value.toLowerCase();
    if (pngMap[lowerValue]) return pngMap[lowerValue];

    // Try partial matching - find PNG that contains key parts of the value
    const valueParts = value.split('_').filter(p => p.length > 2);
    for (const file of pngFiles) {
        const fileLower = file.toLowerCase();
        const matchCount = valueParts.filter(part => fileLower.includes(part.toLowerCase())).length;
        if (matchCount >= Math.ceil(valueParts.length * 0.6)) {
            return file;
        }
    }

    return null;
}

// Build the atlas from EQUIPMENT_OPTIONS
const atlas = {
    helmets: [],
    facemasks: [],
    visors: [],
    mouthpieces: [],
    neckpads: [],
    guardianCaps: [],
    armSleeves: [],
    elbowGear: [],
    wristGear: [],
    gloves: [],
    undershirts: [],
    backplates: [],
    flakJackets: [],
    towels: [],
    handwarmers: [],
    shoes: [],
    spats: [],
    kneePads: [],
    thighPads: [],
    shoulderPads: []
};

// Mapping from EQUIPMENT_OPTIONS keys to atlas categories
const slotToCategory = {
    Helmet: 'helmets',
    Facemask: 'facemasks',
    Visor: 'visors',
    Mouthpiece: 'mouthpieces',
    Neckpad: 'neckpads',
    GuardianCap: 'guardianCaps',
    LeftSleeve: 'armSleeves',
    RightSleeve: 'armSleeves',
    LeftElbow: 'elbowGear',
    RightElbow: 'elbowGear',
    LeftWrist: 'wristGear',
    RightWrist: 'wristGear',
    LeftGlove: 'gloves',
    RightGlove: 'gloves',
    Undershirt: 'undershirts',
    BackPlate: 'backplates',
    FlakJacket: 'flakJackets',
    Towel: 'towels',
    Handwarmer: 'handwarmers',
    LeftShoe: 'shoes',
    RightShoe: 'shoes',
    LeftSpats: 'spats',
    RightSpats: 'spats',
    KneePad: 'kneePads',
    LeftThighPad: 'thighPads',
    RightThighPad: 'thighPads',
    ShoulderPads: 'shoulderPads'
};

// Track which values we've already added (to avoid duplicates from Left/Right)
const addedValues = {};

// Process each equipment slot
let totalItems = 0;
let itemsWithImages = 0;

Object.entries(slotToCategory).forEach(([slot, category]) => {
    const options = EQUIPMENT_OPTIONS[slot];
    if (!options) {
        console.log(`Warning: No options for slot ${slot}`);
        return;
    }

    if (!addedValues[category]) addedValues[category] = new Set();

    options.forEach(option => {
        // Skip None options and already added values
        if (option.value.includes('None') || addedValues[category].has(option.value)) {
            return;
        }

        addedValues[category].add(option.value);
        totalItems++;

        const image = findImage(option.value);
        if (image) itemsWithImages++;

        const entry = {
            value: option.value,
            label: option.label,
            image: image || null
        };

        // Add facemask compatibility
        if (category === 'facemasks') {
            entry.compatibility = detectFacemaskCompatibility(option.value);
        }

        atlas[category].push(entry);
    });
});

// Detect facemask compatibility from value string
function detectFacemaskCompatibility(value) {
    const lowerValue = value.toLowerCase();

    if (lowerValue.includes('speedflex') || lowerValue.includes('speed_flex')) return 'speedflex';
    if (lowerValue.includes('revospeed') || lowerValue.includes('revo_speed')) return 'revospeed';
    if (lowerValue.includes('revolution') && !lowerValue.includes('speed')) return 'revolution';
    if (lowerValue.includes('axiom')) return 'axiom';
    if (lowerValue.includes('f7pro')) return 'f7pro';
    if (lowerValue.includes('f7') && !lowerValue.includes('f7pro')) return 'f7';
    if (lowerValue.includes('viciszero2trench') || lowerValue.includes('vicistrench')) return 'vicistrench';
    if (lowerValue.includes('viciszero2')) return 'viciszero2';
    if (lowerValue.includes('viciszero1')) return 'viciszero1';
    if (lowerValue.includes('vicis')) return 'vicis';
    if (lowerValue.includes('xenithorbit')) return 'xenithorbit';
    if (lowerValue.includes('xenith')) return 'xenith';
    if (lowerValue.includes('vengeancez10')) return 'vengeancez10';
    if (lowerValue.includes('vengeance')) return 'vengeance';
    if (lowerValue.includes('riddell360')) return 'riddell360';
    if (lowerValue.includes('light')) return 'light';
    if (lowerValue.includes('vintage') || lowerValue.includes('tk')) return 'vintage';

    return 'universal';
}

// Add helmet compatibility mapping
atlas.helmetCompatibility = {
    'GearHelmet_Speed_Flex': 'speedflex',
    'GearHelmet_RevolutionSpeed': 'revospeed',
    'GearHelmet_Revolution': 'revolution',
    'GearHelmet_Axiom': 'axiom',
    'GearHelmet_SchuttF7': 'f7',
    'GearHelmet_SchuttF7Pro': 'f7pro',
    'GearHelmet_VicisZero1': 'viciszero1',
    'GearHelmet_VicisZero2': 'viciszero2',
    'GearHelmet_VicisZero2Trench': 'vicistrench',
    'GearHelmet_XenithShadow': 'xenith',
    'GearHelmet_XenithEpic': 'xenith',
    'GearHelmet_XenithOrbit': 'xenithorbit',
    'GearHelmet_VengeanceZ10': 'vengeancez10',
    'GearHelmet_SchuttVeng': 'vengeance',
    'GearHelmet_Riddell360': 'riddell360',
    'GearHelmet_LightGladiator': 'light',
    'GearHelmet_LightLS2': 'light',
    'GearHelmet_Standard': 'universal',
    'GearHelmet_standardBrady': 'universal',
    'GearHelmet_Schutt': 'universal',
    'GearHelmet_RiddellTK': 'vintage',
    'GearHelmet_AirXP': 'universal',
    'GearHelmet_X2E': 'vengeance',
    'GearHelmet_PumpkinDefender': 'universal'
};

// Sort all categories alphabetically by label
Object.keys(atlas).forEach(key => {
    if (Array.isArray(atlas[key])) {
        atlas[key].sort((a, b) => a.label.localeCompare(b.label));
    }
});

// Write atlas
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(atlas, null, 2));

// Print summary
console.log('Gear atlas rebuilt from EQUIPMENT_OPTIONS:');
Object.keys(atlas).forEach(key => {
    if (Array.isArray(atlas[key]) && atlas[key].length > 0) {
        const withImg = atlas[key].filter(i => i.image).length;
        console.log(`  ${key}: ${atlas[key].length} items (${withImg} with images)`);
    }
});
console.log(`\nTotal: ${totalItems} items, ${itemsWithImages} with images (${Math.round(itemsWithImages/totalItems*100)}%)`);
console.log(`\nOutput: ${OUTPUT_FILE}`);
