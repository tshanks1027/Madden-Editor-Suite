/**
 * Test that the fix will work: Pass TeamIndex directly instead of array position
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function testFixHypothesis() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const teamTables = franchise.getAllTablesByName('Team');
    const teamTable = teamTables[1];
    await teamTable.readRecords();

    const coachTable = franchise.getTableByName('Coach');
    await coachTable.readRecords();

    const allTeams = teamTable.records.filter(r => !r.isEmpty);
    const coaches = coachTable.records.filter(r => !r.isEmpty && r.ContractStatus === 'Signed');

    console.log('=== TESTING FIX HYPOTHESIS ===\n');

    // Simulate clicking Bengals (TeamIndex 2)
    const bengalsTeamId = 2;

    console.log('1. User clicks Bengals team card');
    console.log(`   → Passes teamId = ${bengalsTeamId}\n`);

    // CURRENT BUGGY CODE:
    console.log('2. CURRENT CODE (buggy):');
    console.log('   viewTeamStaffByTeamId(2) does:');

    const team = allTeams.find(t => {
        const tId = t.TeamIndex !== undefined ? t.TeamIndex : (t.TGID !== undefined ? t.TGID : -1);
        return tId === bengalsTeamId;
    });

    console.log(`   → Finds team: ${team.DisplayName} (TeamIndex ${team.TeamIndex})`);

    const arrayIndex = allTeams.indexOf(team);
    console.log(`   → Gets array position: ${arrayIndex}`);
    console.log(`   → Calls viewTeamStaff(${arrayIndex})`);

    // What coaches does it get?
    const buggyTeamCoaches = coaches.filter(c => c.TeamIndex === arrayIndex);
    console.log(`   → Filters coaches for TeamIndex ${arrayIndex}`);
    console.log(`   → Result: ${buggyTeamCoaches.length} coaches:`);
    buggyTeamCoaches.forEach(c => {
        console.log(`      - ${c.FirstName} ${c.LastName} (${c.Position})`);
    });

    // PROPOSED FIX:
    console.log('\n3. PROPOSED FIX:');
    console.log('   viewTeamStaffByTeamId(2) should do:');
    console.log(`   → Just call viewTeamStaff(${bengalsTeamId}) directly`);
    console.log(`   → viewTeamStaff finds team with TeamIndex ${bengalsTeamId}`);
    console.log(`   → Filters coaches for TeamIndex ${bengalsTeamId}`);

    const fixedTeamCoaches = coaches.filter(c => c.TeamIndex === bengalsTeamId);
    console.log(`   → Result: ${fixedTeamCoaches.length} coaches:`);
    fixedTeamCoaches.forEach(c => {
        console.log(`      - ${c.FirstName} ${c.LastName} (${c.Position})`);
    });

    console.log('\n=== VERIFICATION ===');

    // Expected coaches for Bengals from previous tests
    const headCoach = fixedTeamCoaches.find(c => c.Position === 'HeadCoach');
    if (headCoach && headCoach.LastName === 'Taylor') {
        console.log('✅ FIX WORKS! Got Zac Taylor for Bengals');
    } else {
        console.log('❌ FIX FAILED! Head coach is:', headCoach ? `${headCoach.FirstName} ${headCoach.LastName}` : 'NONE');
    }
}

testFixHypothesis().catch(console.error);
