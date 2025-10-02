/**
 * Madden Player Field Definitions
 * Complete field definitions with validation, types, and display names
 */

export const MADDEN_FIELDS = {
    // User-friendly fields based on FIELD_ORDER
    'PLNA': { display: 'Last Name', shortDisplay: 'Last Name', type: 'text', editable: true, width: 100 },
    'PFNA': { display: 'First Name', shortDisplay: 'First Name', type: 'text', editable: true, width: 100 },
    'PSXP': { display: 'Pic ID', shortDisplay: 'PID', type: 'numeric', editable: true, width: 200, min: 0, max: 10861 },
    'PLAYERPIC': { display: 'Player Pic', shortDisplay: 'Player Pic', type: 'autocomplete', editable: true, width: 120, lookup: 'pids' },
    'PPOS': { display: 'Position', shortDisplay: 'POS', type: 'lookup', editable: true, width: 80, lookup: 'positions' },
    'PYRP': { display: 'Years Pro', shortDisplay: 'YRS', type: 'numeric', editable: true, width: 80, min: 0, max: 25 },
    'TGID': { display: 'Team', shortDisplay: 'Team', type: 'lookup', editable: true, width: 80, lookup: 'teams' },
    'PJEN': { display: 'Jersey Number', shortDisplay: 'JER', type: 'numeric', editable: true, width: 80, min: 0, max: 99 },
    'PCOL': { display: 'College', shortDisplay: 'College', type: 'lookup', editable: true, width: 100, lookup: 'colleges' },
    'PAGE': { display: 'Age', shortDisplay: 'Age', type: 'numeric', editable: true, width: 60, min: 18, max: 45 },
    'PHTN': { display: 'Hometown', shortDisplay: 'Hometown', type: 'text', editable: true, width: 100 },
    'PHSN': { display: 'State', shortDisplay: 'State', type: 'lookup', editable: true, width: 80, lookup: 'states' },
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
    'PWGT': { display: 'Weight', shortDisplay: 'WGT', type: 'numeric', editable: true, width: 70, min: 160, max: 380 },

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
    'POVR': { display: 'Overall Rating', shortDisplay: 'OVR', type: 'numeric', editable: false, width: 70, min: 0, max: 99 }
};

// Field order for user-friendly editing (Madden game order)
export const FIELD_ORDER = [
    ["PLNA", "Last Name"], ["PFNA", "First Name"], ["PSXP", "Pic ID"], ["PLAYERPIC", "Player Pic"],
    ["PPOS", "Position"], ["PYRP", "Years Pro"], ["TGID", "Team"], ["PJEN", "Jersey #"], ["PCOL", "College"],
    ["PAGE", "Age"], ["PHTN", "Hometown"], ["PHSN", "State"],
    ["PACC", "Acceleration"], ["PAGI", "Agility"], ["PAWR", "Awareness"], ["PBKT", "Break Tackle"], ["PBCV", "Vision"],
    ["PBSG", "Block Shed"], ["PBSK", "Break Sack"], ["PCAR", "Carrying"], ["PLCI", "Catch in Traffic"],
    ["PCTH", "Catching"], ["PDRR", "Deep RR"], ["PELU", "Change of Dir"], ["PFMS", "Finesse Moves"],
    ["PLHT", "Hit Power"], ["PLIB", "Impact Block"], ["PINJ", "Injury"], ["PLJM", "Juke"],
    ["PJMP", "Jump"], ["PKAC", "Kick Acc"], ["PKPR", "Kick Power"], ["PKRT", "Kick Return"],
    ["PLBK", "Lead Block"], ["PLMC", "Man Cov"], ["PMRR", "Medium RR"], ["PPBK", "Pass Block"],
    ["PPBF", "Pass Block FIN"], ["PPBS", "Pass Block PWR"], ["PPLA", "Play Action"], ["PLPM", "Power Move"],
    ["PLPE", "Press"], ["PLPU", "Pursuit"], ["PLPR", "Play Recognition"], ["PLRL", "Release"], ["PRBK", "Run Block"],
    ["PRBF", "Run Block FIN"], ["PRBS", "Run Block PWR"], ["SRRN", "Short RR"], ["PLSC", "Spec Catch"],
    ["PSPD", "Speed"], ["PLSM", "Spin Move"], ["PSTA", "Stamina"], ["PLSA", "Stiff Arm"],
    ["PSTR", "Strength"], ["PTAK", "Tackling"], ["PTAD", "Deep Throw"], ["PTAM", "Med Throw"],
    ["PTAS", "Short Throw"], ["PTOR", "Throw on Run"], ["PTHP", "Throw Power"],
    ["PTUP", "Throw Under Pressure"], ["PTGH", "Toughness"], ["PLTR", "Truck"], ["PLZC", "Zone Coverage"],
    ["PHGT", "Height"], ["PWGT", "Weight"],
    ["PCON", "Contract Years"], ["PCYL", "Years Left"], ["TOTAL_SALARY", "Total Salary"], ["PSBO", "Signing Bonus"]
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
    positions: new Map(),
    teams: new Map(),
    pids: new Map(),
    pidsByName: new Map(),
    devtraits: new Map([
        [0, 'Normal'],
        [1, 'Star'],
        [2, 'Superstar'],
        [3, 'X-Factor']
    ])
};

