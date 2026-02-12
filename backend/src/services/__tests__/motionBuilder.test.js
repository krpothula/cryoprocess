jest.mock('../../utils/logger');

const MotionCorrectionBuilder = require('../motionBuilder');
const { buildCommand, createBuilder } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag } = require('./helpers/commandAssertions');

const BASE_DATA = {
  inputMovies: 'Import/Job001/movies.star',
  submitToQueue: 'Yes',
};

afterEach(() => jest.restoreAllMocks());

// ─── RELION own vs MotionCor2 ────────────────────────────────────────

describe('MotionCorrectionBuilder — implementation branching', () => {
  it('adds --use_own for RELION implementation (default)', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectFlag(cmd, '--use_own');
    expectNoFlag(cmd, '--use_motioncor2');
  });

  it('adds --use_own when explicitly set', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      useRelionImplementation: 'Yes',
    });
    expectFlag(cmd, '--use_own');
    expectNoFlag(cmd, '--use_motioncor2');
  });

  it('adds --use_motioncor2 when RELION implementation disabled', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      useRelionImplementation: 'No',
      motioncor2Executable: '/usr/local/bin/motioncor2',
    });
    expectFlag(cmd, '--use_motioncor2');
    expectFlag(cmd, '--motioncor2_exe', '/usr/local/bin/motioncor2');
    expectNoFlag(cmd, '--use_own');
  });

  it('adds --gpu when using MotionCor2', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      useRelionImplementation: 'No',
      motioncor2Executable: '/usr/local/bin/motioncor2',
      useGPU: '0,1',
    });
    expectFlag(cmd, '--gpu', '0,1');
  });
});

// ─── Gain reference ──────────────────────────────────────────────────

describe('MotionCorrectionBuilder — gain reference', () => {
  it('adds --gainref when provided', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
    });
    expectFlag(cmd, '--gainref', '/data/gain.mrc');
  });

  it('omits --gainref when not provided', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectNoFlag(cmd, '--gainref');
  });
});

// ─── Gain rotation ───────────────────────────────────────────────────

describe('MotionCorrectionBuilder — gain rotation mapping', () => {
  it('maps "No rotation (0)" → no --gain_rot flag', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainRotation: 'No rotation (0)',
    });
    expectNoFlag(cmd, '--gain_rot');
  });

  it('maps "90 degrees (1)" → --gain_rot 1', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainRotation: '90 degrees (1)',
    });
    expectFlag(cmd, '--gain_rot', '1');
  });

  it('maps "180 degrees (2)" → --gain_rot 2', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainRotation: '180 degrees (2)',
    });
    expectFlag(cmd, '--gain_rot', '2');
  });

  it('maps "270 degrees (3)" → --gain_rot 3', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainRotation: '270 degrees (3)',
    });
    expectFlag(cmd, '--gain_rot', '3');
  });
});

// ─── Gain flip ───────────────────────────────────────────────────────

describe('MotionCorrectionBuilder — gain flip mapping', () => {
  it('maps "No flipping (0)" → no --gain_flip flag', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainFlip: 'No flipping (0)',
    });
    expectNoFlag(cmd, '--gain_flip');
  });

  it('maps "Flip upside down (1)" → --gain_flip 1', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainFlip: 'Flip upside down (1)',
    });
    expectFlag(cmd, '--gain_flip', '1');
  });

  it('maps "Flip left to right (2)" → --gain_flip 2', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainFlip: 'Flip left to right (2)',
    });
    expectFlag(cmd, '--gain_flip', '2');
  });
});

// ─── Dose weighting ──────────────────────────────────────────────────

describe('MotionCorrectionBuilder — dose weighting', () => {
  it('adds --dose_weighting when enabled', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      doseWeighting: 'Yes',
    });
    expectFlag(cmd, '--dose_weighting');
  });

  it('omits --dose_weighting by default', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectNoFlag(cmd, '--dose_weighting');
  });

  it('adds --save_noDW when enabled', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      nonDoseWeighted: 'Yes',
    });
    expectFlag(cmd, '--save_noDW');
  });
});

// ─── Standard parameters ─────────────────────────────────────────────

describe('MotionCorrectionBuilder — standard parameters', () => {
  it('uses relion_run_motioncorr binary', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    const hasBinary = cmd.some(
      t => t === 'relion_run_motioncorr' || t === 'relion_run_motioncorr_mpi'
    );
    expect(hasBinary).toBe(true);
  });

  it('includes required fields', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      dosePerFrame: 1.2,
      patchesX: 5,
      patchesY: 5,
      binningFactor: 2,
      bfactor: 200,
    });
    expectFlag(cmd, '--dose_per_frame', '1.2');
    expectFlag(cmd, '--patch_x', '5');
    expectFlag(cmd, '--patch_y', '5');
    expectFlag(cmd, '--bin_factor', '2');
    expectFlag(cmd, '--bfactor', '200');
  });

  it('includes default dose_per_frame', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectFlag(cmd, '--dose_per_frame', '1');
  });

  it('includes EER grouping', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      eerFractionation: 20,
    });
    expectFlag(cmd, '--eer_grouping', '20');
  });

  it('default EER grouping is 32', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectFlag(cmd, '--eer_grouping', '32');
  });

  it('adds thumbnail flags', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectFlag(cmd, '--do_thumbnails', 'true');
  });
});

// ─── MPI ─────────────────────────────────────────────────────────────

describe('MotionCorrectionBuilder — MPI', () => {
  it('uses _mpi for multiple procs', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, { ...BASE_DATA, runningmpi: 4 });
    expect(cmd[0]).toBe('relion_run_motioncorr_mpi');
  });

  it('uses non-mpi for single proc', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, { ...BASE_DATA, runningmpi: 1 });
    expect(cmd[0]).toBe('relion_run_motioncorr');
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('MotionCorrectionBuilder — validation', () => {
  it('fails without input movies', () => {
    const builder = createBuilder(MotionCorrectionBuilder, {});
    const result = builder.validate();
    expect(result.valid).toBe(false);
  });

  it('passes with input movies', () => {
    const builder = createBuilder(MotionCorrectionBuilder, BASE_DATA);
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
