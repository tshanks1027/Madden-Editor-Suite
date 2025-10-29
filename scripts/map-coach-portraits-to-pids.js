const fs = require('fs').promises;
const path = require('path');

/**
 * Maps coach portrait files (named with PAMs) to PID-based filenames
 * Reads Coach_lookup.csv to get PAM -> PID mappings
 * Copies portraits from source directory to temp directory with PID filenames
 */

const CONFIG = {
  coachLookupPath: path.join(__dirname, '..', 'data', 'lookups', 'Coach_lookup.csv'),
  sourceDir: path.join(__dirname, '..', 'data', 'Coach info', 'Coach and Owners'),
  outputDir: path.join(__dirname, '..', 'data', 'coach-portraits-by-pid'),
  genericSourceDir: path.join(__dirname, '..', 'data', 'Coach info', 'Coach and Owners', 'Generic')
};

async function loadCoachLookup() {
  const content = await fs.readFile(CONFIG.coachLookupPath, 'utf-8');
  const lines = content.trim().split('\n');

  const coaches = [];
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 4) {
      const lastName = parts[0].trim();
      const firstName = parts[1].trim();
      const pam = parts[2].trim();
      const pid = parseInt(parts[3].trim());

      if (!isNaN(pid)) {
        coaches.push({ lastName, firstName, pam, pid });
      }
    }
  }

  return coaches;
}

