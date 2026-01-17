/**
 * Frosty Player Creator
 *
 * Creates a new Madden player from the Dart template for import into Frosty.
 *
 * Usage (single player):
 *   node scripts/create-frosty-player.js --firstName "Todd" --lastName "Shanks" --pid 11054 --portrait "path/to/portrait.dds"
 *
 * Usage (batch mode):
 *   node scripts/create-frosty-player.js --batch "path/to/players.json" --output "C:/Output"
 *
 * Batch JSON format:
 *   [
 *     { "firstName": "Todd", "lastName": "Shanks", "pid": "11054", "race": 1 },
 *     { "firstName": "Joe", "lastName": "Montana", "pid": "1234", "race": 1 }
 *   ]
 *
 * Or interactive mode:
 *   node scripts/create-frosty-player.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Template player info (Jaxon Dart)
const TEMPLATE = {
  firstName: 'Jaxson',  // Note: spelled Jaxson in files
  lastName: 'Dart',
  pid: '14796',
  displayName: 'Jaxon Dart',
  folderLetter: 'd'
};

// Template source path
const TEMPLATE_PATH = 'C:\\Users\\tshan\\Downloads\\PAM\\DartTest';

// Specific paths within template to copy (only player-related files)
const PLAYER_PATHS = [
  // Player character folder
  'EBX/content/characters/player/players/d/DartJaxson_14796',
  // Root item files
  'DartJaxson_14796_item.xml',
  'dartjaxson_14796_item_footballcharacteritems_brt.xml',
  'dartjaxson_14796_item_footballcharacteritems_brt_blueprint.xml',
  // Portrait
  'plpo_DartJaxson.dds'
];

// Output path
const OUTPUT_BASE = 'C:\\Users\\tshan\\Downloads\\PAM\\GeneratedPlayers';

/**
 * Generate a new GUID
 */
function generateGuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a unique ItemDataId (8-9 digit number)
 */
function generateItemDataId() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * Replace all occurrences in a string (case variations)
 */
function replaceAllInContent(content, newFirstName, newLastName, newPid) {
  const oldNamePid = `DartJaxson_14796`;
  const newNamePid = `${newLastName}${newFirstName}_${newPid}`;

  const oldNamePidLower = `dartjaxson_14796`;
  const newNamePidLower = `${newLastName.toLowerCase()}${newFirstName.toLowerCase()}_${newPid}`;

  // Also handle Jaxon vs Jaxson spelling variations
  const oldNamePid2 = `DartJaxon_14796`;
  const oldNamePidLower2 = `dartjaxon_14796`;

  let result = content;

  // Replace PascalCase versions
  result = result.split(oldNamePid).join(newNamePid);
  result = result.split(oldNamePid2).join(newNamePid);

  // Replace lowercase versions
  result = result.split(oldNamePidLower).join(newNamePidLower);
  result = result.split(oldNamePidLower2).join(newNamePidLower);

  // Replace display names
  const newDisplayName = `${newFirstName} ${newLastName}`;
  result = result.split('Jaxon Dart').join(newDisplayName);
  result = result.split('Jaxson Dart').join(newDisplayName);

  // Replace folder letter in paths (players/d/ -> players/x/)
  const newFolderLetter = newLastName.charAt(0).toLowerCase();
  result = result.split('players/d/').join(`players/${newFolderLetter}/`);
  result = result.split('players\\d\\').join(`players\\${newFolderLetter}\\`);

  // Replace portrait name references
  result = result.split('plpo_DartJaxson').join(`plpo_${newLastName}${newFirstName}`);
  result = result.split('plpo_DartJaxon').join(`plpo_${newLastName}${newFirstName}`);

  return result;
}

/**
 * Rename a path component
 */
