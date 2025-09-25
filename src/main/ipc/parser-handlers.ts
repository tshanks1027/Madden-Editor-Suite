import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

export interface ParsedRoster {
  version: number;
  playerCount: number;
  players: Player[];
  teams: Team[];
}

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  college: string;
  jerseyNumber: number;
  position: number;
  teamId: number;
  age: number;
  height: number;
  weight: number;
  attributes: PlayerAttributes;
  stats: PlayerStats;
}

export interface PlayerAttributes {
  speed: number;
  acceleration: number;
  strength: number;
  agility: number;
  awareness: number;
  // Additional attributes based on position
  [key: string]: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesStarted: number;
  passingYards?: number;
  passingTDs?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receivingYards?: number;
  receivingTDs?: number;
  tackles?: number;
  sacks?: number;
  interceptions?: number;
}

export interface Team {
  id: number;
  name: string;
  city: string;
  abbreviation: string;
  players: number[]; // Player IDs
}

// Roster file parsing
ipcMain.handle('parser:parse-roster', async (event, filePath: string): Promise<ParsedRoster> => {
  try {
    const data = await fs.readFile(filePath);
    return parseRosterFile(data);
  } catch (error) {
    throw new Error(`Failed to parse roster file: ${error}`);
  }
});

function parseRosterFile(data: Buffer): ParsedRoster {
  // Validate file signature
  const signature = data.subarray(0, 4).toString('ascii');
  if (signature !== 'ROS\0') {
    throw new Error('Invalid roster file signature');
  }

  // Read header
  const version = data.readUInt32LE(4);
  const fileSize = data.readUInt32LE(8);
  const playerCount = data.readUInt32LE(12);
  const teamDataOffset = data.readUInt32LE(16);
  const stringTableOffset = data.readUInt32LE(20);

  // Validate file size
  if (fileSize !== data.length) {
    throw new Error('File size mismatch in header');
  }

  // Parse string table
  const strings = parseStringTable(data, stringTableOffset);

  // Parse players
  const players: Player[] = [];
  let offset = 32; // Skip header

  for (let i = 0; i < playerCount; i++) {
    const player = parsePlayerRecord(data, offset, strings);
    players.push(player);
    offset += 188; // Player record size
  }

  // Parse team assignments (simplified for now)
  const teams: Team[] = [];
  for (let teamId = 0; teamId < 32; teamId++) {
    const teamPlayers = players
      .filter(p => p.teamId === teamId)
      .map(p => p.id);

    if (teamPlayers.length > 0) {
      teams.push({
        id: teamId,
        name: getTeamName(teamId),
        city: getTeamCity(teamId),
        abbreviation: getTeamAbbreviation(teamId),
        players: teamPlayers
      });
    }
  }

  return {
    version,
    playerCount,
    players,
    teams
  };
}

function parseStringTable(data: Buffer, offset: number): string[] {
  const strings: string[] = [];
  let currentOffset = offset;

  // Read string count
  const stringCount = data.readUInt32LE(currentOffset);
  currentOffset += 4;

  // Read string offsets
  const offsets: number[] = [];
  for (let i = 0; i < stringCount; i++) {
    offsets.push(data.readUInt32LE(currentOffset));
    currentOffset += 4;
  }

  // Read strings
  for (const stringOffset of offsets) {
    const absoluteOffset = offset + stringOffset;
    const length = data.readUInt8(absoluteOffset);
    const stringData = data.subarray(absoluteOffset + 1, absoluteOffset + 1 + length);
    strings.push(stringData.toString('utf8'));
  }

  return strings;
}

