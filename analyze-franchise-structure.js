/**
 * Madden 26 Franchise File Structure Analyzer
 *
 * This script performs comprehensive analysis of a Madden franchise file:
 * - Lists all tables available
 * - Shows table metadata (record count, field types)
 * - Captures sample data from first records
 * - Categorizes tables by domain (Player, Team, Staff, etc.)
 * - Outputs both JSON and Markdown reports
 *
 * Usage: node analyze-franchise-structure.js
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

// Configuration
const FRANCHISE_FILE_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';
const OUTPUT_JSON = path.join(__dirname, 'M26_FRANCHISE_STRUCTURE.json');
const OUTPUT_MD = path.join(__dirname, 'M26_FRANCHISE_STRUCTURE.md');

// Table categorization based on naming patterns
const TABLE_CATEGORIES = {
  'Player': /^(Player|PLYR|PlayerArray)/i,
  'Team': /^(Team|TEAM|TeamArray|TeamRank|TeamStat|TeamSeason)/i,
  'Staff': /^(Coach|COACH|Owner|OWNR|Scout|SCOU)/i,
  'Season': /^(Season|SEAS|Week|WEEK|Game|GAME|Schedule|Match)/i,
  'Draft': /^(Draft|DRFT|DraftPick|DraftClass|Prospect)/i,
  'Contract': /^(Contract|CONT|Salary|SAL|Cap)/i,
  'League': /^(League|LEAG|Division|DIV|Conference|CONF)/i,
  'Statistics': /^(Stat|STAT|CareerStat|SeasonStat)/i,
  'Awards': /^(Award|AWRD|Trophy|Honor|Record)/i,
  'Injury': /^(Injury|INJ)/i,
  'Trade': /^(Trade|TRAD|Transaction)/i,
  'Media': /^(Story|NEWS|Article|Tweet|Social)/i,
  'Stadium': /^(Stadium|STAD|Arena)/i,
  'Presentation': /^(Present|Pres|Broadcast|Commentary)/i,
  'Settings': /^(Setting|Option|Preference|Config)/i,
  'System': /^(Schema|Meta|Version|Table|Index|Signature)/i
};

/**
 * Categorize a table based on its name
 */
function categorizeTable(tableName) {
  for (const [category, pattern] of Object.entries(TABLE_CATEGORIES)) {
    if (pattern.test(tableName)) {
      return category;
    }
  }
  return 'Other';
}

/**
 * Get field type string
 */
function getFieldTypeString(field) {
  const typeMap = {
    's_int8': 'int8',
    's_int16': 'int16',
    's_int32': 'int32',
    's_uint8': 'uint8',
    's_uint16': 'uint16',
    's_uint32': 'uint32',
    's_bool': 'bool',
    's_float': 'float',
    's_string': 'string',
    's_reference': 'reference',
    's_blob': 'blob',
    's_enum': 'enum'
  };

  if (field.isReference) return 'reference';
  return typeMap[field.type] || field.type || 'unknown';
}

/**
 * Safely get sample value from a record
 */
function getSampleValue(record, fieldName, fieldType) {
  try {
    const value = record[fieldName];

    // Handle undefined/null
    if (value === undefined || value === null) {
      return null;
    }

    // Handle references
    if (fieldType === 'reference') {
      return {
        _type: 'reference',
        tableId: record.fieldsArray?.find(f => f.key === fieldName)?.referenceData?.tableId || null,
        rowNumber: value
      };
    }

    // Handle blobs (just show size)
    if (fieldType === 'blob') {
      return {
        _type: 'blob',
        size: value?.length || 0
      };
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return {
        _type: 'array',
        length: value.length,
        sample: value.slice(0, 3)
      };
    }

    // Handle objects
    if (typeof value === 'object' && value !== null) {
      return {
        _type: 'object',
        keys: Object.keys(value)
      };
    }

    return value;
  } catch (err) {
    return { _error: err.message };
  }
}

/**
 * Analyze a single table
 */
