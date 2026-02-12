module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/src/services/__tests__/helpers/jestSetup.js'],
  collectCoverageFrom: [
    'src/services/*Builder.js',
    'src/utils/paramHelper.js',
    'src/utils/pathUtils.js',
    'src/controllers/archiveController.js',
  ],
};
