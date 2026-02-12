jest.mock('../../utils/logger');

const Class2DBuilder = require('../class2dBuilder');
const { buildCommand, createBuilder, MOCK_OUTPUT_DIR, MOCK_JOB_NAME } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag, expectBinary } = require('./helpers/commandAssertions');

const BASE_DATA = {
  inputStarFile: 'Extract/Job003/particles.star',
  submitToQueue: 'Yes',
};

afterEach(() => jest.restoreAllMocks());

// ─── VDAM vs EM ──────────────────────────────────────────────────────

describe('Class2DBuilder — VDAM mode (default)', () => {
  it('includes --grad and --grad_ini_subset for VDAM', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, useVDAM: 'Yes' });
    expectFlag(cmd, '--grad');
    expectFlag(cmd, '--grad_ini_subset', '200');
    expectFlag(cmd, '--class_inactivity_threshold', '0.1');
    expectFlag(cmd, '--grad_write_iter', '10');
  });

  it('VDAM is enabled by default (no useVDAM field)', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA });
    expectFlag(cmd, '--grad');
    expectFlag(cmd, '--grad_ini_subset', '200');
  });

  it('respects custom mini-batch size', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, vdamMiniBatches: 100 });
    expectFlag(cmd, '--grad_ini_subset', '100');
  });
});

describe('Class2DBuilder — EM mode', () => {
  it('omits --grad when VDAM disabled', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, useVDAM: 'No' });
    expectNoFlag(cmd, '--grad');
    expectNoFlag(cmd, '--grad_ini_subset');
    expectNoFlag(cmd, '--class_inactivity_threshold');
  });
});

// ─── Continue mode ───────────────────────────────────────────────────

describe('Class2DBuilder — continue from optimiser', () => {
  it('uses --continue instead of --i', () => {
    const cmd = buildCommand(Class2DBuilder, {
      continueFrom: 'Class2D/Job001/run_it025_optimiser.star',
      submitToQueue: 'Yes',
    });
    expectFlag(cmd, '--continue', 'Class2D/Job001/run_it025_optimiser.star');
    expectNoFlag(cmd, '--i');
  });

  it('skips VDAM and CTF flags in continue mode', () => {
    const cmd = buildCommand(Class2DBuilder, {
      continueFrom: 'Class2D/Job001/run_it025_optimiser.star',
      useVDAM: 'Yes',
      submitToQueue: 'Yes',
    });
    expectNoFlag(cmd, '--grad');
    expectNoFlag(cmd, '--ctf');
    expectNoFlag(cmd, '--grad_ini_subset');
  });
});

// ─── MPI ─────────────────────────────────────────────────────────────

describe('Class2DBuilder — MPI', () => {
  it('uses relion_refine (no _mpi) for single process', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, runningmpi: 1 });
    expect(cmd[0]).toBe('relion_refine');
  });

  it('uses relion_refine_mpi for multi-process queue submission', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, runningmpi: 4 });
    expect(cmd[0]).toBe('relion_refine_mpi');
  });
});

// ─── GPU ─────────────────────────────────────────────────────────────

describe('Class2DBuilder — GPU', () => {
  it('adds --gpu flag when acceleration enabled', () => {
    const cmd = buildCommand(Class2DBuilder, {
      ...BASE_DATA,
      gpuAcceleration: 'Yes',
      useGPU: '0,1',
    });
    expectFlag(cmd, '--gpu', '0,1');
  });

  it('omits --gpu when not enabled', () => {
    const cmd = buildCommand(Class2DBuilder, {
      ...BASE_DATA,
      gpuAcceleration: 'No',
    });
    expectNoFlag(cmd, '--gpu');
  });
});

// ─── Default parameters ──────────────────────────────────────────────

