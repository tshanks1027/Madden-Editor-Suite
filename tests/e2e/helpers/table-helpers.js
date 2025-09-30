/**
 * Handsontable Interaction Helpers for Playwright Tests
 *
 * Utilities for interacting with Handsontable data grid during E2E tests.
 */

/**
 * Wait for Handsontable to be initialized
 * @param {Object} page - Playwright page object
 * @param {number} timeout - Timeout in ms
 */
async function waitForHandsontable(page, timeout = 10000) {
  await page.waitForSelector('#handsontable-container', {
    state: 'visible',
    timeout
  });

  // Wait for table to have data
  await page.waitForFunction(
    () => {
      const container = document.getElementById('handsontable-container');
      if (!container) return false;

      // Check if Handsontable instance exists
      const hot = window.app?.hotTable;
      return hot && hot.countRows() > 0;
    },
    { timeout }
  );
}

/**
 * Get number of rows in Handsontable
 * @param {Object} page - Playwright page object
 * @returns {Promise<number>} Number of rows
 */
async function getRowCount(page) {
  return await page.evaluate(() => {
    const hot = window.app?.hotTable;
    return hot ? hot.countRows() : 0;
  });
}

/**
 * Get number of columns in Handsontable
 * @param {Object} page - Playwright page object
 * @returns {Promise<number>} Number of columns
 */
async function getColumnCount(page) {
  return await page.evaluate(() => {
    const hot = window.app?.hotTable;
    return hot ? hot.countCols() : 0;
  });
}

/**
 * Get cell value from Hands ontable
 * @param {Object} page - Playwright page object
 * @param {number} row - Row index (0-based)
 * @param {number} col - Column index (0-based)
 * @returns {Promise<any>} Cell value
 */
async function getCellValue(page, row, col) {
  return await page.evaluate(({ row, col }) => {
    const hot = window.app?.hotTable;
    return hot ? hot.getDataAtCell(row, col) : null;
  }, { row, col });
}

/**
 * Set cell value in Handsontable
 * @param {Object} page - Playwright page object
 * @param {number} row - Row index (0-based)
 * @param {number} col - Column index (0-based)
 * @param {any} value - New value
 */
async function setCellValue(page, row, col, value) {
  await page.evaluate(({ row, col, value }) => {
    const hot = window.app?.hotTable;
    if (hot) {
      hot.setDataAtCell(row, col, value);
    }
  }, { row, col, value });

  // Wait for change to propagate
  await page.waitForTimeout(500);
}

/**
 * Get column headers from Handsontable
 * @param {Object} page - Playwright page object
 * @returns {Promise<Array<string>>} Array of column headers
 */
async function getColumnHeaders(page) {
  return await page.evaluate(() => {
    const hot = window.app?.hotTable;
    if (!hot) return [];

    const colCount = hot.countCols();
    const headers = [];

    for (let i = 0; i < colCount; i++) {
      headers.push(hot.getColHeader(i));
    }

    return headers;
  });
}

/**
 * Get row data from Handsontable
 * @param {Object} page - Playwright page object
 * @param {number} row - Row index (0-based)
 * @returns {Promise<Array>} Array of cell values for the row
 */
async function getRowData(page, row) {
  return await page.evaluate((row) => {
    const hot = window.app?.hotTable;
    return hot ? hot.getDataAtRow(row) : [];
  }, row);
}

/**
 * Get column data from Handsontable
 * @param {Object} page - Playwright page object
 * @param {number} col - Column index (0-based)
 * @returns {Promise<Array>} Array of cell values for the column
 */
async function getColumnData(page, col) {
  return await page.evaluate((col) => {
    const hot = window.app?.hotTable;
    return hot ? hot.getDataAtCol(col) : [];
  }, col);
}

/**
 * Find column index by header name
 * @param {Object} page - Playwright page object
 * @param {string} headerName - Column header name
 * @returns {Promise<number>} Column index or -1 if not found
 */
async function findColumnByHeader(page, headerName) {
  return await page.evaluate((headerName) => {
    const hot = window.app?.hotTable;
    if (!hot) return -1;

    const colCount = hot.countCols();
    for (let i = 0; i < colCount; i++) {
      if (hot.getColHeader(i) === headerName) {
        return i;
      }
    }
    return -1;
  }, headerName);
}

