/**
 * Examine NFL Stats XLS files to understand the data format
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const STATS_FOLDER = 'C:/Users/tshan/Documents/Docs/NFL Stats';

// Sample files to examine
const sampleFiles = [
    '1976Pass.xls',
    '1976Run.xls',
    '1976Rec.xls',
    '1976Def.xls'
];

for (const file of sampleFiles) {
    const filePath = path.join(STATS_FOLDER, file);

    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${file}`);
        continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`FILE: ${file}`);
    console.log('='.repeat(60));

    try {
        const workbook = XLSX.readFile(filePath);

        console.log('Sheet names:', workbook.SheetNames);

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        console.log(`Total rows: ${data.length}`);

        // Show header row
        if (data.length > 0) {
            console.log('\nHeader row:');
            console.log(data[0]);
        }

        // Show first 3 data rows
        console.log('\nFirst 3 data rows:');
        for (let i = 1; i <= Math.min(3, data.length - 1); i++) {
            console.log(`Row ${i}:`, data[i]);
        }
    } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
    }
}
