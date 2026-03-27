# Rating Field Conversion Table

This document maps all rating field names across the different systems in the Madden Editor Suite.

## Systems That Need to Match

1. **Draft Class Parser** (draftClassFunctions.js / M26Parser.js) - reads binary files
2. **Roster Parser** (RosterParser.js) - reads TDB2 database files
3. **OVR Calculator** (OVRWeightsCalculator.ts) - calculates overall rating
4. **Database Service** (DraftClassDatabaseService.ts) - pushes to/pulls from player database
5. **UI Display** (index.html) - shows in editor grids

## Field Code Reference

| Rating Name | M26 Field Code | Draft Parser camelCase | OVR Calculator | Database Service | Notes |
|-------------|----------------|------------------------|----------------|------------------|-------|
| **PHYSICAL** |
| Speed | PSPD | speed | SpeedRating | PSPD | |
| Acceleration | PACC | acceleration | AccelerationRating | PACC | |
| Agility | PAGI | agility | AgilityRating | PAGI | |
| Strength | PSTR | strength | StrengthRating | PSTR | |
| Jumping | PJMP | jumping | JumpingRating | PJMP | |
| Stamina | PSTA | stamina | StaminaRating | PSTA | |
| Awareness | PAWR | awareness | AwarenessRating | PAWR | |
| Change of Direction | PELU | changeOfDirection | ChangeOfDirectionRating | PELU | |
| Toughness | PTGH | toughness | ToughnessRating | PTGH | |
| Injury | PINJ | injury | InjuryRating | PINJ | |
| **BALL CARRIER** |
| Ball Carrier Vision | PBCV | ballCarrierVision | BCVisionRating | PBCV | |
| Break Tackle | PBKT | breakTackle | BreakTackleRating | PBKT | |
| Trucking | PLTR | trucking | TruckingRating | PLTR | |
| Stiff Arm | PLSA | stiffArm | StiffArmRating | PLSA | |
| Spin Move | PLSM | spinMove | SpinMoveRating | PLSM | |
| Juke Move | PLJM | jukeMove | JukeMoveRating | PLJM | |
| Carrying | PCAR | carrying | CarryingRating | PCAR | |
| **PASSING** |
| Throw Power | PTHP | throwPower | ThrowPowerRating | PTHP | |
| Throw Accuracy Short | PTAS | throwAccuracyShort | ThrowAccuracyShortRating | PTAS | |
| Throw Accuracy Mid | PTAM | throwAccuracyMid | ThrowAccuracyMidRating | PTAM | |
| Throw Accuracy Deep | PTAD | throwAccuracyDeep | ThrowAccuracyDeepRating | PTAD | |
| Throw On Run | PTOR | throwOnTheRun | ThrowOnTheRunRating | PTOR | |
| Throw Under Pressure | PTUP | throwUnderPressure | ThrowUnderPressureRating | PTUP | |
| Play Action | PPLA | playAction | PlayActionRating | PPLA | |
| Break Sack | PBSK | breakSack | BreakSackRating | PBSK | |
| **RECEIVING** |
| Catching | PCTH | catching | CatchingRating | PCTH | |
| Catch In Traffic | PLCI | catchInTraffic | CatchInTrafficRating | PLCI | |
| Spectacular Catch | PLSC | spectacularCatch | SpectacularCatchRating | PLSC | |
| Short Route Running | SRRN | shortRouteRunning | ShortRouteRunningRating | SRRN | |
| Medium Route Running | PMRR | mediumRouteRunning | MediumRouteRunningRating | PMRR | |
| Deep Route Running | PDRR | deepRouteRunning | DeepRouteRunningRating | PDRR | |
| Release | PLRL | release | ReleaseRating | PLRL | |
| **BLOCKING** |
| Pass Block | PPBK | passBlock | PassBlockRating | PPBK | |
| Pass Block Finesse | PPBF | passBlockFinesse | PassBlockFinesseRating | PPBF | |
| Pass Block Power | PPBS | passBlockPower | PassBlockPowerRating | PPBS | |
| Run Block | PRBK | runBlock | RunBlockRating | PRBK | |
| Run Block Finesse | PRBF | runBlockFinesse | RunBlockFinesseRating | PRBF | |
| Run Block Power | PRBS | runBlockPower | RunBlockPowerRating | PRBS | |
| Lead Block | PLBK | leadBlock | LeadBlockRating | PLBK | |
| Impact Blocking | PLIB | impactBlocking | ImpactBlockingRating | PLIB | |
| **DEFENSE** |
| Tackle | PTAK | tackle | TackleRating | PTAK | |
| Hit Power | PLHT | hitPower | HitPowerRating | PLHT | |
| Finesse Moves | PFMS | finesseMoves | FinesseMovesRating | PFMS | |
| Power Moves | PLPM | powerMoves | PowerMovesRating | PLPM | |
| Block Shedding | PBSG | blockShedding | BlockSheddingRating | PBSG | |
| Play Recognition | PLPR | playRecognition | PlayRecognitionRating | PLPR | |
| Pursuit | PLPU | pursuit | PursuitRating | PLPU | |
| **COVERAGE** |
| Man Coverage | PLMC | manCoverage | ManCoverageRating | PLMC | |
| Zone Coverage | PLZC | zoneCoverage | ZoneCoverageRating | PLZC | |
| Press Coverage | PLPE | pressCoverage | PressRating | PLPE | |
| **KICKING** |
| Kick Power | PKPR | kickPower | KickPowerRating | PKPR | |
| Kick Accuracy | PKAC | kickAccuracy | KickAccuracyRating | PKAC | |
| Kick Return | PKRT | kickReturn | KickReturnRating | PKRT | |
| Long Snap | PIMP | longSnap | LongSnapRating | PIMP | |
| **OTHER** |
| Overall | POVR | overall | - | POVR | Calculated |
| Position | PPOS | position | - | PPOS | |
| Archetype | PLTY | archetype | - | PLTY | |

