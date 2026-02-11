/**
 * RELION Log Parser
 *
 * Parses run.out and run.err files from RELION jobs to extract
 * structured error/warning information for display in the UI.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Error patterns to scan for (ordered by severity)
const ERROR_PATTERNS = [
  { pattern: /Segmentation fault/i,       category: 'Segmentation Fault', severity: 'error' },
  { pattern: /std::bad_alloc/i,           category: 'Out of Memory (C++)', severity: 'error' },
  { pattern: /Out of memory/i,            category: 'Out of Memory', severity: 'error' },
  { pattern: /SIGKILL/i,                  category: 'Process Killed (SIGKILL)', severity: 'error' },
  { pattern: /SIGSEGV/i,                  category: 'Segmentation Violation', severity: 'error' },
  { pattern: /Bus error/i,               category: 'Bus Error', severity: 'error' },
  { pattern: /MPI_ABORT/i,               category: 'MPI Abort', severity: 'error' },
  { pattern: /Aborting/i,                category: 'RELION Abort', severity: 'error' },
  { pattern: /FATAL/i,                   category: 'Fatal Error', severity: 'error' },
  { pattern: /ERROR:\s*option/i,          category: 'Invalid Option', severity: 'error' },
  { pattern: /ERROR\s+reading/i,          category: 'File Read Error', severity: 'error' },
  { pattern: /ERROR/i,                   category: 'Error', severity: 'error' },
  { pattern: /cannot open/i,             category: 'File Not Found', severity: 'error' },
  { pattern: /No such file or directory/i, category: 'File Not Found', severity: 'error' },
  { pattern: /Permission denied/i,        category: 'Permission Denied', severity: 'error' },
  { pattern: /Killed/i,                  category: 'Process Killed', severity: 'error' },
];

const WARNING_PATTERNS = [
  { pattern: /WARNING/i,                 category: 'Warning', severity: 'warning' },
  { pattern: /WARN/i,                    category: 'Warning', severity: 'warning' },
  { pattern: /skipping/i,               category: 'Skipped', severity: 'warning' },
];

/**
 * Safely read the last N lines of a file.
 * Returns empty string if file doesn't exist or can't be read.
 */
function readLastLines(filePath, n = 50) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(-n).join('\n');
  } catch (err) {
    logger.debug(`[RelionLogParser] Could not read ${filePath}: ${err.message}`);
    return '';
  }
}

/**
 * Read file content from a byte offset (for streaming).
 * Returns { content, newOffset, totalSize }.
 */
function readFromOffset(filePath, offset = 0) {
  try {
    if (!fs.existsSync(filePath)) return { content: '', newOffset: 0, totalSize: 0 };
    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    if (offset >= totalSize) return { content: '', newOffset: offset, totalSize };

    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(totalSize - offset);
    fs.readSync(fd, buffer, 0, buffer.length, offset);
    fs.closeSync(fd);

    return {
      content: buffer.toString('utf8'),
      newOffset: totalSize,
      totalSize
    };
  } catch (err) {
    logger.debug(`[RelionLogParser] Could not read from offset ${filePath}: ${err.message}`);
    return { content: '', newOffset: offset, totalSize: 0 };
  }
}

/**
 * Scan a file for error and warning patterns.
 *
 * @param {string} filePath - Path to log file (run.out or run.err)
 * @param {string} source - Label for the source ('stdout' or 'stderr')
 * @param {Object} options - { includeWarnings: true, contextLines: 2 }
 * @returns {{ errors: Array, warnings: Array }}
 */
function scanFileForIssues(filePath, source, options = {}) {
  const { includeWarnings = true, contextLines = 2 } = options;
  const errors = [];
  const warnings = [];

  try {
    if (!fs.existsSync(filePath)) return { errors, warnings };
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Check error patterns
      for (const { pattern, category, severity } of ERROR_PATTERNS) {
        if (pattern.test(line)) {
          // Get context (surrounding lines)
          const contextStart = Math.max(0, i - contextLines);
          const contextEnd = Math.min(lines.length - 1, i + contextLines);
          const context = lines.slice(contextStart, contextEnd + 1).join('\n');

          errors.push({
            severity,
            source,
            category,
            message: line.trim(),
            line: i + 1,
            context
          });
          break; // One match per line
        }
      }

      // Check warning patterns (if no error matched)
      if (includeWarnings && !errors.some(e => e.line === i + 1)) {
        for (const { pattern, category, severity } of WARNING_PATTERNS) {
          if (pattern.test(line)) {
            const contextStart = Math.max(0, i - contextLines);
            const contextEnd = Math.min(lines.length - 1, i + contextLines);
            const context = lines.slice(contextStart, contextEnd + 1).join('\n');

            warnings.push({
              severity,
              source,
              category,
              message: line.trim(),
              line: i + 1,
              context
            });
            break;
          }
        }
      }
    }
  } catch (err) {
    logger.debug(`[RelionLogParser] Error scanning ${filePath}: ${err.message}`);
  }

  return { errors, warnings };
}

/**
 * Parse RELION errors from a job's output directory.
 *
 * @param {string} outputDir - Job output directory (contains run.out, run.err)
 * @param {Object} options - { includeWarnings: true }
 * @returns {{ issues: Array, summary: Object }}
 */
function parseRelionErrors(outputDir, options = {}) {
  const { includeWarnings = true } = options;
  const outPath = path.join(outputDir, 'run.out');
  const errPath = path.join(outputDir, 'run.err');

  const outResult = scanFileForIssues(outPath, 'stdout', { includeWarnings });
  const errResult = scanFileForIssues(errPath, 'stderr', { includeWarnings });

  // Combine and sort by severity (errors first), then by line number
  const allErrors = [...errResult.errors, ...outResult.errors];
  const allWarnings = includeWarnings ? [...errResult.warnings, ...outResult.warnings] : [];
  const issues = [...allErrors, ...allWarnings];

  return {
    issues,
    summary: {
      total: issues.length,
      errors: allErrors.length,
      warnings: allWarnings.length
    }
  };
}

/**
 * Build a human-readable one-line error summary from parsed issues.
 * Suitable for storing in Job.error_message (kept under ~120 chars).
 *
 * @param {Array} issues - Array of issue objects from parseRelionErrors
 * @returns {string} Summary string, e.g. "Segmentation fault in run.err (line 42)"
 */
function buildErrorSummary(issues) {
  if (!issues || issues.length === 0) return '';

  // Only use errors (not warnings) for the summary
  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length === 0) return '';

  // Take the most important errors (first 2)
  const summaryParts = errors.slice(0, 2).map(e => {
    const sourceFile = e.source === 'stderr' ? 'run.err' : 'run.out';
    return `${e.category} in ${sourceFile} (line ${e.line})`;
  });

  let summary = summaryParts.join('; ');

  // Truncate if too long
  if (summary.length > 120) {
    summary = summary.substring(0, 117) + '...';
  }

  return summary;
}

module.exports = {
  readLastLines,
  readFromOffset,
  scanFileForIssues,
  parseRelionErrors,
  buildErrorSummary,
  ERROR_PATTERNS,
  WARNING_PATTERNS
};
