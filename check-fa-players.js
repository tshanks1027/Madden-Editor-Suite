const path = require('path');
const franchisePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-Testing';

(async () => {
  try {
    const Franchise = await import('madden-franchise');
    const franchise = await Franchise.create(franchisePath);

    // Find Player table
    const playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      console.log('Player table not found');
      return;
    }
    await playerTable.readRecords();

    // Search for Christian Wilkins and Stephon Gilmore
    const searchNames = ['Wilkins', 'Gilmore'];

    console.log('Searching for players...\n');

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const lastName = player.LastName || '';
      const firstName = player.FirstName || '';

      if (searchNames.some(name => lastName.includes(name))) {
        const teamIndex = player.TeamIndex;
        const contractStatus = player.ContractStatus || 'N/A';
        console.log(firstName + ' ' + lastName + ': TeamIndex=' + teamIndex + ', ContractStatus=' + contractStatus);
      }
    }

    // Also show what team indices are used for FA players
    console.log('\n--- All unique TeamIndex values for players with ContractStatus=FreeAgent ---');
    const faTeamIndices = new Set();
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      if (player.ContractStatus === 'FreeAgent') {
        faTeamIndices.add(Number(player.TeamIndex));
      }
    }
    console.log('TeamIndex values for FreeAgent players:', Array.from(faTeamIndices).sort((a,b) => a-b).join(', '));

  } catch (err) {
    console.error('Error:', err.message);
  }
})();
