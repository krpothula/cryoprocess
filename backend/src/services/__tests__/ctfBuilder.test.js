jest.mock('../../utils/logger');

const CTFBuilder = require('../ctfBuilder');
const { buildCommand, createBuilder } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag } = require('./helpers/commandAssertions');

const BASE_DATA = {
  inputStarFile: 'MotionCorr/Job002/corrected_micrographs.star',
  submitToQueue: 'Yes',
};

afterEach(() => jest.restoreAllMocks());

// ─── CTFFIND4 vs CTFFIND5 ───────────────────────────────────────────

describe('CTFBuilder — CTFFIND version detection', () => {
  it('adds --is_ctffind4 for standard ctffind path', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      ctfFindExecutable: '/usr/local/bin/ctffind',
    });
    expectFlag(cmd, '--ctffind_exe', '/usr/local/bin/ctffind');
    expectFlag(cmd, '--is_ctffind4');
  });

  it('adds --is_ctffind4 for ctffind4 explicit path', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      ctfFindExecutable: '/usr/local/bin/ctffind4',
    });
    expectFlag(cmd, '--is_ctffind4');
  });

  it('omits --is_ctffind4 for ctffind5 path', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      ctfFindExecutable: '/usr/local/bin/ctffind5',
    });
    expectNoFlag(cmd, '--is_ctffind4');
  });

  it('omits --is_ctffind4 for ctffind-5 path', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      ctfFindExecutable: '/opt/software/ctffind-5.0.2/bin/ctffind-5',
    });
    expectNoFlag(cmd, '--is_ctffind4');
  });

  it('omits --is_ctffind4 for CTFFIND_5 uppercase path', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      ctfFindExecutable: '/usr/local/bin/CTFFIND_5',
    });
    expectNoFlag(cmd, '--is_ctffind4');
  });
});

// ─── Gctf mode ───────────────────────────────────────────────────────

describe('CTFBuilder — Gctf mode', () => {
  it('adds --use_gctf and --gctf_exe', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      useGctf: 'Yes',
      gctfExecutable: '/usr/local/bin/gctf',
    });
    expectFlag(cmd, '--use_gctf');
    expectFlag(cmd, '--gctf_exe', '/usr/local/bin/gctf');
    expectNoFlag(cmd, '--ctffind_exe');
    expectNoFlag(cmd, '--is_ctffind4');
  });

  it('adds --gpu for Gctf', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      useGctf: 'Yes',
      gctfExecutable: '/usr/local/bin/gctf',
      gpuToUse: '0,1',
    });
    expectFlag(cmd, '--gpu', '0,1');
  });
});

// ─── Defocus min/max swap ────────────────────────────────────────────

describe('CTFBuilder — defocus range', () => {
  it('uses provided min and max', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      minDefocus: 3000,
      maxDefocus: 70000,
    });
    expectFlag(cmd, '--dFMin', '3000');
    expectFlag(cmd, '--dFMax', '70000');
  });

  it('swaps inverted defocus range (min > max)', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      minDefocus: 70000,
      maxDefocus: 3000,
    });
    // Should be swapped
    expectFlag(cmd, '--dFMin', '3000');
    expectFlag(cmd, '--dFMax', '70000');
  });

  it('uses default defocus range', () => {
    const cmd = buildCommand(CTFBuilder, BASE_DATA);
    expectFlag(cmd, '--dFMin', '5000');
    expectFlag(cmd, '--dFMax', '50000');
    expectFlag(cmd, '--FStep', '500');
  });
});

// ─── Phase shift ─────────────────────────────────────────────────────

describe('CTFBuilder — phase shift estimation', () => {
  it('adds phase shift flags when enabled', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      estimatePhaseShifts: 'Yes',
      phaseShiftMin: 0,
      phaseShiftMax: 180,
      phaseShiftStep: 10,
    });
    expectFlag(cmd, '--do_phaseshift');
    expectFlag(cmd, '--phase_min', '0');
    expectFlag(cmd, '--phase_max', '180');
    expectFlag(cmd, '--phase_step', '10');
  });

  it('omits phase shift flags when disabled', () => {
    const cmd = buildCommand(CTFBuilder, BASE_DATA);
    expectNoFlag(cmd, '--do_phaseshift');
    expectNoFlag(cmd, '--phase_min');
  });
});

// ─── Standard parameters ─────────────────────────────────────────────

describe('CTFBuilder — standard parameters', () => {
  it('uses relion_run_ctffind binary', () => {
    const cmd = buildCommand(CTFBuilder, BASE_DATA);
    const hasBinary = cmd.some(t => t === 'relion_run_ctffind' || t === 'relion_run_ctffind_mpi');
    expect(hasBinary).toBe(true);
  });

  it('includes box size, resolution range', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      fftBoxSize: 1024,
      minResolution: 50,
      maxResolution: 3,
    });
    expectFlag(cmd, '--Box', '1024');
    expectFlag(cmd, '--ResMin', '50');
    expectFlag(cmd, '--ResMax', '3');
  });

  it('includes default box size (512)', () => {
    const cmd = buildCommand(CTFBuilder, BASE_DATA);
    expectFlag(cmd, '--Box', '512');
  });

  it('adds thumbnail flags', () => {
    const cmd = buildCommand(CTFBuilder, BASE_DATA);
    expectFlag(cmd, '--do_thumbnails', 'true');
    expectFlag(cmd, '--thumbnail_size', '512');
  });
});

// ─── Optional flags ──────────────────────────────────────────────────

describe('CTFBuilder — optional flags', () => {
  it('adds --use_given_ps when enabled', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      usePowerSpectraFromMotionCorr: 'Yes',
    });
    expectFlag(cmd, '--use_given_ps');
  });

  it('adds --use_noDW when enabled', () => {
    const cmd = buildCommand(CTFBuilder, {
      ...BASE_DATA,
      useMicrographWithoutDoseWeighting: 'Yes',
    });
    expectFlag(cmd, '--use_noDW');
  });
});

// ─── MPI ─────────────────────────────────────────────────────────────

describe('CTFBuilder — MPI', () => {
  it('uses _mpi for multiple procs', () => {
    const cmd = buildCommand(CTFBuilder, { ...BASE_DATA, mpiProcs: 4 });
    expect(cmd[0]).toBe('relion_run_ctffind_mpi');
  });

  it('uses non-mpi for single proc', () => {
    const cmd = buildCommand(CTFBuilder, { ...BASE_DATA, mpiProcs: 1 });
    expect(cmd[0]).toBe('relion_run_ctffind');
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('CTFBuilder — validation', () => {
  it('fails without input star file', () => {
    const builder = createBuilder(CTFBuilder, {});
    const result = builder.validate();
    expect(result.valid).toBe(false);
  });

  it('passes with input star file', () => {
    const builder = createBuilder(CTFBuilder, BASE_DATA);
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
