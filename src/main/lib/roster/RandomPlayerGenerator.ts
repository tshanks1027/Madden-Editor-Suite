/**
 * Random Player Generator
 *
 * Generates random low-OVR players for teams that didn't exist in a given year.
 * Creates believable player names, positions, and low attributes (40-55 OVR).
 *
 * Source: Custom implementation for historical roster generation
 */

import { MaddenAttributes } from './AttributeMapper';

export interface RandomPlayer {
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  height: string; // Format: "6-2"
  weight: number;
  college: string;
  attributes: MaddenAttributes;
}

// Common first names for random generation
const FIRST_NAMES = [
  'John', 'Michael', 'David', 'James', 'Robert', 'William', 'Richard', 'Thomas', 'Charles', 'Daniel',
  'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin',
  'Brian', 'George', 'Timothy', 'Ronald', 'Edward', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary',
  'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Larry', 'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel',
  'Raymond', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack', 'Dennis', 'Jerry', 'Tyler', 'Aaron'
];

// Common last names for random generation
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

// Common college names
const COLLEGES = [
  'Alabama', 'Ohio State', 'Michigan', 'Texas', 'USC', 'Oklahoma', 'Florida', 'Georgia', 'LSU', 'Penn State',
  'Notre Dame', 'Nebraska', 'Tennessee', 'Auburn', 'Florida State', 'Miami', 'Oregon', 'Washington', 'UCLA', 'Wisconsin',
  'Clemson', 'Stanford', 'Michigan State', 'Texas A&M', 'Arizona State', 'California', 'Iowa', 'Colorado', 'Virginia Tech', 'Arkansas'
];

// Positions to distribute across roster
const POSITION_DISTRIBUTION = {
  'QB': 3,     // 3 QBs
  'HB': 4,     // 4 RBs
  'FB': 2,     // 2 FBs
  'WR': 6,     // 6 WRs
  'TE': 3,     // 3 TEs
  'LT': 2,     // 2 Left Tackles
  'LG': 2,     // 2 Left Guards
  'C': 2,      // 2 Centers
  'RG': 2,     // 2 Right Guards
  'RT': 2,     // 2 Right Tackles
  'LE': 2,     // 2 Left Ends
  'RE': 2,     // 2 Right Ends
  'DT': 4,     // 4 Defensive Tackles
  'LOLB': 2,   // 2 LOLBs
  'MLB': 3,    // 3 MLBs
  'ROLB': 2,   // 2 ROLBs
  'CB': 5,     // 5 Cornerbacks
  'FS': 2,     // 2 Free Safeties
  'SS': 2,     // 2 Strong Safeties
  'K': 1,      // 1 Kicker
  'P': 1       // 1 Punter
};

/**
 * Generate a full random roster for a non-existent team
 * @param teamAbbr - Team abbreviation
 * @returns Array of random players (53-man roster)
 */
export function generateRandomRoster(teamAbbr: string): RandomPlayer[] {
  const roster: RandomPlayer[] = [];

  // Generate players for each position
  for (const [position, count] of Object.entries(POSITION_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
      roster.push(generateRandomPlayer(position));
    }
  }

  return roster;
}

/**
 * Generate a single random player
 * @param position - Player position
 * @returns Random player object
 */
export function generateRandomPlayer(position: string): RandomPlayer {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const college = randomElement(COLLEGES);

  // Generate age (rookies to veterans)
  const age = randomInt(22, 28);

  // Generate physical attributes based on position
  const { height, weight } = generatePhysicals(position);

  // Generate low-tier attributes (40-55 range)
  const attributes = generateLowAttributes(position);

  return {
    firstName,
    lastName,
    position,
    age,
    height,
    weight,
    college,
    attributes
  };
}

/**
 * Generate position-appropriate physical attributes
 */