describe('Class2DBuilder — defaults', () => {
  it('includes standard RELION flags', () => {
    const cmd = buildCommand(Class2DBuilder, BASE_DATA);
    expectFlag(cmd, '--ctf');
    expectFlag(cmd, '--flatten_solvent');
    expectFlag(cmd, '--zero_mask');
    expectFlag(cmd, '--center_classes');
    expectFlag(cmd, '--norm');
    expectFlag(cmd, '--scale');
    expectFlag(cmd, '--dont_combine_weights_via_disc');
  });

  it('uses default iterations (25)', () => {
    const cmd = buildCommand(Class2DBuilder, BASE_DATA);
    expectFlag(cmd, '--iter', '25');
  });

  it('uses default particle diameter (200)', () => {
    const cmd = buildCommand(Class2DBuilder, BASE_DATA);
    expectFlag(cmd, '--particle_diameter', '200');
  });

  it('uses default K=1', () => {
    const cmd = buildCommand(Class2DBuilder, BASE_DATA);
    expectFlag(cmd, '--K', '1');
  });

  it('sets custom number of classes', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, numberOfClasses: 50 });
    expectFlag(cmd, '--K', '50');
  });

  it('sets custom iterations', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, numberEMIterations: 40 });
    expectFlag(cmd, '--iter', '40');
  });
});

// ─── CTF options ─────────────────────────────────────────────────────

describe('Class2DBuilder — CTF intact first peak', () => {
  it('adds --ctf_intact_first_peak when enabled', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, ignoreCTFs: 'Yes' });
    expectFlag(cmd, '--ctf_intact_first_peak');
  });

  it('omits --ctf_intact_first_peak by default', () => {
    const cmd = buildCommand(Class2DBuilder, BASE_DATA);
    expectNoFlag(cmd, '--ctf_intact_first_peak');
  });
});

// ─── Resolution limit ────────────────────────────────────────────────

describe('Class2DBuilder — strict_highres_exp', () => {
  it('adds --strict_highres_exp when positive', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, limitResolutionEStep: 10 });
    expectFlag(cmd, '--strict_highres_exp', '10');
  });

  it('omits --strict_highres_exp when -1 (disabled)', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, limitResolutionEStep: -1 });
    expectNoFlag(cmd, '--strict_highres_exp');
  });
});

// ─── Helical options ─────────────────────────────────────────────────

describe('Class2DBuilder — helical', () => {
  it('adds helical flags when enabled', () => {
    const cmd = buildCommand(Class2DBuilder, {
      ...BASE_DATA,
      classify2DHelical: 'Yes',
      tubeDiameter: 300,
      helicalRise: 5.5,
      doBimodalAngular: 'Yes',
    });
    expectFlag(cmd, '--helical_outer_diameter', '300');
    expectFlag(cmd, '--helical_rise', '5.5');
    expectFlag(cmd, '--bimodal_psi');
  });

  it('omits helical flags when disabled', () => {
    const cmd = buildCommand(Class2DBuilder, BASE_DATA);
    expectNoFlag(cmd, '--helical_outer_diameter');
    expectNoFlag(cmd, '--bimodal_psi');
  });
});

// ─── Scratch & preread ───────────────────────────────────────────────

describe('Class2DBuilder — I/O options', () => {
  it('adds --preread_images when enabled', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, preReadAllParticles: 'Yes' });
    expectFlag(cmd, '--preread_images');
  });

  it('adds --scratch_dir when set', () => {
    const cmd = buildCommand(Class2DBuilder, { ...BASE_DATA, scratch_dir: '/scratch/user' });
    expectFlag(cmd, '--scratch_dir', '/scratch/user');
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('Class2DBuilder — validation', () => {
  it('fails when no input and no continueFrom', () => {
    const builder = createBuilder(Class2DBuilder, {});
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/input star file/i);
  });

  it('passes with inputStarFile', () => {
    const builder = createBuilder(Class2DBuilder, { inputStarFile: 'Extract/Job003/particles.star' });
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });

  it('passes with continueFrom', () => {
    const builder = createBuilder(Class2DBuilder, { continueFrom: 'Class2D/Job001/run_it025_optimiser.star' });
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
