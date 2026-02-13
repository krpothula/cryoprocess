jest.mock('../../utils/logger');

const crypto = require('crypto');

// ─── Shared mock state ──────────────────────────────────────────────

let mockUserByUsername;
let mockUserByApiKeyHash;
let mockSmartScopeApiKey;

// ─── Mock dependencies ──────────────────────────────────────────────

jest.mock('../../config/settings', () => ({
  JWT_SECRET: 'test-secret',
  get SMARTSCOPE_API_KEY() { return mockSmartScopeApiKey; },
}));

jest.mock('../../models/User', () => ({
  findOne: jest.fn().mockImplementation((query) => {
    const chain = {
      lean: jest.fn().mockImplementation(() => {
        // Route to the right mock based on query
        if (query.username) return Promise.resolve(mockUserByUsername);
        if (query.api_key_hash) return Promise.resolve(mockUserByApiKeyHash);
        if (query.id !== undefined) return Promise.resolve(null); // JWT path
        return Promise.resolve(null);
      }),
    };
    return chain;
  }),
}));

const { smartscopeAuth } = require('../auth');

// ─── Helpers ────────────────────────────────────────────────────────

const mockRes = () => {
  const res = {
    statusCode: null,
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

const makeReq = (apiKey = null) => ({
  headers: apiKey ? { 'x-api-key': apiKey } : {},
  cookies: {},
});

const smartscopeUser = {
  id: 100,
  username: 'smartscope',
  email: 'smartscope@localhost',
  first_name: 'SmartScope',
  last_name: 'Service',
  is_active: true,
  is_staff: false,
  is_superuser: false,
};

const regularUser = {
  id: 10,
  username: 'testuser',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  is_active: true,
  is_staff: false,
  is_superuser: false,
};

// ─── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  mockUserByUsername = { ...smartscopeUser };
  mockUserByApiKeyHash = null;
  mockSmartScopeApiKey = '';
  jest.clearAllMocks();
});

// =====================================================================
// Legacy .env SMARTSCOPE_API_KEY
// =====================================================================

describe('smartscopeAuth — legacy .env API key', () => {
  it('authenticates with matching .env API key', async () => {
    mockSmartScopeApiKey = 'legacy-env-key-123';
    const req = makeReq('legacy-env-key-123');
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.username).toBe('smartscope');
    expect(req.user.id).toBe(100);
  });

  it('returns 500 when smartscope service account not found', async () => {
    mockSmartScopeApiKey = 'legacy-env-key-123';
    mockUserByUsername = null;
    const req = makeReq('legacy-env-key-123');
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toContain('service account not found');
  });

  it('does not match when .env key differs', async () => {
    mockSmartScopeApiKey = 'legacy-env-key-123';
    const req = makeReq('wrong-key');
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    // Should fall through to per-user check (and fail since no DB match)
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});

// =====================================================================
// Per-user API key (SHA-256 hash lookup)
// =====================================================================

describe('smartscopeAuth — per-user API key', () => {
  const rawKey = 'a'.repeat(64); // A 64-char hex key
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  beforeEach(() => {
    // No .env key set — force per-user path
    mockSmartScopeApiKey = '';
    mockUserByApiKeyHash = { ...regularUser };
  });

  it('authenticates with valid per-user API key', async () => {
    const req = makeReq(rawKey);
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.username).toBe('testuser');
    expect(req.user.id).toBe(10);
  });

  it('looks up user by SHA-256 hash of the API key', async () => {
    const User = require('../../models/User');
    const req = makeReq(rawKey);
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    // Verify findOne was called with the correct hash
    expect(User.findOne).toHaveBeenCalledWith({ api_key_hash: keyHash });
  });

  it('rejects disabled user accounts', async () => {
    mockUserByApiKeyHash = { ...regularUser, is_active: false };
    const req = makeReq(rawKey);
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('disabled');
  });

  it('returns 401 when API key does not match any user', async () => {
    mockUserByApiKeyHash = null;
    const req = makeReq('unknown-key-that-wont-match');
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Invalid API key');
  });

  it('attaches correct user fields to req.user', async () => {
    mockUserByApiKeyHash = {
      id: 42,
      username: 'bot',
      email: 'bot@lab.org',
      first_name: 'Bot',
      last_name: 'Account',
      is_active: true,
      is_staff: true,
      is_superuser: false,
    };
    const req = makeReq(rawKey);
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    expect(req.user).toEqual({
      id: 42,
      username: 'bot',
      email: 'bot@lab.org',
      first_name: 'Bot',
      last_name: 'Account',
      is_staff: true,
      is_superuser: false,
    });
  });
});

// =====================================================================
// Fallback to JWT
// =====================================================================

describe('smartscopeAuth — JWT fallback', () => {
  it('falls back to JWT when no X-API-Key header', async () => {
    const req = {
      headers: {},
      cookies: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    // JWT auth should kick in and return 401 (no token provided)
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Authentication required');
  });
});

// =====================================================================
// Priority: .env key checked before per-user key
// =====================================================================

describe('smartscopeAuth — priority', () => {
  it('prefers .env key over per-user key when both could match', async () => {
    // Set .env key to the same value as what we'd send
    const rawKey = 'shared-key-value';
    mockSmartScopeApiKey = rawKey;
    mockUserByUsername = { ...smartscopeUser };

    // Also set up a per-user match (different user)
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    mockUserByApiKeyHash = { ...regularUser };

    const req = makeReq(rawKey);
    const res = mockRes();
    const next = jest.fn();

    await smartscopeAuth(req, res, next);

    // Should use .env path → smartscope user, not per-user path
    expect(next).toHaveBeenCalled();
    expect(req.user.username).toBe('smartscope');
  });
});
