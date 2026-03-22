/**
 * Update gear-atlas.json with correct image filenames for visors and add eyepaint section
 */

const fs = require('fs');
const path = require('path');

const ATLAS_PATH = path.join(__dirname, '..', 'data', 'gear-atlas.json');
const SPRITES_PATH = path.join(__dirname, '..', 'data', 'gear-sprites');

// Load current atlas
const atlas = JSON.parse(fs.readFileSync(ATLAS_PATH, 'utf8'));

// Get all PNG files
const pngFiles = fs.readdirSync(SPRITES_PATH).filter(f => f.endsWith('.png'));

// Build lookup map: extract the visor value from filename
// Format: vnty_xxx_VALUE.png -> VALUE
const imageMap = {};
for (const png of pngFiles) {
    // Extract the meaningful part (the visor/equipment value)
    // Examples:
    // vnty_rodgers_v_ROD_Visor_GRE.png -> v_ROD_Visor_GRE
    // vnty_99club_G_Visor_99Club_B_GOL.png -> G_Visor_99Club_B_GOL
    // vnty_nflgear_GearVisor_visorClear.png -> GearVisor_visorClear

    const base = png.replace('.png', '');
    const parts = base.split('_');

    // Skip first part (vnty) and second part (category)
    if (parts.length >= 3) {
        // Try different extraction strategies
        let value = null;

        // For standard visors: vnty_nflgear_GearVisor_xxx -> GearVisor_xxx
        if (base.includes('GearVisor_')) {
            value = base.substring(base.indexOf('GearVisor_'));
        }
        // For G_Visor type: vnty_xxx_G_Visor_yyy -> G_Visor_yyy
        else if (base.includes('_G_Visor_')) {
            value = base.substring(base.indexOf('_G_Visor_') + 1);
        }
        // For V_xxx type (uppercase): vnty_xxx_V_yyy -> V_yyy
        else if (base.includes('_V_')) {
            const idx = base.indexOf('_V_');
            value = base.substring(idx + 1);
        }
        // For v_xxx type (lowercase): vnty_xxx_v_yyy -> v_yyy
        else if (base.includes('_v_')) {
            const idx = base.indexOf('_v_');
            value = base.substring(idx + 1);
        }
        // For Oakley Prizm: vnty_oakleyprizm_OakleyPrizmXxx_Visor -> OakleyPrizmXxx_Visor
        else if (base.includes('OakleyPrizm')) {
            const match = base.match(/(OakleyPrizm\w+_Visor)/);
            if (match) value = match[1];
        }
        // For eyepaint: vnty_styles_eyepaint_facetape_xxx -> xxx
        else if (base.includes('eyepaint_facetape_')) {
            value = base.substring(base.indexOf('eyepaint_facetape_') + 18);
        }

        if (value) {
            imageMap[value] = png;
            // Also add lowercase version for case-insensitive matching
            imageMap[value.toLowerCase()] = png;
        }
    }
}

console.log('Built image map with', Object.keys(imageMap).length, 'entries');

// Update visors
let visorsUpdated = 0;
for (const visor of atlas.visors) {
    if (visor.image === null) {
        // Try to find matching image
        let img = imageMap[visor.value];
        if (!img) {
            img = imageMap[visor.value.toLowerCase()];
        }
        if (img) {
            visor.image = img;
            visorsUpdated++;
            console.log(`  Updated visor: ${visor.value} -> ${img}`);
        } else {
            console.log(`  No image found for visor: ${visor.value}`);
        }
    }
}
console.log(`Updated ${visorsUpdated} visor images`);

// Create eyepaint section if it doesn't exist
if (!atlas.eyepaint) {
    atlas.eyepaint = [];
}

// Define eyepaint options with their images
const eyepaintOptions = [
    { value: 'FaceMarks_None', label: 'None', image: null },
    { value: 'FaceMarks_EyePaint', label: 'Eye Black', image: null },
    { value: 'FaceMarks_EyePaint2', label: 'Eye Black 2', image: null },
    { value: 'FaceMarks_EyePaint3', label: 'Eye Black 3', image: null },
    { value: 'FaceMarks_EyePaintCross', label: 'Eye Black Cross', image: null },
    { value: 'EyeBlack_Grease', label: 'Eye Black Grease', image: 'vnty_styles_eyepaint_facetape_EyeBlack_Grease.png' },
    { value: 'EyeBlack_Grease_Crosses', label: 'Eye Black Grease Crosses', image: 'vnty_styles_eyepaint_facetape_EyeBlack_Grease_Crosses.png' },
    { value: 'EyeBlack_Grease_Mask', label: 'Eye Black Grease Mask', image: 'vnty_styles_eyepaint_facetape_EyeBlack_Grease_Mask.png' },
    { value: 'EyeBlack_Grease_Smear', label: 'Eye Black Grease Smear', image: 'vnty_styles_eyepaint_facetape_EyeBlack_Grease_Smear.png' },
    { value: 'EyeBlack_Sticker', label: 'Eye Black Sticker', image: 'vnty_styles_eyepaint_facetape_EyeBlack_Sticker.png' },
    { value: 'EyeBlack_L_Sticker', label: 'Eye Black Left Sticker', image: 'vnty_styles_eyepaint_facetape_EyeBlack_L_Sticker.png' },
    { value: 'EyeBlack_R_Sticker', label: 'Eye Black Right Sticker', image: 'vnty_styles_eyepaint_facetape_EyeBlack_R_Sticker.png' },
    { value: 'FaceMarks_EyeTape', label: 'Eye Tape', image: null },
    { value: 'FaceMarks_EyeTapeLeft', label: 'Eye Tape Left', image: null },
    { value: 'FaceMarks_EyeTapeRight', label: 'Eye Tape Right', image: null },
    { value: 'FaceMarks_NoseTape', label: 'Nose Tape', image: null },
    { value: 'EyeBlack_NoseStrip', label: 'Nose Strip', image: 'vnty_styles_eyepaint_facetape_EyeBlack_NoseStrip.png' },
    { value: 'EyeBlack_NoseStripXL', label: 'Nose Strip XL', image: 'vnty_styles_eyepaint_facetape_EyeBlack_NoseStripXL.png' },
    { value: 'FaceMarks_NoseEyeTape', label: 'Nose & Eye Tape', image: null },
    { value: 'FaceMarks_NoseTapeEyePaint', label: 'Nose Tape + Eye Black', image: null },
    { value: 'EyeBlack_Grease_NoseStrip', label: 'Eye Black + Nose Strip', image: 'vnty_styles_eyepaint_facetape_EyeBlack_Grease_NoseStrip.png' },
    { value: 'EyeBlack_GreaseSmear_NoseStripXL', label: 'Eye Black Smear + Nose XL', image: 'vnty_styles_eyepaint_facetape_EyeBlack_GreaseSmear_NoseStripXL.png' }
];

atlas.eyepaint = eyepaintOptions;
console.log(`Added ${eyepaintOptions.length} eyepaint options to atlas`);

// Write updated atlas
fs.writeFileSync(ATLAS_PATH, JSON.stringify(atlas, null, 2));
console.log('\nUpdated gear-atlas.json successfully!');
