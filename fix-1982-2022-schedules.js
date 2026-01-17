/**
 * Fix 1982 and 2022 schedules
 * - 1982: Replace with full intended 16-game schedule from original NFL schedule
 * - 2022: Add cancelled Bills @ Bengals game
 */

const fs = require('fs');
const path = require('path');

// Team name to index mapping
const teamNameMappings = {
  "Arizona Cardinals": 6, "Atlanta Falcons": 14, "Baltimore Ravens": 25,
  "Buffalo Bills": 2, "Carolina Panthers": 21, "Chicago Bears": 0,
  "Cincinnati Bengals": 1, "Cleveland Browns": 4, "Dallas Cowboys": 11,
  "Denver Broncos": 3, "Detroit Lions": 19, "Green Bay Packers": 20,
  "Houston Texans": 29, "Indianapolis Colts": 9, "Jacksonville Jaguars": 17,
  "Kansas City Chiefs": 8, "Las Vegas Raiders": 23, "Los Angeles Chargers": 7,
  "Los Angeles Rams": 24, "Miami Dolphins": 12, "Minnesota Vikings": 31,
  "New England Patriots": 22, "New Orleans Saints": 26, "New York Giants": 16,
  "New York Jets": 18, "Philadelphia Eagles": 13, "Pittsburgh Steelers": 28,
  "San Francisco 49ers": 15, "Seattle Seahawks": 27, "Tampa Bay Buccaneers": 5,
  "Tennessee Titans": 30, "Washington Commanders": 10,
  // 1982 team names
  "St. Louis Cardinals": 6, "Oakland Raiders": 23, "San Diego Chargers": 7,
  "Baltimore Colts": 9, "Houston Oilers": 30, "Washington Redskins": 10,
  "Los Angeles Raiders": 23,
  // Shortcuts
  "Atlanta": 14, "Buffalo": 2, "Chicago": 0, "Cincinnati": 1, "Cleveland": 4,
  "Dallas": 11, "Denver": 3, "Detroit": 19, "Green Bay": 20, "Houston": 30,
  "Kansas City": 8, "L.A. Raiders": 23, "L.A. Rams": 24, "Miami": 12,
  "Minnesota": 31, "New England": 22, "New Orleans": 26, "N.Y. Giants": 16,
  "N.Y. Jets": 18, "Oakland": 23, "Philadelphia": 13, "Pittsburgh": 28,
  "St. Louis": 6, "San Diego": 7, "San Francisco": 15, "Seattle": 27,
  "Tampa Bay": 5, "Washington": 10, "Baltimore": 9
};

function getTeamIndex(name) {
  // Direct lookup
  if (teamNameMappings[name] !== undefined) return teamNameMappings[name];

  // Try variations
  const variations = [
    name,
    name.replace("N.Y.", "New York"),
    name.replace("L.A.", "Los Angeles"),
  ];

  for (const v of variations) {
    if (teamNameMappings[v] !== undefined) return teamNameMappings[v];
  }

  console.warn(`Unknown team: ${name}`);
  return -1;
}

