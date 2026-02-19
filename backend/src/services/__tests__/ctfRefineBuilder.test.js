jest.mock('../../utils/logger');
jest.mock('fs');

const fs = require('fs');
const CTFRefineBuilder = require('../ctfRefineBuilder');
const { buildCommand, createBuilder } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag } = require('./helpers/commandAssertions');

const BASE_DATA = {
  particlesStar: 'AutoRefine/Job011/_data.star',
  postProcessStar: 'PostProcess/Job014/postprocess.star',
  submitToQueue: 'Yes',
};

beforeEach(() => {
  fs.readFileSync.mockReturnValue('_rlnMaskName some_mask.mrc\n_rlnFourierShellCorrelationCorrected');
  fs.existsSync.mockReturnValue(true);
  fs.mkdirSync.mockReturnValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

// ─── fit_mode permutations (81 combinations: 3^4) ──────────────────

describe('CTFRefineBuilder — fit_mode permutations', () => {
  const modes = ['No', 'Per-micrograph', 'Per-particle'];
  const modeChar = (v) => {
    if (v === 'Per-particle') return 'p';
    if (v === 'Per-micrograph') return 'm';
    return 'f';
  };

  const permutations = [];
  for (const phase of modes) {
    for (const defocus of modes) {
      for (const astig of modes) {
        for (const bfac of modes) {
          const expected = modeChar(phase) + modeChar(defocus) + modeChar(astig) + 'f' + modeChar(bfac);
          permutations.push([phase, defocus, astig, bfac, expected]);
        }
      }
    }
  }

  it.each(permutations)(
    'phase=%s defocus=%s astig=%s bfac=%s → fit_mode=%s',
    (phase, defocus, astig, bfac, expected) => {
      const cmd = buildCommand(CTFRefineBuilder, {
        ...BASE_DATA,
        ctfParameter: 'Yes',
        fitPhaseShift: phase,
        fitDefocus: defocus,
        fitAstigmatism: astig,
        fitBFactor: bfac,
      });
      expectFlag(cmd, '--fit_mode', expected);

      expect(expected).toHaveLength(5);
      expect(expected[3]).toBe('f');
      expect([...expected].every(c => 'fmp'.includes(c))).toBe(true);
    }
  );
});

// ─── CTF parameter on/off ───────────────────────────────────────────

describe('CTFRefineBuilder — ctfParameter toggle', () => {
  it('omits --fit_defocus and --fit_mode when ctfParameter off', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      estimateBeamtilt: 'Yes',
    });
    expectNoFlag(cmd, '--fit_defocus');
    expectNoFlag(cmd, '--fit_mode');
  });

  it('includes --fit_defocus and --fit_mode when ctfParameter on', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      fitDefocus: 'Per-particle',
    });
    expectFlag(cmd, '--fit_defocus');
    expectFlag(cmd, '--fit_mode');
  });
});

// ─── Beam tilt + trefoil ────────────────────────────────────────────

describe('CTFRefineBuilder — beam tilt and trefoil', () => {
  it('omits --fit_beamtilt when disabled', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
    });
    expectNoFlag(cmd, '--fit_beamtilt');
  });

  it('adds --fit_beamtilt when enabled', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      estimateBeamtilt: 'Yes',
    });
    expectFlag(cmd, '--fit_beamtilt');
    expectFlag(cmd, '--kmin_tilt');
  });

  it('adds --odd_aberr_max_n 3 when trefoil enabled with beamtilt', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      estimateBeamtilt: 'Yes',
      estimateTreFoil: 'Yes',
    });
    expectFlag(cmd, '--odd_aberr_max_n', '3');
  });

  it('ignores trefoil when beamtilt disabled', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      estimateBeamtilt: 'No',
      estimateTreFoil: 'Yes',
      ctfParameter: 'Yes',
    });
    expectNoFlag(cmd, '--odd_aberr_max_n');
    expectNoFlag(cmd, '--fit_beamtilt');
  });
});

// ─── 4th order aberrations ──────────────────────────────────────────

describe('CTFRefineBuilder — aberrations', () => {
  it('adds --fit_aberr when enabled', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      aberrations: 'Yes',
    });
    expectFlag(cmd, '--fit_aberr');
  });

  it('omits --fit_aberr when disabled', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
    });
    expectNoFlag(cmd, '--fit_aberr');
  });
});

// ─── Anisotropic magnification ──────────────────────────────────────

describe('CTFRefineBuilder — magnification', () => {
  it('adds --fit_aniso and --kmin_mag when enabled', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      estimateMagnification: 'Yes',
    });
    expectFlag(cmd, '--fit_aniso');
    expectFlag(cmd, '--kmin_mag');
  });

  it('omits --fit_aniso when disabled', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
    });
    expectNoFlag(cmd, '--fit_aniso');
  });
});

// ─── Min resolution propagation ────────────────────────────────────