## Binary File Byte Offsets (M26 Draft Class)

These are the byte offsets in the 200-byte attribute section (starting at block + 0x1000):

| Offset | Field | M26 Code |
|--------|-------|----------|
| 0x51 | Overall | POVR |
| 0x52 | Acceleration | PACC |
| 0x53 | Agility | PAGI |
| 0x54 | Awareness | PAWR |
| 0x55 | Ball Carrier Vision | PBCV |
| 0x56 | Block Shedding | PBSG |
| 0x57 | Break Sack | PBSK |
| 0x58 | Break Tackle | PBKT |
| 0x59 | Carrying | PCAR |
| 0x5A | Catching | PCTH |
| 0x5B | Catch In Traffic | PLCI |
| 0x5C | Change of Direction | PELU |
| 0x5D | Finesse Moves | PFMS |
| 0x5E | Hit Power | PLHT |
| 0x5F | Impact Blocking | PLIB |
| 0x60 | Injury | PINJ |
| 0x61 | Juke Move | PLJM |
| 0x62 | Jumping | PJMP |
| 0x63 | Kick Accuracy | PKAC |
| 0x64 | Kick Power | PKPR |
| 0x65 | Kick Return | PKRT |
| 0x66 | Lead Block | PLBK |
| 0x68 | Man Coverage | PLMC |
| 0x69 | Pass Block Power | PPBS |
| 0x6A | Pass Block Finesse | PPBF |
| 0x6B | Pass Block | PPBK |
| 0x6D | Play Action | PPLA |
| 0x6E | Play Recognition | PLPR |
| 0x6F | Power Moves | PLPM |
| 0x70 | Press Coverage | PLPE |
| 0x71 | Pursuit | PLPU |
| 0x72 | Release | PLRL |
| 0x73 | Deep Route Running | PDRR |
| 0x74 | Medium Route Running | PMRR |
| 0x75 | Short Route Running | SRRN |
| 0x76 | Run Block Finesse | PRBF |
| 0x77 | Run Block Power | PRBS |
| 0x78 | Run Block | PRBK |
| 0x7A | Spectacular Catch | PLSC |
| 0x7B | Speed | PSPD |
| 0x7C | Spin Move | PLSM |
| 0x7D | Stamina | PSTA |
| 0x7E | Stiff Arm | PLSA |
| 0x7F | Strength | PSTR |
| 0x80 | Tackle | PTAK |
| 0x81 | Throw Accuracy Deep | PTAD |
| 0x82 | Throw Accuracy Mid | PTAM |
| 0x84 | Throw Accuracy Short | PTAS |
| 0x85 | Throw On Run | PTOR |
| 0x86 | Throw Power | PTHP |
| 0x87 | Throw Under Pressure | PTUP |
| 0x88 | Toughness | PTGH |
| 0x89 | Trucking | PLTR |
| 0x8A | Zone Coverage | PLZC |
| 0x8B | Long Snap | PIMP |

## Critical Notes

1. **PBF/PBS Order**: In binary, PBS (0x69) comes BEFORE PBF (0x6A). Parser must read in this order.
2. **M26Parser uses explicit offsets** - correct for M26 files
3. **draftClassFunctions.js uses sequential reading** - only for legacy M25 files
4. **OVR Calculator expects field codes** (PSPD, PPBF) not camelCase (speed, passBlockFinesse)
5. **Database push converts camelCase to field codes** via RATING_FIELD_MAP
