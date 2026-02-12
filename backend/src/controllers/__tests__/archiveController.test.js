jest.mock('../../utils/logger');

// ─── Shared mock state (all prefixed with "mock" for Jest hoisting) ─

let mockProject;
let mockActiveJobCount;
let mockFsExistsResults; // Map<path, boolean>
let mockExecSyncCalls;
let mockProjectSaved;
let mockRewrittenCount;

// ─── Mock dependencies ──────────────────────────────────────────────

jest.mock('../../config/settings', () => ({
  ROOT_PATH: '/data/projects',
  ARCHIVE_PATH: '/mnt/archive/projects',
}));

jest.mock('../../models/Project', () => ({
  findOne: jest.fn().mockImplementation(() => {
    if (!mockProject) return Promise.resolve(null);
    return Promise.resolve({
      ...mockProject,
      save: jest.fn().mockImplementation(function () {
        mockProjectSaved = true;
        Object.assign(mockProject, {
          is_archived: this.is_archived,
          folder_name: this.folder_name,
        });
        return Promise.resolve();
      }),
    });
  }),
}));

jest.mock('../../models/Job', () => ({
  countDocuments: jest.fn().mockImplementation(() => Promise.resolve(mockActiveJobCount)),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockImplementation((p) => {
      if (mockFsExistsResults && p in mockFsExistsResults) return mockFsExistsResults[p];
      return false;
    }),
    mkdirSync: jest.fn(),
  };
});

jest.mock('child_process', () => ({
  execFileSync: jest.fn().mockImplementation((cmd, args) => {
    mockExecSyncCalls.push({ cmd, args });
  }),
}));

jest.mock('../../utils/pathUtils', () => ({
  getProjectPath: jest.fn().mockImplementation((project) => {
    const folder = project.folder_name || project.project_name.replace(/ /g, '_');
    return `/data/projects/${folder}`;
  }),
  getArchivedProjectPath: jest.fn().mockImplementation((project) => {
    const folder = project.folder_name || project.project_name.replace(/ /g, '_');
    return `/mnt/archive/projects/${folder}`;
  }),
  rewriteJobPaths: jest.fn().mockImplementation(() => Promise.resolve(mockRewrittenCount)),
}));

jest.mock('../../utils/responseHelper', () => ({
  badRequest: jest.fn((res, msg) => res.status(400).json({ success: false, message: msg })),
  notFound: jest.fn((res, msg) => res.status(404).json({ success: false, message: msg })),
  forbidden: jest.fn((res, msg) => res.status(403).json({ success: false, message: msg })),
  conflict: jest.fn((res, msg) => res.status(409).json({ success: false, message: msg })),
  serverError: jest.fn((res, msg) => res.status(500).json({ success: false, message: msg })),
  success: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
}));

const { archiveProject, restoreProject, relocateProject } = require('../archiveController');

// ─── Helpers ────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {
    statusCode: null,
    body: null,
    headersSent: false,
    status: jest.fn().mockImplementation(function (code) {
      this.statusCode = code;
      this.headersSent = true;
      return this;
    }),
    json: jest.fn().mockImplementation(function (body) {
      this.body = body;
      return this;
    }),
  };
  return res;
};

const ownerUser = { id: 'user-1', is_superuser: false };
const superUser = { id: 'admin-1', is_superuser: true };
const otherUser = { id: 'user-2', is_superuser: false };

// ─── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  mockProject = {
    id: 'proj-1',
    project_name: 'Test Project',
    folder_name: 'TestProject',
    created_by_id: 'user-1',
    is_archived: false,
  };
  mockActiveJobCount = 0;
  mockFsExistsResults = {
    '/data/projects/TestProject': true,
    '/mnt/archive/projects': true,
  };
  mockExecSyncCalls = [];
  mockProjectSaved = false;
  mockRewrittenCount = 5;
  jest.clearAllMocks();
});

// =====================================================================
// archiveProject
// =====================================================================

