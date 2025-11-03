const XLSX = require('xlsx');
const fs = require('fs');

// Read the Excel file
const workbook = XLSX.readFile('C:\\Users\\tshan\\Downloads\\Copy of Rating Tools.xlsx');

// Get all sheet names
console.log('Sheet Names:', workbook.SheetNames);
console.log('\n');

// For each sheet, show some info
workbook.SheetNames.forEach(sheetName => {
    console.log(`\n========== SHEET: ${sheetName} ==========`);
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON to see the data structure
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Show first 30 rows
    console.log('First 30 rows:');
    data.slice(0, 30).forEach((row, idx) => {
        console.log(`Row ${idx}:`, row);
    });

    // Also save to JSON file for easier analysis
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    fs.writeFileSync(`C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\scripts\\${sheetName}.json`, JSON.stringify(jsonData, null, 2));
    console.log(`\nSaved to ${sheetName}.json`);
});
