/**
 * Add diagnostic logging to trace team-coach matching in the UI
 * This will reveal exactly what values are flowing through the system
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'renderer', 'js', 'franchise-editor.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the team card click handler and add logging
const teamCardClickPattern = /card\.addEventListener\('click', \(\) => this\.viewTeamByTeamIndex\(teamId\)\);/;
const teamCardReplacement = `card.addEventListener('click', () => {
            console.log('🔵 [DIAGNOSTIC] Team card clicked:', {
                teamName: teamName,
                teamId: teamId,
                teamIndex: team.TeamIndex,
                arrayPosition: index
            });
            this.viewTeamByTeamIndex(teamId);
        });`;

content = content.replace(teamCardClickPattern, teamCardReplacement);

// Find viewTeamByTeamIndex and add logging at the start
const viewByIndexPattern = /viewTeamByTeamIndex\(teamId\) \{(\s+)console\.log\('\[Franchise Editor\] Viewing team by TeamIndex:', teamId\);/;
const viewByIndexReplacement = `viewTeamByTeamIndex(teamId) {
        console.log('🔵 [DIAGNOSTIC] viewTeamByTeamIndex called with:', teamId);
        console.log('[Franchise Editor] Viewing team by TeamIndex:', teamId);`;

content = content.replace(viewByIndexPattern, viewByIndexReplacement);

// Find where we create Staff button and add logging
const staffButtonPattern = /staffBtn\.addEventListener\('click', \(\) => this\.viewTeamStaffByTeamId\(teamId\)\);/;
const staffButtonReplacement = `staffBtn.addEventListener('click', () => {
                console.log('🔵 [DIAGNOSTIC] Staff button clicked:', {
                    teamId: teamId,
                    teamName: team ? (team.DisplayName || team.LongName) : 'TEAM NOT FOUND'
                });
                this.viewTeamStaffByTeamId(teamId);
            });`;

content = content.replace(staffButtonPattern, staffButtonReplacement);

// Find viewTeamStaffByTeamId and add detailed logging
const viewStaffByIdPattern = /viewTeamStaffByTeamId\(teamId\) \{(\s+)const team = this\.franchiseData\.teams\.find/;
const viewStaffByIdReplacement = `viewTeamStaffByTeamId(teamId) {
        console.log('🔵 [DIAGNOSTIC] viewTeamStaffByTeamId called with:', teamId);
        const team = this.franchiseData.teams.find`;

content = content.replace(viewStaffByIdPattern, viewStaffByIdReplacement);

// Add logging after finding team in viewTeamStaffByTeamId
const afterFindPattern = /(viewTeamStaffByTeamId\(teamId\) \{[\s\S]*?const team = this\.franchiseData\.teams\.find[\s\S]*?\}\);[\s\n]*)(const teamIndex = this\.franchiseData\.teams\.indexOf\(team\);)/;
const afterFindReplacement = `$1console.log('🔵 [DIAGNOSTIC] viewTeamStaffByTeamId found team:', {
            teamId: teamId,
            foundTeam: team ? (team.DisplayName || team.LongName) : 'NULL',
            foundTeamIndex: team ? team.TeamIndex : 'N/A',
            arrayPosition: team ? this.franchiseData.teams.indexOf(team) : -1
        });
        $2`;

content = content.replace(afterFindPattern, afterFindReplacement);

// Find viewTeamStaff and add logging
const viewStaffPattern = /viewTeamStaff\(teamIndexOrTeamId\) \{(\s+)console\.log\('\[Franchise Editor\] Viewing team staff:', teamIndexOrTeamId\);/;
const viewStaffReplacement = `viewTeamStaff(teamIndexOrTeamId) {
        console.log('🔵 [DIAGNOSTIC] viewTeamStaff called with:', teamIndexOrTeamId);
        console.log('[Franchise Editor] Viewing team staff:', teamIndexOrTeamId);`;

content = content.replace(viewStaffPattern, viewStaffReplacement);

// Add logging after finding team in viewTeamStaff
const viewStaffFindPattern = /(viewTeamStaff\(teamIndexOrTeamId\) \{[\s\S]*?const team = this\.franchiseData\.teams\.find[\s\S]*?\}\);[\s\n]*)(if \(!team\) \{)/;
const viewStaffFindReplacement = `$1console.log('🔵 [DIAGNOSTIC] viewTeamStaff found team:', {
            lookingForTeamIndex: teamIndexOrTeamId,
            foundTeam: team ? (team.DisplayName || team.LongName) : 'NULL',
            foundTeamIndex: team ? team.TeamIndex : 'N/A'
        });
        $2`;

content = content.replace(viewStaffFindPattern, viewStaffFindReplacement);

// Add logging before filtering coaches
const filterCoachesPattern = /(const teamId = team\.TeamIndex[\s\S]*?;[\s\n]*)(\/\/ Filter coaches by team)/;
const filterCoachesReplacement = `$1console.log('🔵 [DIAGNOSTIC] About to filter coaches:', {
            teamId: teamId,
            totalCoaches: this.franchiseData.coaches ? this.franchiseData.coaches.length : 0
        });
        $2`;

content = content.replace(filterCoachesPattern, filterCoachesReplacement);

// Add logging after filtering coaches
const afterFilterPattern = /(const teamCoaches = this\.franchiseData\.coaches\.filter[\s\S]*?\}\);[\s\n]*)(const contentArea = document\.getElementById\('team-content-area'\);)/;
const afterFilterReplacement = `$1console.log('🔵 [DIAGNOSTIC] Filtered coaches result:', {
            teamId: teamId,
            coachesFound: teamCoaches.length,
            coaches: teamCoaches.map(c => ({
                name: \`\${c.FirstName} \${c.LastName}\`,
                position: c.Position,
                teamIndex: c.TeamIndex
            }))
        });
        $2`;

content = content.replace(afterFilterPattern, afterFilterReplacement);

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Added diagnostic logging to franchise-editor.js');
console.log('\nNow when you:');
console.log('1. Click a team card');
console.log('2. Click the Staff button');
console.log('\nYou will see detailed logs showing:');
console.log('- What TeamIndex was passed');
console.log('- What team was found');
console.log('- What coaches were filtered');
console.log('- The exact values at each step');
console.log('\nThis will reveal where the mismatch is happening.');
