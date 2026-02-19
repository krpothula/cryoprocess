jest.mock('../../utils/logger');

const AutoRefineBuilder = require('../autoRefineBuilder');
const { buildCommand, createBuilder } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag, expectBinary } = require('./helpers/commandAssertions');

const BASE_DATA = {
  inputStarFile: 'Extract/Job003/particles.star',
  referenceMap: 'InitialModel/Job005/initial_model.mrc',
  submitToQueue: 'Yes',
};

afterEach(() => jest.restoreAllMocks());

// ─── MPI minimum 3 ──────────────────────────────────────────────────

describe('AutoRefineBuilder — MPI constraints', () => {
  it('forces MPI from 2 to 3 for split_random_halves', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, mpiProcs: 2 });
    expect(cmd[0]).toBe('relion_refine_mpi');
    expectFlag(cmd, '--split_random_halves');
  });

  it('keeps MPI=1 as single process (no _mpi)', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, mpiProcs: 1 });
    expect(cmd[0]).toBe('relion_refine');
  });

  it('keeps MPI=4 unchanged', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, mpiProcs: 4 });
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

  it('includes flatten_solvent, norm, scale', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectFlag(cmd, '--flatten_solvent');
    expectFlag(cmd, '--norm');
    expectFlag(cmd, '--scale');
  });
});

// ─── GPU ─────────────────────────────────────────────────────────────

describe('AutoRefineBuilder — GPU', () => {
  it('adds --gpu flag when acceleration enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      gpuAcceleration: 'Yes',
      gpuToUse: '0',
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
      rise: 4.75,
    });
    expectFlag(cmd, '--helix');
    expectFlag(cmd, '--helical_outer_diameter', '200');
    expectFlag(cmd, '--helical_twist_initial', '36');
    expectFlag(cmd, '--helical_rise_initial', '4.75');
  });

  it('adds tilt and psi sigma for helical', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      helicalReconstruction: 'Yes',
      angularTilt: 15,
      angularPsi: 10,
    });
    expectFlag(cmd, '--sigma_tilt', '15');
    // psi is divided by 3.0
    expectFlag(cmd, '--sigma_psi', String(10 / 3.0));
  });

  it('adds --helical_keep_tilt_prior_fixed by default', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      helicalReconstruction: 'Yes',
    });
    expectFlag(cmd, '--helical_keep_tilt_prior_fixed');
  });

  it('adds helical symmetry search when enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      helicalReconstruction: 'Yes',
      helicalSymmetry: 'Yes',
      localSearches: 'Yes',
      twistSearch1: 30,
      twistSearch2: 40,
      riseSearchMin: 4,
      riseSearchMax: 6,
    });
    expectFlag(cmd, '--helical_symmetry_search');
    expectFlag(cmd, '--helical_twist_min', '30');
    expectFlag(cmd, '--helical_twist_max', '40');
    expectFlag(cmd, '--helical_rise_min', '4');
    expectFlag(cmd, '--helical_rise_max', '6');
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

  it('adds --solvent_correct_fsc when mask AND useSolventFlattenedFscs enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      referenceMask: 'MaskCreate/Job010/mask.mrc',
      useSolventFlattenedFscs: 'Yes',
    });
    expectFlag(cmd, '--solvent_correct_fsc');
  });
});

// ─── Blush regularisation ────────────────────────────────────────────

describe('AutoRefineBuilder — blush regularisation', () => {
  it('adds --blush when enabled WITH GPU', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      useBlushRegularisation: 'Yes',
      gpuAcceleration: 'Yes',
      gpuToUse: '0',
    });
    expectFlag(cmd, '--blush');
  });

  it('omits --blush when enabled WITHOUT GPU', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      ...BASE_DATA,
      useBlushRegularisation: 'Yes',
    });
    expectNoFlag(cmd, '--blush');
  });

  it('omits --blush by default', () => {
    const cmd = buildCommand(AutoRefineBuilder, BASE_DATA);
    expectNoFlag(cmd, '--blush');
  });
});

// ─── Continue mode ──────────────────────────────────────────────────

describe('AutoRefineBuilder — continue mode', () => {
  it('uses --continue when continueFrom provided', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      continueFrom: 'Refine3D/Job010/run_it025_optimiser.star',
      submitToQueue: 'Yes',
    });
    expectFlag(cmd, '--continue', 'Refine3D/Job010/run_it025_optimiser.star');
    expectNoFlag(cmd, '--i');
    expectNoFlag(cmd, '--auto_refine');
  });

  it('includes GPU in continue mode', () => {
    const cmd = buildCommand(AutoRefineBuilder, {
      continueFrom: 'Refine3D/Job010/run_it025_optimiser.star',
      gpuAcceleration: 'Yes',
      gpuToUse: '0',
      submitToQueue: 'Yes',
    });
    expectFlag(cmd, '--gpu', '0');
  });
});

// ─── I/O options ────────────────────────────────────────────────────

describe('AutoRefineBuilder — I/O options', () => {
  it('adds --preread_images when enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, preReadAllParticles: 'Yes' });
    expectFlag(cmd, '--preread_images');
  });

  it('adds --scratch_dir when set', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, copyParticlesToScratch: '/scratch/user' });
    expectFlag(cmd, '--scratch_dir', '/scratch/user');
  });

  it('adds --no_parallel_disc_io when disabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, useParallelIO: 'No' });
    expectFlag(cmd, '--no_parallel_disc_io');
  });

  it('adds --skip_gridding when skipPadding enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, skipPadding: 'Yes' });
    expectFlag(cmd, '--skip_gridding');
  });
});

// ─── Finer angular sampling ─────────────────────────────────────────

describe('AutoRefineBuilder — angular options', () => {
  it('adds --auto_ignore_angles and --auto_resol_angles when finer sampling enabled', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, finerAngularSampling: 'Yes' });
    expectFlag(cmd, '--auto_ignore_angles');
    expectFlag(cmd, '--auto_resol_angles');
  });

  it('adds --relax_sym when specified', () => {
    const cmd = buildCommand(AutoRefineBuilder, { ...BASE_DATA, relaxSymmetry: 'C2' });
    expectFlag(cmd, '--relax_sym', 'C2');
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('AutoRefineBuilder — validation', () => {
  it('fails when no input star file', () => {
    const builder = createBuilder(AutoRefineBuilder, { referenceMap: 'ref.mrc' });
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

  it('passes in continue mode without input/reference', () => {
    const builder = createBuilder(AutoRefineBuilder, {
      continueFrom: 'Refine3D/Job010/run_it025_optimiser.star',
    });
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
