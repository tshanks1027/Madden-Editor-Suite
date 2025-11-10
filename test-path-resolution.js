// Quick test to verify path resolution
const path = require('path');
const fs = require('fs');

// Simulate what PlayerDataService does
const __dirname = 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\.vite\\build\\services\\generator';

console.log('Testing path resolution...');
console.log('__dirname:', __dirname);

// Old way (broken)
const oldPath = path.join(__dirname, '..', '..', 'data', 'lookups', 'ROSTER_lookup.csv');
console.log('OLD path:', oldPath);

// New way (fixed) - would use app.getAppPath() in real code
const projectRoot = 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite';
const newPath = path.join(projectRoot, 'data', 'lookups', 'ROSTER_lookup.csv');
console.log('NEW path:', newPath);

// Verify file exists
console.log('\nFile exists at OLD path:', fs.existsSync(oldPath));
console.log('File exists at NEW path:', fs.existsSync(newPath));
