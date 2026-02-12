/**
 * Madden Player Trait Definitions
 * Complete trait definitions for franchise files (PT_* fields), roster files (TR* fields),
 * and draft class files.
 *
 * Franchise files: Use boolean PT_* fields directly
 * Roster files: Use TR* fields (need mapping to trait names)
 * Draft class files: Binary offsets (TBD)
 */

/**
 * All player traits with display names, descriptions, and applicable positions
 * Key format matches franchise file field names (without PT_ prefix)
 */
export const PLAYER_TRAITS = {
    // QB Traits
    AGGRESSIVEQB: {
        display: 'Aggressive QB',
        description: 'QB takes more risks and throws into tight coverage',
        category: 'QB',
        positions: ['QB']
    },
    CANNON: {
        display: 'Cannon Arm',
        description: 'QB can make extremely powerful throws',
        category: 'QB',
        positions: ['QB']
    },
    CONSERVATIVE: {
        display: 'Conservative',
        description: 'QB avoids risky throws and checks down more often',
        category: 'QB',
        positions: ['QB']
    },
    EYESUP: {
        display: 'Eyes Up',
        description: 'QB keeps eyes downfield while avoiding pressure',
        category: 'QB',
        positions: ['QB']
    },
    HAPPYFEET: {
        display: 'Happy Feet',
        description: 'QB tends to scramble even when not under pressure',
        category: 'QB',
        positions: ['QB']
    },
    HEROBALL: {
        display: 'Hero Ball',
        description: 'QB tries to make big plays in clutch situations',
        category: 'QB',
        positions: ['QB']
    },
    LOOKFORSTARS: {
        display: 'Look for Stars',
        description: 'QB targets star receivers more often',
        category: 'QB',
        positions: ['QB']
    },
    OBLIVIOUS: {
        display: 'Oblivious',
        description: 'QB is less aware of incoming pressure',
        category: 'QB',
        positions: ['QB']
    },
    PARANOID: {
        display: 'Paranoid',
        description: 'QB panics under pressure more easily',
        category: 'QB',
        positions: ['QB']
    },
    POCKETPASSER: {
        display: 'Pocket Passer',
        description: 'QB prefers to stay in the pocket',
        category: 'QB',
        positions: ['QB']
    },
    QUICKCLOCK: {
        display: 'Quick Clock',
        description: 'QB gets the ball out quickly',
        category: 'QB',
        positions: ['QB']
    },
    QUICKTRIGGER: {
        display: 'Quick Trigger',
        description: 'QB releases the ball very quickly',
        category: 'QB',
        positions: ['QB']
    },
    RISKTAKER: {
        display: 'Risk Taker',
        description: 'QB throws into tight windows more often',
        category: 'QB',
        positions: ['QB']
    },
    SCRAMBLER: {
        display: 'Scrambler',
        description: 'QB likes to run when plays break down',
        category: 'QB',
        positions: ['QB']
    },
    SEEINGGHOSTS: {
        display: 'Seeing Ghosts',
        description: 'QB senses phantom pressure and throws early',
        category: 'QB',
        positions: ['QB']
    },
    SETUPTIME: {
        display: 'Setup Time',
        description: 'QB needs more time to make reads',
        category: 'QB',
        positions: ['QB']
    },
    SNAPMISCHIEF: {
        display: 'Snap Mischief',
        description: 'QB draws defenders offsides with hard counts',
        category: 'QB',
        positions: ['QB']
    },
    THROWAWAY: {
        display: 'Throw Away',
        description: 'QB throws the ball away rather than taking sacks',
        category: 'QB',
        positions: ['QB']
    },
    TRIGGERHAPPY: {
        display: 'Trigger Happy',
        description: 'QB throws to first read without progression',
        category: 'QB',
        positions: ['QB']
    },
    UPANDOVER: {
        display: 'Up and Over',
        description: 'QB uses a high throwing motion',
        category: 'QB',
        positions: ['QB']
    },

    // Ball Carrier Traits (HB/FB/WR/TE)
    AGGRESSIVE: {
        display: 'Aggressive Receiver',
        description: 'Receiver fights for the ball in contested catches',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    COVERBALL: {
        display: 'Cover Ball',
        description: 'Ball carrier covers up in traffic to avoid fumbles',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    ELUSIVEINSTINCT: {
        display: 'Elusive Instinct',
        description: 'Ball carrier has natural instincts to avoid tackles',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    HIGHLIGHTREEL: {
        display: 'Highlight Reel',
        description: 'Ball carrier makes spectacular plays',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    POSSESSION: {
        display: 'Possession Receiver',
        description: 'Receiver focuses on securing the catch',
        category: 'Ball Carrier',
        positions: ['WR', 'TE']
    },
    RAC: {
        display: 'RAC Receiver',
        description: 'Receiver excels at gaining yards after the catch',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    RUNOVER: {
        display: 'Run Over',
        description: 'Ball carrier powers through tackles',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    SPINCYCLE: {
        display: 'Spin Cycle',
        description: 'Ball carrier uses spin moves effectively',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    STEERINGCLEAR: {
        display: 'Steering Clear',
        description: 'Receiver avoids contact and runs out of bounds',
        category: 'Ball Carrier',
        positions: ['WR', 'TE']
    },
    STRONGARM: {
        display: 'Strong Arm',
        description: 'Ball carrier uses stiff arm effectively',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    WHIRLWIND: {
        display: 'Whirlwind',
        description: 'Ball carrier spins through contact effectively',
        category: 'Ball Carrier',
        positions: ['HB', 'FB', 'WR', 'TE']
    },

    // Defensive Traits - Position-specific
    BIGHITTER: {
        display: 'Big Hitter',
        description: 'Defender delivers powerful hits',
        category: 'Defense',
        positions: ['LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    BOUNCER: {
        display: 'Bouncer',
        description: 'Defender bounces off blocks effectively',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT']
    },
    BULL: {
        display: 'Bull Rush',
        description: 'Pass rusher uses power to push through blockers',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },
    DISCIPLINED: {
        display: 'Disciplined',
        description: 'Player rarely commits penalties',
        category: 'Other',
        positions: ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    FLYSWATTER: {
        display: 'Fly Swatter',
        description: 'Defender swats down passes at the line',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT']
    },
    HAMMERHEAD: {
        display: 'Hammerhead',
        description: 'Defender uses head-first tackling style',
        category: 'Defense',
        positions: ['LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    HEADHUNTER: {
        display: 'Head Hunter',
        description: 'Defender targets ball carriers aggressively',
        category: 'Defense',
        positions: ['LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    KNEECAPBITER: {
        display: 'Kneecap Biter',
        description: 'Defender goes low for tackles',
        category: 'Defense',
        positions: ['LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    PLAYBALL: {
        display: 'Play Ball',
        description: 'Defender goes for interceptions',
        category: 'Defense',
        positions: ['LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    PLAYBALLAGGRESSIVE: {
        display: 'Play Ball Aggressive',
        description: 'Defender aggressively attacks the ball',
        category: 'Defense',
        positions: ['CB', 'FS', 'SS']
    },
    PLAYBALLCONSERVATIVE: {
        display: 'Play Ball Conservative',
        description: 'Defender plays it safe and goes for swats',
        category: 'Defense',
        positions: ['CB', 'FS', 'SS']
    },
    PLAYRECEIVER: {
        display: 'Play Receiver',
        description: 'Defender focuses on the receiver, not the ball',
        category: 'Defense',
        positions: ['CB', 'FS', 'SS']
    },
    PLAYDEFENDER: {
        display: 'Play Defender',
        description: 'Defender focuses on the offensive player',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT']
    },
    PUNCHITOUT: {
        display: 'Punch It Out',
        description: 'Defender goes for forced fumbles',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    SAFETACKLER: {
        display: 'Safe Tackler',
        description: 'Defender wraps up for secure tackles',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    SEDENTARY: {
        display: 'Sedentary',
        description: 'Defender is slow to react',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT']
    },
    STRIPSBALL: {
        display: 'Strips Ball',
        description: 'Defender actively tries to strip the ball',
        category: 'Defense',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    UNDISCIPLINED: {
        display: 'Undisciplined',
        description: 'Player commits penalties more often',
        category: 'Other',
        positions: ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },

    // Pass Rusher Traits - DL/Edge and edge-rushing LBs only
    FINESSERUSHER: {
        display: 'Finesse Rusher',
        description: 'Pass rusher uses speed and agility moves',
        category: 'Pass Rush',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },
    POWERRUSHER: {
        display: 'Power Rusher',
        description: 'Pass rusher uses strength-based moves',
        category: 'Pass Rush',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },
    SPINRUSHER: {
        display: 'Spin Rusher',
        description: 'Pass rusher uses spin moves',
        category: 'Pass Rush',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },
    UNDERCUT: {
        display: 'Undercut',
        description: 'Pass rusher dips under blockers effectively',
        category: 'Pass Rush',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },
    FREESTYLER: {
        display: 'Freestyler',
        description: 'Pass rusher uses creative moves',
        category: 'Pass Rush',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },
    TWISTER: {
        display: 'Twister',
        description: 'Pass rusher uses twist/stunt moves effectively',
        category: 'Pass Rush',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },
    BULLISH: {
        display: 'Bullish',
        description: 'Pass rusher has a powerful bull rush',
        category: 'Pass Rush',
        positions: ['LEDG', 'REDG', 'DT', 'LOLB', 'ROLB', 'SAM', 'WILL']
    },

    // Blocking Traits
    OLE: {
        display: 'Ole',
        description: 'Blocker whiffs on blocks occasionally',
        category: 'Blocking',
        positions: ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'FB']
    },

    // Other Traits
    DIVECELEBRATION: {
        display: 'Dive Celebration',
        description: 'Player dives into the end zone',
        category: 'Other',
        positions: ['QB', 'HB', 'FB', 'WR', 'TE']
    },
    DOUBLEBACK: {
        display: 'Double Back',
        description: 'Ball carrier reverses field',
        category: 'Other',
        positions: ['HB', 'FB', 'WR', 'TE']
    },
    EARLYCELEBRATION: {
        display: 'Early Celebration',
        description: 'Player celebrates before crossing goal line',
        category: 'Other',
        positions: ['QB', 'HB', 'FB', 'WR', 'TE']
    },
    GASGUZZLER: {
        display: 'Gas Guzzler',
        description: 'Player tires out faster',
        category: 'Other',
        positions: ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT', 'LOLB', 'MLB', 'ROLB', 'SAM', 'Mike', 'WILL', 'CB', 'FS', 'SS']
    },
    JAMMER: {
        display: 'Red Zone Jammer',
        description: 'Defender excels in red zone coverage',
        category: 'Other',
        positions: ['CB', 'FS', 'SS']
    },

    // Unused traits (may be used in future Madden versions)
    UNUSEDTRAIT1: {
        display: 'Unused Trait 1',
        description: 'Reserved for future use',
        category: 'Unused',
        positions: []
    },
    UNUSEDTRAIT2: {
        display: 'Unused Trait 2',
        description: 'Reserved for future use',
        category: 'Unused',
        positions: []
    },
    UNUSEDTRAIT3: {
        display: 'Unused Trait 3',
        description: 'Reserved for future use',
        category: 'Unused',
        positions: []
    }
};

/**
 * Position-specific trait groups
 * Maps position codes to applicable traits
 */
export const POSITION_TRAITS = {
    // Quarterback
    QB: [
        'AGGRESSIVEQB', 'CANNON', 'CONSERVATIVE', 'EYESUP', 'HAPPYFEET',
        'HEROBALL', 'LOOKFORSTARS', 'OBLIVIOUS', 'PARANOID', 'POCKETPASSER',
        'QUICKCLOCK', 'QUICKTRIGGER', 'RISKTAKER', 'SCRAMBLER', 'SEEINGGHOSTS',
        'SETUPTIME', 'SNAPMISCHIEF', 'THROWAWAY', 'TRIGGERHAPPY', 'UPANDOVER',
        'DIVECELEBRATION', 'EARLYCELEBRATION', 'GASGUZZLER'
    ],

    // Halfback
    HB: [
        'AGGRESSIVE', 'COVERBALL', 'ELUSIVEINSTINCT', 'HIGHLIGHTREEL', 'RAC',
        'RUNOVER', 'SPINCYCLE', 'STRONGARM', 'DIVECELEBRATION', 'DOUBLEBACK',
        'EARLYCELEBRATION', 'GASGUZZLER'
    ],

    // Fullback
    FB: [
        'AGGRESSIVE', 'COVERBALL', 'ELUSIVEINSTINCT', 'HIGHLIGHTREEL', 'RAC',
        'RUNOVER', 'SPINCYCLE', 'STRONGARM', 'OLE', 'DIVECELEBRATION',
        'DOUBLEBACK', 'EARLYCELEBRATION', 'GASGUZZLER'
    ],

    // Wide Receiver
    WR: [
        'AGGRESSIVE', 'COVERBALL', 'ELUSIVEINSTINCT', 'HIGHLIGHTREEL', 'POSSESSION',
        'RAC', 'RUNOVER', 'SPINCYCLE', 'STEERINGCLEAR', 'STRONGARM', 'WHIRLWIND',
        'DISCIPLINED', 'UNDISCIPLINED', 'DIVECELEBRATION', 'DOUBLEBACK',
        'EARLYCELEBRATION', 'GASGUZZLER'
    ],

    // Tight End
    TE: [
        'AGGRESSIVE', 'COVERBALL', 'ELUSIVEINSTINCT', 'HIGHLIGHTREEL', 'POSSESSION',
        'RAC', 'RUNOVER', 'SPINCYCLE', 'STEERINGCLEAR', 'STRONGARM', 'WHIRLWIND', 'OLE',
        'DISCIPLINED', 'UNDISCIPLINED', 'DIVECELEBRATION', 'DOUBLEBACK',
        'EARLYCELEBRATION', 'GASGUZZLER'
    ],

    // Offensive Line
    LT: ['DISCIPLINED', 'OLE', 'UNDISCIPLINED', 'GASGUZZLER'],
    LG: ['DISCIPLINED', 'OLE', 'UNDISCIPLINED', 'GASGUZZLER'],
    C: ['DISCIPLINED', 'OLE', 'UNDISCIPLINED', 'GASGUZZLER'],
    RG: ['DISCIPLINED', 'OLE', 'UNDISCIPLINED', 'GASGUZZLER'],
    RT: ['DISCIPLINED', 'OLE', 'UNDISCIPLINED', 'GASGUZZLER'],

    // Defensive Line / Edge - Pass rush focused
    LEDG: [
        'BOUNCER', 'BULL', 'FLYSWATTER', 'PLAYDEFENDER', 'PUNCHITOUT', 'SAFETACKLER',
        'SEDENTARY', 'STRIPSBALL', 'FINESSERUSHER', 'POWERRUSHER', 'SPINRUSHER',
        'UNDERCUT', 'FREESTYLER', 'TWISTER', 'BULLISH', 'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    REDG: [
        'BOUNCER', 'BULL', 'FLYSWATTER', 'PLAYDEFENDER', 'PUNCHITOUT', 'SAFETACKLER',
        'SEDENTARY', 'STRIPSBALL', 'FINESSERUSHER', 'POWERRUSHER', 'SPINRUSHER',
        'UNDERCUT', 'FREESTYLER', 'TWISTER', 'BULLISH', 'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    DT: [
        'BOUNCER', 'BULL', 'FLYSWATTER', 'PLAYDEFENDER', 'PUNCHITOUT', 'SAFETACKLER',
        'SEDENTARY', 'STRIPSBALL', 'FINESSERUSHER', 'POWERRUSHER', 'SPINRUSHER',
        'UNDERCUT', 'FREESTYLER', 'TWISTER', 'BULLISH', 'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],

    // Linebackers - Mix of pass rush (OLBs) and coverage
    // SAM (Strongside LB) - M26 name for LOLB
    SAM: [
        'BIGHITTER', 'BULL', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'PLAYBALL',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL', 'FINESSERUSHER', 'POWERRUSHER',
        'SPINRUSHER', 'UNDERCUT', 'FREESTYLER', 'TWISTER', 'BULLISH',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    LOLB: [
        'BIGHITTER', 'BULL', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'PLAYBALL',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL', 'FINESSERUSHER', 'POWERRUSHER',
        'SPINRUSHER', 'UNDERCUT', 'FREESTYLER', 'TWISTER', 'BULLISH',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    // Mike (Middle LB) - M26 name for MLB
    Mike: [
        'BIGHITTER', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'PLAYBALL',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    MLB: [
        'BIGHITTER', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'PLAYBALL',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    // WILL (Weakside LB) - M26 name for ROLB
    WILL: [
        'BIGHITTER', 'BULL', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'PLAYBALL',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL', 'FINESSERUSHER', 'POWERRUSHER',
        'SPINRUSHER', 'UNDERCUT', 'FREESTYLER', 'TWISTER', 'BULLISH',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    ROLB: [
        'BIGHITTER', 'BULL', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'PLAYBALL',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL', 'FINESSERUSHER', 'POWERRUSHER',
        'SPINRUSHER', 'UNDERCUT', 'FREESTYLER', 'TWISTER', 'BULLISH',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],

    // Secondary - Coverage focused
    CB: [
        'BIGHITTER', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'JAMMER',
        'PLAYBALL', 'PLAYBALLAGGRESSIVE', 'PLAYBALLCONSERVATIVE', 'PLAYRECEIVER',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    FS: [
        'BIGHITTER', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'JAMMER',
        'PLAYBALL', 'PLAYBALLAGGRESSIVE', 'PLAYBALLCONSERVATIVE', 'PLAYRECEIVER',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],
    SS: [
        'BIGHITTER', 'HAMMERHEAD', 'HEADHUNTER', 'KNEECAPBITER', 'JAMMER',
        'PLAYBALL', 'PLAYBALLAGGRESSIVE', 'PLAYBALLCONSERVATIVE', 'PLAYRECEIVER',
        'PUNCHITOUT', 'SAFETACKLER', 'STRIPSBALL',
        'DISCIPLINED', 'UNDISCIPLINED', 'GASGUZZLER'
    ],

    // Special Teams
    K: ['GASGUZZLER'],
    P: ['GASGUZZLER'],
    LS: ['GASGUZZLER']
};

// Alternate position names (for legacy/alternate position codes)
export const POSITION_ALIASES = {
    'Mike': 'MLB',
    'SAM': 'LOLB',
    'WILL': 'ROLB',
    'LE': 'LEDG',
    'RE': 'REDG'
};

/**
 * Roster file trait field mapping (TR* fields -> trait names)
 * Based on research of actual roster file field meanings
 *
 * NOTE: These mappings are tentative and may need verification through in-game testing
 */
export const ROSTER_TRAIT_MAPPING = {
    // Map TR* field codes to trait names
    TRBH: 'BIGHITTER',       // Big Hitter
    TRBR: 'BULLRUSH',        // Bull Rush (may map to BULL)
    TRCB: 'COVERBALL',       // Cover Ball
    TRCL: 'CLUTCH',          // Clutch (may be development-related)
    TRDO: 'DROPOPEN',        // Drop Open passes (may map to possession/catch traits)
    TRDS: 'DEEPSTREAK',      // Deep Streak (may be receiver route trait)
    TRFB: 'FORCEFUMBLE',     // Force Fumble (may map to PUNCHITOUT/STRIPSBALL)
    TRFK: 'FAKEOUT',         // Fakeout (may be juke/spin related)
    TRFY: 'FREELANCER',      // Freelancer (may be scrambler/playmaker)
    TRHM: 'HOMERUNHITTER',   // Home Run Hitter (may be highlight reel)
    TRJR: 'JUMPROUTE',       // Jump Route (may be route running related)
    TRSB: 'STRIPSBALL',      // Strips Ball
    TRSW: 'SWATBALL',        // Swat Ball (may map to PLAYBALL variants)
    TRTA: 'THROWAWAY',       // Throw Away
    TRTL: 'TIGHTLINESMAN',   // Tight Linesman (may be blocking related)
    TRTS: 'TOUGHSITUATION',  // Tough Situation (may be clutch/pressure related)
    TRWU: 'WARMUP'           // Warm Up (may be stamina related)
};

/**
 * Franchise file trait field names (PT_* prefix)
 * These are the actual field names used in franchise database tables
 */
export const FRANCHISE_TRAIT_FIELDS = [
    'PT_AGGRESSIVEQB', 'PT_CANNON', 'PT_CONSERVATIVE', 'PT_EYESUP', 'PT_HAPPYFEET',
    'PT_HEROBALL', 'PT_LOOKFORSTARS', 'PT_OBLIVIOUS', 'PT_PARANOID', 'PT_POCKETPASSER',
    'PT_QUICKCLOCK', 'PT_QUICKTRIGGER', 'PT_RISKTAKER', 'PT_SCRAMBLER', 'PT_SEEINGGHOSTS',
    'PT_SETUPTIME', 'PT_SNAPMISCHIEF', 'PT_THROWAWAY', 'PT_TRIGGERHAPPY', 'PT_UPANDOVER',
    'PT_AGGRESSIVE', 'PT_COVERBALL', 'PT_ELUSIVEINSTINCT', 'PT_HIGHLIGHTREEL',
    'PT_POSSESSION', 'PT_RAC', 'PT_RUNOVER', 'PT_SPINCYCLE', 'PT_STEERINGCLEAR', 'PT_STRONGARM', 'PT_WHIRLWIND',
    'PT_BIGHITTER', 'PT_BOUNCER', 'PT_BULL', 'PT_DISCIPLINED', 'PT_FLYSWATTER',
    'PT_HAMMERHEAD', 'PT_HEADHUNTER', 'PT_KNEECAPBITER', 'PT_PLAYBALL',
    'PT_PLAYBALLAGGRESSIVE', 'PT_PLAYBALLCONSERVATIVE', 'PT_PLAYRECEIVER',
    'PT_PUNCHITOUT', 'PT_SAFETACKLER', 'PT_SEDENTARY', 'PT_STRIPSBALL', 'PT_UNDISCIPLINED',
    'PT_FINESSERUSHER', 'PT_POWERRUSHER', 'PT_SPINRUSHER',
    'PT_UNDERCUT', 'PT_FREESTYLER', 'PT_TWISTER', 'PT_BULLISH', 'PT_PLAYDEFENDER',
    'PT_OLE',
    'PT_DIVECELEBRATION', 'PT_DOUBLEBACK', 'PT_EARLYCELEBRATION',
    'PT_GASGUZZLER', 'PT_JAMMER',
    'PT_UNUSEDTRAIT1', 'PT_UNUSEDTRAIT2', 'PT_UNUSEDTRAIT3'
];

/**
 * Trait categories for UI grouping
 */
export const TRAIT_CATEGORIES = {
    QB: {
        display: 'Quarterback',
        color: '#4CAF50',
        order: 1
    },
    'Ball Carrier': {
        display: 'Ball Carrier',
        color: '#2196F3',
        order: 2
    },
    Defense: {
        display: 'Defense',
        color: '#f44336',
        order: 3
    },
    'Pass Rush': {
        display: 'Pass Rush',
        color: '#FF9800',
        order: 4
    },
    Blocking: {
        display: 'Blocking',
        color: '#9C27B0',
        order: 5
    },
    Other: {
        display: 'Other',
        color: '#607D8B',
        order: 6
    },
    Unused: {
        display: 'Unused',
        color: '#9E9E9E',
        order: 99
    }
};

/**
 * Get traits applicable to a specific position
 * @param {string} position - Position code (e.g., 'QB', 'HB', 'WR')
 * @returns {Array} Array of trait objects with name and definition
 */
export function getTraitsForPosition(position) {
    // Check for position alias first
    const normalizedPosition = POSITION_ALIASES[position] || position;

    const traitNames = POSITION_TRAITS[normalizedPosition] || [];

    return traitNames.map(name => ({
        name,
        ...PLAYER_TRAITS[name]
    })).filter(trait => trait.display); // Filter out undefined traits
}

/**
 * Get traits grouped by category for a specific position
 * @param {string} position - Position code
 * @returns {Object} Object with category keys and arrays of traits
 */
export function getTraitsGroupedByCategory(position) {
    const traits = getTraitsForPosition(position);
    const grouped = {};

    traits.forEach(trait => {
        const category = trait.category || 'Other';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(trait);
    });

    // Sort by category order
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        const orderA = TRAIT_CATEGORIES[a]?.order || 99;
        const orderB = TRAIT_CATEGORIES[b]?.order || 99;
        return orderA - orderB;
    });

    const result = {};
    sortedCategories.forEach(cat => {
        result[cat] = grouped[cat];
    });

    return result;
}

/**
 * Convert franchise field name to trait name
 * @param {string} fieldName - Franchise field name (e.g., 'PT_HEROBALL')
 * @returns {string} Trait name (e.g., 'HEROBALL')
 */
export function franchiseFieldToTrait(fieldName) {
    if (fieldName.startsWith('PT_')) {
        return fieldName.substring(3);
    }
    return fieldName;
}

/**
 * Convert trait name to franchise field name
 * @param {string} traitName - Trait name (e.g., 'HEROBALL')
 * @returns {string} Franchise field name (e.g., 'PT_HEROBALL')
 */
export function traitToFranchiseField(traitName) {
    if (!traitName.startsWith('PT_')) {
        return 'PT_' + traitName;
    }
    return traitName;
}

/**
 * Convert roster field to trait name (if mapped)
 * @param {string} fieldName - Roster field name (e.g., 'TRBH')
 * @returns {string|null} Trait name or null if not mapped
 */
export function rosterFieldToTrait(fieldName) {
    return ROSTER_TRAIT_MAPPING[fieldName] || null;
}

/**
 * Get all trait field names for a file type
 * @param {string} fileType - 'franchise', 'roster', or 'draftclass'
 * @returns {Array} Array of field names
 */
export function getTraitFieldNames(fileType) {
    switch (fileType) {
        case 'franchise':
            return FRANCHISE_TRAIT_FIELDS;
        case 'roster':
            return Object.keys(ROSTER_TRAIT_MAPPING);
        case 'draftclass':
            // Draft class trait fields TBD
            return [];
        default:
            return [];
    }
}

/**
 * Position code to display name mapping
 */
export const POSITION_DISPLAY_NAMES = {
    QB: 'Quarterback',
    HB: 'Halfback',
    FB: 'Fullback',
    WR: 'Wide Receiver',
    TE: 'Tight End',
    LT: 'Left Tackle',
    LG: 'Left Guard',
    C: 'Center',
    RG: 'Right Guard',
    RT: 'Right Tackle',
    LEDG: 'Left Edge',
    REDG: 'Right Edge',
    DT: 'Defensive Tackle',
    LOLB: 'Left Outside LB',
    MLB: 'Middle Linebacker',
    ROLB: 'Right Outside LB',
    CB: 'Cornerback',
    FS: 'Free Safety',
    SS: 'Strong Safety',
    K: 'Kicker',
    P: 'Punter',
    LS: 'Long Snapper'
};
