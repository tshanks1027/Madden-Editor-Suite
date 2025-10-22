// Franchise Data Extractor for UI Prototype
// Extracts data from a Madden franchise file and outputs JSON

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

// Default franchise path - can be overridden by command line argument
const defaultFranchisePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';
const franchisePath = process.argv[2] || defaultFranchisePath;
const outputPath = path.join(__dirname, '..', 'franchise-data.json');

console.log('=== Franchise Data Extractor ===\n');
console.log('Input:', franchisePath);
console.log('Output:', outputPath);
console.log('\nOpening franchise file...');

async function extractFranchiseData() {
  try {
    const franchise = new Franchise(franchisePath);

    // Check if schema exists
    if (!franchise.schema || !franchise.schema.tables) {
      throw new Error('Franchise schema not loaded. The file may not be a valid Madden franchise file.');
    }

    // Get available tables
    const tables = franchise.schema.tables.map(t => t.name);
    console.log(`Found ${tables.length} tables in schema`);

    // Try to find the right table names (M26 may have different names)
    const playerTableName = tables.find(t => t.toLowerCase().includes('player') && !t.toLowerCase().includes('award'));
    const teamTableName = tables.find(t => t.toLowerCase() === 'team');
    const seasonInfoTableName = tables.find(t => t.toLowerCase().includes('season') && t.toLowerCase().includes('info'));

    console.log('\nLoading tables:');
    console.log('  Player table:', playerTableName || 'NOT FOUND');
    console.log('  Team table:', teamTableName || 'NOT FOUND');
    console.log('  Season info:', seasonInfoTableName || 'NOT FOUND');

    if (!playerTableName || !teamTableName) {
      throw new Error('Could not find required tables. Available tables: ' + tables.slice(0, 20).join(', '));
    }

    // Load tables
    const playerTable = franchise.getTableByName(playerTableName);
    const teamTable = franchise.getTableByName(teamTableName);
    const seasonInfoTable = seasonInfoTableName ? franchise.getTableByName(seasonInfoTableName) : null;

    console.log('\nReading records...');
    await playerTable.readRecords();
    await teamTable.readRecords();
    if (seasonInfoTable) await seasonInfoTable.readRecords();

    console.log(`  Players: ${playerTable.records.length}`);
    console.log(`  Teams: ${teamTable.records.length}`);

    // Extract season info
    let currentSeason = 2025;
    let currentWeek = 1;
    if (seasonInfoTable && seasonInfoTable.records.length > 0) {
      const seasonInfo = seasonInfoTable.records[0];
      currentSeason = seasonInfo.CurrentSeasonYear || currentSeason;
      currentWeek = seasonInfo.CurrentWeekType || currentWeek;
    }

    // Extract teams
    console.log('\nProcessing teams...');
    const teams = teamTable.records
      .filter(t => t.TEAM_VISIBLE !== false)
      .map(team => ({
        index: team._index || team.index,
        name: team.DisplayName || team.LongName || team.ShortName || 'Unknown Team',
        shortName: team.ShortName || '',
        city: team.CityName || '',
        abbr: team.TeamName || '',
        wins: team.SeasonWins || 0,
        losses: team.SeasonLosses || 0,
        ties: team.SeasonTies || 0,
        capRoom: team.CapRoom || 0,
        offensiveScheme: team.OffensiveScheme,
        defensiveScheme: team.DefensiveScheme
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`  Processed ${teams.length} teams`);

    // Extract top players
    console.log('\nProcessing players...');
    const topPlayers = playerTable.records
      .filter(p => p.Overall && p.Overall > 70) // Only players with ratings
      .sort((a, b) => (b.Overall || 0) - (a.Overall || 0))
      .slice(0, 100) // Top 100 players
      .map(player => {
        const team = teamTable.records.find(t => t._index === player.TeamIndex);

        return {
          index: player._index || player.index,
          firstName: player.FirstName || 'Unknown',
          lastName: player.LastName || 'Player',
          position: player.Position || 'UNK',
          jerseyNum: player.JerseyNum || 0,
          overall: player.Overall || 0,
          age: player.Age || 0,
          teamIndex: player.TeamIndex,
          teamName: team ? (team.DisplayName || team.LongName || team.ShortName) : 'Free Agent',

          // Physical
          height: player.Height || 0,
          weight: player.Weight || 0,

          // Key Ratings
          speed: player.SpeedRating || 0,
          acceleration: player.AccelerationRating || 0,
          strength: player.StrengthRating || 0,
          awareness: player.AwarenessRating || 0,

          // Stats would require finding stats table - for now null
          stats: null
        };
      });

    console.log(`  Processed ${topPlayers.length} top players`);

    // Build output data
    const franchiseData = {
      metadata: {
        fileName: path.basename(franchisePath),
        gameVersion: 'Madden 26',
        currentSeason: currentSeason,
        currentWeek: currentWeek,
        totalPlayers: playerTable.records.length,
        totalTeams: teams.length,
        extractedAt: new Date().toISOString()
      },
      teams: teams,
      topPlayers: topPlayers,
      awards: [] // Would need to find awards table
    };

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(franchiseData, null, 2));

    console.log(`\n✓ Successfully extracted franchise data!`);
    console.log(`  Output: ${outputPath}`);
    console.log(`  Teams: ${teams.length}`);
    console.log(`  Top Players: ${topPlayers.length}`);
    console.log(`\nYou can now open franchise-ui-prototype-v3.html to view the data!`);

    return franchiseData;

  } catch (error) {
    console.error('\n✗ Error extracting franchise data:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

extractFranchiseData();
