/**
 * Extract and document all franchise file tables
 * Run this with: node extract-franchise-schema.js <franchise-file-path>
 */

const fs = require('fs');
const path = require('path');
const Franchise = require('madden-franchise');

async function extractSchema(filePath) {
  console.log('Loading franchise file:', filePath);

  const franchise = new Franchise(filePath);

  await new Promise((resolve, reject) => {
    franchise.on('ready', resolve);
    franchise.on('error', reject);
  });

  console.log('File loaded successfully');
  console.log('Game Year:', franchise.schema?.meta?.gameYear);
  console.log('Schema Version:', franchise.schema?.meta?.major + '.' + franchise.schema?.meta?.minor);
  console.log('Total Tables:', franchise.tables?.length || 0);

  const output = [];
  output.push('# Madden Franchise File Schema Documentation\n');
  output.push(`**File:** ${path.basename(filePath)}\n`);
  output.push(`**Game Year:** M${franchise.schema?.meta?.gameYear}\n`);
  output.push(`**Schema Version:** ${franchise.schema?.meta?.major}.${franchise.schema?.meta?.minor}\n`);
  output.push(`**Total Tables:** ${franchise.tables?.length || 0}\n\n`);
  output.push('---\n\n');

  const tablesByCategory = {
    'Players': [],
    'Teams': [],
    'Stats & Awards': [],
    'Season & Schedule': [],
    'Coaching': [],
    'Draft': [],
    'Contracts & Salary': [],
    'League Settings': [],
    'Other': []
  };

  // Categorize tables
  franchise.tables.forEach(table => {
    const name = table.name;
    const lower = name.toLowerCase();

    if (lower.includes('player') && !lower.includes('stat') && !lower.includes('award')) {
      tablesByCategory['Players'].push(table);
    } else if (lower.includes('team') && !lower.includes('stat')) {
      tablesByCategory['Teams'].push(table);
    } else if (lower.includes('stat') || lower.includes('award') || lower.includes('record')) {
      tablesByCategory['Stats & Awards'].push(table);
    } else if (lower.includes('season') || lower.includes('week') || lower.includes('game') || lower.includes('schedule')) {
      tablesByCategory['Season & Schedule'].push(table);
    } else if (lower.includes('coach') || lower.includes('staff')) {
      tablesByCategory['Coaching'].push(table);
    } else if (lower.includes('draft') || lower.includes('prospect')) {
      tablesByCategory['Draft'].push(table);
    } else if (lower.includes('contract') || lower.includes('salary') || lower.includes('cap')) {
      tablesByCategory['Contracts & Salary'].push(table);
    } else if (lower.includes('league') || lower.includes('setting') || lower.includes('option')) {
      tablesByCategory['League Settings'].push(table);
    } else {
      tablesByCategory['Other'].push(table);
    }
  });

  // Process each category
  for (const [category, tables] of Object.entries(tablesByCategory)) {
    if (tables.length === 0) continue;

    output.push(`## ${category} (${tables.length} tables)\n\n`);

    for (const table of tables) {
      console.log(`Processing ${table.name}...`);

      try {
        await table.readRecords();

        const activeRecords = table.records.filter(r => !r.isEmpty);
        const recordCount = activeRecords.length;

        output.push(`### ${table.name}\n\n`);
        output.push(`**Records:** ${recordCount}\n\n`);

        // Get field information
        if (table.schema && table.schema.attributes) {
          output.push(`**Fields (${table.schema.attributes.length}):**\n\n`);

          table.schema.attributes.forEach(attr => {
            output.push(`- \`${attr.name}\` (${attr.type || 'unknown'})\n`);
          });
          output.push('\n');
        }

        // Show sample data
        if (activeRecords.length > 0) {
          output.push(`**Sample Data (First Record):**\n\n`);
          output.push('```json\n');

          const sampleData = {};
          table.schema.attributes.forEach(attr => {
            sampleData[attr.name] = activeRecords[0][attr.name];
          });

          output.push(JSON.stringify(sampleData, null, 2));
          output.push('\n```\n\n');
        }

        output.push('---\n\n');
      } catch (err) {
        console.error(`Error processing ${table.name}:`, err.message);
        output.push(`*Error loading data: ${err.message}*\n\n`);
        output.push('---\n\n');
      }
    }
  }

  // Write to file
  const outputPath = path.join(__dirname, 'FRANCHISE_SCHEMA.md');
  fs.writeFileSync(outputPath, output.join(''));

  console.log('\n✓ Documentation written to:', outputPath);
  console.log('Total tables documented:', franchise.tables.length);
}

// Get file path from command line
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node extract-franchise-schema.js <franchise-file-path>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

extractSchema(filePath)
  .then(() => {
    console.log('\n✓ Complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n✗ Error:', err);
    process.exit(1);
  });
