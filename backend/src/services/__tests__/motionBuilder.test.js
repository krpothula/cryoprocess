jest.mock('../../utils/logger');
jest.mock('../../utils/mrcParser');
jest.mock('../../utils/starParser');

const MotionCorrectionBuilder = require('../motionBuilder');
const { buildCommand, createBuilder } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag } = require('./helpers/commandAssertions');

const BASE_DATA = {
  inputMovies: 'Import/Job001/movies.star',
  submitToQueue: 'Yes',
};

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.MOTIONCOR2_EXE;
});

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
    process.env.MOTIONCOR2_EXE = '/usr/local/bin/motioncor2';
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      useRelionImplementation: 'No',
    });
    expectFlag(cmd, '--use_motioncor2');
    expectFlag(cmd, '--motioncor2_exe', '/usr/local/bin/motioncor2');
    expectNoFlag(cmd, '--use_own');
  });

  it('omits --motioncor2_exe when env var not set', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      useRelionImplementation: 'No',
    });
    expectFlag(cmd, '--use_motioncor2');
    expectNoFlag(cmd, '--motioncor2_exe');
  });

  it('adds --gpu when using MotionCor2', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      useRelionImplementation: 'No',
      gpuToUse: '0,1',
    });
    expectFlag(cmd, '--gpu', '0,1');
  });

  it('omits --gpu when using RELION own', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gpuToUse: '0,1',
    });
    expectNoFlag(cmd, '--gpu');
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

  it('omits --gainref for empty string', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '   ',
    });
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

  it('handles numeric rotation value', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      gainReferenceImage: '/data/gain.mrc',
      gainRotation: 2,
    });
    expectFlag(cmd, '--gain_rot', '2');
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

  it('adds --save_noDW when dose weighting AND nonDoseWeighted both enabled', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      doseWeighting: 'Yes',
      nonDoseWeighted: 'Yes',
    });
    expectFlag(cmd, '--save_noDW');
  });

  it('omits --save_noDW when nonDoseWeighted enabled but doseWeighting off', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      nonDoseWeighted: 'Yes',
    });
    expectNoFlag(cmd, '--save_noDW');
  });

  it('omits --save_noDW when doseWeighting on but nonDoseWeighted off', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      doseWeighting: 'Yes',
    });
    expectNoFlag(cmd, '--save_noDW');
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

  it('includes required fields with custom values', () => {
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

  it('includes default patches (1x1)', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectFlag(cmd, '--patch_x', '1');
    expectFlag(cmd, '--patch_y', '1');
  });

  it('includes EER grouping with custom value', () => {
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
    expectFlag(cmd, '--thumbnail_size', '512');
    expectFlag(cmd, '--thumbnail_count', '-1');
  });
});

// ─── Optional flags ─────────────────────────────────────────────────

describe('MotionCorrectionBuilder — optional flags', () => {
  it('adds --float16 when float16Output enabled', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, { ...BASE_DATA, float16Output: 'Yes' });
    expectFlag(cmd, '--float16');
  });

  it('omits --float16 by default', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectNoFlag(cmd, '--float16');
  });

  it('adds --grouping_for_ps when savePowerSpectra enabled', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      savePowerSpectra: 'Yes',
      sumPowerSpectra: 8,
    });
    expectFlag(cmd, '--grouping_for_ps', '8');
  });

  it('uses default grouping_for_ps of 4', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      savePowerSpectra: 'Yes',
    });
    expectFlag(cmd, '--grouping_for_ps', '4');
  });

  it('adds --defect_file when provided', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      defectFile: '/data/defect.txt',
    });
    expectFlag(cmd, '--defect_file', '/data/defect.txt');
  });
});

// ─── Frame range ────────────────────────────────────────────────────

describe('MotionCorrectionBuilder — frame range', () => {
  it('includes default first frame (1) and last frame (-1)', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, BASE_DATA);
    expectFlag(cmd, '--first_frame_sum', '1');
    expectFlag(cmd, '--last_frame_sum', '-1');
  });

  it('respects custom frame range', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, {
      ...BASE_DATA,
      firstFrame: 2,
      lastFrame: 40,
    });
    expectFlag(cmd, '--first_frame_sum', '2');
    expectFlag(cmd, '--last_frame_sum', '40');
  });
});

// ─── MPI ─────────────────────────────────────────────────────────────

describe('MotionCorrectionBuilder — MPI', () => {
  it('uses _mpi for multiple procs', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, { ...BASE_DATA, mpiProcs: 4 });
    expect(cmd[0]).toBe('relion_run_motioncorr_mpi');
  });

  it('uses non-mpi for single proc', () => {
    const cmd = buildCommand(MotionCorrectionBuilder, { ...BASE_DATA, mpiProcs: 1 });
    expect(cmd[0]).toBe('relion_run_motioncorr');
  });
});

// ─── Validation ──────────────────────────────────────────────────────

describe('MotionCorrectionBuilder — validation', () => {
  it('fails without input movies', () => {
    const builder = createBuilder(MotionCorrectionBuilder, {});
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/input movies/i);
  });

  it('passes with input movies', () => {
    const builder = createBuilder(MotionCorrectionBuilder, BASE_DATA);
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