function parsePlayerRecord(data: Buffer, offset: number, strings: string[]): Player {
  const id = data.readUInt32LE(offset);
  const firstNameIndex = data.readUInt32LE(offset + 4);
  const lastNameIndex = data.readUInt32LE(offset + 8);
  const collegeIndex = data.readUInt32LE(offset + 12);
  const jerseyNumber = data.readUInt16LE(offset + 16);
  const position = data.readUInt8(offset + 18);
  const teamId = data.readUInt8(offset + 19);
  const age = data.readUInt8(offset + 20);
  const height = data.readUInt16LE(offset + 22);
  const weight = data.readUInt16LE(offset + 24);

  // Parse attributes
  const attributes: PlayerAttributes = {
    speed: data.readUInt8(offset + 32),
    acceleration: data.readUInt8(offset + 33),
    strength: data.readUInt8(offset + 34),
    agility: data.readUInt8(offset + 35),
    awareness: data.readUInt8(offset + 40)
  };

  // Parse stats
  const stats: PlayerStats = {
    gamesPlayed: data.readUInt32LE(offset + 96),
    gamesStarted: data.readUInt32LE(offset + 100),
    passingYards: data.readUInt32LE(offset + 104),
    passingTDs: data.readUInt32LE(offset + 108),
    rushingYards: data.readUInt32LE(offset + 112),
    rushingTDs: data.readUInt32LE(offset + 116),
    receivingYards: data.readUInt32LE(offset + 120),
    receivingTDs: data.readUInt32LE(offset + 124)
  };

  return {
    id,
    firstName: strings[firstNameIndex] || '',
    lastName: strings[lastNameIndex] || '',
    college: strings[collegeIndex] || '',
    jerseyNumber,
    position,
    teamId,
    age,
    height,
    weight,
    attributes,
    stats
  };
}

// Draft class parsing
ipcMain.handle('parser:parse-draft-class', async (event, filePath: string) => {
  try {
    const data = await fs.readFile(filePath);
    return parseDraftClassFile(data);
  } catch (error) {
    throw new Error(`Failed to parse draft class file: ${error}`);
  }
});

function parseDraftClassFile(data: Buffer) {
  const signature = data.subarray(0, 4).toString('ascii');
  if (signature !== 'DRAF') {
    throw new Error('Invalid draft class file signature');
  }

  // Basic parsing - to be expanded
  return {
    signature,
    draftYear: data.readUInt32LE(4),
    playerCount: data.readUInt32LE(12),
    // More parsing to be implemented
  };
}

// Uniform file parsing
ipcMain.handle('parser:parse-uniform', async (event, filePath: string) => {
  try {
    const data = await fs.readFile(filePath);
    return parseUniformFile(data);
  } catch (error) {
    throw new Error(`Failed to parse uniform file: ${error}`);
  }
});

function parseUniformFile(data: Buffer) {
  const signature = data.subarray(0, 4).toString('ascii');
  if (signature !== 'UNIF') {
    throw new Error('Invalid uniform file signature');
  }

  return {
    signature,
    teamId: data.readUInt32LE(4),
    uniformSet: data.readUInt32LE(8),
    textureCount: data.readUInt32LE(12),
    // More parsing to be implemented
  };
}

// DDS texture parsing
ipcMain.handle('parser:parse-dds', async (event, filePath: string) => {
  try {
    const data = await fs.readFile(filePath);
    return parseDDSFile(data);
  } catch (error) {
    throw new Error(`Failed to parse DDS file: ${error}`);
  }
});

function parseDDSFile(data: Buffer) {
  const signature = data.subarray(0, 4).toString('ascii');
  if (signature !== 'DDS ') {
    throw new Error('Invalid DDS file signature');
  }

  const headerSize = data.readUInt32LE(4);
  const flags = data.readUInt32LE(8);
  const height = data.readUInt32LE(12);
  const width = data.readUInt32LE(16);
  const pitch = data.readUInt32LE(20);
  const depth = data.readUInt32LE(24);
  const mipmapCount = data.readUInt32LE(28);

  return {
    signature,
    headerSize,
    flags,
    height,
    width,
    pitch,
    depth,
    mipmapCount,
    dataOffset: 128 // Standard DDS header size
  };
}

