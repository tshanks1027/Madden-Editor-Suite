/**
 * Madden 26 Key Tables Analysis
 *
 * Focused analysis on tables that actually have data and are useful for UI design
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

const FRANCHISE_FILE_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';
const OUTPUT_JSON = path.join(__dirname, 'M26_KEY_TABLES.json');
const OUTPUT_MD = path.join(__dirname, 'M26_KEY_TABLES.md');

// Key tables we want to analyze in detail
const KEY_TABLES = [
  // Core Entity Tables
  'Player', 'Team', 'Coach', 'Owner',

  // Career/Season Management
  'SeasonInfo', 'SeasonGame', 'WeekExperience',

  // Player Data
  'PlayerAward', 'PlayerCareerStats', 'PlayerSeasonStats',
  'PlayerContract', 'PlayerTalentHistory', 'PlayerAbility',

  // Team Data
  'TeamSeasonInfo', 'TeamStanding', 'TeamHistory',

  // Draft
  'DraftPick', 'DraftClass', 'DraftPlayer',

  // Other Important
  'Injury', 'Transaction', 'FreeAgency',

  // Settings
  'LeagueUserSettings'
];

/**
 * Analyze a table in detail
 */
function analyzeTableDetailed(table) {
  const analysis = {
    name: table.name,
    recordCapacity: table.header.recordCapacity,
    actualRecordCount: table.header.nextRecordToUse || 0,
    hasSecondTable: !!table.header.hasSecondTable,
    hasThirdTable: !!table.header.hasThirdTable,
    attributes: []
  };

  if (table.schema && table.schema.attributes) {
    for (const attr of table.schema.attributes) {
      const attrInfo = {
        name: attr.name,
        key: attr.key,
        type: attr.type,
        maxLength: attr.maxLength || null,
        minValue: attr.minValue,
        maxValue: attr.maxValue,
        isReference: attr.isReference || false,
        enum: attr.enum || null,
        offset: attr.offset
      };

      if (attr.isReference && attr.referenceData) {
        attrInfo.referenceTableId = attr.referenceData.tableId;
      }

      analysis.attributes.push(attrInfo);
    }
  }

  return analysis;
}

/**
 * Main analysis
 */
async function analyzeKeyTables() {
  console.log('Madden 26 Key Tables Analysis');
  console.log('==============================\n');

  const franchise = new Franchise(FRANCHISE_FILE_PATH);

  return new Promise((resolve, reject) => {
    franchise.on('ready', () => {
      try {
        console.log('Franchise file loaded!');
        console.log(`Game Year: ${franchise.schema.meta.gameYear}`);
        console.log(`Schema Version: ${franchise.schema.meta.major}.${franchise.schema.meta.minor}`);
        console.log('');

        const analysis = {
          metadata: {
            fileName: path.basename(FRANCHISE_FILE_PATH),
            filePath: FRANCHISE_FILE_PATH,
            analyzedDate: new Date().toISOString(),
            gameVersion: franchise.schema.meta.gameYear,
            schemaVersion: `${franchise.schema.meta.major}.${franchise.schema.minor}`,
          },
          tables: []
        };

        // Analyze each key table
        console.log(`Analyzing ${KEY_TABLES.length} key tables:\n`);

        for (const tableName of KEY_TABLES) {
          console.log(`  Analyzing: ${tableName}...`);

          try {
            const table = franchise.getTableByName(tableName);

            if (!table) {
              console.log(`    ⚠ Table not found`);
              analysis.tables.push({
                name: tableName,
                error: 'Table not found'
              });
              continue;
            }

            const tableAnalysis = analyzeTableDetailed(table);
            analysis.tables.push(tableAnalysis);

            console.log(`    ✓ ${tableAnalysis.attributes.length} attributes, ${tableAnalysis.actualRecordCount} records`);

          } catch (err) {
            console.log(`    ✗ Error: ${err.message}`);
            analysis.tables.push({
              name: tableName,
              error: err.message
            });
          }
        }

        // Also scan for any tables with significant record counts
        console.log('\nScanning for other tables with significant data...\n');

        const allSchemas = franchise.schema.schema.schemas.filter(s => s && s.name);
        const tablesWithData = [];

        for (const schema of allSchemas) {
          try {
            const table = franchise.getTableByName(schema.name);
            if (table && table.header.nextRecordToUse && table.header.nextRecordToUse > 0) {
              tablesWithData.push({
                name: table.name,
                records: table.header.nextRecordToUse
              });
            }
          } catch (err) {
            // Skip tables that error
          }
        }

        // Sort by record count
        tablesWithData.sort((a, b) => b.records - a.records);

        console.log(`Found ${tablesWithData.length} tables with actual data:\n`);
        tablesWithData.slice(0, 30).forEach((t, idx) => {
          console.log(`  ${idx + 1}. ${t.name} (${t.records} records)`);
        });

        analysis.tablesWithData = tablesWithData;

        // Write outputs
        console.log('\n\nWriting outputs...');
        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(analysis, null, 2), 'utf8');
        console.log(`  ✓ JSON: ${OUTPUT_JSON}`);

        // Generate markdown
        generateMarkdown(analysis);
        console.log(`  ✓ Markdown: ${OUTPUT_MD}`);

        console.log('\nAnalysis complete!');
        resolve();

      } catch (err) {
        reject(err);
      }
    });

    franchise.on('error', reject);
  });
}

