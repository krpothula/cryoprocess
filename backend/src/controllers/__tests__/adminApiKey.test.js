jest.mock('../../utils/logger');

// ─── Shared mock state ──────────────────────────────────────────────

let mockUser;
let mockUserSaved;

// ─── Mock dependencies ──────────────────────────────────────────────

jest.mock('../../config/settings', () => ({
  JWT_SECRET: 'test-secret',
  ROOT_PATH: '/data/projects',
}));

jest.mock('../../models/User', () => {
  const findOneFn = jest.fn().mockImplementation(() => {
    const query = {
      select: jest.fn().mockImplementation(function () {
        // .select('+api_key_hash') — return the user with api_key_hash included
        if (!mockUser) return Promise.resolve(null);
        return Promise.resolve({
          ...mockUser,
          save: jest.fn().mockImplementation(function () {
            mockUserSaved = true;
            // Capture mutations
            mockUser.api_key_hash = this.api_key_hash;
            return Promise.resolve();
          }),
          // Expose api_key_hash for direct property access
          get api_key_hash() { return mockUser.api_key_hash; },
          set api_key_hash(v) { mockUser.api_key_hash = v; },
        });
      }),
      lean: jest.fn().mockImplementation(() => {
        if (!mockUser) return Promise.resolve(null);
        return Promise.resolve({ ...mockUser });
      }),
    };
    return query;
  });

  return {
    findOne: findOneFn,
    find: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    })),
  };
});

jest.mock('../../utils/responseHelper', () => ({
  badRequest: jest.fn((res, msg) => res.status(400).json({ success: false, message: msg })),
  notFound: jest.fn((res, msg) => res.status(404).json({ success: false, message: msg })),
  forbidden: jest.fn((res, msg) => res.status(403).json({ success: false, message: msg })),
  conflict: jest.fn((res, msg) => res.status(409).json({ success: false, message: msg })),
  serverError: jest.fn((res, msg) => res.status(500).json({ success: false, message: msg })),
  success: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
}));

const { generateApiKey, revokeApiKey } = require('../adminController');

// ─── Helpers ────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {
    statusCode: 200, // Express defaults to 200
    body: null,
    status: jest.fn().mockImplementation(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn().mockImplementation(function (body) {
      this.body = body;
      return this;
    }),
  };
  return res;
};

const superUser = { id: 1, username: 'admin', is_superuser: true, is_staff: true };
const staffUser = { id: 2, username: 'staff', is_superuser: false, is_staff: true };

const makeReq = (userId, user = superUser) => ({
  params: { userId: String(userId) },
  user,
});

// ─── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  mockUser = {
    id: 10,
    username: 'smartscope',
    email: 'smartscope@localhost',
    is_active: true,
    is_staff: false,
    is_superuser: false,
    api_key_hash: null,
  };
  mockUserSaved = false;
  jest.clearAllMocks();
});

// =====================================================================
// generateApiKey
// =====================================================================

describe('generateApiKey', () => {
  it('generates an API key and returns raw key', async () => {
    const res = mockRes();
    await generateApiKey(makeReq(10), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.apiKey).toBeDefined();
    expect(res.body.data.apiKey).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it('stores a SHA-256 hash (not the raw key)', async () => {
    const res = mockRes();
    await generateApiKey(makeReq(10), res);

    const rawKey = res.body.data.apiKey;
    // Hash should have been set on the user
    expect(mockUserSaved).toBe(true);
    expect(mockUser.api_key_hash).toBeDefined();
    expect(mockUser.api_key_hash).toHaveLength(64); // SHA-256 hex = 64 chars
    // The hash should NOT equal the raw key
    expect(mockUser.api_key_hash).not.toBe(rawKey);
  });

  it('produces correct SHA-256 hash of the raw key', async () => {
    const crypto = require('crypto');
    const res = mockRes();
    await generateApiKey(makeReq(10), res);

    const rawKey = res.body.data.apiKey;
    const expectedHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    expect(mockUser.api_key_hash).toBe(expectedHash);
  });

  it('returns 404 when user does not exist', async () => {
    mockUser = null;
    const res = mockRes();
    await generateApiKey(makeReq(999), res);

    expect(res.statusCode).toBe(404);
  });

  it('allows superuser to generate key for staff accounts', async () => {
    mockUser.is_staff = true;
    const res = mockRes();
    await generateApiKey(makeReq(10, superUser), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.apiKey).toBeDefined();
  });

  it('forbids staff from generating key for staff accounts', async () => {
    mockUser.is_staff = true;
    const res = mockRes();
    await generateApiKey(makeReq(10, staffUser), res);

    expect(res.statusCode).toBe(403);
  });

  it('forbids staff from generating key for superuser accounts', async () => {
    mockUser.is_superuser = true;
    const res = mockRes();
    await generateApiKey(makeReq(10, staffUser), res);

    expect(res.statusCode).toBe(403);
  });

  it('allows staff to generate key for regular users', async () => {
    const res = mockRes();
    await generateApiKey(makeReq(10, staffUser), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.apiKey).toBeDefined();
  });

  it('overwrites existing key on regeneration', async () => {
    mockUser.api_key_hash = 'old-hash-value';
    const res = mockRes();
    await generateApiKey(makeReq(10), res);

    expect(res.statusCode).toBe(200);
    expect(mockUser.api_key_hash).not.toBe('old-hash-value');
    expect(mockUserSaved).toBe(true);
  });
});

// =====================================================================
// revokeApiKey
// =====================================================================

describe('revokeApiKey', () => {
  beforeEach(() => {
    mockUser.api_key_hash = 'existing-hash-value';
  });

  it('revokes API key by setting hash to null', async () => {
    const res = mockRes();
    await revokeApiKey(makeReq(10), res);

    expect(res.statusCode).toBe(200);
    expect(mockUser.api_key_hash).toBeNull();
    expect(mockUserSaved).toBe(true);
  });

  it('returns 404 when user does not exist', async () => {
    mockUser = null;
    const res = mockRes();
    await revokeApiKey(makeReq(999), res);

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when user has no API key', async () => {
    mockUser.api_key_hash = null;
    const res = mockRes();
    await revokeApiKey(makeReq(10), res);

    expect(res.statusCode).toBe(400);
  });

  it('forbids staff from revoking keys for staff accounts', async () => {
    mockUser.is_staff = true;
    const res = mockRes();
    await revokeApiKey(makeReq(10, staffUser), res);

    expect(res.statusCode).toBe(403);
  });

  it('forbids staff from revoking keys for superuser accounts', async () => {
    mockUser.is_superuser = true;
    const res = mockRes();
    await revokeApiKey(makeReq(10, staffUser), res);

    expect(res.statusCode).toBe(403);
  });

  it('allows superuser to revoke key for any account', async () => {
    mockUser.is_staff = true;
    const res = mockRes();
    await revokeApiKey(makeReq(10, superUser), res);

    expect(res.statusCode).toBe(200);
    expect(mockUser.api_key_hash).toBeNull();
  });

  it('allows staff to revoke key for regular users', async () => {
    const res = mockRes();
    await revokeApiKey(makeReq(10, staffUser), res);

    expect(res.statusCode).toBe(200);
  });
});
