/**
 * Parse Andrew Luck's CSV data to see what throwing accuracy should be
 */

// CSV row for Andrew Luck 2013
const row = "2013,Colts,Andrew Luck,Andrew,Luck,QB,12,0,6295,0,Stanford,76,240,82,QB_Scrambler,82,88,59,84,60,72,58,92,25,28,26,22,21,37,86,98,97,69,49,55,72,24,66,72,15,52,23,45,33,47,26,17,10,10,19,24,25,15,21,83,39,55,36,14,12,10,26,93,90,81,74,88,,,,,,,,,,0,Rook,0,0,0,,12,1,49,55,24,66,72,15,47,10,10,19,24,25,15,21,83,39,55,12,10,26,99,40,42";

const parts = row.split(',');

// Header columns based on ROSTER_lookup.csv
const headers = [
  "Year",           // 0
  "Season_Team",    // 1
  "Player_Name",    // 2
  "First_Name",     // 3
  "Last_Name",      // 4
  "Position",       // 5
  "Jersey",         // 6
  "Age",            // 7
  "PID",            // 8
  "PAM",            // 9
  "College",        // 10
  "Height",         // 11
  "Weight",         // 12
  "POVR",           // 13
  "Archetype",      // 14
  "PSPD",           // 15 - Speed
  "PACC",           // 16 - Acceleration
  "PSTR",           // 17 - Strength
  "PAGI",           // 18 - Agility
  "PAWR",           // 19 - Awareness
  "PCTH",           // 20 - Catching
  "PCAR",           // 21 - Carrying
  "PTHP",           // 22 - Throw Power
  "PKPW",           // 23 - Kick Power
  "PKAC",           // 24 - Kick Accuracy
  "PRBK",           // 25 - Run Block
  "PPBK",           // 26 - Pass Block
  "PTAK",           // 27 - Tackle
  "PBTK",           // 28 - Break Tackle
  "PJMP",           // 29 - Jumping
  "PINJ",           // 30 - Injury
  "PSTA",           // 31 - Stamina
  "PTGH",           // 32 - Toughness
  "PTRK",           // 33 - Trucking
  "PCOD",           // 34 - Change of Direction
  "PBCV",           // 35 - Ball Carrier Vision
  "PSTF",           // 36 - Stiff Arm
  "PSPM",           // 37 - Spin Move
  "PJUM",           // 38 - Juke Move
  "PIBL",           // 39 - Impact Blocking
  "PRBP",           // 40 - Run Block Power
  "PRBF",           // 41 - Run Block Finesse
  "PPBP",           // 42 - Pass Block Power
  "PPBF",           // 43 - Pass Block Finesse
  "PLDB",           // 44 - Lead Block
  "PBRS",           // 45 - Break Sack
  "PTUP",           // 46 - Throw Under Pressure
  "PPWM",           // 47 - Power Moves
  "PFNM",           // 48 - Finesse Moves
  "PBSH",           // 49 - Block Shed
  "PPUR",           // 50 - Pursuit
  "PPRC",           // 51 - Play Recognition
  "PMCV",           // 52 - Man Coverage
  "PZCV",           // 53 - Zone Coverage
  "PSPC",           // 54 - Spectacular Catch
  "PCIT",           // 55 - Catch in Traffic
  "PSRR",           // 56 - Short Route Running
  "PMRR",           // 57 - Medium Route Running
  "PDRR",           // 58 - Deep Route Running
  "PHTP",           // 59 - Hit Power
  "PPRS",           // 60 - Press
  "PREL",           // 61 - Release
  "PTAS",           // 62 - Throw Accuracy Short
  "PTAM",           // 63 - Throw Accuracy Mid
  "PTAD",           // 64 - Throw Accuracy Deep
  "PPLA",           // 65 - Play Action
  "PTOR",           // 66 - Throw on Run
];

console.log("=== ANDREW LUCK 2013 CSV DATA ===");
console.log(`Total fields: ${parts.length}`);

// Print key fields
const keyFields = [
  { name: "Player_Name", index: 2 },
  { name: "Position", index: 5 },
  { name: "POVR", index: 13 },
  { name: "PSPD (Speed)", index: 15 },
  { name: "PACC (Acceleration)", index: 16 },
  { name: "PAWR (Awareness)", index: 19 },
  { name: "PTHP (Throw Power)", index: 22 },
  { name: "PTAS (Throw Acc Short)", index: 62 },
  { name: "PTAM (Throw Acc Mid)", index: 63 },
  { name: "PTAD (Throw Acc Deep)", index: 64 },
  { name: "PTOR (Throw on Run)", index: 66 },
  { name: "PTUP (Throw Under Pressure)", index: 46 },
];

console.log("\n=== KEY ATTRIBUTES ===");
for (const field of keyFields) {
  console.log(`${field.name}: ${parts[field.index]}`);
}

console.log("\n=== WHAT'S IN THE SAVED FILE ===");
console.log("throwAccuracyDeep (0x81): 16");
console.log("throwAccuracyMid (0x83): 11");
console.log("throwAccuracyShort (0x84): 32");
console.log("speed (0x7B): 82");
console.log("throwPower (0x86): 92");

console.log("\n=== COMPARISON ===");
console.log(`Throw Acc Short: CSV=${parts[62]}, File=32 ${parts[62] === '32' ? '✓' : '✗ MISMATCH!'}`);
console.log(`Throw Acc Mid: CSV=${parts[63]}, File=11 ${parts[63] === '11' ? '✓' : '✗ MISMATCH!'}`);
console.log(`Throw Acc Deep: CSV=${parts[64]}, File=16 ${parts[64] === '16' ? '✓' : '✗ MISMATCH!'}`);
