/**
 * STAR File Parser
 *
 * Parses RELION STAR files to extract metadata and file paths.
 * Supports multiple data blocks (optics, micrographs, global_shift, etc.)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const logger = require('./logger');

/**
 * Parse a RELION STAR file - returns data organized by block name
 * @param {string} starPath - Path to the STAR file
 * @param {number} limit - Maximum number of entries to return (0 = all)
 * @returns {Promise<Object>} Object with block names as keys, each containing rows array
 */
const parseStarFile = async (starPath, limit = 0) => {
  return new Promise((resolve, reject) => {
    const blocks = {};
    let currentBlockName = '';
    let currentBlockColumns = {};
    let currentBlockRows = [];
    let inLoopBlock = false;
    let currentColumnCount = 0;
    let allColumns = [];

    // For backward compatibility - micrograph files list
    const files = [];
    let totalFileCount = 0; // Track actual total count (not limited)

    const saveCurrentBlock = () => {
      if (currentBlockName && (currentBlockRows.length > 0 || Object.keys(currentBlockColumns).length > 0)) {
        const blockKey = currentBlockName.replace('data_', '');
        blocks[blockKey] = {
          columns: Object.keys(currentBlockColumns),
          rows: currentBlockRows
        };
      }
    };

    const fileStream = fs.createReadStream(starPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;

      // Detect data block start - save previous block and reset state
      if (line.startsWith('data_')) {
        saveCurrentBlock();
        currentBlockName = line;
        currentBlockColumns = {};
        currentBlockRows = [];
        currentColumnCount = 0;
        inLoopBlock = false;
        return;
      }

      // Detect loop block
      if (currentBlockName && line === 'loop_') {
        inLoopBlock = true;
        return;
      }

      // Parse column definitions
      if (currentBlockName && line.startsWith('_')) {
        const parts = line.split(/\s+/);
        const colName = parts[0];

        // Check if this is loop format (_colName #N) or inline value format (_colName value)
        if (parts.length >= 2) {
          const colIdxMatch = parts[1].match(/#(\d+)/);
          if (colIdxMatch) {
            // Loop format: _colName #N
            currentBlockColumns[colName] = parseInt(colIdxMatch[1], 10) - 1;
            currentColumnCount++;
            if (!allColumns.includes(colName)) {
              allColumns.push(colName);
            }
          } else {
            // Inline value format: _colName value (non-loop single values)
            currentBlockColumns[colName] = currentColumnCount;
            currentColumnCount++;

            // Parse the inline value
            const value = parts.slice(1).join(' ');
            // Only convert to number if the entire value is a valid number
            const isNumeric = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value);
            const parsedValue = isNumeric ? parseFloat(value) : value;

            // For non-loop blocks, store single values directly
            if (currentBlockRows.length === 0) {
              currentBlockRows.push({});
            }
            currentBlockRows[0][colName.substring(1)] = parsedValue; // Remove leading underscore
          }
        }
        return;
      }

      // Parse data rows (loop format)
      if (currentBlockName && inLoopBlock && !line.startsWith('_') && currentColumnCount > 0) {
        const values = line.split(/\s+/);
        if (values.length < currentColumnCount) return;

        const rowData = {};

        // Extract ALL columns dynamically
        for (const [colName, idx] of Object.entries(currentBlockColumns)) {
          if (idx < values.length) {
            const keyWithoutUnderscore = colName.substring(1); // Remove leading underscore
            const value = values[idx];
            // Only convert to number if the entire value is a valid number
            // This prevents converting "00000001@Extract/..." to 1
            // Use regex to check if it's a pure numeric value
            const isNumeric = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value);
            const parsedValue = isNumeric ? parseFloat(value) : value;
            rowData[keyWithoutUnderscore] = parsedValue;
          }
        }

        currentBlockRows.push(rowData);

        // For backward compatibility - add to files array if this is a micrograph/movie block
        if ('_rlnMicrographMovieName' in currentBlockColumns || '_rlnMicrographName' in currentBlockColumns) {
          totalFileCount++; // Always count total files

          const fileInfo = { ...rowData };

          if ('_rlnMicrographMovieName' in currentBlockColumns) {
            const idx = currentBlockColumns['_rlnMicrographMovieName'];
            if (idx < values.length) {
              fileInfo.movie_name = values[idx];
              fileInfo.name = path.basename(values[idx]);
            }
          } else if ('_rlnMicrographName' in currentBlockColumns) {
            const idx = currentBlockColumns['_rlnMicrographName'];
            if (idx < values.length) {
              fileInfo.micrograph_name = values[idx];
              fileInfo.name = path.basename(values[idx]);
            }
          }

          // Only add to files array if under limit
          if (limit === 0 || files.length < limit) {
            files.push(fileInfo);
          }
        }
      }
    });

    rl.on('close', () => {
      // Save the last block
      saveCurrentBlock();

      // Return both block-organized data and backward-compatible files array
      resolve({
        ...blocks,
        files: files,
        columns: allColumns,
        total: totalFileCount // Actual total count in file, not limited
      });
    });

    rl.on('error', (error) => {
      logger.error('[STAR Parser] Error:', error);
      reject(error);
    });
  });
};

