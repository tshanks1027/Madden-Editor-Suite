/**
 * Frosty Portrait Creator v2
 *
 * Creates new portrait .bin files by properly patching the EBX RIFF structure.
 * Handles variable-length player names by updating chunk sizes.
 *
 * Usage:
 *   node scripts/create-frosty-portrait-v2.js --name "ShankTodd" --portrait "path/to/portrait.dds"
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Template files (aaituiisaako portrait registration)
const TEMPLATE_PATH = 'C:\\Users\\tshan\\Downloads\\PAM\\DartTest';
const TEMPLATE_NAME = 'aaituiisaako';

// Output path
const OUTPUT_BASE = 'C:\\Users\\tshan\\Downloads\\PAM\\GeneratedPortraits';

/**
 * Parse RIFF-based EBX file structure
 */
function parseEbxStructure(buffer) {
  // Verify RIFF header
  const riffSig = buffer.toString('ascii', 0, 4);
  if (riffSig !== 'RIFF') {
    throw new Error('Not a RIFF file');
  }

  const riffSize = buffer.readUInt32LE(4);
  const ebxSig = buffer.toString('ascii', 8, 12);

  // Find EBXD chunk
  let offset = 12;
  const chunks = [];

  while (offset < buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);

    chunks.push({
      id: chunkId,
      offset: offset,
      sizeOffset: offset + 4,
      dataOffset: offset + 8,
      size: chunkSize
    });

    offset += 8 + chunkSize;
    // RIFF chunks are padded to even boundaries
    if (chunkSize % 2 === 1) offset += 1;
  }

  return { riffSize, chunks };
}

/**
 * Find the path string in EBXD chunk
 */
function findPathString(buffer, ebxdChunk) {
  const searchStart = ebxdChunk.dataOffset;
  const searchEnd = ebxdChunk.dataOffset + ebxdChunk.size;

  // Look for "content/" which starts the path
  const pathPrefix = Buffer.from('content/', 'utf8');
  let pathStart = -1;

  for (let i = searchStart; i < searchEnd - pathPrefix.length; i++) {
    if (buffer.compare(pathPrefix, 0, pathPrefix.length, i, i + pathPrefix.length) === 0) {
      pathStart = i;
      break;
    }
  }

  if (pathStart === -1) {
    throw new Error('Could not find path string in EBXD chunk');
  }

  // Find null terminator
  let pathEnd = pathStart;
  while (buffer[pathEnd] !== 0 && pathEnd < searchEnd) {
    pathEnd++;
  }

  const pathString = buffer.toString('utf8', pathStart, pathEnd);
  return { pathStart, pathEnd, pathString };
}

/**
 * Create patched portrait .bin file with variable-length name support
 */