function analyzeTable(table) {
  const analysis = {
    name: table.name,
    recordCount: table.header.recordCapacity,
    currentRecords: table.header.currentRecords || 0,
    fields: []
  };

  // Get field definitions from table header
  const fields = table.schema?.fields || [];

  for (const field of fields) {
    const fieldInfo = {
      name: field.name,
      type: getFieldTypeString(field),
      offset: field.offset,
      length: field.length || field.maxLength || null,
      isReference: field.isReference || false,
      referenceTable: field.isReference ? (field.referenceData?.tableId || null) : null,
      enum: field.enum || null
    };

    analysis.fields.push(fieldInfo);
  }

  // Try to get sample data from first record
  try {
    const records = table.records;
    if (records && records.length > 0) {
      const firstRecord = records[0];
      analysis.sampleData = {};

      for (const field of fields) {
        analysis.sampleData[field.name] = getSampleValue(
          firstRecord,
          field.name,
          fieldInfo.type
        );
      }
    }
  } catch (err) {
    analysis.sampleDataError = err.message;
  }

  return analysis;
}

/**
 * Main analysis function
 */
async function analyzeFranchiseFile() {
  console.log('Starting Madden 26 Franchise File Analysis...');
  console.log(`File: ${FRANCHISE_FILE_PATH}`);
  console.log('');

  const franchise = new Franchise(FRANCHISE_FILE_PATH);

  return new Promise((resolve, reject) => {
    franchise.on('ready', async () => {
      try {
        console.log('Franchise file loaded successfully!');
        console.log('');

        // Get all table schemas from franchise.schema.schema.schemas
        let allTableSchemas = [];
        if (franchise.schema?.schema?.schemas && Array.isArray(franchise.schema.schema.schemas)) {
          allTableSchemas = franchise.schema.schema.schemas.filter(t => t && t.name);
        } else {
          throw new Error('Cannot find table definitions in schema');
        }

        console.log(`Found ${allTableSchemas.length} table schemas`);
        console.log(`Game Year: ${franchise.schema?.meta?.gameYear || 'Unknown'}`);
        console.log(`Schema Version: ${franchise.schema?.meta?.major}.${franchise.schema?.meta?.minor}`);
        console.log('');

        // Analyze each table
        const analysis = {
          metadata: {
            fileName: path.basename(FRANCHISE_FILE_PATH),
            filePath: FRANCHISE_FILE_PATH,
            analyzedDate: new Date().toISOString(),
            gameVersion: franchise.schema?.meta?.gameYear || 'Unknown',
            schemaVersion: franchise.schema?.meta?.major + '.' + franchise.schema?.meta?.minor || 'Unknown',
            totalTables: allTableSchemas.length
          },
          categorizedTables: {},
          allTables: []
        };

        // Analyze tables one by one
        for (let i = 0; i < allTableSchemas.length; i++) {
          const tableSchema = allTableSchemas[i];
          const tableName = tableSchema.name;

          // Show progress every 50 tables
          if (i % 50 === 0 || i === allTableSchemas.length - 1) {
            console.log(`Progress: ${i + 1}/${allTableSchemas.length} tables analyzed...`);
          }

          try {
            const table = franchise.getTableByName(tableName);
            if (!table) {
              console.warn(`  Warning: Could not load table ${tableName}`);
              continue;
            }

            const tableAnalysis = analyzeTable(table);
            const category = categorizeTable(tableName);

            // Add to categorized tables
            if (!analysis.categorizedTables[category]) {
              analysis.categorizedTables[category] = [];
            }
            analysis.categorizedTables[category].push(tableAnalysis);

            // Add to all tables list
            analysis.allTables.push({
              ...tableAnalysis,
              category
            });
          } catch (err) {
            console.error(`  Error analyzing table ${tableName}: ${err.message}`);
            analysis.allTables.push({
              name: tableName,
              error: err.message,
              category: 'Error'
            });
          }
        }

        console.log('');
        console.log('Analysis complete!');
        console.log('');

        // Write JSON output
        console.log(`Writing JSON output to: ${OUTPUT_JSON}`);
        fs.writeFileSync(OUTPUT_JSON, JSON.stringify(analysis, null, 2), 'utf8');

        // Generate markdown report
        console.log(`Writing Markdown output to: ${OUTPUT_MD}`);
        generateMarkdownReport(analysis);

        console.log('');
        console.log('Done! Check the output files for detailed analysis.');

        resolve();
      } catch (err) {
        reject(err);
      }
    });

    franchise.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate human-readable markdown report
 */
function generateMarkdownReport(analysis) {
  let md = '# Madden 26 Franchise File Structure Analysis\n\n';

  // Metadata
  md += '## File Metadata\n\n';
  md += `- **File Name**: ${analysis.metadata.fileName}\n`;
  md += `- **File Path**: ${analysis.metadata.filePath}\n`;
  md += `- **Analyzed Date**: ${analysis.metadata.analyzedDate}\n`;
  md += `- **Game Version**: ${analysis.metadata.gameVersion}\n`;
  md += `- **Schema Version**: ${analysis.metadata.schemaVersion}\n`;
  md += `- **Total Tables**: ${analysis.metadata.totalTables}\n\n`;

  // Table of contents by category
  md += '## Table of Contents by Category\n\n';
  const sortedCategories = Object.keys(analysis.categorizedTables).sort();
  for (const category of sortedCategories) {
    const tables = analysis.categorizedTables[category];
    md += `- [${category}](#${category.toLowerCase().replace(/\s+/g, '-')}) (${tables.length} tables)\n`;
  }
  md += '\n---\n\n';

  // Detailed analysis by category
  for (const category of sortedCategories) {
    md += `## ${category}\n\n`;
    md += `**${analysis.categorizedTables[category].length} tables**\n\n`;

    for (const table of analysis.categorizedTables[category]) {
      md += `### ${table.name}\n\n`;
      md += `- **Record Capacity**: ${table.recordCount}\n`;
      md += `- **Current Records**: ${table.currentRecords}\n`;
      md += `- **Fields**: ${table.fields.length}\n\n`;

      // Fields table
      md += '#### Fields\n\n';
      md += '| Field Name | Type | Offset | Length | Reference Table |\n';
      md += '|------------|------|--------|--------|----------------|\n';

      for (const field of table.fields) {
        const refTable = field.isReference ? (field.referenceTable || 'Yes') : '-';
        const length = field.length !== null ? field.length : '-';
        md += `| ${field.name} | ${field.type} | ${field.offset} | ${length} | ${refTable} |\n`;
      }
      md += '\n';

      // Sample data (if available)
      if (table.sampleData) {
        md += '#### Sample Data (First Record)\n\n';
        md += '```json\n';
        md += JSON.stringify(table.sampleData, null, 2);
        md += '\n```\n\n';
      }

      if (table.sampleDataError) {
        md += `*Sample data unavailable: ${table.sampleDataError}*\n\n`;
      }

      md += '---\n\n';
    }
  }

  // Summary statistics
  md += '## Summary Statistics\n\n';
  md += '### Tables by Category\n\n';
  md += '| Category | Count |\n';
  md += '|----------|-------|\n';
  for (const category of sortedCategories) {
    md += `| ${category} | ${analysis.categorizedTables[category].length} |\n`;
  }
  md += '\n';

  // Top 20 largest tables by field count
  md += '### Top 20 Tables by Field Count\n\n';
  md += '| Rank | Table Name | Fields | Records | Category |\n';
  md += '|------|------------|--------|---------|----------|\n';

  const sortedByFields = [...analysis.allTables]
    .filter(t => t.fields)
    .sort((a, b) => b.fields.length - a.fields.length)
    .slice(0, 20);

  sortedByFields.forEach((table, idx) => {
    md += `| ${idx + 1} | ${table.name} | ${table.fields.length} | ${table.currentRecords} | ${table.category} |\n`;
  });
  md += '\n';

  // Top 20 tables by record count
  md += '### Top 20 Tables by Record Count\n\n';
  md += '| Rank | Table Name | Records | Fields | Category |\n';
  md += '|------|------------|---------|--------|----------|\n';

  const sortedByRecords = [...analysis.allTables]
    .filter(t => t.currentRecords)
    .sort((a, b) => b.currentRecords - a.currentRecords)
    .slice(0, 20);

  sortedByRecords.forEach((table, idx) => {
    md += `| ${idx + 1} | ${table.name} | ${table.currentRecords} | ${table.fields.length} | ${table.category} |\n`;
  });
  md += '\n';

  fs.writeFileSync(OUTPUT_MD, md, 'utf8');
}

// Run the analysis
analyzeFranchiseFile()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