/**
 * Parse optics table from STAR file
 * @param {string} starPath - Path to the STAR file
 * @returns {Promise<Array>} Array of optics group objects
 */
const parseOpticsTable = async (starPath) => {
  return new Promise((resolve, reject) => {
    const optics = [];
    const columns = {};
    let inOpticsBlock = false;
    let inLoopBlock = false;

    const fileStream = fs.createReadStream(starPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      line = line.trim();
      if (!line) return;

      // Detect optics block
      if (line === 'data_optics') {
        inOpticsBlock = true;
        inLoopBlock = false;
        return;
      }

      // Exit optics block on next data_ block
      if (inOpticsBlock && line.startsWith('data_') && line !== 'data_optics') {
        inOpticsBlock = false;
        return;
      }

      if (!inOpticsBlock) return;

      if (line === 'loop_') {
        inLoopBlock = true;
        return;
      }

      // Parse column definitions
      if (line.startsWith('_')) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const colName = parts[0];
          const colIdxMatch = parts[1].match(/#(\d+)/);
          if (colIdxMatch) {
            columns[colName] = parseInt(colIdxMatch[1], 10) - 1;
          }
        }
        return;
      }

      // Parse data rows
      if (inLoopBlock && Object.keys(columns).length > 0) {
        const values = line.split(/\s+/);
        const opticsGroup = {};

        for (const [colName, idx] of Object.entries(columns)) {
          if (idx < values.length) {
            const key = colName.substring(4); // Remove _rln prefix
            const value = values[idx];
            // Try to parse as number
            const numVal = parseFloat(value);
            opticsGroup[key] = isNaN(numVal) ? value : numVal;
          }
        }

        if (Object.keys(opticsGroup).length > 0) {
          optics.push(opticsGroup);
        }
      }
    });

    rl.on('close', () => resolve(optics));
    rl.on('error', reject);
  });
};

/**
 * Write a STAR file
 * @param {string} outputPath - Path to write the file
 * @param {Object} starData - Star data with blocks
 */
const writeStarFile = (outputPath, starData) => {
  const lines = [];
  lines.push('# Written by CryoProcess Node.js');
  lines.push('');

  for (const [blockName, blockData] of Object.entries(starData)) {
    if (!blockData || !blockData.columns || !blockData.data) {
      continue;
    }

    // Write block header
    lines.push(blockName.startsWith('data_') ? blockName : `data_${blockName}`);
    lines.push('');
    lines.push('loop_');

    // Write column definitions
    blockData.columns.forEach((col, idx) => {
      const colName = col.startsWith('_') ? col : `_${col}`;
      lines.push(`${colName} #${idx + 1}`);
    });

    // Write data rows
    for (const row of blockData.data) {
      lines.push(row.join('\t'));
    }

    lines.push('');
  }

  fs.writeFileSync(outputPath, lines.join('\n'));
};

/**
 * Synchronously get the first movie/micrograph path from a STAR file.
 * Reads only enough lines to find the first data row — efficient for large files.
 * @param {string} starPath - Path to the STAR file
 * @returns {string|null} First movie or micrograph path, or null if not found
 */
const getFirstMoviePathSync = (starPath) => {
  try {
    const content = fs.readFileSync(starPath, 'utf-8');
    const lines = content.split('\n');

    let movieColIdx = -1;
    let microColIdx = -1;
    let inLoop = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line === 'loop_') {
        inLoop = true;
        movieColIdx = -1;
        microColIdx = -1;
        continue;
      }

      if (line.startsWith('data_')) {
        inLoop = false;
        movieColIdx = -1;
        microColIdx = -1;
        continue;
      }

      if (inLoop && line.startsWith('_')) {
        const parts = line.split(/\s+/);
        const idxMatch = parts[1] && parts[1].match(/#(\d+)/);
        if (idxMatch) {
          const idx = parseInt(idxMatch[1], 10) - 1;
          if (parts[0] === '_rlnMicrographMovieName') movieColIdx = idx;
          if (parts[0] === '_rlnMicrographName') microColIdx = idx;
        }
        continue;
      }

      // First data row after columns — extract the movie path
      if (inLoop && (movieColIdx >= 0 || microColIdx >= 0) && !line.startsWith('_')) {
        const values = line.split(/\s+/);
        const colIdx = movieColIdx >= 0 ? movieColIdx : microColIdx;
        if (colIdx < values.length) {
          return values[colIdx];
        }
      }
    }

    return null;
  } catch (error) {
    logger.error(`[STAR Parser] Error reading first movie path: ${error.message}`);
    return null;
  }
};

module.exports = {
  parseStarFile,
  parseOpticsTable,
  writeStarFile,
  getFirstMoviePathSync
};
