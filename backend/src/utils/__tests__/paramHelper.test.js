jest.mock('../../utils/logger');

const {
  getParam,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getMpiProcs,
  getThreads,
  isGpuEnabled,
  getGpuIds,
  getInputStarFile,
  getContinueFrom,
  getMaskDiameter,
  getNumberOfClasses,
  getIterations,
  getPooledParticles,
  getAngpix,
  getReference,
  getSymmetry,
  getScratchDir,
} = require('../paramHelper');

// ─── getParam ────────────────────────────────────────────────────────

describe('getParam', () => {
  it('returns first matching field', () => {
    expect(getParam({ a: 'x', b: 'y' }, ['a', 'b'])).toBe('x');
  });

  it('skips undefined, null, and empty-string fields', () => {
    expect(getParam({ a: undefined, b: null, c: '', d: 'ok' }, ['a', 'b', 'c', 'd'])).toBe('ok');
  });

  it('returns default when nothing matches', () => {
    expect(getParam({}, ['missing'], 'fallback')).toBe('fallback');
  });

  it('returns 0 as a valid value (not falsy-skipped)', () => {
    expect(getParam({ a: 0 }, ['a'], 99)).toBe(0);
  });

  it('returns false as a valid value', () => {
    expect(getParam({ a: false }, ['a'], true)).toBe(false);
  });
});

// ─── getIntParam ─────────────────────────────────────────────────────

describe('getIntParam', () => {
  it('parses string integers', () => {
    expect(getIntParam({ n: '42' }, ['n'])).toBe(42);
  });

  it('returns default for NaN', () => {
    expect(getIntParam({ n: 'abc' }, ['n'], 7)).toBe(7);
  });

  it('truncates floats', () => {
    expect(getIntParam({ n: 3.9 }, ['n'])).toBe(3);
  });

  it('returns default when field missing', () => {
    expect(getIntParam({}, ['n'], 10)).toBe(10);
  });
});

// ─── getFloatParam ───────────────────────────────────────────────────

describe('getFloatParam', () => {
  it('parses float strings', () => {
    expect(getFloatParam({ v: '1.23' }, ['v'])).toBeCloseTo(1.23);
  });

  it('returns default for NaN', () => {
    expect(getFloatParam({ v: 'nope' }, ['v'], 5.5)).toBeCloseTo(5.5);
  });
});

// ─── getBoolParam ────────────────────────────────────────────────────

describe('getBoolParam', () => {
  it.each([
    ['Yes', true],
    ['yes', true],
    ['No', false],
    ['no', false],
    ['true', true],
    ['false', false],
  ])('handles string "%s" → %s', (input, expected) => {
    expect(getBoolParam({ x: input }, ['x'])).toBe(expected);
  });

  it('handles native booleans', () => {
    expect(getBoolParam({ x: true }, ['x'])).toBe(true);
    expect(getBoolParam({ x: false }, ['x'])).toBe(false);
  });

  it('returns default when field missing', () => {
    expect(getBoolParam({}, ['x'], true)).toBe(true);
    expect(getBoolParam({}, ['x'], false)).toBe(false);
  });

  it('coerces truthy numbers', () => {
    expect(getBoolParam({ x: 1 }, ['x'])).toBe(true);
    expect(getBoolParam({ x: 0 }, ['x'])).toBe(false);
  });
});

// ─── getMpiProcs ─────────────────────────────────────────────────────

describe('getMpiProcs', () => {
  it('reads mpiProcs first', () => {
    expect(getMpiProcs({ mpiProcs: 4, numberOfMpiProcs: 8 })).toBe(4);
  });

  it('falls back to numberOfMpiProcs', () => {
    expect(getMpiProcs({ numberOfMpiProcs: 3 })).toBe(3);
  });

  it('enforces minimum of 1', () => {
    expect(getMpiProcs({ mpiProcs: 0 })).toBe(1);
    expect(getMpiProcs({ mpiProcs: -5 })).toBe(1);
  });

  it('returns 1 (default) when all fields missing', () => {
    expect(getMpiProcs({})).toBe(1);
  });
});

// ─── getThreads ──────────────────────────────────────────────────────

describe('getThreads', () => {
  it('reads numberOfThreads first', () => {
    expect(getThreads({ numberOfThreads: 8, threads: 4 })).toBe(8);
  });

  it('enforces minimum of 1', () => {
    expect(getThreads({ numberOfThreads: 0 })).toBe(1);
  });
});

// ─── isGpuEnabled ────────────────────────────────────────────────────

