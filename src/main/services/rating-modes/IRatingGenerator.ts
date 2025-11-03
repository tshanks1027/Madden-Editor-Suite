/**
 * Interface for rating generation strategies
 */

export interface RatingContext {
  position: string;              // Required: QB, HB, WR, etc.
  draftPosition?: number;        // For realistic mode (1-262)
  draftRound?: number;          // For realistic mode (1-7)
  careerStats?: any;            // For historical mode (scraped data)
  fortyTime?: number;           // Speed calculation (4.3-5.5 seconds)
  age?: number;
  name?: string;                // For logging/debugging
}

export interface PlayerRatings {
  // Overall
  POVR: number;

  // Physical
  PSPD: number;  // Speed
  PACC: number;  // Acceleration
  PAGI: number;  // Agility
  PSTR: number;  // Strength
  PJMP: number;  // Jumping
  PSTA: number;  // Stamina
  PINJ: number;  // Injury
  PTGH: number;  // Toughness

  // Mental
  PAWR: number;  // Awareness

  // QB-specific
  PTAD?: number; // Throw Accuracy Deep
  PTAM?: number; // Throw Accuracy Mid
  PTAS?: number; // Throw Accuracy Short
  PTHP?: number; // Throw Power
  PTUP?: number; // Throw Under Pressure
  PTOR?: number; // Throw on Run
  PPLA?: number; // Play Action
  PBSK?: number; // Break Sack

  // HB/FB-specific
  PCAR?: number; // Carrying
  PBCV?: number; // Ball Carrier Vision
  PBKT?: number; // Break Tackle
  PLTR?: number; // Trucking
  PLJM?: number; // Juke Move
  PLSM?: number; // Spin Move
  PLSA?: number; // Stiff Arm
  PELU?: number; // Change of Direction

  // Receiver-specific
  PCTH?: number; // Catching
  PLCI?: number; // Catch in Traffic
  PLSC?: number; // Spectacular Catch
  PLRL?: number; // Release
  PDRR?: number; // Deep Route Running
  PMRR?: number; // Medium Route Running
  SRRN?: number; // Short Route Running

  // Blocker-specific
  PRBK?: number; // Run Block
  PPBK?: number; // Pass Block
  PLIB?: number; // Impact Blocking
  PLBK?: number; // Lead Block
  PRBF?: number; // Run Block Finesse
  PRBS?: number; // Run Block Power
  PPBF?: number; // Pass Block Finesse
  PPBS?: number; // Pass Block Power

  // Defender-specific
  PTAK?: number; // Tackling
  PLPU?: number; // Pursuit
  PLPR?: number; // Play Recognition
  PLHT?: number; // Hit Power
  PBSG?: number; // Block Shedding
  PFMS?: number; // Finesse Moves
  PLPM?: number; // Power Moves
  PLMC?: number; // Man Coverage
  PLZC?: number; // Zone Coverage
  PLPE?: number; // Press

  // Kicker-specific
  PKAC?: number; // Kick Accuracy
  PKPR?: number; // Kick Power
  PKRT?: number; // Kick Return
}

export interface IRatingGenerator {
  /**
   * Generate complete ratings for a player
   * @param context Player context including position, draft info, stats
   * @returns Complete set of Madden ratings
   */
  generateRatings(context: RatingContext): Promise<PlayerRatings>;

  /**
   * Get the name of this rating generator
   */
  getName(): string;
}
