/**
 * Madden Player Field Definitions
 * Complete field definitions with validation, types, and display names
 */

export const MADDEN_FIELDS = {
    // User-friendly fields based on FIELD_ORDER
    'PLNA': { display: 'Last Name', shortDisplay: 'Last Name', type: 'text', editable: true, width: 100 },
    'PFNA': { display: 'First Name', shortDisplay: 'First Name', type: 'text', editable: true, width: 100 },
    'PSXP': { display: 'Pic ID', shortDisplay: 'PID', type: 'numeric', editable: true, width: 60, min: 0, max: 10861 },
    'PLAYERPIC': { display: 'Player Pic', shortDisplay: 'Player Pic', type: 'autocomplete', editable: true, width: 180, lookup: 'pids' },
    'PEPS': { display: 'PAM', shortDisplay: 'PAM', type: 'text', editable: true, width: 180 },
    'PPOS': { display: 'Position', shortDisplay: 'POS', type: 'lookup', editable: true, width: 80, lookup: 'positions' },
    'PYRP': { display: 'Years Pro', shortDisplay: 'YRS', type: 'numeric', editable: true, width: 80, min: 0, max: 25 },
    'TGID': { display: 'Team', shortDisplay: 'Team', type: 'lookup', editable: true, width: 80, lookup: 'teams' },
    'PJEN': { display: 'Jersey Number', shortDisplay: 'JER', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PCOL': { display: 'College', shortDisplay: 'College', type: 'lookup', editable: true, width: 100, lookup: 'colleges' },
    'PAGE': { display: 'Age', shortDisplay: 'Age', type: 'numeric', editable: true, width: 60, min: 18, max: 45 },
    'PHTN': { display: 'Hometown', shortDisplay: 'Hometown', type: 'text', editable: true, width: 100 },
    'PHSN': { display: 'State', shortDisplay: 'State', type: 'lookup', editable: true, width: 120, lookup: 'states' },
    'PLRC': {
        display: 'Race',
        shortDisplay: 'Race',
        type: 'lookup',
        editable: true,
        width: 100,
        lookup: 'race',
        options: [
            { value: 1, display: '1' },
            { value: 2, display: '2' },
            { value: 3, display: '3' },
            { value: 4, display: '4' },
            { value: 5, display: '5' },
            { value: 6, display: '6' },
            { value: 7, display: '7' }
        ]
    },
    'PACC': { display: 'Acceleration', shortDisplay: 'ACC', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PAGI': { display: 'Agility', shortDisplay: 'AGI', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PAWR': { display: 'Awareness', shortDisplay: 'AWR', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PBKT': { display: 'Break Tackle', shortDisplay: 'BTK', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PBCV': { display: 'Ball Carrier Vision', shortDisplay: 'BCV', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PBSG': { display: 'Block Shedding', shortDisplay: 'BSH', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PBSK': { display: 'Break Sack', shortDisplay: 'BSK', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PCAR': { display: 'Carrying', shortDisplay: 'CAR', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLCI': { display: 'Catch in Traffic', shortDisplay: 'CIT', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PCTH': { display: 'Catching', shortDisplay: 'CTH', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PDRR': { display: 'Deep Route Running', shortDisplay: 'DRR', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PELU': { display: 'Change of Direction', shortDisplay: 'COD', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PFMS': { display: 'Finesse Moves', shortDisplay: 'FMV', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PLHT': { display: 'Hit Power', shortDisplay: 'POW', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLIB': { display: 'Impact Blocking', shortDisplay: 'IBL', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PINJ': { display: 'Injury', shortDisplay: 'INJ', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLJM': { display: 'Juke Move', shortDisplay: 'JKM', type: 'numeric', editable: true, width: 60, min: 0, max: 99 },
    'PJMP': { display: 'Jumping', shortDisplay: 'JMP', type: 'numeric', editable: true, width: 60, min: 0, max: 99 },
    'PKAC': { display: 'Kick Accuracy', shortDisplay: 'KAC', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PKPR': { display: 'Kick Power', shortDisplay: 'KPW', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PKRT': { display: 'Kick Return', shortDisplay: 'KR', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLBK': { display: 'Lead Block', shortDisplay: 'LBK', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLMC': { display: 'Man Coverage', shortDisplay: 'MCV', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PMRR': { display: 'Medium Route Running', shortDisplay: 'MRR', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PPBK': { display: 'Pass Blocking', shortDisplay: 'PBK', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PPBF': { display: 'Pass Block Finesse', shortDisplay: 'PBF', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PPBS': { display: 'Pass Block Strength', shortDisplay: 'PBS', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PPLA': { display: 'Play Action', shortDisplay: 'PAC', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PLPM': { display: 'Power Moves', shortDisplay: 'PMV', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PLPE': { display: 'Press', shortDisplay: 'PRS', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLPU': { display: 'Pursuit', shortDisplay: 'PUR', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLPR': { display: 'Play Recognition', shortDisplay: 'PRC', type: 'numeric', editable: true, width: 110, min: 0, max: 99 },
    'PLRL': { display: 'Release', shortDisplay: 'RLS', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PRBK': { display: 'Run Blocking', shortDisplay: 'RBK', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PRBF': { display: 'Run Block Finesse', shortDisplay: 'RBF', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PRBS': { display: 'Run Block Strength', shortDisplay: 'RBS', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'SRRN': { display: 'Short Route Running', shortDisplay: 'SRR', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLSC': { display: 'Spectacular Catch', shortDisplay: 'SPC', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PSPD': { display: 'Speed', shortDisplay: 'SPD', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLSM': { display: 'Spin Move', shortDisplay: 'SPM', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PSTA': { display: 'Stamina', shortDisplay: 'STA', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PLSA': { display: 'Stiff Arm', shortDisplay: 'SFA', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PSTR': { display: 'Strength', shortDisplay: 'STR', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PTAK': { display: 'Tackling', shortDisplay: 'TAK', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PTAD': { display: 'Throw Accuracy Deep', shortDisplay: 'TAD', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PTAM': { display: 'Throw Accuracy Mid', shortDisplay: 'TAM', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PTAS': { display: 'Throw Accuracy Short', shortDisplay: 'TAS', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PTOR': { display: 'Throw on the Run', shortDisplay: 'TOR', type: 'numeric', editable: true, width: 120, min: 0, max: 99 },
    'PTHP': { display: 'Throw Power', shortDisplay: 'THP', type: 'numeric', editable: true, width: 100, min: 0, max: 99 },
    'PTUP': { display: 'Throw Under Pressure', shortDisplay: 'TUP', type: 'numeric', editable: true, width: 140, min: 0, max: 99 },
    'PTGH': { display: 'Toughness', shortDisplay: 'TGH', type: 'numeric', editable: true, width: 90, min: 0, max: 99 },
    'PLTR': { display: 'Trucking', shortDisplay: 'TRK', type: 'numeric', editable: true, width: 70, min: 0, max: 99 },
    'PLZC': { display: 'Zone Coverage', shortDisplay: 'ZCV', type: 'numeric', editable: true, width: 110, min: 0, max: 99 },
    'PHGT': { display: 'Height', shortDisplay: 'HGT', type: 'numeric', editable: true, width: 70, min: 65, max: 85 },
    'PWGT': { display: 'Weight', shortDisplay: 'WGT', type: 'numeric', editable: true, width: 70, min: 160, max: 380, transform: { display: v => v + 160, save: v => v - 160 } },
    'PCBT': { display: 'Body Type', shortDisplay: 'Body', type: 'lookup', editable: true, width: 90, lookup: 'bodytypes' },
    'PHAN': { display: 'Handedness', shortDisplay: 'Hand', type: 'lookup', editable: true, width: 80, lookup: 'handedness' },
    'PROL': { display: 'Dev Trait', shortDisplay: 'Dev', type: 'lookup', editable: true, width: 100, lookup: 'devtraits' },

    // Contract fields (stored in hundreds of thousands, displayed in millions - divide by 100 for display, multiply by 100 when saving)
    'PCON': { display: 'Contract Years', shortDisplay: 'CON', type: 'numeric', editable: true, width: 80, min: 0, max: 7 },
    'PCYL': { display: 'Years Left', shortDisplay: 'LEFT', type: 'numeric', editable: true, width: 80, min: 0, max: 7 },

    // Per-year salary fields (PSA0-PSA6)
    'PSA0': { display: 'Salary Yr 1 ($M)', shortDisplay: 'SAL1', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },
    'PSA1': { display: 'Salary Yr 2 ($M)', shortDisplay: 'SAL2', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },
    'PSA2': { display: 'Salary Yr 3 ($M)', shortDisplay: 'SAL3', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },
    'PSA3': { display: 'Salary Yr 4 ($M)', shortDisplay: 'SAL4', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },
    'PSA4': { display: 'Salary Yr 5 ($M)', shortDisplay: 'SAL5', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },
    'PSA5': { display: 'Salary Yr 6 ($M)', shortDisplay: 'SAL6', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },
    'PSA6': { display: 'Salary Yr 7 ($M)', shortDisplay: 'SAL7', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },

    // Calculated total salary (sum of PSA0-PSA6)
    'TOTAL_SALARY': { display: 'Total Salary ($M)', shortDisplay: 'TOT SAL', type: 'calculated', editable: false, width: 110, calculate: (player) => {
        const years = ['PSA0', 'PSA1', 'PSA2', 'PSA3', 'PSA4', 'PSA5', 'PSA6'];
        const total = years.reduce((sum, field) => sum + (player[field] || 0), 0);
        return Math.round(total / 100); // Convert to millions
    }},

    'PSBO': { display: 'Signing Bonus ($M)', shortDisplay: 'BONUS', type: 'numeric', editable: true, width: 100, min: 0, max: 999, transform: { display: v => v / 100, save: v => v * 100 } },

    // Additional system fields
    'PGID': { display: 'Player ID', shortDisplay: 'ID', type: 'numeric', editable: false, width: 80, min: 0, max: 99999 },
    'POVR': { display: 'Overall Rating', shortDisplay: 'OVR', type: 'numeric', editable: false, width: 70, min: 0, max: 99 },
    'POID': { display: 'Presentation ID', shortDisplay: 'POID', type: 'numeric', editable: true, width: 80, min: 0, max: 99999 },

    // Draft class specific fields
    'PDPI': { display: 'Draft Position', shortDisplay: 'Draft Pos', type: 'numeric', editable: true, width: 90, min: 0, max: 500 },
    'PDRO': { display: 'Draft Rank', shortDisplay: 'Rank', type: 'numeric', editable: false, width: 80, min: 0, max: 500 },

    // Archetype (editable lookup field - converts between archetype ID and name)
    // Uses PLTY (Player Type) field from roster files, options depend on player position
    'ARCHETYPE': {
        display: 'Archetype',
        shortDisplay: 'Archetype',
        type: 'archetype',  // Special type for position-dependent archetype dropdown
        editable: true,
        width: 200,
        underlyingField: 'PLTY'  // The actual field that stores the archetype ID
    },

    // Birthday (calculated field - converts birthdate integer to MM/DD/YYYY format)
    // Uses PLBD (Birthday) field from roster files
    'BIRTHDAY': { display: 'Birthday', shortDisplay: 'Birthday', type: 'calculated', editable: false, width: 100, calculate: async (player) => {
        if (player.PLBD && player.PLBD > 0) {
            try {
                return await window.electronAPI.rating.birthdayToDisplay(player.PLBD);
            } catch (e) {
                return '';
            }
        }
        return '';
    }}
};

// Field order for user-friendly editing (Madden game order)
export const FIELD_ORDER = [
    ["PLNA", "Last Name"], ["PFNA", "First Name"], ["PSXP", "Pic ID"], ["PLAYERPIC", "Player Pic"], ["PEPS", "PAM"], ["POID", "Pres ID"],
    ["PPOS", "Position"], ["TGID", "Team"], ["PJEN", "Jersey #"], ["PCOL", "College"],
    ["PAGE", "Age"], ["ARCHETYPE", "Archetype"], ["PHTN", "Hometown"], ["PHSN", "State"], ["PLRC", "Race"],
    ["PHGT", "Height"], ["PWGT", "Weight"], ["PCBT", "Body Type"], ["PHAN", "Handedness"], ["PYRP", "Years Pro"], ["PROL", "Dev Trait"],
    ["POVR", "Overall"],
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
    ["PTUP", "Throw Under Pressure"], ["PTGH", "Toughness"], ["PLTR", "Truck"], ["PLZC", "Zone Coverage"]
];

// Contract fields - only shown in player card, not in main editor grid
export const CONTRACT_FIELDS = [
    ["PCON", "Contract Years"], ["PCYL", "Years Left"], ["TOTAL_SALARY", "Total Salary"], ["PSBO", "Signing Bonus"],
    ["PSA0", "Salary Yr 1"], ["PSA1", "Salary Yr 2"], ["PSA2", "Salary Yr 3"], ["PSA3", "Salary Yr 4"],
    ["PSA4", "Salary Yr 5"], ["PSA5", "Salary Yr 6"], ["PSA6", "Salary Yr 7"]
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
    "PSB3", "PICN", "PHAN", "PSA4", "PSB4", "PSA5", "PSA6", "PSB5", "PSB6", "PLRC"
];

// Basic fields for default view (user-friendly editing fields only)
export const BASIC_FIELDS = FIELD_ORDER.map(field => field[0]);

// Position field mappings (simplified position names to internal codes)
export const POSITION_MAPPINGS = {
    0: 'QB', 1: 'HB', 2: 'WR', 3: 'TE', 4: 'LT', 5: 'LG', 6: 'C', 7: 'RG', 8: 'RT',
    9: 'DT', 10: 'LEDG', 11: 'REDG', 12: 'SAM', 13: 'Mike', 14: 'WILL', 15: 'CB',
    16: 'FS', 17: 'SS', 18: 'K', 19: 'P'
};

// Team mappings - matches team_lookup.csv TGID values (1-32)
export const TEAM_MAPPINGS = {
    1: 'CHI',   // Bears
    2: 'CIN',   // Bengals
    3: 'BUF',   // Bills
    4: 'DEN',   // Broncos
    5: 'CLE',   // Browns
    6: 'TB',    // Buccs
    7: 'ARI',   // Cards
    8: 'LAC',   // Chargers
    9: 'KC',    // Chiefs
    10: 'IND',  // Colts
    11: 'DAL',  // Cowboys
    12: 'MIA',  // Dolphins
    13: 'PHI',  // Eagles
    14: 'ATL',  // Falcons
    15: 'SF',   // 49ers
    16: 'NYG',  // Giants
    17: 'JAX',  // Jags
    18: 'NYJ',  // Jets
    19: 'DET',  // Lions
    20: 'GB',   // Packers
    21: 'CAR',  // Panthers
    22: 'NE',   // Pats
    23: 'LV',   // Raiders
    24: 'LAR',  // Rams
    25: 'BAL',  // Ravens
    26: 'WAS',  // Commanders
    27: 'NO',   // Saints
    28: 'SEA',  // Seahawks
    29: 'PIT',  // Steelers
    30: 'TEN',  // Titans
    31: 'MIN',  // Vikings
    32: 'HOU',  // Texans
    1009: 'FA'  // Free Agent
};

// Lookup data storage - exported for use in other modules
export let LOOKUP_DATA = {
    colleges: new Map(),
    states: new Map(),
    positions: new Map(),
    teams: new Map(),
    pids: new Map(),
    pidsByName: new Map(),
    pidsCapitalized: new Map(), // Maps PID -> Capitalized Name
    allPlayers: [], // Array of all players [{name, pid, hasPid, plpo}] for full-text search
    plpos: new Map(), // Maps PID -> PLPO key (for portraits)
    plpoToPid: new Map(), // Maps PLPO key -> PID (REVERSE lookup for generic faces)
    pidNames: new Map(), // Maps PID -> { firstName, lastName, fullName } (for Photo Name column)
    devtraits: new Map([
        [0, 'Normal'],
        [1, 'Star'],
        [2, 'Superstar'],
        [3, 'X-Factor']
    ]),
    bodytypes: new Map([
        [0, 'Standard'],
        [1, 'Thin'],
        [2, 'Muscular'],
        [3, 'Heavy'],
        [4, 'Lean']
    ]),
    races: new Map([
        [1, '1'],
        [2, '2'],
        [3, '3'],
        [4, '4'],
        [5, '5'],
        [6, '6'],
        [7, '7']
    ]),
    handedness: new Map([
        [0, 'Right'],
        [1, 'Left']
    ])
};

/**
 * Capitalize each word in a name
 * @param {string} name - Name to capitalize
 * @returns {string} Capitalized name
 */
function capitalizeName(name) {
    if (!name) return name;
    return name.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

/**
 * Load lookup data from CSV files
 */
export async function loadLookupData() {
    try {
        // Load PID data (embedded sample data - working demonstration)
        // PID data will be loaded via IPC from ALLDATA_Lookup.csv (see below)

        // For now, use static data since file loading might have path issues
        // Complete college data from college_lookup.csv (493 colleges)
        const collegeData = [
            [0, 'Blank'], [1, 'Abilene Christian'], [2, 'Air Force'], [3, 'Akron'], [4, 'Alabama'],
            [5, 'Alabama A&M'], [6, 'Alabama State'], [7, 'Alcorn State'], [8, 'Appalachian State'],
            [9, 'Arizona'], [10, 'Arizona State'], [11, 'Arkansas'], [12, 'Arkansas Pine Bluff'],
            [13, 'Arkansas State'], [14, 'Army'], [15, 'Auburn'], [16, 'Austin Peay'], [17, 'Ball State'],
            [18, 'Baylor'], [19, 'Beth Cookman'], [20, 'Boise State'], [21, 'Boston College'],
            [22, 'Bowling Green State'], [23, 'Brown'], [24, 'Bucknell'], [25, 'Buffalo'],
            [27, 'BYU'], [28, 'Cal Poly SLO'], [29, 'California'], [30, 'Cal State Northridge'],
            [31, 'Malone'], [32, 'Canisus'], [34, 'Eastern Michigan'], [35, 'Central State (OH)'],
            [37, 'Cincinnati'], [38, 'Citadel'], [39, 'Clemson'], [41, 'Colgate'], [42, 'Colorado'],
            [43, 'Colorado State'], [45, 'Cornell'], [46, 'Culver-Stockton'], [47, 'Dartmouth'],
            [49, 'Dayton'], [50, 'Delaware'], [51, 'Delaware State'], [52, 'Drake'], [53, 'Duke'],
            [54, 'Duquesne'], [55, 'Mississippi State'], [56, 'Eastern Illinois'], [57, 'Eastern Kentucky'],
            [58, 'East Tennessee State'], [59, 'East Carolina'], [60, 'Eastern Washington'], [61, 'Elon University'],
            [63, 'Florida'], [64, 'Florida A&M'], [65, 'Florida State'], [66, 'Fordham'], [67, 'Fresno State'],
            [68, 'Furman'], [69, 'Georgia Southern'], [71, 'Georgia'], [72, 'Georgia Tech'], [73, 'Grambling State'],
            [74, 'Grand Valley State'], [75, 'Hampton'], [76, 'Harvard'], [77, 'Hawaii'], [78, 'Henderson State'],
            [80, 'Holy Cross'], [81, 'Houston'], [82, 'Howard'], [83, 'Idaho'], [84, 'Idaho State'],
            [85, 'Illinois'], [86, 'Illinois State'], [87, 'Indiana'], [88, 'Indiana State'], [90, 'Iowa'],
            [91, 'Iowa State'], [92, 'James Madison'], [93, 'Jackson State'], [94, 'Jacksonville State'],
            [96, 'Kansas'], [97, 'Kansas State'], [98, 'Kent State'], [99, 'Kentucky'], [100, 'Kutztown'],
            [102, 'LA Tech'], [104, 'Lehigh'], [105, 'Liberty'], [106, 'Louisville'], [107, 'LSU'],
            [108, 'Mississippi Valley State'], [109, 'Maine'], [110, 'Marist'], [111, 'Marshall'], [112, 'Maryland'],
            [113, 'Massachusetts'], [114, 'McNeese State'], [115, 'Memphis'], [116, 'Miami'], [117, 'Miami of Ohio'],
            [118, 'Michigan'], [119, 'Michigan State'], [120, 'Middle Tennessee State'], [121, 'Minnesota'],
            [122, 'North Carolina'], [123, 'Missouri'], [125, 'Montana'], [126, 'Montana State'],
            [127, 'Morehead State'], [129, 'Morgan State'], [132, 'Murray State'], [133, 'North Alabama'],
            [134, 'Northern Arizona'], [135, 'Tennessee'], [136, 'South Carolina'], [137, 'Northern Colorado'],
            [138, 'Northern Illinois'], [139, 'NC State'], [140, 'Navy'], [141, 'North Carolina Central'],
            [143, 'Nebraska'], [144, 'Nevada'], [145, 'New Mexico State'], [146, 'New Mexico'],
            [147, 'Nicholls State'], [148, 'Norfolk State'], [149, 'North Texas'], [150, 'Northeastern'],
            [151, 'Northern Iowa'], [152, 'Northwestern'], [153, 'Notre Dame'], [155, 'Uni. Arkansas Monticello'],
            [156, 'Ohio'], [157, 'Ohio State'], [158, 'Oklahoma'], [159, 'Oklahoma State'], [160, 'Ole Miss'],
            [161, 'Oregon'], [162, 'Oregon State'], [163, 'Prairie View A&M'], [164, 'Penn'], [165, 'Penn State'],
            [166, 'Pittsburgh State'], [167, 'Pittsburgh'], [168, 'Portland State'], [169, 'Princeton'],
            [170, 'Purdue'], [171, 'Rhode Island'], [172, 'Rice'], [173, 'Richmond'], [175, 'Rowan'],
            [176, 'Rutgers'], [177, 'Augustana'], [178, 'South Dakota State'], [179, 'Southern Illinois'],
            [180, 'South Carolina State'], [181, 'San Diego State'], [182, 'Wagner College'], [183, 'Sacred Heart'],
            [184, 'Sam Houston'], [185, 'Samford'], [186, 'San Jose State'], [187, 'Savannah State'],
            [189, 'SE Missouri State'], [190, 'Shippensburg'], [193, 'SMU'], [194, 'Southern'],
            [195, 'Southern Miss'], [196, 'Southern Utah'], [198, "St. John's"], [199, "St. Mary's"],
            [201, 'Stanford'], [202, 'Stony Brook'], [205, 'Southern Arkansas'], [206, 'Syracuse'],
            [207, 'Texas A&M Kingsville'], [208, 'TCU'], [209, 'Temple'], [211, 'Tenn-Chattanooga'],
            [212, 'Tennessee'], [213, 'Tennessee State'], [214, 'Tenn-Martin'], [215, 'Texas'],
            [216, 'Texas A&M'], [217, 'Texas Southern'], [218, 'Texas Tech'], [219, 'Toledo'],
            [220, 'Towson'], [221, 'Troy'], [222, 'Tulane'], [223, 'Tulsa'], [225, 'UAB'], [226, 'UCF'],
            [227, 'UCLA'], [228, 'Connecticut'], [229, 'UL Lafayette'], [230, 'UL Monroe'], [231, 'UNLV'],
            [232, 'USC'], [233, 'USF'], [234, 'Utah'], [235, 'Utah State'], [236, 'UTEP'],
            [237, 'Valdosta State'], [239, 'Vanderbilt'], [240, 'Villanova'], [241, 'Virginia'],
            [242, 'Virginia Tech'], [244, 'W. Carolina'], [245, 'W. Illinois'], [246, 'W. Kentucky'],
            [247, 'W. Michigan'], [248, 'W. Texas A&M'], [250, 'Wake Forest'], [252, 'Washington State'],
            [253, 'Washington'], [254, 'Weber State'], [255, 'West Virginia'], [257, 'William & Mary'],
            [258, 'Winston Salem'], [259, 'Wisconsin'], [261, 'Wyoming'], [262, 'Yale'], [263, 'Youngstown State'],
            [264, 'Sonoma State'], [265, 'No College'], [266, 'New Hampshire'], [267, 'UW La Crosse'],
            [270, 'North Dakota'], [271, 'Wayne State'], [273, 'IUP'], [274, 'Saginaw Valley'],
            [276, 'Emporia State'], [277, 'Wingate'], [279, 'W. New Mexico'], [280, 'Albany'],
            [282, 'Bloomsburg'], [283, 'Central Michigan'], [286, 'UC Davis'], [287, 'Carson-Newman'],
            [288, 'Central Arkansas'], [289, 'Berry College'], [290, 'Coastal Carolina'], [291, 'Tusculum College'],
            [296, 'Ferris State'], [297, 'FIU'], [298, 'Delta State'], [299, 'Fort Valley State'],
            [300, 'Gardner-Webb'], [302, 'Lafayette'], [303, 'Lane'], [306, 'Mesa State'], [307, 'California (PA)'],
            [308, 'FAU'], [310, 'Missouri State'], [311, 'Missouri Western State'], [312, 'Mount Union'],
            [314, 'None'], [315, 'North Dakota State'], [316, 'Northern State'], [317, 'NW Missouri State'],
            [323, 'Regina'], [324, 'Lindenwood'], [325, 'Sacramento State'], [327, 'San Diego'],
            [328, 'South Dakota'], [330, 'SE Louisiana'], [332, 'Texas State'], [334, 'Tarleton State'],
            [335, 'Truman State'], [337, 'Virginia Union'], [338, 'Washburn'], [342, 'West Georgia'],
            [343, 'Wisc-Whitewater'], [346, 'Western Ontario'], [348, 'Manitoba'], [350, 'Western Oregon'],
            [351, 'Tiffin'], [353, 'Stephen F. Austin'], [355, 'UTSA'], [359, 'Newberry College'],
            [360, 'Ashland'], [362, 'Georgia State'], [364, 'Bowie State'], [370, 'Ouachita Baptist'],
            [373, 'Fort Hays State'], [377, 'Humboldt State'], [378, 'CSU-Pueblo'], [379, 'South Alabama'],
            [380, 'Old Dominion'], [382, 'West Alabama'], [384, 'East Central University'], [385, 'Central Missouri'],
            [390, 'Minnesota State'], [391, 'Assumption'], [394, 'Bemidji State'], [395, 'Shepherd University'],
            [400, 'Texas A&M-Commerce'], [406, 'Fayetteville State'], [410, 'Campbell University'],
            [411, 'Northern Michigan'], [418, 'Findlay'], [423, 'Charlotte'], [428, 'Charleston'],
            [429, 'Greenville College'], [434, 'Stetson'], [436, 'Virginia Commonwealth'], [439, 'Azusa Pacific'],
            [440, 'Western Colorado'], [441, 'Dubuque'], [445, 'Univ. British Columbia'], [447, 'Sioux Falls'],
            [448, 'East Texas Baptist'], [462, 'Kennesaw State'], [463, 'Missouri S&T'], [464, 'Lenoir-Rhyne'],
            [466, 'Alberta'], [468, 'Adams State'], [476, 'Friends University'], [478, 'Livingstone College'],
            [480, 'Houston Baptist'], [484, 'West Florida'], [487, 'York University'], [488, 'Albany State'],
            [489, 'Bryant'], [490, 'Baldwin Wallace'], [491, 'Houston Christian'], [492, 'Minot State'],
            [493, 'Barton']
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

        // Load position data from position_lookup.csv
        const positionData = [
            [0, 'QB'], [1, 'HB'], [2, 'FB'], [3, 'WR'], [4, 'TE'],
            [5, 'LT'], [6, 'LG'], [7, 'C'], [8, 'RG'], [9, 'RT'],
            [10, 'LEDG'], [11, 'REDG'], [12, 'DT'], [13, 'SAM'],
            [14, 'Mike'], [15, 'WILL'], [16, 'CB'], [17, 'FS'],
            [18, 'SS'], [19, 'K'], [20, 'P'], [21, 'LS']
        ];

        positionData.forEach(([id, name]) => {
            if (name && name.trim()) {
                LOOKUP_DATA.positions.set(id, name.trim());
            }
        });

        // Load team data from team_lookup.csv
        const teamData = [
            [1, 'Bears'], [2, 'Bengals'], [3, 'Bills'], [4, 'Broncos'],
            [5, 'Browns'], [6, 'Buccs'], [7, 'Cards'], [8, 'Chargers'],
            [9, 'Cheifs'], [10, 'Colts'], [11, 'Cowboys'], [12, 'Dolphins'],
            [13, 'Eagles'], [14, 'Falcons'], [15, '49ers'], [16, 'Giants'],
            [17, 'Jags'], [18, 'Jets'], [19, 'Lions'], [20, 'Packers'],
            [21, 'Panthers'], [22, 'Pats'], [23, 'Raiders'], [24, 'Rams'],
            [25, 'Ravens'], [26, 'Commanders'], [27, 'Saints'], [28, 'Seahawks'],
            [29, 'Steelers'], [30, 'Titans'], [31, 'Vikings'], [32, 'Texans'],
            [1009, 'Free Agent']
        ];

        teamData.forEach(([id, name]) => {
            if (name && name.trim()) {
                LOOKUP_DATA.teams.set(id, name.trim());
            }
        });

        // Load PID data from ALLDATA_Lookup.csv using IPC lookup handler
        console.log('Loading PID lookup data via IPC...');

        try {
            const pidOptions = await window.electronAPI.lookup.getDropdownOptions('ALLDATA_Lookup.csv');

            console.log(`Loaded ${pidOptions.length} PID lookups from lookup service`);

            // Reset allPlayers array
            LOOKUP_DATA.allPlayers = [];
            let withPid = 0;
            let withoutPid = 0;

            // Populate maps from the lookup options (skip entries with missing labels)
            pidOptions.forEach(option => {
                if (option.label && option.label.trim()) {
                    const capitalizedName = capitalizeName(option.label);
                    const hasPid = option.hasPid !== false && option.value > 0;

                    // Store ALL players for searching (with or without PID)
                    LOOKUP_DATA.allPlayers.push({
                        name: option.label,
                        nameCapitalized: capitalizedName,
                        nameLower: option.label.toLowerCase(),
                        pid: option.value,
                        hasPid: hasPid,
                        plpo: option.plpo || ''
                    });

                    // Only populate PID maps for players WITH valid PIDs
                    if (hasPid) {
                        LOOKUP_DATA.pids.set(option.value, option.label); // Keep original for backward compat
                        LOOKUP_DATA.pidsCapitalized.set(option.value, capitalizedName); // Capitalized version
                        LOOKUP_DATA.pidsByName.set(option.label.toLowerCase(), option.value); // Lowercase key for lookup
                        withPid++;
                    } else {
                        withoutPid++;
                    }
                }
            });

            console.log(`Processed ${LOOKUP_DATA.pids.size} PID lookups (${withPid} with PID, ${withoutPid} without PID)`);
            console.log(`Total players in allPlayers array: ${LOOKUP_DATA.allPlayers.length}`);

            // Debug: Find Dobbs entries
            const dobbsEntries = LOOKUP_DATA.allPlayers.filter(p => p.nameLower.includes('dobbs'));
            console.log(`Found ${dobbsEntries.length} Dobbs entries:`, dobbsEntries);
        } catch (error) {
            console.error('Failed to load PID lookup:', error);
        }

        // Load PLPO data from ALLDATA_Lookup.csv for portrait mapping
        console.log('Loading PLPO lookup data via IPC...');

        try {
            const plpoOptions = await window.electronAPI.lookup.getDropdownOptions('ALLDATA_Lookup.csv');

            console.log(`Loaded ${plpoOptions.length} PLPO entries from ALLDATA lookup`);

            // Populate plpos map (PID -> PLPO key) AND reverse map (PLPO -> PID)
            // ALSO populate PID -> Name mapping for Photo Name column
            plpoOptions.forEach(option => {
                // option.value is PhotoID (PID), option.plpo is the PLPO key
                if (option.plpo && option.plpo.trim()) {
                    const plpoKey = option.plpo.trim();
                    LOOKUP_DATA.plpos.set(option.value, plpoKey);
                    LOOKUP_DATA.plpoToPid.set(plpoKey, option.value); // REVERSE lookup
                }

                // Store PID -> Name mapping (firstName, lastName from label which is "LastName, FirstName")
                if (option.label && option.value) {
                    const [lastName, firstName] = option.label.split(',').map(s => s.trim());
                    LOOKUP_DATA.pidNames.set(option.value, {
                        firstName: firstName || '',
                        lastName: lastName || '',
                        fullName: firstName ? `${firstName} ${lastName}` : lastName
                    });
                }
            });

            console.log(`Processed ${LOOKUP_DATA.plpos.size} PLPO mappings from FullData_Lookup`);
            console.log(`Processed ${LOOKUP_DATA.plpoToPid.size} PLPO->PID reverse mappings from FullData_Lookup`);
            console.log(`Processed ${LOOKUP_DATA.pidNames.size} PID->Name mappings from FullData_Lookup`);
        } catch (error) {
            console.error('Failed to load PLPO lookup:', error);
        }

        // Load PID_Portrait_Mapping.csv (combined file with PID, Name, Type, Portrait)
        try {
            const pidPortraitMapping = await window.electronAPI.lookup.getPIDPortraitMapping();
            console.log(`Loaded ${pidPortraitMapping.length} entries from PID_Portrait_Mapping.csv`);

            let addedCount = 0;
            let skippedCount = 0;

            pidPortraitMapping.forEach(mapping => {
                // Only add if PID is NOT already mapped (preserves real player portraits from ALL_PLAYER_LOOKUP)
                if (!LOOKUP_DATA.plpos.has(mapping.pid)) {
                    LOOKUP_DATA.plpos.set(mapping.pid, mapping.portrait);
                    LOOKUP_DATA.plpoToPid.set(mapping.portrait, mapping.pid);
                    addedCount++;
                } else {
                    skippedCount++;
                }

                // Add name mapping for ALL PIDs (from combined file)
                if (!LOOKUP_DATA.pidNames.has(mapping.pid)) {
                    LOOKUP_DATA.pidNames.set(mapping.pid, {
                        firstName: '',  // Combined file only has full name
                        lastName: '',
                        fullName: mapping.name
                    });
                }
            });

            console.log(`Added ${addedCount} PIDs from PID_Portrait_Mapping.csv`);
            console.log(`Skipped ${skippedCount} PIDs (already mapped to real players)`);
            console.log(`Loaded ${LOOKUP_DATA.pidNames.size} PID -> Name mappings`);
        } catch (error) {
            console.error('Failed to load PID_Portrait_Mapping.csv:', error);
        }

        console.log(`Total PLPO mappings: ${LOOKUP_DATA.plpos.size}`);
        console.log(`Total PLPO->PID reverse mappings: ${LOOKUP_DATA.plpoToPid.size}`);

        console.log('Lookup data loaded successfully');
        console.log(`Colleges: ${LOOKUP_DATA.colleges.size}, States: ${LOOKUP_DATA.states.size}, PIDs: ${LOOKUP_DATA.pids.size}, PLPOs: ${LOOKUP_DATA.plpos.size}`);

        // Expose LOOKUP_DATA on window for two-way PID sync
        window.lookupData = LOOKUP_DATA;

    } catch (error) {
        console.error('Failed to load lookup data:', error);
        // Fallback to basic mappings
        LOOKUP_DATA.colleges.set(0, 'Unknown');
        LOOKUP_DATA.states.set(0, 'Unknown');

        // Still expose on window even with fallback
        window.lookupData = LOOKUP_DATA;
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
            return Array.from(LOOKUP_DATA.positions.entries()).map(([value, label]) => ({ value, label }));
        case 'teams':
            return Array.from(LOOKUP_DATA.teams.entries()).map(([value, label]) => ({ value, label }));
        case 'colleges':
            return Array.from(LOOKUP_DATA.colleges.entries()).map(([value, label]) => ({ value, label }));
        case 'states':
            return Array.from(LOOKUP_DATA.states.entries()).map(([value, label]) => ({ value, label }));
        case 'pids':
            return Array.from(LOOKUP_DATA.pids.entries()).map(([value, label]) => ({ value, label }));
        case 'devtraits':
            return Array.from(LOOKUP_DATA.devtraits.entries()).map(([value, label]) => ({ value, label }));
        case 'bodytypes':
            return Array.from(LOOKUP_DATA.bodytypes.entries()).map(([value, label]) => ({ value, label }));
        case 'handedness':
            return Array.from(LOOKUP_DATA.handedness.entries()).map(([value, label]) => ({ value, label }));
        case 'race':
        case 'races':
            return Array.from(LOOKUP_DATA.races.entries()).map(([value, label]) => ({ value, label }));
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
            return LOOKUP_DATA.positions.get(value) || 'Unknown';
        case 'teams':
            return LOOKUP_DATA.teams.get(value) || 'Unknown';
        case 'colleges':
            return LOOKUP_DATA.colleges.get(value) || 'Unknown';
        case 'states':
            return LOOKUP_DATA.states.get(value) || 'Unknown';
        case 'pids':
            return LOOKUP_DATA.pids.get(value) || 'Generic Name';
        case 'bodytypes':
            return LOOKUP_DATA.bodytypes.get(value) || 'Unknown';
        case 'handedness':
            return LOOKUP_DATA.handedness.get(value) || 'Right';
        case 'devtraits':
            return LOOKUP_DATA.devtraits.get(value) || 'Normal';
        case 'race':
        case 'races':
            return LOOKUP_DATA.races.get(value) || 'Unknown';
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
    const fieldDef = MADDEN_FIELDS[fieldName] || {
        display: fieldName,
        type: 'numeric',
        editable: true,
        width: 80,
        min: 0,
        max: 99
    };

    // Populate options array from LOOKUP_DATA for dropdown fields
    if (fieldDef.type === 'lookup' && fieldDef.lookup && !fieldDef.options) {
        const lookupMap = LOOKUP_DATA[fieldDef.lookup];
        if (lookupMap && lookupMap.size > 0) {
            fieldDef.options = [];
            lookupMap.forEach((displayName, id) => {
                fieldDef.options.push({
                    value: id,
                    display: displayName
                });
            });
        }
    }

    return fieldDef;
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
        // Allow empty/null/undefined for numeric fields - treat as 0
        if (value === '' || value === null || value === undefined) {
            return { isValid: true };
        }

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

/**
 * Get PID from player name (for autocomplete)
 * @param {string} playerName - Player name to search for
 * @returns {number|null} PID or null if not found
 */
export function getPIDFromName(playerName) {
    if (!playerName) return null;
    return LOOKUP_DATA.pidsByName.get(playerName.toLowerCase()) || null;
}

/**
 * Get PID from PLPO key (reverse lookup)
 * @param {string} plpo - PLPO key to look up
 * @returns {number|null} PID or null if not found
 */
export function getPIDFromPLPO(plpo) {
    if (!plpo || typeof plpo !== 'string') return null;

    // Try exact match first
    let pid = LOOKUP_DATA.plpoToPid.get(plpo);
    if (pid) return pid;

    // Try removing common suffixes (_morphed, _portrait, etc.)
    const suffixes = ['_morphed', '_portrait', '_base'];
    for (const suffix of suffixes) {
        if (plpo.endsWith(suffix)) {
            const basePlpo = plpo.substring(0, plpo.length - suffix.length);
            pid = LOOKUP_DATA.plpoToPid.get(basePlpo);
            if (pid) return pid;
        }
    }

    return null;
}

/**
 * Get player name from PID
 * @param {number} pid - PID to look up
 * @returns {string} Player name or 'Generic Name'
 */
export function getPlayerNameFromPID(pid) {
    // If PID is 0, return blank (no player assigned)
    if (!pid || pid === 0) {
        return '';
    }

    // Check PID_lookup.csv for player name
    const nameData = LOOKUP_DATA.pidNames.get(pid);

    // Debug logging for first 5 lookups
    if (!window._pidLookupCount) window._pidLookupCount = 0;
    if (window._pidLookupCount < 5) {
        console.log(`[getPlayerNameFromPID] PID=${pid}, nameData="${nameData?.fullName}", pidNames.size=${LOOKUP_DATA.pidNames.size}`);
        window._pidLookupCount++;
    }

    if (nameData && nameData.fullName) {
        return nameData.fullName;
    }

    // If PID not found in ALL_PLAYER_LOOKUP, check PLPO
    const plpo = LOOKUP_DATA.plpos.get(pid);
    if (plpo && typeof plpo === 'string') {
        // Check if it's a generic face (handles both "gen_X_X_XXX" and "plpo_generic_X_XXX" formats)
        if (plpo.startsWith('gen_') || plpo.includes('generic')) {
            // Generic faces should show "Generic Face" in Player Pic column
            return 'Generic Face';
        }

        // Real player with portrait but not in lookup - extract name from PLPO
        // e.g., "plpo_CodringtonBrandon" → "Codrington Brandon"
        const nameMatch = plpo.match(/plpo_(.+)/);
        if (nameMatch) {
            const camelCase = nameMatch[1];
            // Split camelCase: "CodringtonBrandon" → "Codrington Brandon"
            const name = camelCase.replace(/([A-Z])/g, ' $1').trim();
            return name;
        }
    }

    // If no mapping found at all, return default
    return 'Generic Face';
}

/**
 * Search PID names for autocomplete
 * @param {string} query - Search query
 * @param {number} limit - Max results to return
 * @returns {Array} Array of matching player names
 */
export function searchPIDNames(query, limit = 10) {
    if (!query || query.trim().length < 2) return [];

    const lowercaseQuery = query.toLowerCase();
    const matches = [];

    // Search through players WITH PIDs only
    for (const player of LOOKUP_DATA.allPlayers) {
        if (player.hasPid && player.nameLower.includes(lowercaseQuery)) {
            matches.push({
                name: player.name,
                pid: player.pid,
                hasPid: player.hasPid,
                plpo: player.plpo
            });
            if (matches.length >= limit) break;
        }
    }

    // Sort alphabetically
    return matches.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Body Type / Weight Linking Utility
 *
 * Body Type Codes:
 *   0 = Standard (default for skill positions)
 *   1 = Thin (K, P)
 *   2 = Muscular (TE, FB, EDGE)
 *   3 = Heavy (OL, DT)
 *   4 = Lean (slim athletic players)
 *
 * PWGT is stored as: actualWeight - 160
 * So stored 38 = actual 198 lbs
 */

// Body type to default ACTUAL weight mapping (in lbs)
export const BODY_TYPE_WEIGHTS = {
    0: 220,   // Standard: 220 lbs (QB, WR, HB, CB, FS, SS, LB default)
    1: 200,   // Thin: 200 lbs (K, P default)
    2: 250,   // Muscular: 250 lbs (TE, FB, EDGE default)
    3: 300,   // Heavy: 300 lbs (OL, DT default)
    4: 195    // Lean: 195 lbs (slim athletic players)
};

// Body type names for logging
export const BODY_TYPE_NAMES = {
    0: 'Standard',
    1: 'Thin',
    2: 'Muscular',
    3: 'Heavy',
    4: 'Lean'
};

/**
 * Determine body type from actual weight (in pounds)
 * @param {number} actualWeight - Player weight in pounds
 * @param {number|string} position - Position code or name (optional, for context)
 * @returns {number} Body type code (0-4)
 */
export function getBodyTypeFromWeight(actualWeight, position = null) {
    // Position names that should always be Thin
    const thinPositions = ['K', 'P', 19, 20];
    // Position names that should always be Heavy
    const heavyPositions = ['LT', 'LG', 'C', 'RG', 'RT', 'DT', 5, 6, 7, 8, 9, 12];
    // Position names that tend to be Muscular
    const muscularPositions = ['TE', 'FB', 'LEDG', 'REDG', 'LE', 'RE', 4, 2, 10, 11];

    // If position is provided and is a specialty position, use position-based logic
    if (position !== null) {
        if (thinPositions.includes(position)) {
            return 1; // Thin for K/P
        }
        if (heavyPositions.includes(position)) {
            return actualWeight >= 330 ? 3 : 3; // Always Heavy for OL/DT
        }
        if (muscularPositions.includes(position)) {
            return actualWeight >= 280 ? 3 : 2; // Heavy if really big, else Muscular
        }
    }

    // Weight-based body type determination (for skill positions and general use)
    if (actualWeight < 190) {
        return 4; // Lean for very light players
    } else if (actualWeight < 215) {
        return 0; // Standard for average skill position weight
    } else if (actualWeight < 250) {
        return 0; // Standard for typical QB/LB weight
    } else if (actualWeight < 280) {
        return 2; // Muscular for bigger players
    } else {
        return 3; // Heavy for 280+ lbs
    }
}

/**
 * Get the default actual weight for a body type
 * @param {number} bodyType - Body type code (0-4)
 * @param {number|string} position - Position code or name (optional, for position-specific defaults)
 * @returns {number} Default actual weight in pounds
 */
export function getWeightFromBodyType(bodyType, position = null) {
    // Position-specific heavy weights
    const olDtPositions = ['LT', 'LG', 'C', 'RG', 'RT', 'DT', 5, 6, 7, 8, 9, 12];

    if (bodyType === 3 && position !== null && olDtPositions.includes(position)) {
        return 310; // OL/DT default for Heavy
    }

    return BODY_TYPE_WEIGHTS[bodyType] || 220; // Default to Standard weight
}

/**
 * Convert actual weight to stored PWGT value
 * @param {number} actualWeight - Weight in pounds
 * @returns {number} Stored weight value (actualWeight - 160)
 */
export function actualWeightToStored(actualWeight) {
    return actualWeight - 160;
}

/**
 * Convert stored PWGT value to actual weight
 * @param {number} storedWeight - Stored weight value
 * @returns {number} Actual weight in pounds
 */
export function storedWeightToActual(storedWeight) {
    return storedWeight + 160;
}

/**
 * Handle body type change - returns new stored weight value
 * @param {number} newBodyType - New body type code (0-4)
 * @param {number|string} position - Position code or name (optional)
 * @returns {number} New stored weight value
 */
export function onBodyTypeChange(newBodyType, position = null) {
    const actualWeight = getWeightFromBodyType(newBodyType, position);
    return actualWeightToStored(actualWeight);
}

/**
 * Handle weight change - returns new body type code
 * @param {number} newStoredWeight - New stored weight value
 * @param {number|string} position - Position code or name (optional)
 * @returns {number} New body type code (0-4)
 */
export function onWeightChange(newStoredWeight, position = null) {
    const actualWeight = storedWeightToActual(newStoredWeight);
    return getBodyTypeFromWeight(actualWeight, position);
}