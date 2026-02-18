/**
 * ModelAngelo Job Builder
 *
 * Builds ModelAngelo commands for automated model building.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const settings = require('../config/settings');
const {
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class ModelAngeloBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'ModelAngelo';
  }

  // ModelAngelo uses GPU for neural network inference
  get supportsGpu() {
    return true;
  }

  // ModelAngelo is NOT an MPI command
  get supportsMpi() {
    return false;
  }

  validate() {
    const inputMap = getParam(this.data, ['bFactorSharpenedMap'], null);
    if (!inputMap) {
      return { valid: false, error: 'B-factor sharpened map is required' };
    }

    // At least one FASTA file should be provided
    const fastaProtein = getParam(this.data, ['fastaProtein'], null);
    const fastaDNA = getParam(this.data, ['fastaDNA'], null);
    const fastaRNA = getParam(this.data, ['fastaRNA'], null);

    if (!fastaProtein && !fastaDNA && !fastaRNA) {
      return { valid: false, error: 'At least one FASTA sequence file (protein, DNA, or RNA) is required' };
    }

    logger.info(`[ModelAngelo] Validation passed | map: ${inputMap}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const executable = getParam(data, ['modelAngeloExecutable'], null) || settings.MODELANGELO_EXE || 'relion_python_modelangelo';
    const inputMap = getParam(data, ['bFactorSharpenedMap'], null);
    const gpuDevice = String(getIntParam(data, ['gpuToUse'], 0));

    // Build the 'build' subcommand
    const cmd = [executable, 'build'];

    // Add FASTA files for different chain types
    const fastaProtein = getParam(data, ['fastaProtein'], null);
    const fastaDNA = getParam(data, ['fastaDNA'], null);
    const fastaRNA = getParam(data, ['fastaRNA'], null);

    if (fastaProtein) {
      cmd.push('-pf', fastaProtein);
    }
    if (fastaDNA) {
      cmd.push('-df', fastaDNA);
    }
    if (fastaRNA) {
      cmd.push('-rf', fastaRNA);
    }

    // Add volume, output, and device
    cmd.push('-v', this.makeRelative(this.resolveInputPath(inputMap)));
    cmd.push('-o', relOutputDir);
    cmd.push('-d', gpuDevice);
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // If HMMER search is enabled, chain the hmm_search command
    if (getBoolParam(data, ['performHmmerSearch'], false)) {
      cmd.push('&&');
      cmd.push(executable);
      cmd.push('hmm_search');
      cmd.push('-i', relOutputDir);

      // Use HMMER sequence library if provided
      const fastaFile = getParam(data, ['hmmerSequenceLibrary'], null) ||
        fastaProtein || fastaDNA || fastaRNA || '';
      cmd.push('-f', fastaFile);
      cmd.push('-o', relOutputDir);

      // Alphabet type
      const alphabet = getParam(data, ['hmmerAlphabet'], 'amino');
      cmd.push('-a', alphabet);

      // HMMER search parameters
      cmd.push('--F1', String(getFloatParam(data, ['hmmerF1'], 0.02)));
      cmd.push('--F2', String(getFloatParam(data, ['hmmerF2'], 0.001)));
      cmd.push('--F3', String(getFloatParam(data, ['hmmerF3'], 1e-05)));
      cmd.push('--E', String(getFloatParam(data, ['hmmerE'], 10)));
      cmd.push('--pipeline_control', relOutputDir + path.sep);
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[ModelAngelo] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = ModelAngeloBuilder;
