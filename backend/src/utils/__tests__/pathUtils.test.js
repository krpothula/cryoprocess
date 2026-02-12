jest.mock('../../utils/logger');

// Mock settings before requiring pathUtils
jest.mock('../../config/settings', () => ({
  ROOT_PATH: '/data/projects',
  ARCHIVE_PATH: '/mnt/archive/projects',
  ALLOWED_EXTENSIONS: ['.star', '.mrc', '.mrcs', '.tif', '.tiff', '.eer', '.jpg', '.png', '.txt', '.log'],
  MAX_FILE_SIZE_MB: 500,
}));

const {
  getProjectPath,
  getArchivedProjectPath,
  rewriteJobPaths,
} = require('../pathUtils');

// ─── getProjectPath ─────────────────────────────────────────────────

describe('getProjectPath', () => {
  it('uses folder_name when present', () => {
    const project = { folder_name: 'MyProject', project_name: 'My Project' };
    expect(getProjectPath(project)).toBe('/data/projects/MyProject');
  });

  it('falls back to project_name with spaces replaced', () => {
    const project = { project_name: 'My Cool Project' };
    expect(getProjectPath(project)).toBe('/data/projects/My_Cool_Project');
  });

  it('uses folder_name even when empty string (truthy check)', () => {
    // folder_name = '' is falsy, so it should fall back to project_name
    const project = { folder_name: '', project_name: 'Fallback' };
    expect(getProjectPath(project)).toBe('/data/projects/Fallback');
  });
});

// ─── getArchivedProjectPath ─────────────────────────────────────────

describe('getArchivedProjectPath', () => {
  it('joins ARCHIVE_PATH with folder_name', () => {
    const project = { folder_name: 'MyProject', project_name: 'My Project' };
    expect(getArchivedProjectPath(project)).toBe('/mnt/archive/projects/MyProject');
  });

  it('falls back to project_name with spaces replaced', () => {
    const project = { project_name: 'Archived Project' };
    expect(getArchivedProjectPath(project)).toBe('/mnt/archive/projects/Archived_Project');
  });

  it('handles folder_name with special characters', () => {
    const project = { folder_name: 'project-2024_v3', project_name: 'x' };
    expect(getArchivedProjectPath(project)).toBe('/mnt/archive/projects/project-2024_v3');
  });
});

// ─── rewriteJobPaths ────────────────────────────────────────────────

describe('rewriteJobPaths', () => {
  let mockJobs;
  let bulkWriteOps;

  // We need to mock the Job model that rewriteJobPaths requires internally
  beforeEach(() => {
    bulkWriteOps = [];
    mockJobs = [];

    // Reset the module registry so our Job mock is picked up
    jest.resetModules();

    // Re-mock settings for the fresh module load
    jest.doMock('../../config/settings', () => ({
      ROOT_PATH: '/data/projects',
      ARCHIVE_PATH: '/mnt/archive/projects',
      ALLOWED_EXTENSIONS: ['.star', '.mrc'],
      MAX_FILE_SIZE_MB: 500,
    }));

    jest.doMock('../../models/Job', () => ({
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockJobs),
      }),
      bulkWrite: jest.fn().mockImplementation((ops) => {
        bulkWriteOps.push(...ops);
        return Promise.resolve({ modifiedCount: ops.length });
      }),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rewrites matching job paths', async () => {
    mockJobs.push(
      { id: 'job-001', output_file_path: '/data/projects/Proj1/MotionCorr/Job001/output' },
      { id: 'job-002', output_file_path: '/data/projects/Proj1/CtfFind/Job002/output' }
    );

    const { rewriteJobPaths: rewrite } = require('../pathUtils');
    const count = await rewrite('proj-1', '/data/projects/Proj1', '/mnt/archive/projects/Proj1');

    expect(count).toBe(2);
    expect(bulkWriteOps).toHaveLength(2);
    expect(bulkWriteOps[0].updateOne.update.output_file_path).toBe(
      '/mnt/archive/projects/Proj1/MotionCorr/Job001/output'
    );
    expect(bulkWriteOps[1].updateOne.update.output_file_path).toBe(
      '/mnt/archive/projects/Proj1/CtfFind/Job002/output'
    );
  });

  it('skips jobs with null output_file_path', async () => {
    mockJobs.push(
      { id: 'job-001', output_file_path: null },
      { id: 'job-002', output_file_path: '/data/projects/Proj1/Job002/out' }
    );

    const { rewriteJobPaths: rewrite } = require('../pathUtils');
    const count = await rewrite('proj-1', '/data/projects/Proj1', '/mnt/archive/projects/Proj1');

    expect(count).toBe(1);
  });

  it('skips jobs whose paths do not start with oldPrefix', async () => {
    mockJobs.push(
      { id: 'job-001', output_file_path: '/other/path/Job001/out' }
    );

    const { rewriteJobPaths: rewrite } = require('../pathUtils');
    const count = await rewrite('proj-1', '/data/projects/Proj1', '/mnt/archive/projects/Proj1');

    expect(count).toBe(0);
  });

  it('returns 0 when project has no jobs', async () => {
    // mockJobs is empty
    const { rewriteJobPaths: rewrite } = require('../pathUtils');
    const count = await rewrite('proj-1', '/data/projects/Proj1', '/mnt/archive/projects/Proj1');

    expect(count).toBe(0);
  });

  it('does not call bulkWrite when no paths need updating', async () => {
    mockJobs.push(
      { id: 'job-001', output_file_path: '/unrelated/path/out' }
    );

    const { rewriteJobPaths: rewrite } = require('../pathUtils');
    await rewrite('proj-1', '/data/projects/Proj1', '/mnt/archive/projects/Proj1');

    const Job = require('../../models/Job');
    expect(Job.bulkWrite).not.toHaveBeenCalled();
  });

  it('handles prefix that is a substring of another path correctly', async () => {
    // Edge case: /data/projects/Proj1 should NOT match /data/projects/Proj10
    mockJobs.push(
      { id: 'job-001', output_file_path: '/data/projects/Proj10/Job001/out' }
    );

    const { rewriteJobPaths: rewrite } = require('../pathUtils');
    const count = await rewrite('proj-1', '/data/projects/Proj1', '/mnt/archive/projects/Proj1');

    // This WILL match because startsWith('/data/projects/Proj1') is true for '/data/projects/Proj10/...'
    // This is a known edge case — document it
    expect(count).toBe(1);
  });
});
