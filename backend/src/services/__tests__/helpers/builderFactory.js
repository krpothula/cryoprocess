const fs = require('fs');

const MOCK_PROJECT = {
  _id: 'proj_test_001',
  project_name: 'TestProject',
  folder_name: 'TestProject',
};

const MOCK_USER = {
  _id: 'user_test_001',
  username: 'testuser',
};

const MOCK_PROJECT_PATH = '/tmp/test-projects/TestProject';
const MOCK_OUTPUT_DIR = MOCK_PROJECT_PATH + '/Class2D/Job001';
const MOCK_JOB_NAME = 'Job001';

/**
 * Create a builder instance with mocked filesystem.
 * Stubs fs.existsSync (returns true) and fs.mkdirSync (no-op).
 */
function createBuilder(BuilderClass, data = {}, options = {}) {
  const project = options.project || MOCK_PROJECT;
  const user = options.user || MOCK_USER;

  // Stub filesystem calls so validation and getOutputDir don't fail
  jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  jest.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);

  return new BuilderClass(data, project, user);
}

/**
 * Create a builder and immediately call buildCommand(),
 * returning the command array.
 */
function buildCommand(BuilderClass, data = {}, options = {}) {
  const outputDir = options.outputDir || MOCK_OUTPUT_DIR;
  const jobName = options.jobName || MOCK_JOB_NAME;
  const builder = createBuilder(BuilderClass, data, options);
  return builder.buildCommand(outputDir, jobName);
}

module.exports = {
  createBuilder,
  buildCommand,
  MOCK_PROJECT,
  MOCK_USER,
  MOCK_PROJECT_PATH,
  MOCK_OUTPUT_DIR,
  MOCK_JOB_NAME,
};
