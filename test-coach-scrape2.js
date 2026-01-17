/**
 * Test scraping the coaches_year table specifically
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Find Chrome/Edge on the system
function findChrome() {
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  for (const chromePath of chromePaths) {
    if (fs.existsSync(chromePath)) {
      console.log(`Found browser at: ${chromePath}`);
      return chromePath;
    }
  }
  return null;
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testScrape() {
  const chromePath = findChrome();
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  const url = 'https://www.pro-football-reference.com/teams/crd/coaches.htm';
  console.log(`Fetching ${url}`);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await delay(1000);

  // Get the coaches_year table structure
  const yearTableData = await page.evaluate(() => {
    const table = document.querySelector('#coaches_year');
    if (!table) return { error: 'No coaches_year table found' };

    const rows = table.querySelectorAll('tbody tr');
    const sampleRows = [];

    // Get first 5 non-header rows
    let count = 0;
    for (const row of rows) {
      if (row.classList.contains('thead') || row.classList.contains('over_header')) continue;
      if (count >= 5) break;

      const cells = row.querySelectorAll('td, th');
      const cellData = [];
      cells.forEach(cell => {
        cellData.push({
          tag: cell.tagName,
          dataStat: cell.getAttribute('data-stat'),
          text: cell.textContent?.trim()?.substring(0, 30)
        });
      });
      sampleRows.push(cellData);
      count++;
    }

    // Get column headers from thead
    const headerRow = table.querySelector('thead tr:not(.over_header)');
    const headers = [];
    if (headerRow) {
      headerRow.querySelectorAll('th').forEach(th => {
        headers.push({
          dataStat: th.getAttribute('data-stat'),
          text: th.textContent?.trim()
        });
      });
    }

    return {
      rowCount: rows.length,
      headers,
      sampleRows
    };
  });

  console.log('\n=== coaches_year table structure ===');
  console.log(JSON.stringify(yearTableData, null, 2));

  await browser.close();
}

testScrape().catch(console.error);