function renamePath(pathPart, newFirstName, newLastName, newPid) {
  const newNamePid = `${newLastName}${newFirstName}_${newPid}`;
  const newNamePidLower = `${newLastName.toLowerCase()}${newFirstName.toLowerCase()}_${newPid}`;
  const newFolderLetter = newLastName.charAt(0).toLowerCase();

  let result = pathPart;

  // Replace name_pid patterns
  result = result.replace(/DartJaxson_14796/g, newNamePid);
  result = result.replace(/DartJaxon_14796/g, newNamePid);
  result = result.replace(/dartjaxson_14796/g, newNamePidLower);
  result = result.replace(/dartjaxon_14796/g, newNamePidLower);

  // Replace portrait name
  result = result.replace(/plpo_DartJaxson/g, `plpo_${newLastName}${newFirstName}`);
  result = result.replace(/plpo_DartJaxon/g, `plpo_${newLastName}${newFirstName}`);

  // Replace folder letter (d -> newLetter)
  if (result === 'd' && pathPart === 'd') {
    result = newFolderLetter;
  }

  return result;
}

/**
 * Copy directory recursively with transformations
 */
function copyDirWithTransform(srcDir, destDir, newFirstName, newLastName, newPid, stats) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const newName = renamePath(entry.name, newFirstName, newLastName, newPid);
    const destPath = path.join(destDir, newName);

    if (entry.isDirectory()) {
      copyDirWithTransform(srcPath, destPath, newFirstName, newLastName, newPid, stats);
    } else {
      // Read, transform content if XML, write
      if (entry.name.endsWith('.xml')) {
        let content = fs.readFileSync(srcPath, 'utf8');
        content = replaceAllInContent(content, newFirstName, newLastName, newPid);

        // Replace GUIDs to avoid conflicts
        content = content.replace(/Guid="[a-f0-9-]{36}"/gi, () => `Guid="${generateGuid()}"`);

        // Replace ItemDataId
        if (content.includes('<ItemDataId>')) {
          content = content.replace(/<Id>63867299<\/Id>/, `<Id>${generateItemDataId()}</Id>`);
        }

        fs.writeFileSync(destPath, content, 'utf8');
        stats.xmlFiles++;
      } else {
        // Binary file (DDS, etc.) - just copy
        fs.copyFileSync(srcPath, destPath);
        stats.otherFiles++;
      }
    }
  }
}

/**
 * Transform a single file
 */
function transformFile(srcPath, destPath, newFirstName, newLastName, newPid) {
  if (srcPath.endsWith('.xml')) {
    let content = fs.readFileSync(srcPath, 'utf8');
    content = replaceAllInContent(content, newFirstName, newLastName, newPid);

    // Replace GUIDs
    content = content.replace(/Guid="[a-f0-9-]{36}"/gi, () => `Guid="${generateGuid()}"`);

    // Replace ItemDataId
    if (content.includes('<ItemDataId>')) {
      content = content.replace(/<Id>63867299<\/Id>/, `<Id>${generateItemDataId()}</Id>`);
    }

    fs.writeFileSync(destPath, content, 'utf8');
  } else {
    fs.copyFileSync(srcPath, destPath);
  }
}

// Skin tone mapping based on race
const RACE_TO_SKIN_TONE = {
  1: 1,  // White -> Light skin tone
  5: 2,  // Hispanic -> can vary
  7: 2,  // Black -> Dark skin tone
};

/**
 * Process a single player and return stats
 */
