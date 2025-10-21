export type LookupType = 'position' | 'team' | 'college' | 'state' | 'pid' | 'none';

export interface RosterField {
  key: string;
  displayName: string;
  category: 'basic' | 'physical' | 'ratings' | 'contract' | 'development' | 'advanced' | 'transaction';
  dataType: 'number' | 'string' | 'lookup';
  lookupType?: LookupType;
  lookupFile?: string;
  minValue?: number;
  maxValue?: number;
  positions?: string[]; // Show field only for these positions
  priority: 'high' | 'medium' | 'low'; // For column ordering
  defaultVisible: boolean;
  pinned?: 'left' | 'right' | false;
  width?: number;
  sortable: boolean;
  filterable: boolean;
  editable: boolean;
}

export const ROSTER_FIELD_DEFINITIONS: Record<string, RosterField> = {
  // Basic Info (Always visible, pinned left)
  PLNA: {
    key: 'PLNA',
    displayName: 'Last Name',
    category: 'basic',
    dataType: 'string',
    priority: 'high',
    defaultVisible: true,
    pinned: 'left',
    width: 120,
    sortable: true,
    filterable: true,
    editable: true
  },
  PFNA: {
    key: 'PFNA',
    displayName: 'First Name',
    category: 'basic',
    dataType: 'string',
    priority: 'high',
    defaultVisible: true,
    pinned: 'left',
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },
  PPOS: {
    key: 'PPOS',
    displayName: 'Position',
    category: 'basic',
    dataType: 'lookup',
    lookupType: 'position',
    lookupFile: 'position_lookup.csv',
    priority: 'high',
    defaultVisible: true,
    width: 60,
    sortable: true,
    filterable: true,
    editable: true
  },
  TGID: {
    key: 'TGID',
    displayName: 'Team',
    category: 'basic',
    dataType: 'lookup',
    lookupType: 'team',
    lookupFile: 'team_lookup.csv',
    priority: 'high',
    defaultVisible: true,
    width: 80,
    sortable: true,
    filterable: true,
    editable: true
  },
  POVR: {
    key: 'POVR',
    displayName: 'Overall',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'high',
    defaultVisible: true,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },
  PAGE: {
    key: 'PAGE',
    displayName: 'Age',
    category: 'basic',
    dataType: 'number',
    minValue: 18,
    maxValue: 45,
    priority: 'high',
    defaultVisible: true,
    width: 50,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Core Physical Attributes
  PSPD: {
    key: 'PSPD',
    displayName: 'Speed',
    category: 'physical',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'high',
    defaultVisible: true,
    width: 60,
    sortable: true,
    filterable: true,
    editable: true
  },
  PSTR: {
    key: 'PSTR',
    displayName: 'Strength',
    category: 'physical',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'high',
    defaultVisible: true,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },
  PAWR: {
    key: 'PAWR',
    displayName: 'Awareness',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'high',
    defaultVisible: true,
    width: 80,
    sortable: true,
    filterable: true,
    editable: true
  },
  PACC: {
    key: 'PACC',
    displayName: 'Acceleration',
    category: 'physical',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'high',
    defaultVisible: true,
    width: 80,
    sortable: true,
    filterable: true,
    editable: true
  },
  PAGI: {
    key: 'PAGI',
    displayName: 'Agility',
    category: 'physical',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'high',
    defaultVisible: true,
    width: 60,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Physical Traits
  PHGT: {
    key: 'PHGT',
    displayName: 'Height',
    category: 'physical',
    dataType: 'number',
    minValue: 65,
    maxValue: 85,
    priority: 'medium',
    defaultVisible: true,
    width: 60,
    sortable: true,
    filterable: true,
    editable: true
  },
  PWGT: {
    key: 'PWGT',
    displayName: 'Weight',
    category: 'physical',
    dataType: 'number',
    minValue: 150,
    maxValue: 400,
    priority: 'medium',
    defaultVisible: true,
    width: 60,
    sortable: true,
    filterable: true,
    editable: true
  },
  PJMP: {
    key: 'PJMP',
    displayName: 'Jumping',
    category: 'physical',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'medium',
    defaultVisible: false,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },
  PSTA: {
    key: 'PSTA',
    displayName: 'Stamina',
    category: 'physical',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'medium',
    defaultVisible: false,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Core Ratings
  PINJ: {
    key: 'PINJ',
    displayName: 'Injury',
    category: 'ratings',
    dataType: 'number',
    minValue: 1,
    maxValue: 99,
    priority: 'medium',
    defaultVisible: true,
    width: 60,
    sortable: true,
    filterable: true,
    editable: true
  },
  PTGH: {
    key: 'PTGH',
    displayName: 'Toughness',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    priority: 'medium',
    defaultVisible: false,
    width: 80,
    sortable: true,
    filterable: true,
    editable: true
  },

  // QB-Specific Ratings
  PTHP: {
    key: 'PTHP',
    displayName: 'Throw Power',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['QB'],
    priority: 'high',
    defaultVisible: false,
    width: 90,
    sortable: true,
    filterable: true,
    editable: true
  },
  PTHA: {
    key: 'PTHA',
    displayName: 'Throw Accuracy',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['QB'],
    priority: 'high',
    defaultVisible: false,
    width: 110,
    sortable: true,
    filterable: true,
    editable: true
  },
  PTAD: {
    key: 'PTAD',
    displayName: 'Short Accuracy',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['QB'],
    priority: 'medium',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },
  PTAM: {
    key: 'PTAM',
    displayName: 'Medium Accuracy',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['QB'],
    priority: 'medium',
    defaultVisible: false,
    width: 110,
    sortable: true,
    filterable: true,
    editable: true
  },
  PTAS: {
    key: 'PTAS',
    displayName: 'Deep Accuracy',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['QB'],
    priority: 'medium',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Receiving/Catching
  PCTH: {
    key: 'PCTH',
    displayName: 'Catching',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['WR', 'TE', 'HB', 'FB'],
    priority: 'high',
    defaultVisible: false,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },
  PCAR: {
    key: 'PCAR',
    displayName: 'Carrying',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['HB', 'FB', 'WR', 'QB'],
    priority: 'high',
    defaultVisible: false,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Blocking
  PLBK: {
    key: 'PLBK',
    displayName: 'Pass Block',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'FB'],
    priority: 'high',
    defaultVisible: false,
    width: 80,
    sortable: true,
    filterable: true,
    editable: true
  },
  PRBK: {
    key: 'PRBK',
    displayName: 'Run Block',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'FB'],
    priority: 'high',
    defaultVisible: false,
    width: 80,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Defense
  PTAK: {
    key: 'PTAK',
    displayName: 'Tackling',
    category: 'ratings',
    dataType: 'number',
    minValue: 40,
    maxValue: 99,
    positions: ['LEDG', 'REDG', 'DT', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS'],
    priority: 'high',
    defaultVisible: false,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Background Info
  PCOL: {
    key: 'PCOL',
    displayName: 'College',
    category: 'basic',
    dataType: 'lookup',
    lookupType: 'college',
    lookupFile: 'college_lookup.csv',
    priority: 'low',
    defaultVisible: false,
    width: 120,
    sortable: true,
    filterable: true,
    editable: true
  },
  PHSN: {
    key: 'PHSN',
    displayName: 'Home State',
    category: 'basic',
    dataType: 'lookup',
    lookupType: 'state',
    lookupFile: 'state_lookup.csv',
    priority: 'low',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },
  PHTN: {
    key: 'PHTN',
    displayName: 'Hometown',
    category: 'basic',
    dataType: 'string',
    priority: 'low',
    defaultVisible: false,
    width: 120,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Portrait/Experience
  PSXP: {
    key: 'PSXP',
    displayName: 'Portrait ID',
    category: 'basic',
    dataType: 'lookup',
    lookupType: 'pid',
    lookupFile: 'ALLDATA_Lookup.csv',
    priority: 'medium',
    defaultVisible: false,
    width: 90,
    sortable: true,
    filterable: true,
    editable: true
  },
  PYWT: {
    key: 'PYWT',
    displayName: 'Years Pro',
    category: 'development',
    dataType: 'number',
    minValue: 0,
    maxValue: 25,
    priority: 'medium',
    defaultVisible: false,
    width: 70,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Contract Fields (PSA/PSB series)
  PSA0: {
    key: 'PSA0',
    displayName: 'Salary Year 1',
    category: 'contract',
    dataType: 'number',
    minValue: 0,
    maxValue: 99999999,
    priority: 'medium',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },
  PSA1: {
    key: 'PSA1',
    displayName: 'Salary Year 2',
    category: 'contract',
    dataType: 'number',
    minValue: 0,
    maxValue: 99999999,
    priority: 'medium',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },
  PSA2: {
    key: 'PSA2',
    displayName: 'Salary Year 3',
    category: 'contract',
    dataType: 'number',
    minValue: 0,
    maxValue: 99999999,
    priority: 'low',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },
  PSB0: {
    key: 'PSB0',
    displayName: 'Bonus Year 1',
    category: 'contract',
    dataType: 'number',
    minValue: 0,
    maxValue: 99999999,
    priority: 'low',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },
  PSB1: {
    key: 'PSB1',
    displayName: 'Bonus Year 2',
    category: 'contract',
    dataType: 'number',
    minValue: 0,
    maxValue: 99999999,
    priority: 'low',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  },

  // Player Type/Development
  PLTY: {
    key: 'PLTY',
    displayName: 'Player Type',
    category: 'development',
    dataType: 'number',
    minValue: 0,
    maxValue: 50,
    priority: 'medium',
    defaultVisible: false,
    width: 90,
    sortable: true,
    filterable: true,
    editable: true
  },
  PCON: {
    key: 'PCON',
    displayName: 'Contract Length',
    category: 'contract',
    dataType: 'number',
    minValue: 0,
    maxValue: 7,
    priority: 'medium',
    defaultVisible: false,
    width: 100,
    sortable: true,
    filterable: true,
    editable: true
  }

  // Note: This is a subset of the 131 fields from your 2026.csv
  // Additional fields would follow the same pattern with proper categorization
};

// Helper functions for field management
export function getFieldsByCategory(category: string): RosterField[] {
  return Object.values(ROSTER_FIELD_DEFINITIONS).filter(field => field.category === category);
}

export function getFieldsByPosition(position: string): RosterField[] {
  return Object.values(ROSTER_FIELD_DEFINITIONS).filter(field =>
    !field.positions || field.positions.includes(position)
  );
}

export function getDefaultVisibleFields(): RosterField[] {
  return Object.values(ROSTER_FIELD_DEFINITIONS).filter(field => field.defaultVisible);
}

export function getHighPriorityFields(): RosterField[] {
  return Object.values(ROSTER_FIELD_DEFINITIONS).filter(field => field.priority === 'high');
}