jest.mock('../../utils/logger');

const MultibodyBuilder = require('../multibodyBuilder');
const { buildCommand, createBuilder } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag, expectBinary } = require('./helpers/commandAssertions');

const BASE_DATA = {
  refinementStarFile: 'Refine3D/Job010/run_it025_optimiser.star',
  bodyStarFile: 'MultiBody/bodies.star',
  submitToQueue: 'Yes',
};

afterEach(() => jest.restoreAllMocks());

// ─── Core multi-body flags ──────────────────────────────────────────

describe('MultibodyBuilder — multi-body specific flags', () => {
  it('uses --continue (not --i) for the refinement input', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--continue');
    expectNoFlag(cmd, '--i');
  });

  it('does NOT include --auto_refine', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectNoFlag(cmd, '--auto_refine');
  });

  it('does NOT include --split_random_halves', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectNoFlag(cmd, '--split_random_halves');
  });

  it('includes --multibody_masks', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--multibody_masks');
  });

  it('includes --reconstruct_subtracted_bodies by default', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--reconstruct_subtracted_bodies');
  });

  it('omits --reconstruct_subtracted_bodies when disabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      reconstructSubtracted: 'No',
    });
    expectNoFlag(cmd, '--reconstruct_subtracted_bodies');
  });

  it('includes --solvent_correct_fsc by default', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--solvent_correct_fsc');
  });

  it('omits --solvent_correct_fsc when disabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      solventCorrectFsc: 'No',
    });
    expectNoFlag(cmd, '--solvent_correct_fsc');
  });
});

// ─── Standard flags ─────────────────────────────────────────────────

describe('MultibodyBuilder — standard refinement flags', () => {
  it('uses relion_refine binary', () => {
    const cmd = buildCommand(MultibodyBuilder, { ...BASE_DATA, mpiProcs: 1 });
    expectBinary(cmd, 'relion_refine');
  });

  it('includes --healpix_order with default 4', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--healpix_order', '4');
  });

  it('includes --offset_range with default 3', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--offset_range', '3');
  });

  it('includes --offset_step with default 1.5', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--offset_step', '1.5');
  });

  it('includes --dont_combine_weights_via_disc', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--dont_combine_weights_via_disc');
  });

  it('includes --pipeline_control', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--pipeline_control');
  });

  it('includes --oversampling 1', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--oversampling', '1');
  });

  it('includes --pad 2', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectFlag(cmd, '--pad', '2');
  });
});

// ─── MPI ────────────────────────────────────────────────────────────

describe('MultibodyBuilder — MPI', () => {
  it('uses relion_refine for single process', () => {
    const cmd = buildCommand(MultibodyBuilder, { ...BASE_DATA, mpiProcs: 1 });
    expect(cmd[0]).toBe('relion_refine');
  });

  it('uses relion_refine_mpi for multi-process', () => {
    const cmd = buildCommand(MultibodyBuilder, { ...BASE_DATA, mpiProcs: 4 });
    expect(cmd[0]).toBe('relion_refine_mpi');
  });
});

// ─── GPU ────────────────────────────────────────────────────────────

describe('MultibodyBuilder — GPU', () => {
  it('adds --gpu when acceleration enabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      gpuAcceleration: 'Yes',
      gpuToUse: '0,1',
    });
    expectFlag(cmd, '--gpu', '0,1');
  });

  it('omits --gpu when not enabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      gpuAcceleration: 'No',
    });
    expectNoFlag(cmd, '--gpu');
  });
});

// ─── Optional flags ─────────────────────────────────────────────────

describe('MultibodyBuilder — optional flags', () => {
  it('adds --blush when blushRegularisation enabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      blushRegularisation: 'Yes',
    });
    expectFlag(cmd, '--blush');
  });

  it('omits --blush by default', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expectNoFlag(cmd, '--blush');
  });

  it('adds --no_parallel_disc_io when disabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      useParallelIO: 'No',
    });
    expectFlag(cmd, '--no_parallel_disc_io');
  });

  it('adds --preread_images when enabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      preReadAllParticles: 'Yes',
    });
    expectFlag(cmd, '--preread_images');
  });

  it('adds --scratch_dir when copyParticle set', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      copyParticle: '/scratch/user',
    });
    expectFlag(cmd, '--scratch_dir', '/scratch/user');
  });

  it('adds --skip_gridding when skipPadding enabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      skipPadding: 'Yes',
    });
    expectFlag(cmd, '--skip_gridding');
  });
});

// ─── Flexibility analysis ───────────────────────────────────────────

describe('MultibodyBuilder — flexibility analysis', () => {
  it('chains relion_flex_analyse when runFlexibility enabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      runFlexibility: 'Yes',
      numberOfEigenvectorMovies: 5,
    });
    expect(cmd).toContain('&&');
    expect(cmd).toContain('relion_flex_analyse');
    expectFlag(cmd, '--PCA_orient');
    expectFlag(cmd, '--do_movies', '5');
  });

  it('includes eigenvalue selection when enabled', () => {
    const cmd = buildCommand(MultibodyBuilder, {
      ...BASE_DATA,
      runFlexibility: 'Yes',
      selectParticlesEigenValue: 'Yes',
      eigenValue: 2,
      minEigenValue: -5,
      maxEigenValue: 5,
    });
    expectFlag(cmd, '--select_eigenvalue', '2');
    expectFlag(cmd, '--select_eigenvalue_min', '-5');
    expectFlag(cmd, '--select_eigenvalue_max', '5');
  });

  it('omits flexibility analysis by default', () => {
    const cmd = buildCommand(MultibodyBuilder, BASE_DATA);
    expect(cmd).not.toContain('relion_flex_analyse');
  });
});

// ─── Validation ─────────────────────────────────────────────────────

describe('MultibodyBuilder — validation', () => {
  it('fails when no refinement star file', () => {
    const builder = createBuilder(MultibodyBuilder, {
      bodyStarFile: 'MultiBody/bodies.star',
    });
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/refinement/i);
  });

  it('fails when no body masks file', () => {
    const builder = createBuilder(MultibodyBuilder, {
      refinementStarFile: 'Refine3D/Job010/run_it025_optimiser.star',
    });
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/mask/i);
  });

  it('passes with both required files', () => {
    const builder = createBuilder(MultibodyBuilder, BASE_DATA);
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
