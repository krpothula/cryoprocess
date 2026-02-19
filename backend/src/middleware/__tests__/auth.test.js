jest.mock('../../utils/logger');

const jwt = require('jsonwebtoken');

jest.mock('../../config/settings', () => ({
  JWT_SECRET: 'test-secret-key-for-testing',
}));

let mockUser;

jest.mock('../../models/User', () => ({
  findOne: jest.fn().mockImplementation(() => ({
    lean: jest.fn().mockImplementation(() => {
      if (!mockUser) return Promise.resolve(null);
      return Promise.resolve({ ...mockUser });
    }),
  })),
}));

const authMiddleware = require('../auth');
const { isStaff, isSuperuser } = authMiddleware;

// ─── Helpers ──────────────────────────────────────────────────────

const mockReq = (overrides = {}) => ({
  headers: {},
  cookies: {},
  ...overrides,
});

const mockRes = () => {
  const res = {
    statusCode: 200,
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

const nextFn = jest.fn();

const signToken = (payload, options = {}) =>
  jwt.sign(payload, 'test-secret-key-for-testing', { expiresIn: '7d', ...options });

// ─── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    is_staff: false,
    is_superuser: false,
    is_active: true,
  };
  jest.clearAllMocks();
});

// ─── authMiddleware ───────────────────────────────────────────────

describe('authMiddleware', () => {
  it('authenticates via cookie token', async () => {
    const token = signToken({ id: 1 });
    const req = mockReq({ cookies: { atoken: token } });
    const res = mockRes();

    await authMiddleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(req.user.username).toBe('testuser');
  });

  it('authenticates via Authorization header', async () => {
    const token = signToken({ id: 1 });
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
    const res = mockRes();

    await authMiddleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(req.user.id).toBe(1);
  });

  it('returns 401 when no token provided', async () => {
    const req = mockReq();
    const res = mockRes();

    await authMiddleware(req, res, nextFn);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Authentication required');
    expect(nextFn).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', async () => {
    const req = mockReq({ cookies: { atoken: 'invalid-token-string' } });
    const res = mockRes();

    await authMiddleware(req, res, nextFn);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });

  it('returns 401 for expired token', async () => {
    const token = signToken({ id: 1 }, { expiresIn: '-1s' });
    const req = mockReq({ cookies: { atoken: token } });
    const res = mockRes();

    await authMiddleware(req, res, nextFn);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Token expired');
  });

  it('returns 401 when user not found', async () => {
    mockUser = null;
    const token = signToken({ id: 999 });
    const req = mockReq({ cookies: { atoken: token } });
    const res = mockRes();

    await authMiddleware(req, res, nextFn);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('User not found');
  });

  it('returns 401 when user is inactive', async () => {
    mockUser.is_active = false;
    const token = signToken({ id: 1 });
    const req = mockReq({ cookies: { atoken: token } });
    const res = mockRes();

    await authMiddleware(req, res, nextFn);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('User account is disabled');
  });
});

// ─── isStaff ──────────────────────────────────────────────────────

describe('isStaff', () => {
  it('allows staff users', () => {
    const req = { user: { isStaff: true, isSuperuser: false } };
    const res = mockRes();
    isStaff(req, res, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  it('allows superusers', () => {
    const req = { user: { isStaff: false, isSuperuser: true } };
    const res = mockRes();
    isStaff(req, res, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  it('rejects regular users', () => {
    const req = { user: { isStaff: false, isSuperuser: false } };
    const res = mockRes();
    isStaff(req, res, nextFn);
    expect(res.statusCode).toBe(403);
  });

  it('returns 401 when no user attached', () => {
    const req = {};
    const res = mockRes();
    isStaff(req, res, nextFn);
    expect(res.statusCode).toBe(401);
  });
});

// ─── isSuperuser ──────────────────────────────────────────────────

describe('isSuperuser', () => {
  it('allows superusers', () => {
    const req = { user: { isSuperuser: true } };
    const res = mockRes();
    isSuperuser(req, res, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  it('rejects staff (non-super) users', () => {
    const req = { user: { isStaff: true, isSuperuser: false } };
    const res = mockRes();
    isSuperuser(req, res, nextFn);
    expect(res.statusCode).toBe(403);
  });

  it('returns 401 when no user attached', () => {
    const req = {};
    const res = mockRes();
    isSuperuser(req, res, nextFn);
    expect(res.statusCode).toBe(401);
  });
});
