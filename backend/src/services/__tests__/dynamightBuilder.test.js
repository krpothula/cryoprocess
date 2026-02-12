jest.mock('../../utils/logger');

const DynamightBuilder = require('../dynamightBuilder');
const { buildCommand, createBuilder, MOCK_OUTPUT_DIR, MOCK_JOB_NAME } = require('./helpers/builderFactory');
const { expectFlag, expectNoFlag } = require('./helpers/commandAssertions');

const BASE_DATA = {
  micrographs: 'Extract/Job003/particles.star',
  consensusMap: 'Refine3D/Job010/run_class001.mrc',
  submitToQueue: 'Yes',
};

afterEach(() => jest.restoreAllMocks());

// ─── Primary training: optimize-deformations ──────────────────────────

describe('DynamightBuilder — optimize-deformations (default)', () => {
  it('uses relion_python_dynamight binary', () => {
    const cmd = buildCommand(DynamightBuilder, BASE_DATA);
    expect(cmd[0]).toBe('relion_python_dynamight');
  });

  it('uses optimize-deformations subcommand', () => {
    const cmd = buildCommand(DynamightBuilder, BASE_DATA);
    expect(cmd[1]).toBe('optimize-deformations');
  });

  it('maps micrographs to --refinement-star-file', () => {
    const cmd = buildCommand(DynamightBuilder, BASE_DATA);
    expectFlag(cmd, '--refinement-star-file');
  });

  it('maps consensusMap to --initial-model', () => {
    const cmd = buildCommand(DynamightBuilder, BASE_DATA);
    expectFlag(cmd, '--initial-model');
  });

  it('includes --n-gaussians with default 10000', () => {
    const cmd = buildCommand(DynamightBuilder, BASE_DATA);
    expectFlag(cmd, '--n-gaussians', '10000');
  });

  it('respects custom numGaussians', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, numGaussians: 500 });
    expectFlag(cmd, '--n-gaussians', '500');
  });

  it('includes --regularization-factor', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, regularizationFactor: 0.9 });
    expectFlag(cmd, '--regularization-factor', '0.9');
  });

  it('includes --initial-threshold when provided', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, initialMapThreshold: '0.0025' });
    expectFlag(cmd, '--initial-threshold', '0.0025');
  });

  it('omits --initial-threshold when empty', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, initialMapThreshold: '' });
    expectNoFlag(cmd, '--initial-threshold');
  });

  it('includes --gpu-id', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, gpuToUse: 1 });
    expectFlag(cmd, '--gpu-id', '1');
  });

  it('includes --preload-images when enabled', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, preloadImages: 'Yes' });
    expectFlag(cmd, '--preload-images');
  });

  it('omits --preload-images when disabled', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, preloadImages: 'No' });
    expectNoFlag(cmd, '--preload-images');
  });

  it('includes --pipeline-control', () => {
    const cmd = buildCommand(DynamightBuilder, BASE_DATA);
    expectFlag(cmd, '--pipeline-control');
  });

  it('includes --n-threads', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, threads: 8 });
    expectFlag(cmd, '--n-threads', '8');
  });

  it('uses custom executable when provided', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BASE_DATA, dynamightExecutable: '/opt/bin/dynamight' });
    expect(cmd[0]).toBe('/opt/bin/dynamight');
  });

  it('omits --initial-model when consensusMap not provided', () => {
    const cmd = buildCommand(DynamightBuilder, {
      micrographs: 'Extract/Job003/particles.star',
      submitToQueue: 'Yes',
    });
    expectNoFlag(cmd, '--initial-model');
  });
});

// ─── Checkpoint + continue training ─────────────────────────────────

describe('DynamightBuilder — checkpoint without task flags', () => {
  it('runs optimize-deformations with --checkpoint-file', () => {
    const cmd = buildCommand(DynamightBuilder, {
      ...BASE_DATA,
      checkpointFile: 'Dynamight/Job001/forward_deformations/checkpoints/100.pth',
    });
    expect(cmd[1]).toBe('optimize-deformations');
    expectFlag(cmd, '--checkpoint-file', 'Dynamight/Job001/forward_deformations/checkpoints/100.pth');
  });
});

// ─── Visualization: explore-latent-space ────────────────────────────

