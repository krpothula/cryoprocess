jest.mock('../../utils/logger');

const AutoRefineBuilder = require('../autoRefineBuilder');
const { buildCommand, createBuilder, MOCK_OUTPUT_DIR, MOCK_JOB_NAME } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag, expectBinary } = require('./helpers/commandAssertions');

const BASE_DATA = {
  inputStarFile: 'Extract/Job003/particles.star',
  reference: 'InitialModel/Job005/initial_model.mrc',
  submitToQueue: 'Yes',
};

afterEach(() => jest.restoreAllMocks());

// ─── MPI minimum 3 ──────────────────────────────────────────────────

describe('AutoRefineBuilder — MPI constraints', () => {
  it('forces MPI from 2 to 3 for split_random_halves', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, runningmpi: 2 });
    // mpiProcs 2 → forced to 3, so command should be _mpi
    expect(cmd[0]).toBe('relion_refine_mpi');
    expectFlag(cmd, '--split_random_halves');
  });

  it('keeps MPI=1 as single process (no _mpi)', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, runningmpi: 1 });
    expect(cmd[0]).toBe('relion_refine');
  });

  it('keeps MPI=4 unchanged', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, runningmpi: 4 });
    expect(cmd[0]).toBe('relion_refine_mpi');
  });
});

// ─── Healpix mapping ─────────────────────────────────────────────────

describe('AutoRefineBuilder — angular sampling to healpix', () => {
  it.each([
    ['30 degrees', '0'],
    ['15 degrees', '1'],
    ['7.5 degrees', '2'],
    ['3.7 degrees', '3'],
    ['1.8 degrees', '4'],
    ['0.9 degrees', '5'],
  ])('maps "%s" to healpix_order %s', (sampling, expected) => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      initialAngularSampling: sampling,
    });
    expectFlag(cmd, '--healpix_order', expected);
  });

  it('defaults to healpix_order 2 (7.5 degrees)', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectFlag(cmd, '--healpix_order', '2');
  });
});

// ─── firstiter_cc ────────────────────────────────────────────────────

describe('AutoRefineBuilder — reference greyscale', () => {
  it('adds --firstiter_cc when reference is NOT absolute greyscale', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectFlag(cmd, '--firstiter_cc');
  });

  it('omits --firstiter_cc when reference IS absolute greyscale', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      referenceMapAbsolute: 'Yes',
    });
    expectNoFlag(cmd, '--firstiter_cc');
  });
});

// ─── Standard flags ──────────────────────────────────────────────────

describe('AutoRefineBuilder — standard flags', () => {
  it('includes auto_refine and split_random_halves', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectFlag(cmd, '--auto_refine');
    expectFlag(cmd, '--split_random_halves');
  });

  it('includes symmetry', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, symmetry: 'D2' });
    expectFlag(cmd, '--sym', 'D2');
  });

  it('defaults symmetry to C1', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectFlag(cmd, '--sym', 'C1');
  });

  it('includes low-pass filter', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, initialLowPassFilter: 40 });
    expectFlag(cmd, '--ini_high', '40');
  });

  it('includes default low-pass filter (60)', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectFlag(cmd, '--ini_high', '60');
  });

  it('includes mask diameter', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, maskDiameter: 150 });
    expectFlag(cmd, '--particle_diameter', '150');
  });

  it('adds --ctf by default (ctfCorrection=true)', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectFlag(cmd, '--ctf');
  });
});

// ─── GPU ─────────────────────────────────────────────────────────────

describe('AutoRefineBuilder — GPU', () => {
  it('adds --gpu flag when acceleration enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      gpuAcceleration: 'Yes',
      useGPU: '0',
    });
    expectFlag(cmd, '--gpu', '0');
  });

  it('omits --gpu when not enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectNoFlag(cmd, '--gpu');
  });
});

// ─── Helical reconstruction ─────────────────────────────────────────

describe('AutoRefineBuilder — helical mode', () => {
  it('adds --helix and related flags', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      helicalReconstruction: 'Yes',
      tubeDiameter2: 200,
      initialTwist: 36,
      initialRise: 4.75,
    });
    expectFlag(cmd, '--helix');
    expectFlag(cmd, '--helical_outer_diameter', '200');
    expectFlag(cmd, '--helical_twist_initial', '36');
    expectFlag(cmd, '--helical_rise_initial', '4.75');
  });

  it('omits helical flags when disabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectNoFlag(cmd, '--helix');
  });
});

// ─── Reference mask ──────────────────────────────────────────────────

describe('AutoRefineBuilder — reference mask', () => {
  it('adds --solvent_mask when provided', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      referenceMask: 'MaskCreate/Job010/mask.mrc',
    });
    expectFlag(cmd, '--solvent_mask', 'MaskCreate/Job010/mask.mrc');
  });

  it('omits --solvent_mask when not provided', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectNoFlag(cmd, '--solvent_mask');
  });
});

// ─── Blush regularisation ────────────────────────────────────────────

describe('AutoRefineBuilder — blush regularisation', () => {
  it('adds --blush when enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      useBlushRegularisation: 'Yes',
    });
    expectFlag(cmd, '--blush');
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('AutoRefineBuilder — validation', () => {
  it('fails when no input star file', () => {
    const builder = createBuilder(AutoRefineBuilder, { reference: 'ref.mrc' });
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/input star file/i);
  });

  it('fails when no reference map', () => {
    const builder = createBuilder(AutoRefineBuilder, { inputStarFile: 'particles.star' });
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reference map/i);
  });

  it('passes with both inputs', () => {
    const builder = createBuilder(AutoRefineBuilder, BASE_DATA);
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
