/**
 * Frosty Portrait Creator
 *
 * Creates new portrait .bin files by patching a template.
 * IMPORTANT: New name MUST be exactly 12 characters (same as template "aaituiisaako")
 *
 * Usage (single player):
 *   node scripts/create-frosty-portrait.js --name "shankstoddxx" --portrait "path/to/portrait.dds"
 *
 * Usage (batch mode):
 *   node scripts/create-frosty-portrait.js --batch "path/to/players.json" --output "C:/Output"
 *
 * Batch JSON format:
 *   [
 *     { "firstName": "Todd", "lastName": "Shanks", "pid": "11054", "race": 1 },
 *     { "firstName": "Joe", "lastName": "Montana", "pid": "1234", "race": 1 }
 *   ]
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Template files (aaituiisaako portrait registration)
const TEMPLATE_PATH = 'C:\\Users\\tshan\\Downloads\\PAM\\DartTest';
const TEMPLATE_NAME = 'aaituiisaako';

const TEMPLATE_FILES = [
  'plpo_aaituiisaako_assetlibrary_playerportraits_brt.bin',
  'plpo_aaituiisaako_assetlibrary_playerportraits_brt_blueprint.bin'
];

// Output path
const OUTPUT_BASE = 'C:\\Users\\tshan\\Downloads\\PAM\\GeneratedPortraits';

/**
 * Replace all occurrences of a string in a buffer (exact length only)
 */
function replaceInBuffer(buffer, search, replace) {
  const searchBuf = Buffer.from(search, 'utf8');
  const replaceBuf = Buffer.from(replace, 'utf8');

  if (searchBuf.length !== replaceBuf.length) {
    throw new Error(`Length mismatch: "${search}" (${searchBuf.length}) vs "${replace}" (${replaceBuf.length})`);
  }

  let result = Buffer.from(buffer);
  let index = 0;
  let count = 0;

  while ((index = result.indexOf(searchBuf, index)) !== -1) {
    replaceBuf.copy(result, index);
    index += searchBuf.length;
    count++;
  }

  return { buffer: result, count };
}

/**
 * Pad or suggest a name to reach target length
 */
function suggestName(name, targetLength) {
  if (name.length === targetLength) return name;

  if (name.length < targetLength) {
    // Suggest padding options
    const diff = targetLength - name.length;
    const suggestions = [];

    // Add underscores
    suggestions.push(name + '_'.repeat(diff));

    // Add numbers
    if (diff <= 2) {
      suggestions.push(name + '0'.repeat(diff));
      suggestions.push(name + '1'.repeat(diff));
    }

    // Add 'x' characters
    suggestions.push(name + 'x'.repeat(diff));

    return suggestions;
  } else {
    // Truncate
    return [name.substring(0, targetLength)];
  }
}

/**
 * Generate a portrait name that is exactly 12 characters
 */
function generatePortraitName(firstName, lastName) {
  const combined = (lastName + firstName).toLowerCase().replace(/[^a-z]/g, '');
  if (combined.length === 12) {
    return combined;
  } else if (combined.length < 12) {
    return combined + 'x'.repeat(12 - combined.length);
  } else {
    return combined.substring(0, 12);
  }
}

/**
 * Process a single player (used by both single and batch modes)
 */
function processSinglePlayer(playerName, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filesCreated = [];

  for (const templateFile of TEMPLATE_FILES) {
    const srcPath = path.join(TEMPLATE_PATH, templateFile);

    if (!fs.existsSync(srcPath)) {
      console.log(`  ❌ Template not found: ${templateFile}`);
      continue;
    }

    const buffer = fs.readFileSync(srcPath);
    const { buffer: patchedBuffer, count } = replaceInBuffer(buffer, TEMPLATE_NAME, playerName);
    const newFileName = templateFile.replace(TEMPLATE_NAME, playerName);
    const destPath = path.join(outputDir, newFileName);

    fs.writeFileSync(destPath, patchedBuffer);
    filesCreated.push(newFileName);
    console.log(`  ✓ ${newFileName} (${count} replacements)`);
  }

  return filesCreated;
}

/**
 * Batch process multiple players from JSON file
 */