function processSinglePlayerBatch(firstName, lastName, pid, race, outputBase) {
  // Normalize names
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  pid = pid.toString();

  const newFolderLetter = lastName.charAt(0).toLowerCase();
  const stats = { xmlFiles: 0, otherFiles: 0 };

  // Create player-specific output in items folder
  const outputDir = path.join(outputBase, 'items');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Process only the main item XML file for batch mode (not full EBX structure)
  const itemXmlSrc = path.join(TEMPLATE_PATH, 'DartJaxson_14796_item.xml');

  if (!fs.existsSync(itemXmlSrc)) {
    throw new Error(`Template not found: ${itemXmlSrc}`);
  }

  let content = fs.readFileSync(itemXmlSrc, 'utf8');
  content = replaceAllInContent(content, firstName, lastName, pid);

  // Replace GUIDs
  content = content.replace(/Guid="[a-f0-9-]{36}"/gi, () => `Guid="${generateGuid()}"`);

  // Replace ItemDataId
  if (content.includes('<ItemDataId>')) {
    content = content.replace(/<Id>63867299<\/Id>/, `<Id>${generateItemDataId()}</Id>`);
  }

  // Update SkinToneBaseValue based on race
  if (race !== undefined) {
    const skinTone = RACE_TO_SKIN_TONE[race] || 1;
    content = content.replace(/<SkinToneBaseValue>\d+<\/SkinToneBaseValue>/, `<SkinToneBaseValue>${skinTone}</SkinToneBaseValue>`);
  }

  const outputFileName = `${lastName}${firstName}_${pid}_item.xml`;
  const outputPath = path.join(outputDir, outputFileName);
  fs.writeFileSync(outputPath, content, 'utf8');
  stats.xmlFiles++;

  return { outputFileName, stats };
}

/**
 * Batch process multiple players from JSON file
 */