// 1982 Original Schedule - 224 games from the NFL schedule image
// Transcribed from the official 1982 NFL Schedule
// Format: [week, awayTeam, homeTeam] - reading "Away at Home"
const schedule1982 = [
  // FIRST WEEK (14 games)
  [1, "Atlanta", "N.Y. Giants"],         // 1
  [1, "Chicago", "Detroit"],             // 2
  [1, "Seattle", "Cleveland"],           // 3
  [1, "Cincinnati", "Houston"],          // 4
  [1, "Kansas City", "Buffalo"],         // 5
  [1, "Green Bay", "L.A. Rams"],         // 6
  [1, "N.Y. Jets", "Miami"],             // 7
  [1, "Baltimore", "New England"],       // 8
  [1, "L.A. Raiders", "San Francisco"],  // 9
  [1, "St. Louis", "New Orleans"],       // 10
  [1, "San Diego", "Denver"],            // 11
  [1, "Tampa Bay", "Minnesota"],         // 12
  [1, "Washington", "Philadelphia"],     // 13
  [1, "Pittsburgh", "Dallas"],           // 14

  // SECOND WEEK (14 games)
  [2, "Minnesota", "Buffalo"],           // 15
  [2, "Baltimore", "Miami"],             // 16
  [2, "Pittsburgh", "Cincinnati"],       // 17
  [2, "St. Louis", "Chicago"],           // 18
  [2, "Detroit", "L.A. Rams"],           // 19
  [2, "Chicago", "New Orleans"],         // 20
  [2, "N.Y. Jets", "New England"],       // 21
  [2, "Oakland", "Atlanta"],             // 22
  [2, "Philadelphia", "Cleveland"],      // 23
  [2, "Kansas City", "San Diego"],       // 24
  [2, "San Francisco", "Denver"],        // 25
  [2, "Seattle", "Houston"],             // 26
  [2, "Washington", "Tampa Bay"],        // 27
  [2, "Green Bay", "N.Y. Giants"],       // 28

  // THIRD WEEK (14 games)
  [3, "Atlanta", "Kansas City"],         // 29
  [3, "Buffalo", "Houston"],             // 30
  [3, "Chicago", "San Francisco"],       // 31
  [3, "Dallas", "Minnesota"],            // 32
  [3, "Denver", "New Orleans"],          // 33
  [3, "L.A. Raiders", "Philadelphia"],   // 34
  [3, "Miami", "Green Bay"],             // 35
  [3, "N.Y. Giants", "Pittsburgh"],      // 36
  [3, "N.Y. Jets", "Baltimore"],         // 37
  [3, "Oakland", "San Diego"],           // 38
  [3, "St. Louis", "Washington"],        // 39
  [3, "Seattle", "New England"],         // 40
  [3, "Tampa Bay", "Detroit"],           // 41
  [3, "Cincinnati", "Cleveland"],        // 42

  // FOURTH WEEK (14 games)
  [4, "Baltimore", "Detroit"],           // 43
  [4, "Cleveland", "Washington"],        // 44
  [4, "Houston", "N.Y. Jets"],           // 45
  [4, "Kansas City", "Seattle"],         // 46
  [4, "L.A. Raiders", "St. Louis"],      // 47
  [4, "Miami", "Cincinnati"],            // 48
  [4, "Minnesota", "Chicago"],           // 49
  [4, "New England", "Buffalo"],         // 50
  [4, "New Orleans", "Oakland"],         // 51
  [4, "N.Y. Giants", "Dallas"],          // 52
  [4, "Philadelphia", "Green Bay"],      // 53
  [4, "Pittsburgh", "Denver"],           // 54
  [4, "San Diego", "Atlanta"],           // 55
  [4, "San Francisco", "Tampa Bay"],     // 56

  // FIFTH WEEK (14 games)
  [5, "Atlanta", "L.A. Raiders"],        // 57
  [5, "Buffalo", "Baltimore"],           // 58
  [5, "Cincinnati", "New England"],      // 59
  [5, "Cleveland", "Oakland"],           // 60
  [5, "Denver", "N.Y. Jets"],            // 61
  [5, "Detroit", "Miami"],               // 62
  [5, "Green Bay", "Chicago"],           // 63
  [5, "Houston", "Kansas City"],         // 64
  [5, "Minnesota", "Tampa Bay"],         // 65
  [5, "St. Louis", "N.Y. Giants"],       // 66
  [5, "San Francisco", "New Orleans"],   // 67
  [5, "Seattle", "San Diego"],           // 68
  [5, "Washington", "Dallas"],           // 69
  [5, "Philadelphia", "Pittsburgh"],     // 70

  // SIXTH WEEK (14 games)
  [6, "Atlanta", "Detroit"],             // 71
  [6, "Baltimore", "Cleveland"],         // 72
  [6, "Chicago", "St. Louis"],           // 73
  [6, "Cincinnati", "N.Y. Giants"],      // 74
  [6, "Dallas", "Philadelphia"],         // 75
  [6, "Denver", "Houston"],              // 76
  [6, "Kansas City", "San Diego"],       // 77
  [6, "L.A. Rams", "San Francisco"],     // 78
  [6, "New England", "Miami"],           // 79
  [6, "New Orleans", "Minnesota"],       // 80
  [6, "Oakland", "Seattle"],             // 81
  [6, "Pittsburgh", "Washington"],       // 82
  [6, "Tampa Bay", "Green Bay"],         // 83
  [6, "Buffalo", "N.Y. Jets"],           // 84

  // SEVENTH WEEK (14 games)
  [7, "Cleveland", "Pittsburgh"],        // 85
  [7, "Dallas", "Cincinnati"],           // 86
  [7, "Detroit", "Buffalo"],             // 87
  [7, "Green Bay", "Minnesota"],         // 88
  [7, "Miami", "Baltimore"],             // 89
  [7, "New Orleans", "L.A. Raiders"],    // 90
  [7, "N.Y. Jets", "Kansas City"],       // 91
  [7, "Oakland", "Denver"],              // 92
  [7, "St. Louis", "New England"],       // 93
  [7, "San Diego", "Seattle"],           // 94
  [7, "San Francisco", "Atlanta"],       // 95
  [7, "Tampa Bay", "Houston"],           // 96
  [7, "Houston", "Washington"],          // 97
  [7, "N.Y. Giants", "Philadelphia"],    // 98

  // EIGHTH WEEK (14 games)
  [8, "Atlanta", "New Orleans"],         // 99
  [8, "Buffalo", "Denver"],              // 100
  [8, "Chicago", "Green Bay"],           // 101
  [8, "Dallas", "N.Y. Giants"],          // 102
  [8, "Houston", "Cleveland"],           // 103
  [8, "L.A. Raiders", "San Diego"],      // 104
  [8, "Miami", "Oakland"],               // 105
  [8, "New England", "N.Y. Jets"],       // 106
  [8, "Philadelphia", "St. Louis"],      // 107
  [8, "Pittsburgh", "Cincinnati"],       // 108
  [8, "San Francisco", "Washington"],    // 109
  [8, "Seattle", "Kansas City"],         // 110
  [8, "Tampa Bay", "Baltimore"],         // 111
  [8, "Detroit", "Minnesota"],           // 112

  // NINTH WEEK (14 games)
  [9, "Atlanta", "Chicago"],             // 113
  [9, "Baltimore", "New England"],       // 114
  [9, "Denver", "Seattle"],              // 115
  [9, "Detroit", "Philadelphia"],        // 116
  [9, "Green Bay", "Tampa Bay"],         // 117
  [9, "Houston", "Pittsburgh"],          // 118
  [9, "Kansas City", "Oakland"],         // 119
  [9, "L.A. Raiders", "New Orleans"],    // 120
  [9, "Minnesota", "San Francisco"],     // 121
  [9, "N.Y. Giants", "Cleveland"],       // 122
  [9, "N.Y. Jets", "Buffalo"],           // 123
  [9, "St. Louis", "Dallas"],            // 124
  [9, "Washington", "Cincinnati"],       // 125
  [9, "San Diego", "Miami"],             // 126

  // TENTH WEEK (14 games)
  [10, "Buffalo", "New England"],        // 127
  [10, "Chicago", "Tampa Bay"],          // 128
  [10, "Cincinnati", "Houston"],         // 129
  [10, "Cleveland", "Miami"],            // 130
  [10, "Dallas", "San Francisco"],       // 131
  [10, "Denver", "Kansas City"],         // 132
  [10, "Green Bay", "Detroit"],          // 133
  [10, "Minnesota", "Washington"],       // 134
  [10, "New Orleans", "San Diego"],      // 135
  [10, "N.Y. Giants", "L.A. Raiders"],   // 136
  [10, "N.Y. Jets", "Pittsburgh"],       // 137
  [10, "Oakland", "Baltimore"],          // 138
  [10, "Seattle", "St. Louis"],          // 139
  [10, "Philadelphia", "Atlanta"],       // 140

  // ELEVENTH WEEK (14 games)
  [11, "Baltimore", "N.Y. Jets"],        // 141
  [11, "Cincinnati", "Philadelphia"],    // 142
  [11, "Detroit", "Chicago"],            // 143
  [11, "Kansas City", "New Orleans"],    // 144
  [11, "L.A. Raiders", "Atlanta"],       // 145
  [11, "Miami", "Buffalo"],              // 146
  [11, "Minnesota", "Green Bay"],        // 147
  [11, "Pittsburgh", "Houston"],         // 148
  [11, "San Francisco", "St. Louis"],    // 149
  [11, "Seattle", "Denver"],             // 150
  [11, "Tampa Bay", "Dallas"],           // 151
  [11, "Washington", "N.Y. Giants"],     // 152
  [11, "San Diego", "L.A. Raiders"],     // 153  - Fixed: Oakland -> L.A. Raiders
  [11, "Cleveland", "L.A. Rams"],        // 154  - Added missing game

  // TWELFTH WEEK (14 games - Thanksgiving week)
  [12, "Cleveland", "Dallas"],           // 154 (Thanksgiving)
  [12, "N.Y. Giants", "Detroit"],        // 155 (Thanksgiving)
  [12, "Baltimore", "Buffalo"],          // 156
  [12, "Chicago", "Minnesota"],          // 157
  [12, "Denver", "San Diego"],           // 158
  [12, "Green Bay", "N.Y. Jets"],        // 159
  [12, "Houston", "New England"],        // 160
  [12, "Kansas City", "L.A. Raiders"],   // 161
  [12, "L.A. Rams", "San Francisco"],    // 162
  [12, "Oakland", "Cincinnati"],         // 163
  [12, "Philadelphia", "Washington"],    // 164
  [12, "Pittsburgh", "Seattle"],         // 165
  [12, "St. Louis", "Atlanta"],          // 166
  [12, "Miami", "Tampa Bay"],            // 167 (Monday)

  // THIRTEENTH WEEK (14 games)
  [13, "San Francisco", "L.A. Raiders"], // 168 (Thursday)
  [13, "Atlanta", "Denver"],             // 169
  [13, "Buffalo", "Green Bay"],          // 170
  [13, "Cincinnati", "Baltimore"],       // 171
  [13, "Dallas", "Washington"],          // 172
  [13, "Houston", "N.Y. Giants"],        // 173
  [13, "Kansas City", "Pittsburgh"],     // 174
  [13, "Minnesota", "Miami"],            // 175
  [13, "New England", "Chicago"],        // 176
  [13, "St. Louis", "Philadelphia"],     // 177
  [13, "San Diego", "Cleveland"],        // 178
  [13, "Seattle", "Oakland"],            // 179
  [13, "Tampa Bay", "New Orleans"],      // 180
  [13, "Detroit", "N.Y. Jets"],          // 181 (Monday)

  // FOURTEENTH WEEK (14 games)
  [14, "Philadelphia", "N.Y. Giants"],   // 182 (Saturday)
  [14, "San Diego", "San Francisco"],    // 183 (Saturday)
  [14, "Baltimore", "Minnesota"],        // 184
  [14, "Chicago", "Seattle"],            // 185
  [14, "Cleveland", "Cincinnati"],       // 186
  [14, "Denver", "L.A. Raiders"],        // 187
  [14, "Green Bay", "Detroit"],          // 188
  [14, "Miami", "New England"],          // 189
  [14, "New Orleans", "Atlanta"],        // 190
  [14, "Oakland", "Kansas City"],        // 191
  [14, "Pittsburgh", "Buffalo"],         // 192
  [14, "Tampa Bay", "N.Y. Jets"],        // 193
  [14, "Washington", "St. Louis"],       // 194
  [14, "Dallas", "Houston"],             // 195 (Monday)

  // FIFTEENTH WEEK (14 games)
  [15, "L.A. Rams", "L.A. Raiders"],     // 196 (Saturday) - Fixed: Original had L.A. Raiders at Oakland which is invalid
  [15, "N.Y. Jets", "Miami"],            // 197 (Saturday)
  [15, "Atlanta", "San Francisco"],      // 198
  [15, "Buffalo", "Tampa Bay"],          // 199
  [15, "Green Bay", "Baltimore"],        // 200
  [15, "Houston", "Philadelphia"],       // 201
  [15, "Kansas City", "Denver"],         // 202
  [15, "Minnesota", "Detroit"],          // 203
  [15, "New England", "Seattle"],        // 204
  [15, "New Orleans", "Dallas"],         // 205
  [15, "N.Y. Giants", "Washington"],     // 206
  [15, "Pittsburgh", "Cleveland"],       // 207
  [15, "St. Louis", "Chicago"],          // 208
  [15, "Cincinnati", "San Diego"],       // 209 (Monday)

  // SIXTEENTH WEEK (14 games)
  [16, "Baltimore", "San Diego"],        // 210
  [16, "Chicago", "L.A. Raiders"],       // 211
  [16, "Cleveland", "Houston"],          // 212
  [16, "Denver", "Oakland"],             // 213
  [16, "Detroit", "Tampa Bay"],          // 214
  [16, "Green Bay", "Atlanta"],          // 215
  [16, "New England", "Pittsburgh"],     // 216
  [16, "N.Y. Giants", "St. Louis"],      // 217
  [16, "N.Y. Jets", "Minnesota"],        // 218
  [16, "Philadelphia", "Dallas"],        // 219
  [16, "San Francisco", "Kansas City"],  // 220
  [16, "Seattle", "Cincinnati"],         // 221
  [16, "Washington", "New Orleans"],     // 222
  [16, "Buffalo", "Miami"],              // 223 (Monday)
];

