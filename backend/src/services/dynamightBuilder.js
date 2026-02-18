/**
 * DynaMight Flexibility Job Builder
 *
 * Builds relion_python_dynamight commands for flexibility analysis.
 * DynaMight uses Typer CLI with kebab-case flags and subcommands:
 *   - optimize-deformations (primary training)
 *   - explore-latent-space (visualization)
 *   - optimize-inverse-deformations
 *   - deformable-backprojection
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const settings = require('../config/settings');
const {
  getThreads,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class DynamightBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Dynamight';
  }

  // DynaMight uses a single GPU
  get supportsGpu() {
    return true;
  }

  // DynaMight does not use MPI
  get supportsMpi() {
    return false;
  }

  validate() {
    const checkpointFile = getParam(this.data, ['checkpointFile'], null);

    // If continuing from checkpoint, only checkpoint is required
    if (checkpointFile) {
      logger.info(`[Dynamight] Validation passed | checkpoint: ${checkpointFile}`);
      return { valid: true, error: null };
    }

    // For initial training, input particles are required
    const inputFile = getParam(this.data, ['micrographs'], null);
    if (!inputFile) {
      return { valid: false, error: 'Input particles STAR file is required' };
    }

    logger.info(`[Dynamight] Validation passed | input: ${inputFile}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const executable = getParam(data, ['dynamightExecutable'], null)
      || settings.DYNAMIGHT_EXE || 'relion_python_dynamight';

    const gpuDevice = String(getIntParam(data, ['gpuToUse'], 0));
    const threads = getThreads(data);
    const rawCheckpoint = getParam(data, ['checkpointFile'], null);
    const checkpointFile = rawCheckpoint ? this.makeRelative(this.resolveInputPath(rawCheckpoint)) : null;

    // Determine which subcommand(s) to run
    const doVisualization = getBoolParam(data, ['doVisualization', 'doVisulization'], false);
    const doInverse = getBoolParam(data, ['inverseDeformation'], false);
    const doBackprojection = getBoolParam(data, ['deformedBackProjection'], false);

    // If checkpoint provided with task flags, run those specific tasks
    // Otherwise run primary optimize-deformations training
    const cmd = [];

    if (checkpointFile && (doVisualization || doInverse || doBackprojection)) {
      // Run selected post-training tasks
      let firstCmd = true;

      if (doVisualization) {
        if (!firstCmd) cmd.push('&&');
        this._buildExploreLSCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice);
        firstCmd = false;
      }

      if (doInverse) {
        if (!firstCmd) cmd.push('&&');
        this._buildInverseCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice);
        firstCmd = false;
      }

      if (doBackprojection) {
        if (!firstCmd) cmd.push('&&');
        this._buildBackprojectionCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice);
        firstCmd = false;
      }
    } else {
      // Primary training: optimize-deformations
      this._buildOptimizeCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice, threads);
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Dynamight] Command built | ${cmd.join(' ')}`);
    return cmd;
  }

  _buildOptimizeCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice, threads) {
    const inputFile = getParam(data, ['micrographs'], null);
    const consensusMap = getParam(data, ['consensusMap'], null);

    cmd.push(executable, 'optimize-deformations');
    cmd.push('--refinement-star-file', this.makeRelative(this.resolveInputPath(inputFile)));
    cmd.push('--output-directory', relOutputDir + path.sep);

    if (consensusMap) {
      cmd.push('--initial-model', this.makeRelative(this.resolveInputPath(consensusMap)));
    }

    const numGaussians = getIntParam(data, ['numGaussians'], 10000);
    cmd.push('--n-gaussians', String(numGaussians));

    const threshold = getParam(data, ['initialMapThreshold'], null);
    if (threshold && String(threshold).trim() !== '') {
      cmd.push('--initial-threshold', String(threshold));
    }

    const regFactor = getFloatParam(data, ['regularizationFactor'], 1);
    cmd.push('--regularization-factor', String(regFactor));

    if (checkpointFile) {
      cmd.push('--checkpoint-file', checkpointFile);
    }

    cmd.push('--gpu-id', gpuDevice);
    cmd.push('--n-threads', String(threads));

    if (getBoolParam(data, ['preloadImages'], false)) {
      cmd.push('--preload-images');
    }

    cmd.push('--pipeline-control', relOutputDir + path.sep);
  }

  _buildExploreLSCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice) {
    cmd.push(executable, 'explore-latent-space');
    cmd.push('--output-directory', relOutputDir + path.sep);
    cmd.push('--checkpoint-file', checkpointFile);

    const halfSet = getIntParam(data, ['halfSetToVisualize'], 1);
    cmd.push('--half-set', String(halfSet));

    cmd.push('--gpu-id', gpuDevice);

    if (getBoolParam(data, ['preloadImages'], false)) {
      cmd.push('--preload-images');
    }

    cmd.push('--pipeline-control', relOutputDir + path.sep);
  }

  _buildInverseCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice) {
    cmd.push(executable, 'optimize-inverse-deformations');
    cmd.push('--output-directory', relOutputDir + path.sep);
    cmd.push('--checkpoint-file', checkpointFile);

    const numEpochs = getIntParam(data, ['numEpochs'], 50);
    cmd.push('--n-epochs', String(numEpochs));

    if (getBoolParam(data, ['storeDeformations'], false)) {
      cmd.push('--save-deformations');
    }

    cmd.push('--gpu-id', gpuDevice);

    if (getBoolParam(data, ['preloadImages'], false)) {
      cmd.push('--preload-images');
    }

    cmd.push('--pipeline-control', relOutputDir + path.sep);
  }

  _buildBackprojectionCommand(cmd, executable, data, relOutputDir, checkpointFile, gpuDevice) {
    cmd.push(executable, 'deformable-backprojection');
    cmd.push('--output-directory', relOutputDir + path.sep);
    cmd.push('--checkpoint-file', checkpointFile);

    const batchSize = getIntParam(data, ['backprojBatchsize'], 1);
    cmd.push('--backprojection-batch-size', String(batchSize));

    cmd.push('--gpu-id', gpuDevice);

    if (getBoolParam(data, ['preloadImages'], false)) {
      cmd.push('--preload-images');
    }

    cmd.push('--pipeline-control', relOutputDir + path.sep);
  }
}

module.exports = DynamightBuilder;
