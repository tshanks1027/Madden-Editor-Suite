/**
 * Build comprehensive gear atlas JSON mapping equipment values to PNG files
 */

const fs = require('fs');
const path = require('path');

const SPRITES_DIR = path.join(__dirname, '..', 'data', 'gear-sprites');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'gear-atlas.json');

// Read all PNG files
const files = fs.readdirSync(SPRITES_DIR).filter(f => f.endsWith('.png'));

console.log(`Found ${files.length} PNG files in gear-sprites folder\n`);

const atlas = {
    helmets: [],
    facemasks: [],
    visors: [],
    backplates: [],
    mouthpieces: [],
    neckpads: [],
    armSleeves: [],
    elbowGear: [],
    wristGear: [],
    gloves: [],
    shoes: [],
    spats: [],
    kneePads: [],
    thighPads: [],
    undershirts: [],
    flakJackets: [],
    towels: [],
    handwarmers: [],
    guardianCaps: [],
    shoulderPads: []
};

// Process files by category
files.forEach(file => {
    const baseName = file.replace('vnty_nflgear_', '').replace('.png', '');

    // Determine category and extract value/label
    let category = null;
    let value = '';
    let label = '';

    if (file.includes('GearHelmet_')) {
        category = 'helmets';
        const match = file.match(/vnty_nflgear_(GearHelmet_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearHelmet_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearFaceMask_')) {
        category = 'facemasks';
        const match = file.match(/vnty_nflgear_(GearFaceMask_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearFaceMask_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearVisor_')) {
        category = 'visors';
        const match = file.match(/vnty_nflgear_(GearVisor_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearVisor_', '').replace(/visor/gi, '').replace(/_/g, ' ').trim();
        }
    } else if (file.includes('Backplate_')) {
        category = 'backplates';
        const match = file.match(/vnty_nflgear_(Backplate_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('Backplate_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearMouthpiece_')) {
        category = 'mouthpieces';
        const match = file.match(/vnty_nflgear_(GearMouthpiece_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearMouthpiece_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearNeckpad_')) {
        category = 'neckpads';
        const match = file.match(/vnty_nflgear_(GearNeckpad_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearNeckpad_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearArmSleeve_')) {
        category = 'armSleeves';
        const match = file.match(/vnty_nflgear_(GearArmSleeve_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearArmSleeve_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('ElbowGear_')) {
        category = 'elbowGear';
        const match = file.match(/vnty_nflgear_(ElbowGear_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('ElbowGear_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearWrist_')) {
        category = 'wristGear';
        const match = file.match(/vnty_nflgear_(GearWrist_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearWrist_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearHand_') || file.includes('glove')) {
        category = 'gloves';
        const match = file.match(/vnty_nflgear_([^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace(/GearHand_|glove_/gi, '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearFootwear_') || file.includes('shoe_') || file.includes('Shoe_')) {
        category = 'shoes';
        const match = file.match(/vnty_nflgear_([^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace(/GearFootwear_|shoe_|Shoe_/gi, '').replace(/_/g, ' ');
        }
    } else if (file.includes('GearSpats_')) {
        category = 'spats';
        const match = file.match(/vnty_nflgear_(GearSpats_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GearSpats_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('KneePad_')) {
        category = 'kneePads';
        const match = file.match(/vnty_nflgear_(KneePad_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('KneePad_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('ThighPad_')) {
        category = 'thighPads';
        const match = file.match(/vnty_nflgear_(ThighPad_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('ThighPad_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('Undershirt_')) {
        category = 'undershirts';
        const match = file.match(/vnty_nflgear_(Undershirt_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('Undershirt_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('Flakjacket_')) {
        category = 'flakJackets';
        const match = file.match(/vnty_nflgear_(Flakjacket_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('Flakjacket_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('Towel_')) {
        category = 'towels';
        const match = file.match(/vnty_nflgear_(Towel_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('Towel_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('Handwarmer_')) {
        category = 'handwarmers';
        const match = file.match(/vnty_nflgear_(Handwarmer_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('Handwarmer_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('GuardianCap_')) {
        category = 'guardianCaps';
        const match = file.match(/vnty_nflgear_(GuardianCap_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('GuardianCap_', '').replace(/_/g, ' ');
        }
    } else if (file.includes('ShoulderPads_')) {
        category = 'shoulderPads';
        const match = file.match(/vnty_nflgear_(ShoulderPads_[^.]+)\.png/);
        if (match) {
            value = match[1];
            label = value.replace('ShoulderPads_', '').replace(/_/g, ' ');
        }
    }

    // Add to atlas if valid
    if (category && value && atlas[category]) {
        // Determine facemask compatibility
        let compatibility = undefined;
        if (category === 'facemasks') {
            const lowerValue = value.toLowerCase();
            if (lowerValue.includes('speedflex') || lowerValue.includes('speed_flex')) {
                compatibility = 'speedflex';
            } else if (lowerValue.includes('revospeed') || lowerValue.includes('revo_speed')) {
                compatibility = 'revospeed';
            } else if (lowerValue.includes('revo') && !lowerValue.includes('revolution')) {
                compatibility = 'revolution';
            } else if (lowerValue.includes('axiom')) {
                compatibility = 'axiom';
            } else if (lowerValue.includes('f7pro')) {
                compatibility = 'f7pro';
            } else if (lowerValue.includes('f7')) {
                compatibility = 'f7';
            } else if (lowerValue.includes('viciszero2')) {
                compatibility = 'viciszero2';
            } else if (lowerValue.includes('viciszero1')) {
                compatibility = 'viciszero1';
            } else if (lowerValue.includes('vicistrench')) {
                compatibility = 'vicistrench';
            } else if (lowerValue.includes('vicis')) {
                compatibility = 'vicis';
            } else if (lowerValue.includes('xenithorbit')) {
                compatibility = 'xenithorbit';
            } else if (lowerValue.includes('xenith')) {
                compatibility = 'xenith';
            } else if (lowerValue.includes('vengeancez10')) {
                compatibility = 'vengeancez10';
            } else if (lowerValue.includes('vengeance')) {
                compatibility = 'vengeance';
            } else if (lowerValue.includes('riddell360')) {
                compatibility = 'riddell360';
            } else if (lowerValue.includes('light')) {
                compatibility = 'light';
            } else if (lowerValue.includes('vintage')) {
                compatibility = 'vintage';
            } else {
                compatibility = 'universal';
            }
        }

        const entry = { value, label, image: file };
        if (compatibility) entry.compatibility = compatibility;
        atlas[category].push(entry);
    }
});

// Sort all categories alphabetically by label
Object.keys(atlas).forEach(key => {
    if (Array.isArray(atlas[key])) {
        atlas[key].sort((a, b) => a.label.localeCompare(b.label));
    }
});

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
    'GearHelmet_Riddell360': 'riddell360',
    'GearHelmet_LightGladiator': 'light',
    'GearHelmet_LightLS2': 'light',
    'GearHelmet_Standard': 'universal',
    'GearHelmet_Schutt': 'universal',
    'GearHelmet_RiddellTK': 'vintage',
    'GearHelmet_AirXP': 'universal',
    'GearHelmet_X2E': 'vengeance'
};

// Write atlas
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(atlas, null, 2));

// Print summary
console.log('Gear atlas created:');
Object.keys(atlas).forEach(key => {
    if (Array.isArray(atlas[key]) && atlas[key].length > 0) {
        console.log(`  ${key}: ${atlas[key].length}`);
    }
});
console.log(`\nOutput: ${OUTPUT_FILE}`);
