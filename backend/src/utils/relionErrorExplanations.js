/**
 * RELION Error Explanations
 *
 * Maps error categories from relionLogParser to human-friendly explanations
 * and fix suggestions for display in the UI.
 */

const ERROR_EXPLANATIONS = {
  'Segmentation Fault': {
    explanation: 'RELION crashed due to a memory access violation. This usually means the program ran out of memory or encountered corrupted data.',
    suggestion: 'Reduce the number of MPI processes, decrease batch size, or use fewer threads. If using GPU, try reducing the particle box size.',
  },
  'Out of Memory (C++)': {
    explanation: 'The system ran out of available RAM during processing.',
    suggestion: 'Reduce MPI processes (each process loads data into memory), use a node with more RAM, or downsample your particles.',
  },
  'Out of Memory': {
    explanation: 'The system ran out of memory (RAM or GPU VRAM).',
    suggestion: 'Reduce MPI processes, decrease box size, or request a node with more memory. For GPU jobs, reduce batch size or use fewer GPUs per node.',
  },
  'Process Killed (SIGKILL)': {
    explanation: 'The process was forcefully killed, usually by the Linux OOM killer or SLURM (job exceeded time or memory limit).',
    suggestion: 'Request more memory (--mem) or more time (--time) in SLURM. Check if the cluster has memory limits per partition.',
  },
  'Segmentation Violation': {
    explanation: 'A memory access violation occurred (SIGSEGV). The program tried to access memory it should not.',
    suggestion: 'Reduce memory usage by lowering MPI/threads, or check for corrupted input files.',
  },
  'Bus Error': {
    explanation: 'A hardware-level memory access error. Often caused by corrupted shared memory or filesystem issues.',
    suggestion: 'This may indicate corrupted input data or a filesystem issue. Try re-extracting particles or running on a different node.',
  },
  'MPI Abort': {
    explanation: 'An MPI process crashed and caused all processes to abort. Often caused by one process running out of memory or encountering a file error.',
    suggestion: 'Check if input files are accessible from all nodes. Reduce MPI processes or increase available memory.',
  },
  'RELION Abort': {
    explanation: 'RELION detected an internal error and stopped intentionally.',
    suggestion: 'Read the error message carefully — it usually describes exactly what went wrong (wrong parameters, missing files, etc.).',
  },
  'Fatal Error': {
    explanation: 'RELION encountered a fatal error and cannot continue.',
    suggestion: 'Check disk space, file integrity, and that input parameters match the data.',
  },
  'Invalid Option': {
    explanation: 'An unrecognized command-line option was passed to RELION.',
    suggestion: 'Check "Additional arguments" for typos. Ensure you are using flags compatible with your RELION version.',
  },
  'File Read Error': {
    explanation: 'RELION could not read an input file. The file may be corrupted, have wrong permissions, or be in an unexpected format.',
    suggestion: 'Verify the input file exists and is readable. Check that STAR files are not truncated. Re-run the upstream job if needed.',
  },
  'File Not Found': {
    explanation: 'A required file was not found at the expected path.',
    suggestion: 'Check that the input files from the previous job still exist. The project directory may have been moved or the upstream job output was deleted.',
  },
  'Permission Denied': {
    explanation: 'RELION does not have permission to read or write a file.',
    suggestion: 'Check file permissions in the project directory. Ensure the RELION process user can read input files and write to the output directory.',
  },
  'Process Killed': {
    explanation: 'The process was killed, likely by SLURM or the OS. Common causes: exceeded memory limit, exceeded time limit, or node failure.',
    suggestion: 'Increase the SLURM job time limit (--time) or memory (--mem). Check SLURM job accounting with "sacct" for the specific reason.',
  },
  'Error': {
    explanation: 'RELION reported an error during processing.',
    suggestion: 'Read the full error message and log context for specifics. Common issues: wrong input file format, incompatible parameters, or insufficient disk space.',
  },
  'Warning': {
    explanation: 'RELION issued a warning. The job may still succeed, but results might be suboptimal.',
    suggestion: 'Review the warning message. Common warnings: too few particles per class, resolution not improving, or large angular changes between iterations.',
  },
  'Skipped': {
    explanation: 'Some processing steps were skipped.',
    suggestion: 'Check if input data was missing or if certain conditions were not met for this step.',
  },
};

/**
 * Enrich a parsed issue with human-readable explanation and suggestion.
 * @param {Object} issue - Issue from relionLogParser { category, message, severity, ... }
 * @returns {Object} - Enhanced issue with explanation and suggestion fields
 */
function enrichIssue(issue) {
  const entry = ERROR_EXPLANATIONS[issue.category];
  if (entry) {
    return { ...issue, ...entry };
  }

  // Fallback: pattern-match on the message text for common RELION patterns
  const msg = (issue.message || '').toLowerCase();

  if (msg.includes('disk') || msg.includes('space') || msg.includes('no space left')) {
    return {
      ...issue,
      explanation: 'The filesystem ran out of disk space during processing.',
      suggestion: 'Free up disk space on the storage volume. Check with "df -h". Delete old job outputs or move data to a larger volume.',
    };
  }

  if (msg.includes('0 particles') || msg.includes('no particles')) {
    return {
      ...issue,
      explanation: 'No particles were found in the input. The extraction or picking step may have failed.',
      suggestion: 'Check your particle coordinates. Re-run auto-picking with adjusted parameters, or verify that the extraction box size and coordinates match.',
    };
  }

  if (msg.includes('no pixels in background') || msg.includes('mask is too large')) {
    return {
      ...issue,
      explanation: 'The circular mask diameter is too large relative to the box size, leaving no background pixels for normalization.',
      suggestion: 'Reduce the mask diameter. It should be smaller than the box size (in Angstroms). A good rule: mask_diameter < box_size * pixel_size * 0.9.',
    };
  }

  if (msg.includes('nan') || msg.includes('infinity')) {
    return {
      ...issue,
      explanation: 'RELION encountered numerical instability (NaN or Infinity values). This often happens with corrupted data or extreme parameter values.',
      suggestion: 'Check input data quality. Ensure pixel size and voltage are correct. Try with fewer particles or lower resolution limit.',
    };
  }

  if (msg.includes('cuda') || msg.includes('gpu') || msg.includes('cublas')) {
    return {
      ...issue,
      explanation: 'A GPU/CUDA error occurred. This could be a driver issue, insufficient GPU memory, or incompatible GPU hardware.',
      suggestion: 'Try reducing the number of MPI processes per GPU, or use a smaller box size. Check that CUDA drivers are up to date.',
    };
  }

  if (msg.includes('timeout') || msg.includes('time limit')) {
    return {
      ...issue,
      explanation: 'The job exceeded its time limit on the cluster.',
      suggestion: 'Increase the SLURM time limit. For long jobs, consider using fewer iterations or a smaller dataset first.',
    };
  }

  return issue;
}

module.exports = { ERROR_EXPLANATIONS, enrichIssue };