async function batchProcess(jsonPath, outputBase) {
  console.log('\n=== Frosty Portrait Creator (Batch Mode) ===\n');

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: Batch file not found: ${jsonPath}`);
    process.exit(1);
  }

  const players = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Processing ${players.length} players...`);

  // Create registration output directory
  const registrationDir = path.join(outputBase, 'registration');
  if (!fs.existsSync(registrationDir)) {
    fs.mkdirSync(registrationDir, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const { firstName, lastName } = player;

    try {
      const portraitName = generatePortraitName(firstName, lastName);
      console.log(`\n[${i + 1}/${players.length}] ${firstName} ${lastName} -> ${portraitName}`);

      processSinglePlayer(portraitName, registrationDir);
      successCount++;
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errors.push(`${firstName} ${lastName}: ${error.message}`);
      errorCount++;
    }
  }

  // Summary
  console.log('\n=== Batch Complete ===');
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`\nOutput: ${registrationDir}`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  // Write summary file
  const summary = {
    totalPlayers: players.length,
    successCount,
    errorCount,
    errors,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(outputBase, 'portrait_batch_summary.json'), JSON.stringify(summary, null, 2));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let playerName, portraitPath, batchFile, batchOutputDir;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) playerName = args[++i];
    else if (args[i] === '--portrait' && args[i + 1]) portraitPath = args[++i];
    else if (args[i] === '--batch' && args[i + 1]) batchFile = args[++i];
    else if (args[i] === '--output' && args[i + 1]) batchOutputDir = args[++i];
  }

  // Batch mode
  if (batchFile) {
    await batchProcess(batchFile, batchOutputDir || OUTPUT_BASE);
    return;
  }

  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n=== Frosty Portrait Creator ===\n');
  console.log(`Template: "${TEMPLATE_NAME}" (${TEMPLATE_NAME.length} characters)`);
  console.log(`Your new name MUST be exactly ${TEMPLATE_NAME.length} characters.\n`);

  if (!playerName) {
    playerName = await question('New player name (LastNameFirstName format): ');
  }

  // Normalize to lowercase
  playerName = playerName.toLowerCase();

  // Check length
  if (playerName.length !== TEMPLATE_NAME.length) {
    console.log(`\n❌ "${playerName}" is ${playerName.length} characters, need exactly ${TEMPLATE_NAME.length}.`);
    console.log('\nSuggestions:');
    const suggestions = suggestName(playerName, TEMPLATE_NAME.length);
    suggestions.forEach((s, i) => console.log(`  ${i + 1}. "${s}"`));

    const choice = await question('\nEnter a suggested name or type your own: ');
    playerName = choice.toLowerCase();

    if (playerName.length !== TEMPLATE_NAME.length) {
      console.log(`\n❌ Still wrong length. Need exactly ${TEMPLATE_NAME.length} characters.`);
      rl.close();
      process.exit(1);
    }
  }

  if (!portraitPath) {
    portraitPath = await question('\nPortrait DDS path (or Enter to skip): ');
    if (!portraitPath.trim()) portraitPath = null;
  }

  rl.close();

  console.log(`\n✓ Using name: "${playerName}" (${playerName.length} chars)`);

  // Create output directory
  const outputDir = path.join(OUTPUT_BASE, `plpo_${playerName}`);
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`\nOutput: ${outputDir}\n`);

  // Process each template .bin file
  for (const templateFile of TEMPLATE_FILES) {
    const srcPath = path.join(TEMPLATE_PATH, templateFile);

    if (!fs.existsSync(srcPath)) {
      console.log(`  ❌ Template not found: ${templateFile}`);
      continue;
    }

    // Read template
    const buffer = fs.readFileSync(srcPath);

    // Replace template name with new name (exact match)
    const { buffer: patchedBuffer, count } = replaceInBuffer(buffer, TEMPLATE_NAME, playerName);

    // Create new filename
    const newFileName = templateFile.replace(TEMPLATE_NAME, playerName);
    const destPath = path.join(outputDir, newFileName);

    // Write patched file
    fs.writeFileSync(destPath, patchedBuffer);

    console.log(`  ✓ ${newFileName} (${count} replacements)`);
  }

  // Copy portrait DDS if provided
  if (portraitPath && fs.existsSync(portraitPath)) {
    const portraitDest = path.join(outputDir, `plpo_${playerName}.dds`);
    fs.copyFileSync(portraitPath, portraitDest);
    console.log(`  ✓ plpo_${playerName}.dds`);
  }

  // Summary
  console.log('\n=== Complete! ===');
  console.log(`\nImport into Frosty:`);
  console.log(`  1. ${outputDir}\\plpo_${playerName}_assetlibrary_playerportraits_brt.bin`);
  console.log(`  2. ${outputDir}\\plpo_${playerName}_assetlibrary_playerportraits_brt_blueprint.bin`);
  if (portraitPath) {
    console.log(`  3. ${outputDir}\\plpo_${playerName}.dds`);
  }

  console.log(`\nIn roster, set portrait to: plpo_${playerName}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