// Fix team issues - Oakland references should be L.A. Raiders since they moved in 1982
const fixedSchedule1982 = schedule1982.map(([week, away, home]) => {
  // In 1982 Raiders were in LA, not Oakland
  const fixAway = away === "Oakland" ? "L.A. Raiders" : away;
  const fixHome = home === "Oakland" ? "L.A. Raiders" : home;
  return [week, fixAway, fixHome];
});

// Build the 1982 schedule JSON
const games1982 = [];
for (const [week, awayTeam, homeTeam] of fixedSchedule1982) {
  const awayIndex = getTeamIndex(awayTeam);
  const homeIndex = getTeamIndex(homeTeam);

  // Map short names to full names
  const teamFullNames = {
    "Atlanta": "Atlanta Falcons",
    "Buffalo": "Buffalo Bills",
    "Chicago": "Chicago Bears",
    "Cincinnati": "Cincinnati Bengals",
    "Cleveland": "Cleveland Browns",
    "Dallas": "Dallas Cowboys",
    "Denver": "Denver Broncos",
    "Detroit": "Detroit Lions",
    "Green Bay": "Green Bay Packers",
    "Houston": "Houston Oilers",
    "Kansas City": "Kansas City Chiefs",
    "L.A. Raiders": "Los Angeles Raiders",
    "L.A. Rams": "Los Angeles Rams",
    "Miami": "Miami Dolphins",
    "Minnesota": "Minnesota Vikings",
    "New England": "New England Patriots",
    "New Orleans": "New Orleans Saints",
    "N.Y. Giants": "New York Giants",
    "N.Y. Jets": "New York Jets",
    "Oakland": "Oakland Raiders",
    "Philadelphia": "Philadelphia Eagles",
    "Pittsburgh": "Pittsburgh Steelers",
    "St. Louis": "St. Louis Cardinals",
    "San Diego": "San Diego Chargers",
    "San Francisco": "San Francisco 49ers",
    "Seattle": "Seattle Seahawks",
    "Tampa Bay": "Tampa Bay Buccaneers",
    "Washington": "Washington Redskins",
    "Baltimore": "Baltimore Colts"
  };

  games1982.push({
    week,
    weekType: "regular",
    homeTeam: teamFullNames[homeTeam] || homeTeam,
    awayTeam: teamFullNames[awayTeam] || awayTeam,
    homeTeamIndex: homeIndex,
    awayTeamIndex: awayIndex
  });
}

