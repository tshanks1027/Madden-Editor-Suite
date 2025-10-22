// Extract franchise data for UI prototype
const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

const franchisePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';
const outputPath = path.join(__dirname, '..', 'franchise-data.json');

async function extractFranchiseData() {
  console.log('Opening franchise file...');
  const franchise = new Franchise(franchisePath);

  try {
    // List all tables to find correct names
    console.log('Available tables:', franchise.schema.tables.map(t => t.name).slice(0, 50).join(', '));

    // Load all tables
    const playerTable = franchise.getTableByName('Player');
    const teamTable = franchise.getTableByName('Team');
    const seasonInfoTable = franchise.getTableByName('SeasonInfo');
    const playerStatsTable = franchise.getTableByName('PlayerCareerStats') || franchise.getTableByName('PlayerSeasonStats');
    const playerAwardsTable = franchise.getTableByName('PlayerAward');

    if (!playerTable) throw new Error('Player table not found');
    if (!teamTable) throw new Error('Team table not found');
    if (!seasonInfoTable) throw new Error('SeasonInfo table not found');

    await playerTable.readRecords();
    await teamTable.readRecords();
    await seasonInfoTable.readRecords();
    if (playerStatsTable) await playerStatsTable.readRecords();
    if (playerAwardsTable) await playerAwardsTable.readRecords();

    console.log(`Loaded ${playerTable.recordsRead} players`);
    console.log(`Loaded ${teamTable.recordsRead} teams`);

    // Extract season info
    const seasonInfo = seasonInfoTable.records[0];
    const currentSeason = seasonInfo.CurrentSeasonYear;
    const currentWeek = seasonInfo.CurrentWeekType;

    // Extract teams
    const teams = teamTable.records
      .filter(t => t.TEAM_VISIBLE)
      .map(team => ({
        index: team._index,
        name: team.DisplayName || team.LongName || team.ShortName,
        shortName: team.ShortName,
        city: team.CityName,
        abbr: team.TeamName,
        wins: team.SeasonWins || 0,
        losses: team.SeasonLosses || 0,
        ties: team.SeasonTies || 0,
        capRoom: team.CapRoom || 0,
        offensiveScheme: team.OffensiveScheme,
        defensiveScheme: team.DefensiveScheme
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Extract top players with stats
    const topPlayers = playerTable.records
      .filter(p => p.Position !== 'QB' || p.Overall > 70) // Filter for relevant players
      .sort((a, b) => b.Overall - a.Overall)
      .slice(0, 50)
      .map(player => {
        const team = teamTable.records.find(t => t._index === player.TeamIndex);
        const stats = playerStatsTable.records.find(s => s.Player === player._index);

        return {
          index: player._index,
          firstName: player.FirstName,
          lastName: player.LastName,
          position: player.Position,
          jerseyNum: player.JerseyNum,
          overall: player.Overall,
          age: player.Age,
          teamIndex: player.TeamIndex,
          teamName: team ? team.DisplayName : 'Free Agent',

          // Physical
          height: player.Height,
          weight: player.Weight,

          // Key Ratings
          speed: player.SpeedRating,
          acceleration: player.AccelerationRating,
          strength: player.StrengthRating,
          awareness: player.AwarenessRating,

          // Position-specific stats (if available)
          stats: stats ? {
            gamesPlayed: stats.GamesPlayed || 0,
            // QB stats
            passAttempts: stats.PassAttempts || 0,
            passCompletions: stats.PassCompletions || 0,
            passYards: stats.PassYards || 0,
            passTDs: stats.PassTDs || 0,
            interceptions: stats.Interceptions || 0,
            // RB stats
            rushAttempts: stats.RushAttempts || 0,
            rushYards: stats.RushYards || 0,
            rushTDs: stats.RushTDs || 0,
            // WR/TE stats
            receptions: stats.Receptions || 0,
            recYards: stats.ReceivingYards || 0,
            recTDs: stats.ReceivingTDs || 0,
            // DEF stats
            tackles: stats.Tackles || 0,
            sacks: stats.Sacks || 0,
            forcedFumbles: stats.ForcedFumbles || 0,
            interceptionsCaught: stats.DefInterceptions || 0
          } : null
        };
      });

    // Extract player awards
    const awards = playerAwardsTable.records.map(award => {
      const player = playerTable.records.find(p => p._index === award.Player);
      return {
        playerIndex: award.Player,
        playerName: player ? `${player.FirstName} ${player.LastName}` : 'Unknown',
        awardType: award.AwardType,
        seasonYear: award.SeasonYear,
        weekNumber: award.WeekNumber
      };
    });

    // Build output data
    const franchiseData = {
      metadata: {
        fileName: 'CAREER-AUG07-02h00m07p-AUTOSAVE',
        gameVersion: 'Madden 26',
        currentSeason: currentSeason,
        currentWeek: currentWeek,
        totalPlayers: playerTable.recordsRead,
        totalTeams: teams.length,
        extractedAt: new Date().toISOString()
      },
      teams: teams,
      topPlayers: topPlayers,
      awards: awards
    };

    // Write to file
    fs.writeFileSync(outputPath, JSON.stringify(franchiseData, null, 2));
    console.log(`\n✓ Extracted franchise data to ${outputPath}`);
    console.log(`  - ${teams.length} teams`);
    console.log(`  - ${topPlayers.length} top players`);
    console.log(`  - ${awards.length} awards`);

  } catch (error) {
    console.error('Error extracting franchise data:', error);
    throw error;
  }
}

extractFranchiseData().catch(console.error);