describe('isGpuEnabled', () => {
  it('returns true for gpuAcceleration=Yes', () => {
    expect(isGpuEnabled({ gpuAcceleration: 'Yes' })).toBe(true);
  });

  it('returns false for gpuAcceleration=No', () => {
    expect(isGpuEnabled({ gpuAcceleration: 'No' })).toBe(false);
  });

  it('detects GPU from gpuToUse device IDs', () => {
    expect(isGpuEnabled({ gpuToUse: '0' })).toBe(true);
    expect(isGpuEnabled({ gpuToUse: '0,1,2' })).toBe(true);
  });

  it('returns false for empty data', () => {
    expect(isGpuEnabled({})).toBe(false);
  });

  it('handles boolean gpuAcceleration', () => {
    expect(isGpuEnabled({ gpuAcceleration: true })).toBe(true);
    expect(isGpuEnabled({ gpuAcceleration: false })).toBe(false);
  });

  it('falls back to gpuToUse field', () => {
    expect(isGpuEnabled({ gpuToUse: 'Yes' })).toBe(true);
  });
});

// ─── getGpuIds ───────────────────────────────────────────────────────

describe('getGpuIds', () => {
  it('returns GPU IDs from gpuToUse', () => {
    expect(getGpuIds({ gpuToUse: '0,1' })).toBe('0,1');
  });

  it('converts Yes to 0', () => {
    expect(getGpuIds({ gpuToUse: 'Yes' })).toBe('0');
  });

  it('strips whitespace', () => {
    expect(getGpuIds({ gpuToUse: ' 0, 1 ' })).toBe('0,1');
  });

  it('defaults to 0', () => {
    expect(getGpuIds({})).toBe('0');
  });
});

// ─── Domain-specific extractors ──────────────────────────────────────

describe('getInputStarFile', () => {
  it('reads inputStarFile', () => {
    expect(getInputStarFile({ inputStarFile: 'Extract/Job003/particles.star' })).toBe('Extract/Job003/particles.star');
  });

  it('reads inputStarFile with alternate data', () => {
    expect(getInputStarFile({ inputStarFile: 'path.star' })).toBe('path.star');
  });

  it('returns null when missing', () => {
    expect(getInputStarFile({})).toBeNull();
  });
});

describe('getContinueFrom', () => {
  it('reads continueFrom', () => {
    expect(getContinueFrom({ continueFrom: 'Class2D/Job001/run_it025_optimiser.star' }))
      .toBe('Class2D/Job001/run_it025_optimiser.star');
  });

  it('returns null when missing', () => {
    expect(getContinueFrom({})).toBeNull();
  });
});

describe('getMaskDiameter', () => {
  it('reads maskDiameter', () => {
    expect(getMaskDiameter({ maskDiameter: 150 })).toBe(150);
  });

  it('reads maskDiameter with different value', () => {
    expect(getMaskDiameter({ maskDiameter: 120 })).toBe(120);
  });

  it('uses default', () => {
    expect(getMaskDiameter({}, 200)).toBe(200);
  });
});

describe('getNumberOfClasses', () => {
  it('reads numberOfClasses', () => {
    expect(getNumberOfClasses({ numberOfClasses: 50 })).toBe(50);
  });

  it('reads numberOfClasses with different value', () => {
    expect(getNumberOfClasses({ numberOfClasses: 10 })).toBe(10);
  });
});

describe('getIterations', () => {
  it('reads numberEMIterations', () => {
    expect(getIterations({ numberEMIterations: 30 })).toBe(30);
  });

  it('defaults to 25', () => {
    expect(getIterations({})).toBe(25);
  });
});

describe('getPooledParticles', () => {
  it('returns at least 1', () => {
    expect(getPooledParticles({ pooledParticles: 0 })).toBe(1);
  });

  it('reads the value', () => {
    expect(getPooledParticles({ pooledParticles: 10 })).toBe(10);
  });
});

describe('getAngpix', () => {
  it('reads angpix', () => {
    expect(getAngpix({ angpix: 1.05 })).toBeCloseTo(1.05);
  });

  it('defaults when only angpix is available', () => {
    expect(getAngpix({ angpix: 0.85 })).toBeCloseTo(0.85);
  });
});

describe('getReference', () => {
  it('reads referenceMap', () => {
    expect(getReference({ referenceMap: 'InitialModel/Job005/initial_model.mrc' }))
      .toBe('InitialModel/Job005/initial_model.mrc');
  });

  it('returns null when missing', () => {
    expect(getReference({})).toBeNull();
  });
});

describe('getSymmetry', () => {
  it('defaults to C1', () => {
    expect(getSymmetry({})).toBe('C1');
  });

  it('reads symmetry', () => {
    expect(getSymmetry({ symmetry: 'D2' })).toBe('D2');
  });
});

describe('getScratchDir', () => {
  it('reads copyParticlesToScratch', () => {
    expect(getScratchDir({ copyParticlesToScratch: '/scratch/user' })).toBe('/scratch/user');
  });

  it('returns null when missing', () => {
    expect(getScratchDir({})).toBeNull();
  });
});