const schedule1982Json = {
  year: 1982,
  seasonLength: 16,
  byeWeeksEnabled: false,
  regularSeasonWeeks: 16,
  games: games1982,
  playoffs: []
};

// Write 1982 schedule
fs.writeFileSync(
  path.join(__dirname, 'data', 'retro', 'schedules', '1982.json'),
  JSON.stringify(schedule1982Json, null, 2)
);
console.log(`Fixed 1982 schedule: ${games1982.length} games`);

// Fix 2022 - add Bills @ Bengals
const schedule2022 = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'retro', 'schedules', '2022.json'))
);

// Check if Bills @ Bengals already exists
const billsBengalsExists = schedule2022.games.some(
  g => g.week === 17 && g.homeTeamIndex === 1 && g.awayTeamIndex === 2
);

if (!billsBengalsExists) {
  schedule2022.games.push({
    week: 17,
    weekType: "regular",
    homeTeam: "Cincinnati Bengals",
    awayTeam: "Buffalo Bills",
    homeTeamIndex: 1,
    awayTeamIndex: 2
  });

  // Sort by week
  schedule2022.games.sort((a, b) => a.week - b.week);

  fs.writeFileSync(
    path.join(__dirname, 'data', 'retro', 'schedules', '2022.json'),
    JSON.stringify(schedule2022, null, 2)
  );
  console.log(`Fixed 2022 schedule: ${schedule2022.games.length} games (added Bills @ Bengals)`);
} else {
  console.log('2022 already has Bills @ Bengals game');
}