describe('DynamightBuilder — explore-latent-space', () => {
  const VIS_DATA = {
    submitToQueue: 'Yes',
    checkpointFile: 'Dynamight/Job001/forward_deformations/checkpoints/100.pth',
    doVisulization: 'Yes',
  };

  it('uses explore-latent-space subcommand', () => {
    const cmd = buildCommand(DynamightBuilder, VIS_DATA);
    expect(cmd[1]).toBe('explore-latent-space');
  });

  it('includes --checkpoint-file', () => {
    const cmd = buildCommand(DynamightBuilder, VIS_DATA);
    expectFlag(cmd, '--checkpoint-file');
  });

  it('includes --half-set', () => {
    const cmd = buildCommand(DynamightBuilder, { ...VIS_DATA, halfSetToVisualize: 2 });
    expectFlag(cmd, '--half-set', '2');
  });

  it('includes --gpu-id', () => {
    const cmd = buildCommand(DynamightBuilder, { ...VIS_DATA, gpuToUse: 0 });
    expectFlag(cmd, '--gpu-id', '0');
  });
});

// ─── Inverse deformations ───────────────────────────────────────────

describe('DynamightBuilder — optimize-inverse-deformations', () => {
  const INV_DATA = {
    submitToQueue: 'Yes',
    checkpointFile: 'Dynamight/Job001/forward_deformations/checkpoints/100.pth',
    inverseDeformation: 'Yes',
  };

  it('uses optimize-inverse-deformations subcommand', () => {
    const cmd = buildCommand(DynamightBuilder, INV_DATA);
    expect(cmd[1]).toBe('optimize-inverse-deformations');
  });

  it('includes --n-epochs', () => {
    const cmd = buildCommand(DynamightBuilder, { ...INV_DATA, numEpochs: 75 });
    expectFlag(cmd, '--n-epochs', '75');
  });

  it('includes --save-deformations when enabled', () => {
    const cmd = buildCommand(DynamightBuilder, { ...INV_DATA, storeDeformations: 'Yes' });
    expectFlag(cmd, '--save-deformations');
  });

  it('omits --save-deformations by default', () => {
    const cmd = buildCommand(DynamightBuilder, INV_DATA);
    expectNoFlag(cmd, '--save-deformations');
  });
});

// ─── Deformable backprojection ──────────────────────────────────────

describe('DynamightBuilder — deformable-backprojection', () => {
  const BP_DATA = {
    submitToQueue: 'Yes',
    checkpointFile: 'Dynamight/Job001/forward_deformations/checkpoints/100.pth',
    deformedBackProjection: 'Yes',
  };

  it('uses deformable-backprojection subcommand', () => {
    const cmd = buildCommand(DynamightBuilder, BP_DATA);
    expect(cmd[1]).toBe('deformable-backprojection');
  });

  it('includes --backprojection-batch-size', () => {
    const cmd = buildCommand(DynamightBuilder, { ...BP_DATA, backprojBatchsize: 4 });
    expectFlag(cmd, '--backprojection-batch-size', '4');
  });
});

// ─── Multiple tasks chained ─────────────────────────────────────────

describe('DynamightBuilder — chained tasks', () => {
  it('chains inverse + backprojection with &&', () => {
    const cmd = buildCommand(DynamightBuilder, {
      submitToQueue: 'Yes',
      checkpointFile: 'Dynamight/Job001/forward_deformations/checkpoints/100.pth',
      inverseDeformation: 'Yes',
      deformedBackProjection: 'Yes',
    });
    const andIndex = cmd.indexOf('&&');
    expect(andIndex).toBeGreaterThan(0);
    // First command is inverse, second is backprojection
    expect(cmd[1]).toBe('optimize-inverse-deformations');
    const afterAnd = cmd.slice(andIndex + 1);
    expect(afterAnd[1]).toBe('deformable-backprojection');
  });
});

// ─── supportsMpi / supportsGpu ──────────────────────────────────────

describe('DynamightBuilder — properties', () => {
  it('supportsMpi is false', () => {
    const builder = createBuilder(DynamightBuilder, BASE_DATA);
    expect(builder.supportsMpi).toBe(false);
  });

  it('supportsGpu is true', () => {
    const builder = createBuilder(DynamightBuilder, BASE_DATA);
    expect(builder.supportsGpu).toBe(true);
  });
});

// ─── Validation ─────────────────────────────────────────────────────

describe('DynamightBuilder — validation', () => {
  it('fails when no input and no checkpoint', () => {
    const builder = createBuilder(DynamightBuilder, {});
    const result = builder.validate();
    expect(result.valid).toBe(false);
  });

  it('passes with micrographs input', () => {
    const builder = createBuilder(DynamightBuilder, { micrographs: 'Extract/Job003/particles.star' });
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });

  it('passes with checkpoint file only', () => {
    const builder = createBuilder(DynamightBuilder, {
      checkpointFile: 'Dynamight/Job001/forward_deformations/checkpoints/100.pth',
    });
    const result = builder.validate();
    expect(result.valid).toBe(true);
  });
});
