/**
 * Test scraping one team to debug table structure
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

  // Debug: Check what tables exist on the page
  const tableInfo = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const info = [];
    tables.forEach((table, i) => {
      info.push({
        index: i,
        id: table.id || 'no-id',
        className: table.className,
        rows: table.querySelectorAll('tr').length
      });
    });
    return info;
  });

  console.log('\n=== Tables on page ===');
  console.log(JSON.stringify(tableInfo, null, 2));

  // Debug: Check if coaches_year is in comments
  const hasCommentsTable = await page.evaluate(() => {
    const html = document.body.innerHTML;
    const hasCoachesYear = html.includes('id="coaches_year"');
    const hasAllCoachesYear = html.includes('id="all_coaches_year"');
    const inComment = html.includes('<!--') && (html.includes('id="coaches_year"') || html.includes('coaches_year'));
    return { hasCoachesYear, hasAllCoachesYear, inComment };
  });

  console.log('\n=== Comment check ===');
  console.log(JSON.stringify(hasCommentsTable, null, 2));

  // Try to get the first table with stats_table class
  const firstTableData = await page.evaluate(() => {
    const table = document.querySelector('table.stats_table');
    if (!table) return null;

    const rows = table.querySelectorAll('tbody tr');
    const firstRow = rows[0];
    if (!firstRow) return null;

    const cells = firstRow.querySelectorAll('td, th');
    const cellData = [];
    cells.forEach(cell => {
      cellData.push({
        tag: cell.tagName,
        dataStat: cell.getAttribute('data-stat'),
        text: cell.textContent?.trim()?.substring(0, 30)
      });
    });
    return { tableName: table.id, rowCount: rows.length, firstRowCells: cellData };
  });

  console.log('\n=== First stats_table data ===');
  console.log(JSON.stringify(firstTableData, null, 2));

  // Get the HTML of any commented tables
  const commentedHtml = await page.evaluate(() => {
    const html = document.body.innerHTML;
    const match = html.match(/<!--[\s\S]*?coaches[\s\S]*?-->/);
    return match ? match[0].substring(0, 500) : 'no match';
  });

  console.log('\n=== Commented HTML snippet ===');
  console.log(commentedHtml);

  await browser.close();
}

testScrape().catch(console.error);