describe('CTFRefineBuilder — min resolution', () => {
  it.each([20, 30, 50])('propagates minResolutionFits=%d to all kmin flags', (minRes) => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      fitDefocus: 'Per-particle',
      estimateBeamtilt: 'Yes',
      estimateMagnification: 'Yes',
      minResolutionFits: minRes,
    });
    expectFlag(cmd, '--kmin_defocus', String(minRes));
    expectFlag(cmd, '--kmin_tilt', String(minRes));
    expectFlag(cmd, '--kmin_mag', String(minRes));
  });

  it('uses default min resolution of 30', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      fitDefocus: 'Per-particle',
    });
    expectFlag(cmd, '--kmin_defocus', '30');
  });
});

// ─── MPI ────────────────────────────────────────────────────────────

describe('CTFRefineBuilder — MPI', () => {
  it('uses relion_ctf_refine (no _mpi) for single process', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      mpiProcs: 1,
    });
    expect(cmd[0]).toBe('relion_ctf_refine');
  });

  it('uses relion_ctf_refine_mpi for multi-process', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      mpiProcs: 4,
    });
    expect(cmd[0]).toBe('relion_ctf_refine_mpi');
  });
});

// ─── GPU (always disabled) ──────────────────────────────────────────

describe('CTFRefineBuilder — GPU', () => {
  it('never includes --gpu (CPU only)', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      gpuAcceleration: 'Yes',
      gpuToUse: '0',
    });
    expectNoFlag(cmd, '--gpu');
  });

  it('supportsGpu returns false', () => {
    const builder = createBuilder(CTFRefineBuilder, BASE_DATA);
    expect(builder.supportsGpu).toBe(false);
  });
});

// ─── Standard flags ─────────────────────────────────────────────────

describe('CTFRefineBuilder — standard flags', () => {
  it('includes input/output/postprocess paths', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
    });
    expectFlag(cmd, '--i');
    expectFlag(cmd, '--o');
    expectFlag(cmd, '--f');
    expectFlag(cmd, '--pipeline_control');
  });

  it('includes threads', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      numberOfThreads: 6,
    });
    expectFlag(cmd, '--j', '6');
  });
});

// ─── All flags combined ─────────────────────────────────────────────

describe('CTFRefineBuilder — all flags enabled', () => {
  it('includes all refinement flags in a single command', () => {
    const cmd = buildCommand(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
      fitDefocus: 'Per-particle',
      fitAstigmatism: 'Per-micrograph',
      fitBFactor: 'Per-particle',
      fitPhaseShift: 'No',
      estimateBeamtilt: 'Yes',
      estimateTreFoil: 'Yes',
      aberrations: 'Yes',
      estimateMagnification: 'Yes',
      mpiProcs: 4,
      numberOfThreads: 6,
      minResolutionFits: 25,
    });

    expectFlag(cmd, '--fit_defocus');
    expectFlag(cmd, '--fit_mode', 'fpmfp');
    expectFlag(cmd, '--kmin_defocus', '25');
    expectFlag(cmd, '--fit_beamtilt');
    expectFlag(cmd, '--kmin_tilt', '25');
    expectFlag(cmd, '--odd_aberr_max_n', '3');
    expectFlag(cmd, '--fit_aberr');
    expectFlag(cmd, '--fit_aniso');
    expectFlag(cmd, '--kmin_mag', '25');
    expectFlag(cmd, '--j', '6');
  });
});

// ─── Validation ─────────────────────────────────────────────────────

describe('CTFRefineBuilder — validation', () => {
  it('fails without particles star file', () => {
    const builder = createBuilder(CTFRefineBuilder, {
      postProcessStar: 'PostProcess/Job014/postprocess.star',
      ctfParameter: 'Yes',
    });
    const result = builder.validate();
    expect(result.valid).toBe(false);
  });

  it('fails without postprocess star file', () => {
    const builder = createBuilder(CTFRefineBuilder, {
      particlesStar: 'AutoRefine/Job011/_data.star',
      ctfParameter: 'Yes',
    });
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/post-process/i);
  });

  it('fails when no refinement mode enabled', () => {
    fs.readFileSync.mockReturnValue('_rlnMaskName some_mask.mrc');
    const builder = createBuilder(CTFRefineBuilder, {
      particlesStar: 'AutoRefine/Job011/_data.star',
      postProcessStar: 'PostProcess/Job014/postprocess.star',
    });
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/at least one/i);
  });

  it('fails when postprocess lacks mask', () => {
    fs.readFileSync.mockReturnValue('data_general\n_rlnSomeField value\n');
    const builder = createBuilder(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
    });
    const result = builder.validate();
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/solvent mask/i);
  });

  it('passes with valid inputs and at least one mode enabled', () => {
    fs.readFileSync.mockReturnValue('_rlnMaskName some_mask.mrc');
    const builder = createBuilder(CTFRefineBuilder, {
      ...BASE_DATA,
      ctfParameter: 'Yes',
    });
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
