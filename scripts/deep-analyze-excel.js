const XLSX = require('xlsx');

// Read the Excel file
const workbook = XLSX.readFile('C:\\Users\\tshan\\Downloads\\Copy of Rating Tools.xlsx', {
    cellFormula: true,  // Include formulas
    cellStyles: true    // Include styles
});

console.log('========== WORKBOOK ANALYSIS ==========\n');
console.log('Total Sheets:', workbook.SheetNames.length);
console.log('Sheet Names:', workbook.SheetNames);
console.log('\n');

// Analyze each sheet for formulas and patterns
workbook.SheetNames.forEach((sheetName, idx) => {
    console.log(`\n========== SHEET ${idx + 1}/${workbook.SheetNames.length}: ${sheetName} ==========`);
    const sheet = workbook.Sheets[sheetName];

    // Get the range of the sheet
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    console.log(`Range: ${sheet['!ref'] || 'Empty'}`);
    console.log(`Rows: ${range.e.r - range.s.r + 1}, Cols: ${range.e.c - range.s.c + 1}`);

    // Look for cells with formulas
    const cellsWithFormulas = [];
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = sheet[cellAddress];
            if (cell && cell.f) {
                cellsWithFormulas.push({
                    address: cellAddress,
                    formula: cell.f,
                    value: cell.v,
                    type: cell.t
                });
            }
        }
    }

    if (cellsWithFormulas.length > 0) {
        console.log(`\n*** FOUND ${cellsWithFormulas.length} CELLS WITH FORMULAS ***`);
        // Show first 20 formulas
        cellsWithFormulas.slice(0, 20).forEach(cell => {
            console.log(`  ${cell.address}: ${cell.formula} = ${cell.value}`);
        });
        if (cellsWithFormulas.length > 20) {
            console.log(`  ... and ${cellsWithFormulas.length - 20} more formulas`);
        }
    }

    // Convert to JSON and show first few rows to identify structure
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    console.log(`\nFirst 10 rows (sample):`);
    data.slice(0, 10).forEach((row, idx) => {
        // Only show rows with some content
        if (row.some(cell => cell !== '')) {
            console.log(`Row ${idx}:`, row.slice(0, 12).join(' | ')); // First 12 columns
        }
    });

    // Check if sheet has attribute column headers (SPD, STR, ACC, etc.)
    const attributeKeywords = ['SPD', 'STR', 'ACC', 'AGI', 'AWR', 'CTH', 'CAR', 'THP', 'TAD', 'TAM', 'TAS'];
    const hasAttributes = data.some(row =>
        attributeKeywords.some(keyword => row.some(cell =>
            typeof cell === 'string' && cell.toUpperCase().includes(keyword)
        ))
    );

    if (hasAttributes) {
        console.log('\n*** THIS SHEET APPEARS TO HAVE ATTRIBUTE DATA ***');
    }
});