/**
 * Click on a cell in Handsontable
 * @param {Object} page - Playwright page object
 * @param {number} row - Row index (0-based)
 * @param {number} col - Column index (0-based)
 */
async function clickCell(page, row, col) {
  await page.evaluate(({ row, col }) => {
    const hot = window.app?.hotTable;
    if (hot) {
      hot.selectCell(row, col);
    }
  }, { row, col });

  await page.waitForTimeout(300);
}

/**
 * Edit cell value via UI interaction
 * @param {Object} page - Playwright page object
 * @param {number} row - Row index (0-based)
 * @param {number} col - Column index (0-based)
 * @param {string} newValue - New value to enter
 */
async function editCellViaUI(page, row, col, newValue) {
  // Click cell to select
  await clickCell(page, row, col);

  // Double-click to enter edit mode
  await page.evaluate(({ row, col }) => {
    const hot = window.app?.hotTable;
    if (hot) {
      hot.selectCell(row, col);
      const editor = hot.getActiveEditor();
      if (editor) {
        editor.beginEditing();
      }
    }
  }, { row, col });

  // Type new value
  await page.keyboard.type(String(newValue));

  // Press Enter to confirm
  await page.keyboard.press('Enter');

  // Wait for change to propagate
  await page.waitForTimeout(500);
}

/**
 * Get all table data
 * @param {Object} page - Playwright page object
 * @returns {Promise<Array<Array>>} 2D array of all table data
 */
async function getAllTableData(page) {
  return await page.evaluate(() => {
    const hot = window.app?.hotTable;
    return hot ? hot.getData() : [];
  });
}

/**
 * Verify cell has expected value
 * @param {Object} page - Playwright page object
 * @param {number} row - Row index (0-based)
 * @param {number} col - Column index (0-based)
 * @param {any} expectedValue - Expected value
 * @returns {Promise<boolean>} True if value matches
 */
async function verifyCellValue(page, row, col, expectedValue) {
  const actualValue = await getCellValue(page, row, col);
  return actualValue === expectedValue;
}

/**
 * Find row by cell value
 * @param {Object} page - Playwright page object
 * @param {number} col - Column to search
 * @param {any} searchValue - Value to find
 * @returns {Promise<number>} Row index or -1 if not found
 */
async function findRowByCellValue(page, col, searchValue) {
  return await page.evaluate(({ col, searchValue }) => {
    const hot = window.app?.hotTable;
    if (!hot) return -1;

    const rowCount = hot.countRows();
    for (let i = 0; i < rowCount; i++) {
      const value = hot.getDataAtCell(i, col);
      if (value === searchValue) {
        return i;
      }
    }
    return -1;
  }, { col, searchValue });
}

/**
 * Get player count from UI
 * @param {Object} page - Playwright page object
 * @returns {Promise<number>} Player count
 */
async function getPlayerCount(page) {
  const text = await page.textContent('#playerCount');
  const match = text.match(/(\d+) players?/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Get visible fields count from UI
 * @param {Object} page - Playwright page object
 * @returns {Promise<number>} Visible fields count
 */
async function getVisibleFieldsCount(page) {
  const text = await page.textContent('#visibleFields');
  const match = text.match(/(\d+) visible fields?/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Toggle "Show All Columns" checkbox
 * @param {Object} page - Playwright page object
 * @param {boolean} checked - Whether to check or uncheck
 */
async function toggleShowAllColumns(page, checked) {
  const checkbox = await page.$('#showAllColumns');
  const isChecked = await checkbox.isChecked();

  if (isChecked !== checked) {
    await checkbox.click();
    // Wait for table to re-render
    await page.waitForTimeout(1000);
  }
}

/**
 * Select position filter
 * @param {Object} page - Playwright page object
 * @param {string} position - Position code (e.g., 'QB', 'HB')
 */
async function selectPositionFilter(page, position) {
  await page.selectOption('#positionFilter', position);
  // Wait for table to filter
  await page.waitForTimeout(500);
}

module.exports = {
  waitForHandsontable,
  getRowCount,
  getColumnCount,
  getCellValue,
  setCellValue,
  getColumnHeaders,
  getRowData,
  getColumnData,
  findColumnByHeader,
  clickCell,
  editCellViaUI,
  getAllTableData,
  verifyCellValue,
  findRowByCellValue,
  getPlayerCount,
  getVisibleFieldsCount,
  toggleShowAllColumns,
  selectPositionFilter,
};