function patchPortraitBin(templateBuffer, oldName, newName, isBlueprint) {
  // Parse structure
  const structure = parseEbxStructure(templateBuffer);
  const ebxdChunk = structure.chunks.find(c => c.id === 'EBXD');

  if (!ebxdChunk) {
    throw new Error('EBXD chunk not found');
  }

  // Find the path string
  const pathInfo = findPathString(templateBuffer, ebxdChunk);
  console.log(`    Found path at offset 0x${pathInfo.pathStart.toString(16)}: ${pathInfo.pathString}`);

  // Calculate new path
  const suffix = isBlueprint ? '_assetlibrary_playerportraits_brt_blueprint' : '_assetlibrary_playerportraits_brt';
  const basePath = 'content/ui/imageassetlibraries/global/portraits/playerportraits/assets/plpo_';
  const oldPath = basePath + oldName + suffix;
  const newPath = basePath + newName + suffix;

  console.log(`    Old path: ${oldPath}`);
  console.log(`    New path: ${newPath}`);

  const sizeDiff = newPath.length - oldPath.length;
  console.log(`    Size difference: ${sizeDiff} bytes`);

  // Create new buffer with adjusted size
  const newBufferSize = templateBuffer.length + sizeDiff;
  const newBuffer = Buffer.alloc(newBufferSize);

  // Copy everything before the path
  templateBuffer.copy(newBuffer, 0, 0, pathInfo.pathStart);

  // Write new path
  newBuffer.write(newPath, pathInfo.pathStart, 'utf8');
  newBuffer[pathInfo.pathStart + newPath.length] = 0; // null terminator

  // Copy everything after the old path (including null terminator)
  const afterOldPath = pathInfo.pathEnd + 1; // +1 for null terminator
  const afterNewPath = pathInfo.pathStart + newPath.length + 1;
  templateBuffer.copy(newBuffer, afterNewPath, afterOldPath);

  // Update RIFF size (offset 4)
  const newRiffSize = newBufferSize - 8;
  newBuffer.writeUInt32LE(newRiffSize, 4);

  // Update EBXD chunk size (offset 0x10)
  const newEbxdSize = ebxdChunk.size + sizeDiff;
  newBuffer.writeUInt32LE(newEbxdSize, ebxdChunk.sizeOffset);

  console.log(`    RIFF size: ${structure.riffSize} -> ${newRiffSize}`);
  console.log(`    EBXD size: ${ebxdChunk.size} -> ${newEbxdSize}`);

  return newBuffer;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let playerName, portraitPath;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) playerName = args[++i];
    else if (args[i] === '--portrait' && args[i + 1]) portraitPath = args[++i];
  }

  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n=== Frosty Portrait Creator v2 ===');
  console.log('Now supports variable-length player names!\n');
  console.log(`Template: "${TEMPLATE_NAME}" (${TEMPLATE_NAME.length} characters)`);
  console.log('Your new name can be any length.\n');

  if (!playerName) {
    playerName = await question('New player name (LastNameFirstName format, e.g., ShankTodd): ');
  }

  // Normalize to lowercase
  playerName = playerName.toLowerCase();

  if (!playerName || playerName.length < 3) {
    console.log('\nName must be at least 3 characters.');
    rl.close();
    process.exit(1);
  }

  if (!portraitPath) {
    portraitPath = await question('\nPortrait DDS path (or Enter to skip): ');
    if (!portraitPath.trim()) portraitPath = null;
  }

  rl.close();

  console.log(`\nUsing name: "${playerName}" (${playerName.length} chars)`);

  // Create output directory
  const outputDir = path.join(OUTPUT_BASE, `plpo_${playerName}`);
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Output: ${outputDir}\n`);

  // Process the main .bin file
  const templateFiles = [
    { file: 'plpo_aaituiisaako_assetlibrary_playerportraits_brt.bin', isBlueprint: false },
    { file: 'plpo_aaituiisaako_assetlibrary_playerportraits_brt_blueprint.bin', isBlueprint: true }
  ];

  for (const { file, isBlueprint } of templateFiles) {
    const srcPath = path.join(TEMPLATE_PATH, file);

    if (!fs.existsSync(srcPath)) {
      console.log(`  Template not found: ${file}`);
      continue;
    }

    console.log(`Processing: ${file}`);

    const templateBuffer = fs.readFileSync(srcPath);
    const patchedBuffer = patchPortraitBin(templateBuffer, TEMPLATE_NAME, playerName, isBlueprint);

    // Create new filename
    const newFileName = file.replace(TEMPLATE_NAME, playerName);
    const destPath = path.join(outputDir, newFileName);

    fs.writeFileSync(destPath, patchedBuffer);
    console.log(`  Created: ${newFileName} (${patchedBuffer.length} bytes)\n`);
  }

  // Copy portrait DDS if provided
  if (portraitPath && fs.existsSync(portraitPath)) {
    const portraitDest = path.join(outputDir, `plpo_${playerName}.dds`);
    fs.copyFileSync(portraitPath, portraitDest);
    console.log(`Portrait: plpo_${playerName}.dds`);
  }

  // Summary
  console.log('\n=== Complete! ===');
  console.log(`\nImport these files into Frosty:`);
  console.log(`  1. ${outputDir}\\plpo_${playerName}_assetlibrary_playerportraits_brt.bin`);
  console.log(`  2. ${outputDir}\\plpo_${playerName}_assetlibrary_playerportraits_brt_blueprint.bin`);
  if (portraitPath) {
    console.log(`  3. ${outputDir}\\plpo_${playerName}.dds`);
  }

  console.log('\n=== IMPORTANT ===');
  console.log(`In your roster, the player's name must be:`);
  console.log(`  LastName: ${playerName.slice(0, -4) || playerName}`);
  console.log(`  FirstName: ${playerName.slice(-4) || ''}`);
  console.log(`\nThe game constructs portrait name from: plpo_[LastName][FirstName]`);
  console.log(`So "Shanks, Todd" -> "plpo_shanktodd" (all lowercase, no spaces)`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
