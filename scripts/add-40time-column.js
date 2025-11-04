/**
 * Script to add 40Time column to ALL_PLAYER_LOOKUP.csv
 * Adds a comma at the end of each data row to accommodate the new column
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const inputFile = path.join(__dirname, '../data/lookups/ALL_PLAYER_LOOKUP.csv');
const outputFile = path.join(__dirname, '../data/lookups/ALL_PLAYER_LOOKUP_updated.csv');

async function processCSV() {
  const fileStream = fs.createReadStream(inputFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const writeStream = fs.createWriteStream(outputFile);
  let lineCount = 0;
  let isFirstLine = true;

  for await (const line of rl) {
    lineCount++;

    if (isFirstLine) {
      // Header already has 40Time column, just write it
      writeStream.write(line + '\n');
      isFirstLine = false;
      console.log(`Header: ${line}`);
    } else {
      // Add empty 40Time value (comma at end)
      writeStream.write(line + ',\n');
    }

    if (lineCount % 5000 === 0) {
      console.log(`Processed ${lineCount} lines...`);
    }
  }

  writeStream.end();
  console.log(`\nFinished! Processed ${lineCount} lines total.`);
  console.log(`Output written to: ${outputFile}`);
  console.log(`\nTo replace the original file, run:`);
  console.log(`mv ${outputFile} ${inputFile}`);
}

processCSV().catch(console.error);