function normalizeName(name) {
  // Remove spaces, apostrophes, and special characters, convert to lowercase
  return name.toLowerCase().replace(/['\s.-]/g, '');
}

async function mapPortraitsToPIDs() {
  console.log('=== Coach Portrait PID Mapper ===\n');

  // Create output directory
  await fs.mkdir(CONFIG.outputDir, { recursive: true });

  // Load coach lookup
  console.log('Loading coach lookup...');
  const coaches = await loadCoachLookup();
  console.log(`Loaded ${coaches.length} coaches from lookup\n`);

  // Manual mappings for files that don't match automatically
  const manualMappings = {
    'mapo_coachportraits_CallahanBrian.png': 30,  // Callahan, Brian
    'mapo_coachportraits_CampbellDan.png': 18,     // Campbell, Dan
    'mapo_coachportraits_CarrollPete.png': 37,     // Carroll, Pete
    'mapo_coachportraits_CoenLiam.png': 33,        // Coen, Liam
    'mapo_coachportraits_GannonJonathan.png': 6,   // Gannon, Jonathan
    'mapo_coachportraits_HarbaughJohn.png': 24,    // Harbaugh, John
    'mapo_coachportraits_JohnsonBen.png': 35,      // Johnson, Ben
    'mapo_coachportraits_LaFleurMatt.png': 19,     // LaFleur, Matt
    'mapo_coachportraits_McvaySean.png': 23,       // McVay, Sean
    'mapo_coachportraits_MooreKellen.png': 26,     // Moore, Kellen
    'mapo_coachportraits_OConnellKevin.png': 31,   // O'Connell, Kevin
    'mapo_coachportraits_QuinnDan.png': 25,        // Quinn, Dan
    'mapo_coachportraits_ReidAndy.png': 8,         // Reid, Andy
    'mapo_coachportraits_SchottenheimerBrian.png': 36, // Schottenheimer, Brian
    'mapo_coachportraits_SirianniNick.png': 12,    // Sirianni, Nick
    'mapo_coachportraits_TaylorZac.png': 1,        // Taylor, Zac
    'mapo_ownerportraits_Amy_Strunk.png': 129,     // Strunk, Amy
    'mapo_ownerportraits_Art_RooneyIII.png': 128,  // Rooney, Art
    'mapo_ownerportraits_Bill_Bidwill.png': 106,   // Bidwill, Bill
    'mapo_ownerportraits_Clark_Hunt.png': 108,     // Hunt, Clark
    'mapo_ownerportraits_Jed_York.png': 114,       // York, Jed
    'mapo_ownerportraits_Jeffrey_Lurie.png': 112,  // Lurie, Jeff
    'mapo_ownerportraits_Jerry_Jones.png': 110,    // Jones, Jerry
    'mapo_ownerportraits_Joe_Glazer.png': 105,     // Glazer, Joe
    'mapo_ownerportraits_Pat_Bowlen.png': 103,     // Bowlen, Pat
    'mapo_ownerportraits_Paul_Allen.png': 127,     // Allen, Paul
    'mapo_ownerportraits_Robert_C_McNair.png': 131, // McNair, Robert
    'mapo_ownerportraits_Robert_Kraft.png': 121,   // Kraft, Robert
    'mapo_ownerportraits_Shahid_Khan.png': 116,    // Khan, Shahid
    'mapo_ownerportraits_Stephen_Ross.png': 111,   // Ross, Stephen
    'mapo_ownerportraits_Steve_Tisch.png': 115,    // Tisch, Steve
    'mapo_ownerportraits_Terry_Pegula.png': 102,   // Pegula, Terry
    'mapo_ownerportraits_VirginiaMcCaskey.png': 100 // McCaskey, Virginia
  };

  // Get all portrait files from source directories
  console.log('Scanning portrait files...');
  const files = await fs.readdir(CONFIG.sourceDir);
  const portraitFiles = files.filter(f => f.endsWith('.png'));
  console.log(`Found ${portraitFiles.length} portrait files\n`);

  // Also get generic files
  const genericFiles = await fs.readdir(CONFIG.genericSourceDir);
  console.log(`Found ${genericFiles.length} generic portrait files\n`);

  let mappedCount = 0;
  let unmappedCount = 0;
  const unmapped = [];

  // Map coach and owner portraits
  for (const file of portraitFiles) {
    // Extract PAM or name from filename
    // Examples:
    // mapo_coachportraits_CampbellDan.png
    // mapo_coachportraits_legends_JohnMadden_Profile.png
    // mapo_ownerportraits_Jerry_Jones.png

    let found = false;

    // Check manual mappings first
    if (manualMappings[file]) {
      const pid = manualMappings[file];
      const coach = coaches.find(c => c.pid === pid);

      const sourcePath = path.join(CONFIG.sourceDir, file);
      const destPath = path.join(CONFIG.outputDir, `${pid}.png`);

      await fs.copyFile(sourcePath, destPath);
      console.log(`✓ Mapped ${file} -> ${pid}.png (${coach ? `${coach.firstName} ${coach.lastName}` : 'Manual'}) [manual]`);

      mappedCount++;
      found = true;
      continue;
    }

    // Try matching against each coach
    for (const coach of coaches) {
      if (!coach.pam) continue;

      // Normalize both the filename and PAM for comparison
      const normalizedFile = normalizeName(file);
      const normalizedPAM = normalizeName(coach.pam);

      // Check if file contains the PAM
      if (normalizedFile.includes(normalizedPAM)) {
        // Copy file with PID as filename
        const sourcePath = path.join(CONFIG.sourceDir, file);
        const destPath = path.join(CONFIG.outputDir, `${coach.pid}.png`);

        await fs.copyFile(sourcePath, destPath);
        console.log(`✓ Mapped ${file} -> ${coach.pid}.png (${coach.firstName} ${coach.lastName})`);

        mappedCount++;
        found = true;
        break;
      }
    }

    // If not found by PAM, try matching by name
    if (!found) {
      for (const coach of coaches) {
        const fullName = `${coach.firstName}${coach.lastName}`;
        const normalizedFile = normalizeName(file);
        const normalizedName = normalizeName(fullName);

        // Also try matching just last name for cases where first name might be abbreviated
        const normalizedLastName = normalizeName(coach.lastName);

        // Match if file contains full name or last name (with minimum length to avoid false matches)
        if ((normalizedFile.includes(normalizedName) && normalizedName.length > 3) ||
            (normalizedFile.includes(normalizedLastName) && normalizedLastName.length > 4 &&
             normalizedFile.includes(normalizedName.substring(0, 3)))) {
          // Copy file with PID as filename
          const sourcePath = path.join(CONFIG.sourceDir, file);
          const destPath = path.join(CONFIG.outputDir, `${coach.pid}.png`);

          await fs.copyFile(sourcePath, destPath);
          console.log(`✓ Mapped ${file} -> ${coach.pid}.png (${coach.firstName} ${coach.lastName}) [by name]`);

          mappedCount++;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      unmapped.push(file);
      unmappedCount++;
    }
  }

  // Handle generics - these typically don't have PIDs in Coach_lookup.csv
  // We'll just copy them with their original names for reference
  console.log('\nCopying generic portraits...');
  let genericCount = 0;
  for (const file of genericFiles) {
    if (file.endsWith('.png')) {
      const sourcePath = path.join(CONFIG.genericSourceDir, file);
      const destPath = path.join(CONFIG.outputDir, `generic_${file}`);
      await fs.copyFile(sourcePath, destPath);
      genericCount++;
    }
  }
  console.log(`✓ Copied ${genericCount} generic portraits\n`);

  // Summary
  console.log('=== Summary ===');
  console.log(`Total coaches in lookup: ${coaches.length}`);
  console.log(`Portraits mapped to PIDs: ${mappedCount}`);
  console.log(`Unmapped portraits: ${unmappedCount}`);
  console.log(`Generic portraits copied: ${genericCount}`);

  if (unmapped.length > 0) {
    console.log('\nUnmapped files:');
    unmapped.forEach(f => console.log(`  - ${f}`));
  }

  console.log('\n✓ Portrait mapping complete!');
  console.log(`Output directory: ${CONFIG.outputDir}`);
}

// Run mapper
mapPortraitsToPIDs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