describe('archiveProject', () => {
  const makeReq = (user = ownerUser, projectId = 'proj-1') => ({
    params: { projectId },
    user,
  });

  it('returns 202 and triggers async move for valid archive', async () => {
    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe('archiving');
    expect(mockExecSyncCalls).toHaveLength(1);
    expect(mockExecSyncCalls[0].cmd).toBe('mv');
    expect(mockExecSyncCalls[0].args).toEqual(['/data/projects/TestProject', '/mnt/archive/projects/TestProject']);
  });

  it('sets is_archived=true and rewrites job paths after move', async () => {
    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(mockProjectSaved).toBe(true);
    expect(mockProject.is_archived).toBe(true);

    const { rewriteJobPaths } = require('../../utils/pathUtils');
    expect(rewriteJobPaths).toHaveBeenCalledWith(
      'proj-1',
      '/data/projects/TestProject',
      '/mnt/archive/projects/TestProject'
    );
  });

  // ─── Edge case: ARCHIVE_PATH not configured ─────────────────────
  it('rejects when ARCHIVE_PATH is empty', async () => {
    const settings = require('../../config/settings');
    const originalArchivePath = settings.ARCHIVE_PATH;
    settings.ARCHIVE_PATH = '';

    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('not configured');

    settings.ARCHIVE_PATH = originalArchivePath;
  });

  // ─── Edge case: project not found ───────────────────────────────
  it('returns 404 when project does not exist', async () => {
    mockProject = null;
    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(404);
  });

  // ─── Edge case: non-owner, non-superuser ────────────────────────
  it('returns 403 when user is not owner and not superuser', async () => {
    const res = mockRes();
    await archiveProject(makeReq(otherUser), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain('owner or superuser');
  });

  // ─── Edge case: superuser can archive any project ───────────────
  it('allows superuser to archive any project', async () => {
    const res = mockRes();
    await archiveProject(makeReq(superUser), res);

    expect(res.statusCode).toBe(202);
  });

  // ─── Edge case: already archived ────────────────────────────────
  it('rejects archiving an already-archived project', async () => {
    mockProject.is_archived = true;
    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('already archived');
  });

  // ─── Edge case: active jobs running ─────────────────────────────
  it('rejects when jobs are still running or pending', async () => {
    mockActiveJobCount = 3;
    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('3 job(s)');
    expect(mockExecSyncCalls).toHaveLength(0);
  });

  // ─── Edge case: source folder missing ───────────────────────────
  it('rejects when source project folder does not exist on disk', async () => {
    mockFsExistsResults['/data/projects/TestProject'] = false;
    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('not found');
  });

  // ─── Edge case: destination already exists ──────────────────────
  it('returns 409 when archive destination already exists', async () => {
    mockFsExistsResults['/mnt/archive/projects/TestProject'] = true;
    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain('already exists');
  });

  // ─── Edge case: mv command fails ────────────────────────────────
  it('does not set is_archived when mv fails', async () => {
    const { execFileSync } = require('child_process');
    execFileSync.mockImplementationOnce(() => {
      throw new Error('EXDEV: cross-device link not permitted');
    });

    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(202);
    expect(mockProject.is_archived).toBe(false);
  });

  // ─── Edge case: project with spaces in name, no folder_name ─────
  it('handles project with spaces in name (no folder_name set)', async () => {
    mockProject.folder_name = '';
    mockProject.project_name = 'My Cool Project';
    mockFsExistsResults['/data/projects/My_Cool_Project'] = true;

    const res = mockRes();
    await archiveProject(makeReq(), res);

    expect(res.statusCode).toBe(202);
    expect(mockExecSyncCalls[0].args[0]).toContain('My_Cool_Project');
  });
});

// =====================================================================
// restoreProject
// =====================================================================

describe('restoreProject', () => {
  const makeReq = (user = ownerUser, projectId = 'proj-1') => ({
    params: { projectId },
    user,
  });

  beforeEach(() => {
    mockProject.is_archived = true;
    mockFsExistsResults = {
      '/mnt/archive/projects/TestProject': true,
    };
  });

  it('returns 202 and moves project back to ROOT_PATH', async () => {
    const res = mockRes();
    await restoreProject(makeReq(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body.status).toBe('restoring');
    expect(mockExecSyncCalls).toHaveLength(1);
    expect(mockExecSyncCalls[0].cmd).toBe('mv');
    expect(mockExecSyncCalls[0].args).toEqual(['/mnt/archive/projects/TestProject', '/data/projects/TestProject']);
  });

  it('sets is_archived=false after successful restore', async () => {
    const res = mockRes();
    await restoreProject(makeReq(), res);

    expect(mockProjectSaved).toBe(true);
    expect(mockProject.is_archived).toBe(false);
  });

  it('rewrites job paths back to ROOT_PATH', async () => {
    const res = mockRes();
    await restoreProject(makeReq(), res);

    const { rewriteJobPaths } = require('../../utils/pathUtils');
    expect(rewriteJobPaths).toHaveBeenCalledWith(
      'proj-1',
      '/mnt/archive/projects/TestProject',
      '/data/projects/TestProject'
    );
  });

  // ─── Edge case: project is not archived ─────────────────────────
  it('rejects restoring a project that is not archived', async () => {
    mockProject.is_archived = false;
    const res = mockRes();
    await restoreProject(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('not archived');
  });

  // ─── Edge case: archived folder missing on disk ─────────────────
  it('rejects when archived folder does not exist on disk', async () => {
    mockFsExistsResults['/mnt/archive/projects/TestProject'] = false;
    const res = mockRes();
    await restoreProject(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('not found');
  });

  // ─── Edge case: active project folder collision ─────────────────
  it('returns 409 when active folder already exists at destination', async () => {
    mockFsExistsResults['/data/projects/TestProject'] = true;
    const res = mockRes();
    await restoreProject(makeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain('already exists');
  });

  // ─── Edge case: non-owner tries to restore ──────────────────────
  it('returns 403 when non-owner tries to restore', async () => {
    const res = mockRes();
    await restoreProject(makeReq(otherUser), res);

    expect(res.statusCode).toBe(403);
  });

  // ─── Edge case: superuser can restore ───────────────────────────
  it('allows superuser to restore any project', async () => {
    const res = mockRes();
    await restoreProject(makeReq(superUser), res);

    expect(res.statusCode).toBe(202);
  });

  // ─── Edge case: mv fails during restore ─────────────────────────
  it('does not flip is_archived when mv fails', async () => {
    const { execFileSync } = require('child_process');
    execFileSync.mockImplementationOnce(() => {
      throw new Error('Permission denied');
    });

    const res = mockRes();
    await restoreProject(makeReq(), res);

    expect(res.statusCode).toBe(202);
    expect(mockProject.is_archived).toBe(true);
  });

  // ─── Edge case: ARCHIVE_PATH not configured ─────────────────────
  it('rejects when ARCHIVE_PATH is empty', async () => {
    const settings = require('../../config/settings');
    const original = settings.ARCHIVE_PATH;
    settings.ARCHIVE_PATH = '';

    const res = mockRes();
    await restoreProject(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('not configured');

    settings.ARCHIVE_PATH = original;
  });
});

// =====================================================================
// relocateProject
// =====================================================================

describe('relocateProject', () => {
  const makeReq = (body = {}, user = superUser, projectId = 'proj-1') => ({
    params: { projectId },
    body,
    user,
  });

  beforeEach(() => {
    mockFsExistsResults = {
      '/data/projects/TestProject': true,
      '/mnt/custom/NewLocation': true,
    };
  });

  it('updates folder_name and rewrites job paths', async () => {
    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/mnt/custom/NewLocation' }), res);

    expect(res.statusCode).toBe(200);
    expect(mockProjectSaved).toBe(true);
    expect(mockProject.folder_name).toBe('NewLocation');

    const { rewriteJobPaths } = require('../../utils/pathUtils');
    expect(rewriteJobPaths).toHaveBeenCalledWith(
      'proj-1',
      '/data/projects/TestProject',
      '/mnt/custom/NewLocation'
    );
  });

  it('returns job count in success message', async () => {
    mockRewrittenCount = 12;
    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/mnt/custom/NewLocation' }), res);

    expect(res.body.message).toContain('12');
  });

  // ─── Edge case: non-superuser ───────────────────────────────────
  it('rejects non-superuser', async () => {
    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/mnt/custom/NewLocation' }, ownerUser), res);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain('superusers');
  });

  // ─── Edge case: relative path ───────────────────────────────────
  it('rejects relative paths', async () => {
    const res = mockRes();
    await relocateProject(makeReq({ new_path: 'relative/path' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('absolute path');
  });

  // ─── Edge case: missing new_path ────────────────────────────────
  it('rejects missing new_path', async () => {
    const res = mockRes();
    await relocateProject(makeReq({}), res);

    expect(res.statusCode).toBe(400);
  });

  // ─── Edge case: null new_path ───────────────────────────────────
  it('rejects null new_path', async () => {
    const res = mockRes();
    await relocateProject(makeReq({ new_path: null }), res);

    expect(res.statusCode).toBe(400);
  });

  // ─── Edge case: path does not exist on disk ─────────────────────
  it('rejects when new_path does not exist on disk', async () => {
    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/nonexistent/path' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain('does not exist');
  });

  // ─── Edge case: auto-detect is_archived from ROOT_PATH ──────────
  it('sets is_archived=false when new_path is under ROOT_PATH', async () => {
    mockProject.is_archived = true;
    mockFsExistsResults['/data/projects/RestoredProject'] = true;

    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/data/projects/RestoredProject' }), res);

    expect(res.statusCode).toBe(200);
    expect(mockProject.is_archived).toBe(false);
    expect(mockProject.folder_name).toBe('RestoredProject');
  });

  // ─── Edge case: auto-detect is_archived from ARCHIVE_PATH ──────
  it('sets is_archived=true when new_path is under ARCHIVE_PATH', async () => {
    mockProject.is_archived = false;
    mockFsExistsResults['/mnt/archive/projects/ArchivedProject'] = true;

    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/mnt/archive/projects/ArchivedProject' }), res);

    expect(res.statusCode).toBe(200);
    expect(mockProject.is_archived).toBe(true);
    expect(mockProject.folder_name).toBe('ArchivedProject');
  });

  // ─── Edge case: new_path outside both ROOT and ARCHIVE ──────────
  it('preserves current is_archived when new_path is outside known paths', async () => {
    mockProject.is_archived = false;
    mockFsExistsResults['/mnt/custom/SomeProject'] = true;

    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/mnt/custom/SomeProject' }), res);

    expect(res.statusCode).toBe(200);
    expect(mockProject.is_archived).toBe(false);
  });

  // ─── Edge case: project not found ───────────────────────────────
  it('returns 404 when project does not exist', async () => {
    mockProject = null;
    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/mnt/custom/NewLocation' }), res);

    expect(res.statusCode).toBe(404);
  });

  // ─── Edge case: relocate archived project (old path from archive)
  it('computes old path from ARCHIVE_PATH when project is archived', async () => {
    mockProject.is_archived = true;
    mockFsExistsResults['/mnt/custom/Moved'] = true;

    const res = mockRes();
    await relocateProject(makeReq({ new_path: '/mnt/custom/Moved' }), res);

    const { rewriteJobPaths } = require('../../utils/pathUtils');
    expect(rewriteJobPaths).toHaveBeenCalledWith(
      'proj-1',
      '/mnt/archive/projects/TestProject',
      '/mnt/custom/Moved'
    );
  });
});