// Generic file analysis
ipcMain.handle('parser:analyze-file', async (event, filePath: string) => {
  try {
    const data = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);

    // Read first 1KB for analysis
    const sample = data.subarray(0, Math.min(1024, data.length));
    const signature = sample.subarray(0, 4).toString('ascii');

    // Basic entropy calculation for data analysis
    const entropy = calculateEntropy(sample);

    // Look for common patterns
    const patterns = findPatterns(sample);

    return {
      fileName: path.basename(filePath),
      fileSize: stats.size,
      signature,
      entropy,
      patterns,
      hexDump: sample.toString('hex').match(/.{2}/g)?.join(' ').substring(0, 200),
      possibleFormat: detectFormat(signature, sample)
    };
  } catch (error) {
    throw new Error(`Failed to analyze file: ${error}`);
  }
});

function calculateEntropy(data: Buffer): number {
  const frequencies = new Map<number, number>();

  // Count byte frequencies
  for (const byte of data) {
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }

  // Calculate entropy
  let entropy = 0;
  const length = data.length;

  for (const frequency of frequencies.values()) {
    const probability = frequency / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function findPatterns(data: Buffer): string[] {
  const patterns: string[] = [];

  // Look for repeating sequences
  for (let i = 0; i < Math.min(100, data.length - 4); i += 4) {
    const value = data.readUInt32LE(i);
    if (value === 0) patterns.push('Zero padding detected');
    if (value === 0xFFFFFFFF) patterns.push('Max value detected');
  }

  // Look for ASCII strings
  const ascii = data.toString('ascii');
  const printable = ascii.replace(/[^\x20-\x7E]/g, '');
  if (printable.length > 10) {
    patterns.push('ASCII text detected');
  }

  return patterns;
}

function detectFormat(signature: string, data: Buffer): string {
  switch (signature) {
    case 'ROS\0': return 'Madden Roster File';
    case 'FRAN': return 'Madden Franchise File';
    case 'DRAF': return 'Madden Draft Class File';
    case 'UNIF': return 'Madden Uniform File';
    case 'DDS ': return 'DirectDraw Surface Texture';
    default:
      // Check for other common formats
      if (data.subarray(0, 2).toString('hex') === 'ffd8') return 'JPEG Image';
      if (data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'PNG Image';
      return 'Unknown Format';
  }
}

// Team name helpers (simplified - would be loaded from config)
function getTeamName(teamId: number): string {
  const teamNames = [
    'Patriots', 'Bills', 'Dolphins', 'Jets',
    'Steelers', 'Ravens', 'Browns', 'Bengals',
    'Colts', 'Texans', 'Titans', 'Jaguars',
    'Chiefs', 'Chargers', 'Broncos', 'Raiders',
    'Cowboys', 'Giants', 'Eagles', 'Commanders',
    'Packers', 'Bears', 'Lions', 'Vikings',
    'Saints', 'Falcons', 'Panthers', 'Buccaneers',
    '49ers', 'Seahawks', 'Rams', 'Cardinals'
  ];
  return teamNames[teamId] || 'Unknown Team';
}

function getTeamCity(teamId: number): string {
  const teamCities = [
    'New England', 'Buffalo', 'Miami', 'New York',
    'Pittsburgh', 'Baltimore', 'Cleveland', 'Cincinnati',
    'Indianapolis', 'Houston', 'Tennessee', 'Jacksonville',
    'Kansas City', 'Los Angeles', 'Denver', 'Las Vegas',
    'Dallas', 'New York', 'Philadelphia', 'Washington',
    'Green Bay', 'Chicago', 'Detroit', 'Minnesota',
    'New Orleans', 'Atlanta', 'Carolina', 'Tampa Bay',
    'San Francisco', 'Seattle', 'Los Angeles', 'Arizona'
  ];
  return teamCities[teamId] || 'Unknown City';
}

function getTeamAbbreviation(teamId: number): string {
  const teamAbbrevs = [
    'NE', 'BUF', 'MIA', 'NYJ',
    'PIT', 'BAL', 'CLE', 'CIN',
    'IND', 'HOU', 'TEN', 'JAX',
    'KC', 'LAC', 'DEN', 'LV',
    'DAL', 'NYG', 'PHI', 'WAS',
    'GB', 'CHI', 'DET', 'MIN',
    'NO', 'ATL', 'CAR', 'TB',
    'SF', 'SEA', 'LAR', 'ARI'
  ];
  return teamAbbrevs[teamId] || 'UNK';
}