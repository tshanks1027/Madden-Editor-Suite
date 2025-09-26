/**
 * Madden Player Field Definitions
 * Complete field definitions with validation, types, and display names
 */

export const MADDEN_FIELDS = {
    // User-friendly fields based on FIELD_ORDER
    'PLNA': { display: 'Last Name', type: 'text', editable: true, width: 100 },
    'PFNA': { display: 'First Name', type: 'text', editable: true, width: 100 },
    'PSXP': { display: 'Pic ID', type: 'numeric', editable: false, width: 80, min: 0, max: 255 },
    'PLAYERPIC': { display: 'Player Pic', type: 'text', editable: false, width: 100 },
    'PPOS': { display: 'Position', type: 'lookup', editable: true, width: 80, lookup: 'positions' },
    'TGID': { display: 'Team', type: 'lookup', editable: true, width: 80, lookup: 'teams' },
    'PJEN': { display: 'Jersey #', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PCOL': { display: 'College', type: 'lookup', editable: true, width: 100, lookup: 'colleges' },
    'PAGE': { display: 'Age', type: 'numeric', editable: true, width: 60, min: 18, max: 45 },
    'PHTN': { display: 'Hometown', type: 'text', editable: false, width: 100 },
    'PHSN': { display: 'State', type: 'lookup', editable: true, width: 80, lookup: 'states' },
    'PYRP': { display: 'Years Pro', type: 'numeric', editable: true, width: 80, min: 0, max: 25 },
    'PACC': { display: 'Acceleration', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PAGI': { display: 'Agility', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PAWR': { display: 'Awareness', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PBCV': { display: 'Vision', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PBSG': { display: 'Block Shed', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PBSK': { display: 'Break Sack', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PCAR': { display: 'Carrying', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLCI': { display: 'Catch in Traffic', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PCTH': { display: 'Catching', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PDRR': { display: 'Deep RR', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PELU': { display: 'Change of Dir', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PFMS': { display: 'Finesse Moves', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PLHT': { display: 'Hit Power', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLIB': { display: 'Impact Block', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PINJ': { display: 'Injury', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLJM': { display: 'Juke', type: 'numeric', editable: true, width: 60, min: 0, max: 99 },
    'PJMP': { display: 'Jump', type: 'numeric', editable: true, width: 60, min: 0, max: 99 },
    'PKAC': { display: 'Kick Acc', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PKPR': { display: 'Kick Power', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PKRT': { display: 'Kick Return', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLBK': { display: 'Lead Block', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLMC': { display: 'Man Cov', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PMRR': { display: 'Medium RR', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PPBK': { display: 'Pass Block', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PPBF': { display: 'Pass Block FIN', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PPBS': { display: 'Pass Block PWR', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PPLA': { display: 'Play Action', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PLPM': { display: 'Power Move', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PLPE': { display: 'Press', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLPU': { display: 'Pursuit', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLRL': { display: 'Release', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PRBK': { display: 'Run Block', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PRBF': { display: 'Run Block FIN', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PRBS': { display: 'Run Block PWR', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'SRRN': { display: 'Short RR', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLSC': { display: 'Spec Catch', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PSPD': { display: 'Speed', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLSM': { display: 'Spin Move', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PSTA': { display: 'Stamina', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLSA': { display: 'Stiff Arm', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PSTR': { display: 'Strength', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PTAK': { display: 'Tackling', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PTAD': { display: 'Deep Throw', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PTAM': { display: 'Med Throw', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PTAS': { display: 'Short Throw', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PTOR': { display: 'Throw on Run', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PTHP': { display: 'Throw Power', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PTUP': { display: 'Throw Under Pressure', type: 'numeric', editable: true, width: 140, min: 0, max: 99 },
    'PTGH': { display: 'Toughness', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLTR': { display: 'Truck', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLZC': { display: 'Zone Coverage', type: 'numeric', editable: true, width: 110, min: 0, max: 99 },
    'PHGT': { display: 'Height', type: 'numeric', editable: true, width: 70, min: 65, max: 85 },
    'PWGT': { display: 'Weight', type: 'numeric', editable: true, width: 70, min: 160, max: 380 },

    // Additional system fields
    'PGID': { display: 'Player ID', type: 'numeric', editable: false, width: 80, min: 0, max: 99999 },
    'POVR': { display: 'Overall', type: 'numeric', editable: false, width: 70, min: 0, max: 99 }
};

// Field order for user-friendly editing (Madden game order)
export const FIELD_ORDER = [
    ["PLNA", "Last Name"], ["PFNA", "First Name"], ["PSXP", "Pic ID"], ["PLAYERPIC", "Player Pic"],
    ["PPOS", "Position"], ["TGID", "Team"], ["PJEN", "Jersey #"], ["PCOL", "College"],
    ["PAGE", "Age"], ["PHTN", "Hometown"], ["PHSN", "State"], ["PYRP", "Years Pro"],
    ["PACC", "Acceleration"], ["PAGI", "Agility"], ["PAWR", "Awareness"], ["PBCV", "Vision"],
    ["PBSG", "Block Shed"], ["PBSK", "Break Sack"], ["PCAR", "Carrying"], ["PLCI", "Catch in Traffic"],
    ["PCTH", "Catching"], ["PDRR", "Deep RR"], ["PELU", "Change of Dir"], ["PFMS", "Finesse Moves"],
    ["PLHT", "Hit Power"], ["PLIB", "Impact Block"], ["PINJ", "Injury"], ["PLJM", "Juke"],
    ["PJMP", "Jump"], ["PKAC", "Kick Acc"], ["PKPR", "Kick Power"], ["PKRT", "Kick Return"],
    ["PLBK", "Lead Block"], ["PLMC", "Man Cov"], ["PMRR", "Medium RR"], ["PPBK", "Pass Block"],
    ["PPBF", "Pass Block FIN"], ["PPBS", "Pass Block PWR"], ["PPLA", "Play Action"], ["PLPM", "Power Move"],
    ["PLPE", "Press"], ["PLPU", "Pursuit"], ["PLRL", "Release"], ["PRBK", "Run Block"],
    ["PRBF", "Run Block FIN"], ["PRBS", "Run Block PWR"], ["SRRN", "Short RR"], ["PLSC", "Spec Catch"],
    ["PSPD", "Speed"], ["PLSM", "Spin Move"], ["PSTA", "Stamina"], ["PLSA", "Stiff Arm"],
    ["PSTR", "Strength"], ["PTAK", "Tackling"], ["PTAD", "Deep Throw"], ["PTAM", "Med Throw"],
    ["PTAS", "Short Throw"], ["PTOR", "Throw on Run"], ["PTHP", "Throw Power"],
    ["PTUP", "Throw Under Pressure"], ["PTGH", "Toughness"], ["PLTR", "Truck"], ["PLZC", "Zone Coverage"],
    ["PHGT", "Height"], ["PWGT", "Weight"]
];

// Madden export order (for file saving - exact order for roster file export)
export const MADDEN_EXPORT_ORDER = [
    "EPAV", "PACC", "PAGE", "PAGI", "PAWR", "PBCV", "PBKT", "PBSG", "PBSK", "PCAR",
    "PCMT", "PCOL", "PCON", "PCSA", "PCTH", "PCYL", "PDPI", "PDRO", "PDRR", "PEGO",
    "PELU", "PEPS", "PFMS", "PFNA", "PGHE", "PGID", "PHGT", "PHSN", "PHTN", "PIMP",
    "PINJ", "PJEN", "PJMP", "PKAC", "PKPR", "PKRT", "PLBD", "PLBK", "PLCI", "PLHT",
    "PLHY", "PLIB", "PLJM", "PLMC", "PLMO", "PLNA", "PLPE", "PLPL", "PLPM", "PLPO",
    "PLPR", "PLPU", "PLRL", "PLSA", "PLSC", "PLSM", "PLTR", "PLZC", "PMRR", "POID",
    "POVR", "PPBF", "PPBK", "PPBS", "PPLA", "PQBS", "PRBF", "PRBK", "PRBS", "PROL",
    "PRSE", "PSA0", "PSA1", "PSA2", "PSB0", "PSB1", "PSBO", "PSKI", "PSPD", "PSTA",
    "PSTM", "PSTN", "PSTR", "PSXP", "PTAD", "PTAK", "PTAM", "PTAS", "PTEN", "PTGH",
    "PTHA", "PTHP", "PTOR", "PTSA", "PTUP", "PVCO", "PVSB", "PVTS", "PWGT", "PYCF",
    "PYRP", "SRRN", "TGID", "TRBH", "TRBR", "TRCB", "TRCL", "TRDO", "TRDS", "TRFB",
    "TRFK", "TRFY", "TRHM", "TRJR", "TRSB", "TRSW", "TRTA", "TRTL", "TRTS", "TRWU",
    "PLTY", "PPOS", "PYWT", "PLDT", "PCPH", "ISCN", "PCBT", "PLCP", "PSA3", "PSB2",
    "PSB3", "PICN", "PHAN", "PSA4", "PSB4", "PSA5", "PSA6", "PSB5", "PSB6"
];

// Basic fields for default view (user-friendly editing fields only)
export const BASIC_FIELDS = FIELD_ORDER.map(field => field[0]);

// Position field mappings (simplified position names to internal codes)
export const POSITION_MAPPINGS = {
    0: 'QB', 1: 'HB', 2: 'WR', 3: 'TE', 4: 'LT', 5: 'LG', 6: 'C', 7: 'RG', 8: 'RT',
    9: 'DT', 10: 'LEDG', 11: 'REDG', 12: 'SAM', 13: 'Mike', 14: 'WILL', 15: 'CB',
    16: 'FS', 17: 'SS', 18: 'K', 19: 'P'
};

// Team mappings (simplified - full lookup would come from roster file)
export const TEAM_MAPPINGS = {
    0: 'ARI', 1: 'ATL', 2: 'BAL', 3: 'BUF', 4: 'CAR', 5: 'CHI', 6: 'CIN', 7: 'CLE',
    8: 'DAL', 9: 'DEN', 10: 'DET', 11: 'GB', 12: 'HOU', 13: 'IND', 14: 'JAX', 15: 'KC',
    16: 'LV', 17: 'LAC', 18: 'LAR', 19: 'MIA', 20: 'MIN', 21: 'NE', 22: 'NO', 23: 'NYG',
    24: 'NYJ', 25: 'PHI', 26: 'PIT', 27: 'SF', 28: 'SEA', 29: 'TB', 30: 'TEN', 31: 'WAS'
};

// Lookup data storage
let LOOKUP_DATA = {
    colleges: new Map(),
    states: new Map(),
    positions: POSITION_MAPPINGS,
    teams: TEAM_MAPPINGS
};

/**
 * Load lookup data from CSV files
 */
export async function loadLookupData() {
    try {
        // For now, use static data since file loading might have path issues
        // Load college data from the file we read
        const collegeData = [
            [0, 'Blank'], [1, 'Abilene Christian'], [2, 'Air Force'], [3, 'Akron'], [4, 'Alabama'],
            [5, 'Alabama A&M'], [6, 'Alabama State'], [7, 'Alcorn State'], [8, 'Appalachian State'],
            [9, 'Arizona'], [10, 'Arizona State'], [11, 'Arkansas'], [12, 'Arkansas Pine Bluff'],
            [13, 'Arkansas State'], [14, 'Army'], [15, 'Auburn'], [16, 'Austin Peay'], [17, 'Ball State'],
            [18, 'Baylor'], [19, 'Bethune-Cookman'], [20, 'Boise State'], [21, 'Boston College'],
            [22, 'Bowling Green State'], [23, 'Brown'], [24, 'Bucknell'], [25, 'Buffalo'], [26, ''],
            [27, 'BYU'], [28, 'Cal Poly SLO'], [29, 'California'], [30, 'Cal State Northridge']
        ];

        collegeData.forEach(([id, name]) => {
            if (name && name.trim()) {
                LOOKUP_DATA.colleges.set(id, name.trim());
            }
        });

        // Load state data
        const stateData = [
            [0, 'Alabama'], [1, 'Alaska'], [2, 'Arizona'], [3, 'Arkansas'], [4, 'California'],
            [5, 'Colorado'], [6, 'Connecticut'], [7, 'Delaware'], [8, 'Florida'], [9, 'Georgia'],
            [10, 'Hawaii'], [11, 'Idaho'], [12, 'Illinois'], [13, 'Indiana'], [14, 'Iowa'],
            [15, 'Kansas'], [16, 'Kentucky'], [17, 'Louisiana'], [18, 'Maine'], [19, 'Maryland'],
            [20, 'Massachusetts'], [21, 'Michigan'], [22, 'Minnesota'], [23, 'Mississippi'],
            [24, 'Missouri'], [25, 'Montana'], [26, 'Nebraska'], [27, 'Nevada'], [28, 'New Hampshire'],
            [29, 'New Jersey'], [30, 'New Mexico'], [31, 'New York'], [32, 'North Carolina'],
            [33, 'North Dakota'], [34, 'Ohio'], [35, 'Oklahoma'], [36, 'Oregon'], [37, 'Pennsylvania'],
            [38, 'Rhode Island'], [39, 'South Carolina'], [40, 'South Dakota'], [41, 'Tennessee'],
            [42, 'Texas'], [43, 'Utah'], [44, 'Vermont'], [45, 'Virginia'], [46, 'Washington'],
            [47, 'West Virginia'], [48, 'Wisconsin'], [49, 'Wyoming'], [50, 'Non-US']
        ];

        stateData.forEach(([id, name]) => {
            if (name && name.trim()) {
                LOOKUP_DATA.states.set(id, name.trim());
            }
        });

        console.log('Lookup data loaded successfully');
        console.log(`Colleges: ${LOOKUP_DATA.colleges.size}, States: ${LOOKUP_DATA.states.size}`);

    } catch (error) {
        console.error('Failed to load lookup data:', error);
        // Fallback to basic mappings
        LOOKUP_DATA.colleges.set(0, 'Unknown');
        LOOKUP_DATA.states.set(0, 'Unknown');
    }
}

/**
 * Get lookup options for dropdown
 * @param {string} lookupType - Type of lookup (positions, teams, colleges, states)
 * @returns {Array} Array of options for dropdown
 */
export function getLookupOptions(lookupType) {
    switch (lookupType) {
        case 'positions':
            return Object.entries(POSITION_MAPPINGS).map(([value, label]) => ({ value: parseInt(value), label }));
        case 'teams':
            return Object.entries(TEAM_MAPPINGS).map(([value, label]) => ({ value: parseInt(value), label }));
        case 'colleges':
            return Array.from(LOOKUP_DATA.colleges.entries()).map(([value, label]) => ({ value, label }));
        case 'states':
            return Array.from(LOOKUP_DATA.states.entries()).map(([value, label]) => ({ value, label }));
        default:
            return [];
    }
}

/**
 * Get display value from lookup
 * @param {string} lookupType - Type of lookup
 * @param {number} value - The value to look up
 * @returns {string} Display name
 */
export function getLookupValue(lookupType, value) {
    switch (lookupType) {
        case 'positions':
            return POSITION_MAPPINGS[value] || 'Unknown';
        case 'teams':
            return TEAM_MAPPINGS[value] || 'Unknown';
        case 'colleges':
            return LOOKUP_DATA.colleges.get(value) || 'Unknown';
        case 'states':
            return LOOKUP_DATA.states.get(value) || 'Unknown';
        default:
            return 'Unknown';
    }
}

/**
 * Get field definition by name
 * @param {string} fieldName
 * @returns {object} Field definition or default
 */
export function getFieldDefinition(fieldName) {
    return MADDEN_FIELDS[fieldName] || {
        display: fieldName,
        type: 'numeric',
        editable: true,
        width: 80,
        min: 0,
        max: 99
    };
}

/**
 * Get fields for display based on mode
 * @param {boolean} showAll
 * @returns {Array} Array of field names
 */
export function getVisibleFields(showAll) {
    if (showAll) {
        return MADDEN_EXPORT_ORDER;
    }
    return BASIC_FIELDS;
}

/**
 * Validate field value
 * @param {string} fieldName
 * @param {any} value
 * @returns {object} {isValid: boolean, message?: string}
 */
export function validateFieldValue(fieldName, value) {
    const field = getFieldDefinition(fieldName);

    if (!field.editable) {
        return { isValid: false, message: 'Field is read-only' };
    }

    if (field.type === 'numeric') {
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
            return { isValid: false, message: 'Must be a number' };
        }
        if (field.min !== undefined && numValue < field.min) {
            return { isValid: false, message: `Must be at least ${field.min}` };
        }
        if (field.max !== undefined && numValue > field.max) {
            return { isValid: false, message: `Must be at most ${field.max}` };
        }
    }

    if (field.type === 'text' && (!value || value.trim().length === 0)) {
        return { isValid: false, message: 'Field cannot be empty' };
    }

    return { isValid: true };
}