/**
 * Load lookup data from CSV files
 */
export async function loadLookupData() {
    try {
        // Load PID data (embedded sample data - working demonstration)
        const pidData = [
            [0, 'Blank'], [1, 'Gary Anderson'], [2, 'Willie Anderson'], [3, 'Steve Atwater'], [4, 'Tim Brown'],
            [5, 'Terrell Davis'], [6, 'Kevin Greene'], [7, 'Paul Krause (R)'], [8, 'Howie Long'], [9, 'Randall McDaniel'],
            [10, 'Anthony Munoz'], [11, 'Lorenzo Neal'], [12, 'Willie Roaf'], [13, 'Shannon Sharpe'], [14, 'Bruce Smith'],
            [15, 'Michael Strahan'], [16, 'Brian Urlacher'], [17, 'Aeneas Williams'], [18, 'Steve Wisniewski'], [19, 'Bryant Young'],
            [20, 'Morten Andersen'], [21, 'Mel Blount'], [22, 'Dermontti Dawson'], [23, 'Ray Guy'], [24, 'Marcus Allen'],
            [25, 'Bill Bates'], [26, 'Bobby Bell'], [27, 'Matt Birk'], [28, 'Keith Bulluck'], [29, 'Wayne Chrebet'],
            [30, 'Dallas Clark'], [31, 'Corey Dillon'], [32, 'Donald Driver'], [33, 'Jordan Gross'], [34, 'Merton Hanks'],
            [35, 'Marvin Harrison'], [36, 'John Henderson'], [37, 'Ted Hendricks (R)'], [38, 'Torry Holt'], [39, 'Ken Houston (R)'],
            [40, 'Ed Too Tall Jones'], [41, 'Joe Jurevicius'], [42, 'Willie Lanier'], [43, 'Ty Law'], [44, 'Larry Little'],
            [45, 'Bruce Matthews'], [46, 'Deuce McAllister'], [47, 'Herman Moore'], [48, 'Christian Okoye'], [49, 'Alan Page'],
            [50, 'Clinton Portis'], [51, 'Antwaan Randle-El'], [52, 'Andre Reed'], [53, 'Jon Runyan'], [54, 'Cory Schlesinger'],
            [55, 'Jan Stenerud (R)'], [56, 'Patrick Surtain'], [57, 'Lofa Tatupu'], [58, 'Adam Timmerman'], [59, 'Jessie Tuggle'],
            [60, 'Kurt Warner'], [61, 'Brian Waters'], [62, 'Erik Williams'], [63, 'Troy Polamalu'], [65, 'Patrick Willis (R)'],
            [66, 'Trey Adams (R)'], [67, 'Hakeem Adeniji'], [68, 'Patrick Afriyie (R)'], [69, 'McTelvin Agim'], [70, 'Salvon Ahmed'],
            [71, 'Brandon Aiyuk'], [72, 'Cam Akers'], [73, 'Bradlee Anae'], [74, 'Tremayne Anchrum Jr'], [75, 'Bruce Anderson (R)'],
            [76, 'Calvin Anderson'], [77, 'Darius Anderson'], [78, 'Damon Arnette'], [79, 'Grayland Arnold'], [80, 'Devin Asiasi'],
            [81, 'Joe Bachie'], [82, 'Markus Bailey'], [83, 'Trajan Bandy (R)'], [84, 'Ben Bartch'], [85, 'Tyler Bass'],
            [86, 'Essang Bassey'], [87, 'Zack Baun'], [88, 'Omar Bayless (R)'], [89, 'Andrew Beck'], [90, 'Mekhi Becton'],
            [91, 'Levante Bellamy (R)'], [92, 'Eno Benjamin'], [93, 'Francis Bernard'], [94, 'Tyler Biadasz'], [95, 'Daniel Bituli (R)'],
            [96, 'Ross Blacklock'], [97, 'Julian Blackmon'], [98, 'Christian Blake (R)'], [99, 'Tom Brady'], [100, 'Aaron Rodgers']
        ];

        pidData.forEach(([id, name]) => {
            if (name && name.trim()) {
                LOOKUP_DATA.pids.set(id, name.trim());
                LOOKUP_DATA.pidsByName.set(name.trim().toLowerCase(), id);
            }
        });
        console.log(`Loaded ${LOOKUP_DATA.pids.size} PID entries`);

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

        // Load PID data from PID_lookup.csv using IPC
        console.log('Loading PID lookup data via IPC...');
        const pidLookupPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Lookups\\PID_lookup.csv';

        try {
            const readResult = await window.electronAPI.file.read(pidLookupPath);

            if (!readResult.success) {
                throw new Error(readResult.error || 'Failed to read PID lookup file');
            }

            // Convert buffer to text
            const decoder = new TextDecoder('utf-8');
            const csvText = decoder.decode(readResult.data);
            const lines = csvText.split('\n');

            console.log(`Loaded ${lines.length} lines from PID lookup file`);

            // Skip header row, process data rows
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const [pidStr, playerName] = line.split(',');
                const pid = parseInt(pidStr);

                if (!isNaN(pid) && playerName) {
                    const cleanName = playerName.trim();
                    LOOKUP_DATA.pids.set(pid, cleanName);
                    LOOKUP_DATA.pidsByName.set(cleanName.toLowerCase(), pid);
                }
            }

            console.log(`Processed ${LOOKUP_DATA.pids.size} PID lookups`);
        } catch (error) {
            console.error('Failed to load PID lookup:', error);
        }

        console.log('Lookup data loaded successfully');
        console.log(`Colleges: ${LOOKUP_DATA.colleges.size}, States: ${LOOKUP_DATA.states.size}, PIDs: ${LOOKUP_DATA.pids.size}`);

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
 * Get player name from PID
 * @param {number} pid - PID to look up
 * @returns {string} Player name or 'Generic Name'
 */
export function getPlayerNameFromPID(pid) {
    return LOOKUP_DATA.pids.get(pid) || 'Generic Face';
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

    for (const [name, pid] of LOOKUP_DATA.pidsByName.entries()) {
        if (name.includes(lowercaseQuery)) {
            matches.push({ name: LOOKUP_DATA.pids.get(pid), pid });
            if (matches.length >= limit) break;
        }
    }

    return matches.sort((a, b) => a.name.localeCompare(b.name));
}