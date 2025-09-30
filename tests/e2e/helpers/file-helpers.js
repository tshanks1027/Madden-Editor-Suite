/**
 * File Operation Helpers for Playwright Tests
 *
 * Utilities for handling file dialogs and file operations during testing.
 */

const path = require('path');
const fs = require('fs');

/**
 * Get path to test roster file
 * @param {string} filename - Name of test file
 * @returns {string} Absolute path to test file
 */
function getTestFilePath(filename) {
  return path.join(
    __dirname,
    '../../../',
    'C:/Users/tshan/OneDrive/Documents/Madden Files/KNuttZFranchiseSandBox/Madden Files',
    filename
  );
}

/**
 * Check if test file exists
 * @param {string} filename - Name of test file
 * @returns {boolean} True if file exists
 */
function testFileExists(filename) {
  const filePath = getTestFilePath(filename);
  return fs.existsSync(filePath);
}

/**
 * Get test file size
 * @param {string} filename - Name of test file
 * @returns {number} File size in bytes
 */
function getTestFileSize(filename) {
  const filePath = getTestFilePath(filename);
  if (!fs.existsSync(filePath)) return 0;

  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * List all test files in directory
 * @returns {Array} Array of test file objects with name and size
 */
function listTestFiles() {
  const testDir = path.join(
    __dirname,
    '../../../',
    'C:/Users/tshan/OneDrive/Documents/Madden Files/KNuttZFranchiseSandBox/Madden Files'
  );

  if (!fs.existsSync(testDir)) {
    return [];
  }

  const files = fs.readdirSync(testDir);
  return files.map(filename => {
    const filePath = path.join(testDir, filename);
    const stats = fs.statSync(filePath);

    return {
      name: filename,
      size: stats.size,
      path: filePath,
      sizeFormatted: formatBytes(stats.size),
    };
  });
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Handle file open dialog in Electron
 * @param {Object} electronApp - Electron app instance
 * @param {string} filename - Name of file to select
 */
async function handleFileDialog(electronApp, filename) {
  const filePath = getTestFilePath(filename);

  // Set up file chooser interceptor
  await electronApp.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => {
      return {
        canceled: false,
        filePaths: [filePath]
      };
    };
  }, filePath);
}

/**
 * Create a temporary test file copy
 * @param {string} sourceFilename - Source file to copy
 * @param {string} destFilename - Destination filename
 * @returns {string} Path to copied file
 */
function createTestFileCopy(sourceFilename, destFilename) {
  const sourcePath = getTestFilePath(sourceFilename);
  const destPath = getTestFilePath(destFilename);

  fs.copyFileSync(sourcePath, destPath);
  return destPath;
}

/**
 * Delete a test file copy
 * @param {string} filename - File to delete
 */
function deleteTestFile(filename) {
  const filePath = getTestFilePath(filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Verify file was modified
 * @param {string} filename - File to check
 * @param {number} originalSize - Original file size
 * @returns {boolean} True if file was modified
 */
function fileWasModified(filename, originalSize) {
  const currentSize = getTestFileSize(filename);
  return currentSize !== originalSize;
}

/**
 * Read file header bytes
 * @param {string} filename - File to read
 * @param {number} numBytes - Number of bytes to read
 * @returns {Buffer} Buffer containing header bytes
 */
function readFileHeader(filename, numBytes = 16) {
  const filePath = getTestFilePath(filename);
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(numBytes);
  fs.readSync(fd, buffer, 0, numBytes, 0);
  fs.closeSync(fd);
  return buffer;
}

/**
 * Verify file has correct Madden signature
 * @param {string} filename - File to verify
 * @returns {Object} Object with isValid and format
 */
function verifyMaddenFileSignature(filename) {
  const header = readFileHeader(filename, 4);
  const signature = header.toString('ascii', 0, 4);

  const formats = {
    'TDB\0': 'TDB Legacy',
    'TDB\x02': 'TDB2 Uncompressed',
    'FBCH': 'FBCH Modern',
  };

  const format = formats[signature];

  return {
    isValid: !!format,
    format: format || 'Unknown',
    signature: signature,
  };
}

module.exports = {
  getTestFilePath,
  testFileExists,
  getTestFileSize,
  listTestFiles,
  formatBytes,
  handleFileDialog,
  createTestFileCopy,
  deleteTestFile,
  fileWasModified,
  readFileHeader,
  verifyMaddenFileSignature,
};
