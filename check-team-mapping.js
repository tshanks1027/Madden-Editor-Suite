async function analyze() {
  const mf = await import("madden-franchise");
  const filePath = "C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST";
  const franchise = await mf.create(filePath);

  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  console.log("=== TeamIndex to RecordIndex Mapping ===");

  const teams = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex \!== undefined) {
      teams.push({
        teamIndex: team.TeamIndex,
        recordIndex: team.index,
        name: team.LongName || team.DisplayName
      });
    }
  }

  teams.sort((a, b) => a.teamIndex - b.teamIndex);

  for (const t of teams) {
    const binary = t.recordIndex.toString(2).padStart(8, "0");
    console.log("TeamIdx " + t.teamIndex.toString().padStart(2) + " -> RecIdx " + t.recordIndex.toString().padStart(2) + " (bin: " + binary + ") = " + t.name);
  }
}

analyze();
