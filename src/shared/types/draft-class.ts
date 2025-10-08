/**
 * Draft Class TypeScript Interfaces
 *
 * Type definitions for draft class data structures.
 * Based on madden-draft-class-editor repository and calibrated parser.
 *
 * Source: Adapted from madden-draft-class-tools by WiiExpertise (GPL-3.0)
 */

/**
 * Visual/appearance data for a prospect
 * Stored as JSON in the first 4096 bytes of each prospect record
 */
export interface ProspectVisuals {
  CharacterVisuals?: {
    skinTone?: number;
    eyePaint?: number;
    faceMask?: number;
    visor?: number;
    helmet?: number;
    mouthpiece?: number;
    sleeves?: number;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Complete prospect/player data
 * All 115 attributes parsed from draft class file
 */
export interface Prospect {
  // Index and position in file
  index: number;
  offset: number;

  // Visual data (JSON)
  visuals: ProspectVisuals | null;

  // Personal Information
  firstName: string;
  lastName: string;
  homeState: number;
  homeTown: string;
  college: number;
  birthDate: number;
  age: number;
  heightInches: number;
  weight: number;

  // Position and draft info
  position: number;
  archetype: number;
  jerseyNum: number;
  draftable: number;
  draftPick: number;
  draftRound: number;

  // Core Ratings
  overall: number;
  acceleration: number;
  agility: number;
  awareness: number;
  ballCarrierVision: number;
  blockShedding: number;
  breakSack: number;
  breakTackle: number;
  carrying: number;
  catching: number;
  catchInTraffic: number;
  changeOfDirection: number;
  finesseMoves: number;
  hitPower: number;
  impactBlocking: number;
  injury: number;
  jukeMove: number;
  jumping: number;
  kickAccuracy: number;
  kickPower: number;
  kickReturn: number;
  leadBlock: number;
  manCoverage: number;
  passBlockFinesse: number;
  passBlockPower: number;
  passBlock: number;
  personality: number;
  playAction: number;
  playRecognition: number;
  powerMoves: number;
  pressCoverage: number;
  pursuit: number;
  release: number;
  shortRouteRunning: number;
  mediumRouteRunning: number;
  deepRouteRunning: number;
  runBlockFinesse: number;
  runBlockPower: number;
  runBlock: number;
  runningStyle: number;
  spectacularCatch: number;
  speed: number;
  spinMove: number;
  stamina: number;
  stiffArm: number;
  strength: number;
  tackle: number;
  throwAccuracyDeep: number;
  throwAccuracyMid: number;
  throwAccuracy: number;
  throwAccuracyShort: number;
  throwOnTheRun: number;
  throwPower: number;
  throwUnderPressure: number;
  toughness: number;
  trucking: number;
  zoneCoverage: number;
  morale: number;

  // Traits
  traitBigHitter: number;
  traitPossessionCatch: number;
  traitClutch: number;
  traitCoverBall: number;
  traitDeepBall: number;
  traitDlBullRush: number;
  traitDlSpinMove: number;
  traitDlSwimMove: number;
  traitDropsOpen: number;
  traitSidelineCatch: number;
  traitFightForYards: number;
  traitUnk1: number;
  traitHighMotor: number;
  traitAggressiveCatch: number;
  traitPenalty: number;
  traitPlayBall: number;
  traitPumpFake: number;
  traitLbStyle: number;
  traitSensePressure: number;
  traitUnk2: number;
  traitStripBall: number;
  traitTackleLow: number;
  traitThrowAway: number;
  traitTightSpiral: number;
  traitTendency: number;
  traitRunAfterCatch: number;

  // Development and other attributes
  devTrait: number;
  traitPredictability: number;
  unkByte2: number;
  genericHead: number;
  handedness: number;
  portraitId: number;
  qbStyle: number;
  qbStance: number;
  unk3: number;
  unk4: number;
  unk5: number;
  unk6: number;
  visMoveType: number;
  unk8: number;
  commentaryId: number;
  assetName: string;
}

/**
 * Draft class file header information
 */
export interface DraftClassHeader {
  signature: string;          // "FBCHUNKS"
  version: number;            // Header version
  year: number;               // Draft year
  product: string;            // Product string (e.g., "Madden-26")
  gameVersion: number | null; // Detected game version (25, 26, etc.)
  compressionType: string;    // Compression type: 'gzip', 'zstd', or 'none'
  dataStartOffset: number;    // Offset where prospect data begins
}

/**
 * Complete draft class data structure
 */
export interface DraftClassData {
  header: DraftClassHeader;
  prospects: Prospect[];
  meta: {
    fileSize: number;
    prospectCount: number;
    estimatedProspects: number;
    compressionDetected: string;
  };
}

/**
 * Attribute definition for UI rendering
 * Defines how each attribute should be displayed and validated
 */
export interface AttributeDefinition {
  key: string;           // Attribute key (e.g., 'firstName', 'speed')
  label: string;         // Display label
  type: string;          // Data type: 'string', 'number', 'boolean'
  min?: number;          // Minimum value (for numbers)
  max?: number;          // Maximum value (for numbers)
  category?: string;     // Category grouping
  editable?: boolean;    // Whether field is editable
  description?: string;  // Help text
}

/**
 * Attribute definitions organized by category
 */
export interface AttributeDefinitions {
  personal: AttributeDefinition[];
  ratings: AttributeDefinition[];
  draft: AttributeDefinition[];
  traits?: AttributeDefinition[];
  visual?: AttributeDefinition[];
}

/**
 * Validation result for draft class files
 */
export interface DraftClassValidation {
  valid: boolean;
  signature?: string;
  version?: number;
  year?: number;
  product?: string;
  compressionType?: string;
  fileSize?: number;
  error?: string;
}

/**
 * Draft class file information (metadata only, no full parse)
 */
export interface DraftClassInfo {
  valid: boolean;
  header?: DraftClassHeader;
  prospectCount?: number;
  fileSize?: number;
  compressionType?: string;
  gameVersion?: number | null;
  sampleProspects?: Array<{
    name: string;
    position: number;
    overall: number;
    college: number;
  }>;
  error?: string;
}