function generatePhysicals(position: string): { height: string; weight: number } {
  let heightInches: number;
  let weight: number;

  switch (position) {
    case 'QB':
      heightInches = randomInt(73, 77); // 6'1" - 6'5"
      weight = randomInt(210, 240);
      break;

    case 'HB':
      heightInches = randomInt(69, 73); // 5'9" - 6'1"
      weight = randomInt(195, 225);
      break;

    case 'FB':
      heightInches = randomInt(71, 73); // 5'11" - 6'1"
      weight = randomInt(235, 260);
      break;

    case 'WR':
      heightInches = randomInt(69, 76); // 5'9" - 6'4"
      weight = randomInt(180, 220);
      break;

    case 'TE':
      heightInches = randomInt(74, 78); // 6'2" - 6'6"
      weight = randomInt(240, 270);
      break;

    case 'LT':
    case 'RT':
      heightInches = randomInt(76, 80); // 6'4" - 6'8"
      weight = randomInt(300, 340);
      break;

    case 'LG':
    case 'RG':
    case 'C':
      heightInches = randomInt(73, 77); // 6'1" - 6'5"
      weight = randomInt(295, 330);
      break;

    case 'LE':
    case 'RE':
      heightInches = randomInt(74, 78); // 6'2" - 6'6"
      weight = randomInt(260, 290);
      break;

    case 'DT':
      heightInches = randomInt(73, 76); // 6'1" - 6'4"
      weight = randomInt(290, 330);
      break;

    case 'LOLB':
    case 'ROLB':
    case 'MLB':
      heightInches = randomInt(72, 76); // 6'0" - 6'4"
      weight = randomInt(230, 260);
      break;

    case 'CB':
      heightInches = randomInt(69, 73); // 5'9" - 6'1"
      weight = randomInt(180, 205);
      break;

    case 'FS':
    case 'SS':
      heightInches = randomInt(70, 74); // 5'10" - 6'2"
      weight = randomInt(195, 220);
      break;

    case 'K':
    case 'P':
      heightInches = randomInt(70, 74); // 5'10" - 6'2"
      weight = randomInt(180, 210);
      break;

    default:
      heightInches = 72; // 6'0"
      weight = 220;
  }

  const feet = Math.floor(heightInches / 12);
  const inches = heightInches % 12;
  const height = `${feet}-${inches}`;

  return { height, weight };
}

/**
 * Generate low-tier attributes (40-55 range) for random players
 */
function generateLowAttributes(position: string): MaddenAttributes {
  // Base low attributes
  const base: MaddenAttributes = {
    POVR: randomInt(40, 55),
    PSPD: randomInt(40, 58),
    PACC: randomInt(40, 58),
    PAGI: randomInt(40, 58),
    PSTR: randomInt(40, 58),
    PAWR: randomInt(40, 55),
    PJMP: randomInt(40, 58),
    PSTA: randomInt(70, 85), // Stamina is usually decent
    PINJ: randomInt(75, 90), // Injury rating
    PTGH: randomInt(40, 58)
  };

  // Add position-specific attributes
  switch (position) {
    case 'QB':
      base.PTHP = randomInt(40, 58);
      base.PTHA = randomInt(40, 58);
      base.PTAM = randomInt(40, 58);
      base.PTAS = randomInt(40, 58);
      base.PCAR = randomInt(40, 55);
      break;

    case 'HB':
    case 'FB':
      base.PCAR = randomInt(40, 58);
      base.PBTK = randomInt(40, 58);
      base.PCTH = randomInt(40, 55);
      break;

    case 'WR':
    case 'TE':
      base.PCTH = randomInt(40, 58);
      base.PCIT = randomInt(40, 55);
      base.PRTE = randomInt(40, 58);
      base.PREL = randomInt(40, 58);
      break;

    case 'LT':
    case 'LG':
    case 'C':
    case 'RG':
    case 'RT':
      base.PRBK = randomInt(40, 58);
      base.PLBK = randomInt(40, 58);
      base.PSTR = randomInt(50, 65); // O-line needs more strength
      break;

    case 'LE':
    case 'RE':
    case 'DT':
      base.PTAK = randomInt(40, 58);
      base.PHIT = randomInt(40, 58);
      base.PPOW = randomInt(40, 58);
      base.PFMS = randomInt(40, 58);
      base.PBSH = randomInt(40, 58);
      break;

    case 'LOLB':
    case 'MLB':
    case 'ROLB':
      base.PTAK = randomInt(40, 58);
      base.PHIT = randomInt(40, 58);
      base.PPOW = randomInt(40, 55);
      base.PBSH = randomInt(40, 55);
      base.PMAN = randomInt(40, 55);
      base.PZON = randomInt(40, 58);
      break;

    case 'CB':
    case 'FS':
    case 'SS':
      base.PMAN = randomInt(40, 58);
      base.PZON = randomInt(40, 58);
      base.PPRS = randomInt(40, 58);
      base.PTAK = randomInt(40, 55);
      break;

    case 'K':
    case 'P':
      base.PKPR = randomInt(40, 58);
      base.PKAC = randomInt(40, 58);
      base.PSPD = 45; // Kickers don't need speed
      break;
  }

  return base;
}

/**
 * Get a random element from an array
 */
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