/**
 * Generate markdown report
 */
function generateMarkdown(analysis) {
  let md = '# Madden 26 Key Tables Reference\n\n';

  md += '## Metadata\n\n';
  md += `- **Game Version**: Madden ${analysis.metadata.gameVersion}\n`;
  md += `- **Schema Version**: ${analysis.metadata.schemaVersion}\n`;
  md += `- **Analyzed**: ${analysis.metadata.analyzedDate}\n`;
  md += `- **File**: ${analysis.metadata.fileName}\n\n`;

  md += '---\n\n';

  md += '## Key Tables\n\n';

  for (const table of analysis.tables) {
    if (table.error) {
      md += `### ${table.name}\n\n`;
      md += `**Error**: ${table.error}\n\n`;
      continue;
    }

    md += `### ${table.name}\n\n`;
    md += `- **Record Capacity**: ${table.recordCapacity}\n`;
    md += `- **Current Records**: ${table.actualRecordCount}\n`;
    md += `- **Attributes**: ${table.attributes.length}\n`;
    md += `- **Has Second Table**: ${table.hasSecondTable ? 'Yes' : 'No'}\n\n`;

    if (table.attributes.length > 0) {
      md += '#### Attributes\n\n';
      md += '| Name | Type | Reference | Min | Max | Enum |\n';
      md += '|------|------|-----------|-----|-----|------|\n';

      for (const attr of table.attributes) {
        const ref = attr.isReference ? (attr.referenceTableId || 'Yes') : '-';
        const min = attr.minValue !== undefined ? attr.minValue : '-';
        const max = attr.maxValue !== undefined ? attr.maxValue : '-';
        const enumVal = attr.enum || '-';

        md += `| ${attr.name} | ${attr.type} | ${ref} | ${min} | ${max} | ${enumVal} |\n`;
      }

      md += '\n';
    }

    md += '---\n\n';
  }

  // Tables with data
  md += '## All Tables With Actual Data\n\n';
  md += 'Tables that have records in this franchise file:\n\n';
  md += '| Rank | Table Name | Record Count |\n';
  md += '|------|------------|-------------|\n';

  analysis.tablesWithData.forEach((t, idx) => {
    md += `| ${idx + 1} | ${t.name} | ${t.records} |\n`;
  });

  md += '\n';

  fs.writeFileSync(OUTPUT_MD, md, 'utf8');
}

// Run
analyzeKeyTables()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
