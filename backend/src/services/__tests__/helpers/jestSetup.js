// Set env vars BEFORE any module loads (settings.js calls process.exit if JWT_SECRET missing)
process.env.JWT_SECRET = 'test-secret-key-for-jest';
process.env.ROOT_PATH = '/tmp/test-projects';
process.env.NODE_ENV = 'test';