async function batchProcess(jsonPath, outputBase) {
  console.log('\n=== Frosty Player Creator (Batch Mode) ===\n');

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: Batch file not found: ${jsonPath}`);
    process.exit(1);
  }

  const players = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Processing ${players.length} players...`);

  // Create output directories
  if (!fs.existsSync(outputBase)) {
    fs.mkdirSync(outputBase, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  const pamAssignments = {};

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const { firstName, lastName, pid, race } = player;

    try {
      console.log(`[${i + 1}/${players.length}] ${firstName} ${lastName} (PID: ${pid})`);

      const result = processSinglePlayerBatch(firstName, lastName, pid, race, outputBase);
      console.log(`  ✓ ${result.outputFileName}`);

      // Track PAM assignment
      pamAssignments[pid] = {
        firstName,
        lastName,
        race: race || 1,
        skinTone: RACE_TO_SKIN_TONE[race] || 1,
        genericFace: race === 7 ? 'gen_2' : (race === 5 ? 'gen_4' : 'gen_3')
      };

      successCount++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errors.push(`${firstName} ${lastName}: ${error.message}`);
      errorCount++;
    }
  }

  // Write PAM assignments file
  const pamPath = path.join(outputBase, 'pam_assignments.json');
  fs.writeFileSync(pamPath, JSON.stringify(pamAssignments, null, 2));

  // Write import instructions
  const instructions = `
FMT Import Instructions
=======================

This folder contains FMT-importable files for ${players.length} players.

Contents:
- items/ - Player item XML files
- pam_assignments.json - PAM/face assignment mappings

Import Steps:
1. Open Frosty Mod Manager with Madden 26
2. Import the items/*.xml files as character items
3. Use pam_assignments.json to set correct face assignments

Generated: ${new Date().toISOString()}
`;
  fs.writeFileSync(path.join(outputBase, 'IMPORT_INSTRUCTIONS.txt'), instructions);

  // Summary
  console.log('\n=== Batch Complete ===');
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`\nOutput: ${outputBase}`);
  console.log(`PAM Assignments: ${pamPath}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Write summary
  const summary = {
    totalPlayers: players.length,
    successCount,
    errorCount,
    errors,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outputBase, 'player_batch_summary.json'), JSON.stringify(summary, null, 2));
}

/**
 * Main function
 */
async function main() {
  // Parse command line args
  const args = process.argv.slice(2);
  let firstName, lastName, pid, portraitPath, batchFile, batchOutputDir;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--firstName' && args[i + 1]) firstName = args[++i];
    else if (args[i] === '--lastName' && args[i + 1]) lastName = args[++i];
    else if (args[i] === '--pid' && args[i + 1]) pid = args[++i];
    else if (args[i] === '--portrait' && args[i + 1]) portraitPath = args[++i];
    else if (args[i] === '--batch' && args[i + 1]) batchFile = args[++i];
    else if (args[i] === '--output' && args[i + 1]) batchOutputDir = args[++i];
  }

  // Batch mode
  if (batchFile) {
    await batchProcess(batchFile, batchOutputDir || OUTPUT_BASE);
    return;
  }

  // Interactive mode if args missing
  if (!firstName || !lastName || !pid) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    console.log('\n=== Frosty Player Creator ===\n');

    if (!firstName) firstName = await question('First Name: ');
    if (!lastName) lastName = await question('Last Name: ');
    if (!pid) pid = await question('PID (unique number, e.g., 11054): ');
    if (!portraitPath) {
      portraitPath = await question('Portrait DDS path (or press Enter to skip): ');
      if (!portraitPath.trim()) portraitPath = null;
    }

    rl.close();
  }

  // Validate
  if (!firstName || !lastName || !pid) {
    console.error('Error: firstName, lastName, and pid are required');
    process.exit(1);
  }

  // Normalize names (capitalize first letter)
  firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  pid = pid.toString();

  console.log(`\nCreating player: ${firstName} ${lastName} (PID: ${pid})`);

  // Create output directory
  const outputDir = path.join(OUTPUT_BASE, `${lastName}${firstName}_${pid}`);
  if (fs.existsSync(outputDir)) {
    console.log(`Removing existing output directory...`);
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const stats = { xmlFiles: 0, otherFiles: 0 };
  const newFolderLetter = lastName.charAt(0).toLowerCase();

  // Process each player path
  for (const relPath of PLAYER_PATHS) {
    const srcPath = path.join(TEMPLATE_PATH, relPath);

    if (!fs.existsSync(srcPath)) {
      console.log(`  Skipping (not found): ${relPath}`);
      continue;
    }

    // Transform the destination path
    let destRelPath = relPath;
    destRelPath = renamePath(destRelPath, firstName, lastName, pid);
    // Fix the folder letter in path
    destRelPath = destRelPath.replace(/[\\\/]d[\\\/]/g, `/${newFolderLetter}/`);
    destRelPath = destRelPath.replace(/^d\//, `${newFolderLetter}/`);

    const destPath = path.join(outputDir, destRelPath);

    const srcStat = fs.statSync(srcPath);

    if (srcStat.isDirectory()) {
      console.log(`  Processing folder: ${relPath}`);
      copyDirWithTransform(srcPath, destPath, firstName, lastName, pid, stats);
    } else {
      // Ensure parent directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      transformFile(srcPath, destPath, firstName, lastName, pid);

      if (relPath.endsWith('.xml')) stats.xmlFiles++;
      else stats.otherFiles++;

      console.log(`  Created: ${path.basename(destPath)}`);
    }
  }

  // Handle custom portrait if provided
  if (portraitPath && fs.existsSync(portraitPath)) {
    const portraitDest = path.join(outputDir, `plpo_${lastName}${firstName}.dds`);
    fs.copyFileSync(portraitPath, portraitDest);
    console.log(`  Custom portrait: plpo_${lastName}${firstName}.dds`);
    stats.otherFiles++;
  }

  // Summary
  console.log('\n=== Complete! ===');
  console.log(`Output folder: ${outputDir}`);
  console.log(`XML files processed: ${stats.xmlFiles}`);
  console.log(`Other files copied: ${stats.otherFiles}`);

  console.log('\n--- Folder Structure ---');
  const showTree = (dir, prefix = '') => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry, i) => {
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      console.log(`${prefix}${connector}${entry.name}`);
      if (entry.isDirectory()) {
        showTree(path.join(dir, entry.name), prefix + (isLast ? '    ' : '│   '));
      }
    });
  };
  showTree(outputDir);

  console.log('\n--- Next Steps ---');
  console.log('1. Open Frosty Mod Manager');
  console.log('2. Import this folder as a mod');
  console.log(`3. Use PID ${pid} in your roster file to reference this player`);
  console.log(`4. The portrait file should be at: content/ui/ImageAssetLibraries/global/Portraits/PlayerPortraits/assets/plpo_${lastName}${firstName}.dds`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
