/**
 * Fix all issues in both 1980test and AUTOSAVE files:
 * 1. Coach Name field to match FirstName/LastName
 * 2. GameStatus reset to Unplayed
 * 3. CurrentWeek reset to 0
 */
const { create } = require('madden-franchise');
const fs = require('fs');
const path = require('path');

async function fixFile(filePath, fileName) {
  console.log('\n========== FIXING: ' + fileName + ' ==========');

  const franchise = await create(filePath);

  // 1. Fix Coach Name field
  console.log('\n--- Fixing Coach Names ---');
  const ct = franchise.getTableByName('Coach');
  await ct.readRecords();

  let coachesFixed = 0;
  for (const c of ct.records) {
    if (c.isEmpty) continue;

    const firstName = c.FirstName || '';
    const lastName = c.LastName || '';
    const oldName = c.Name || '';

    // Format: "F. LastName" (e.g., "C. Studley")
    const expectedName = firstName.charAt(0) + '. ' + lastName;

    if (oldName !== expectedName && firstName && lastName) {
      c.Name = expectedName;
      coachesFixed++;
      if (coachesFixed <= 5) {
        console.log('  Fixed: "' + oldName + '" -> "' + expectedName + '"');
      }
    }
  }
  console.log('Fixed ' + coachesFixed + ' coach names');

  // 2. Fix GameStatus
  console.log('\n--- Fixing GameStatus ---');
  const gt = franchise.getTableByUniqueId(1607878349);
  await gt.readRecords();

  let gamesFixed = 0;
  for (const g of gt.records) {
    if (g.isEmpty) continue;

    const status = String(g.GameStatus);
    if (status === 'HomeWon' || status === 'AwayWon') {
      g.GameStatus = 'Unplayed';
      gamesFixed++;
    }
  }
  console.log('Fixed ' + gamesFixed + ' game statuses');

  // 3. Fix CurrentWeek
  console.log('\n--- Fixing CurrentWeek ---');
  const si = franchise.getTableByName('SeasonInfo');
  await si.readRecords();

  for (const r of si.records) {
    if (r.isEmpty === false) {
      const oldWeek = r.CurrentWeek;
      if (oldWeek !== 0) {
        r.CurrentWeek = 0;
        console.log('Fixed CurrentWeek: ' + oldWeek + ' -> 0');
      } else {
        console.log('CurrentWeek already 0');
      }
    }
  }

  // Save
  console.log('\n--- Saving ---');
  await franchise.save(filePath);
  console.log('Saved: ' + filePath);
}

async function main() {
  const files = [
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: 'AUTOSAVE', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE' }
  ];

  for (const file of files) {
    try {
      await fixFile(file.path, file.name);
    } catch (err) {
      console.log('Error fixing ' + file.name + ': ' + err.message);
    }
  }

  // Verify
  console.log('\n\n========== VERIFICATION ==========');
  for (const file of files) {
    console.log('\n' + file.name + ':');
    try {
      const f = await create(file.path);

      const si = f.getTableByName('SeasonInfo');
      await si.readRecords();
      for (const r of si.records) {
        if (r.isEmpty === false) {
          console.log('  CurrentWeek:', r.CurrentWeek);
        }
      }

      const ct = f.getTableByName('Coach');
      await ct.readRecords();
      let count = 0;
      for (const c of ct.records) {
        if (c.isEmpty) continue;
        if (count < 3) {
          console.log('  Coach: Name="' + c.Name + '", First="' + c.FirstName + '", Last="' + c.LastName + '"');
          count++;
        }
      }

      const gt = f.getTableByUniqueId(1607878349);
      await gt.readRecords();
      let unplayed = 0;
      let played = 0;
      for (const g of gt.records) {
        if (g.isEmpty) continue;
        const wt = g.SeasonWeekType;
        if (wt === 0 || wt === 'PreSeason') {
          const status = String(g.GameStatus);
          if (status === 'Unplayed') unplayed++;
          else if (status === 'HomeWon' || status === 'AwayWon') played++;
        }
      }
      console.log('  Preseason: ' + unplayed + ' unplayed, ' + played + ' played');

    } catch (err) {
      console.log('  Error: ' + err.message);
    }
  }
}

main().catch(console.error);
