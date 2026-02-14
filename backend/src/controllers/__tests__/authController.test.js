jest.mock('../../utils/logger');

// ─── Mock state ───────────────────────────────────────────────────

let mockUser;
let mockUserSaved;
let mockResetToken;
let mockResetTokenSaved;
let mockAllUsers;

// ─── Mock dependencies ───────────────────────────────────────────

jest.mock('../../config/settings', () => ({
  JWT_SECRET: 'test-secret',
  ROOT_PATH: '/data/projects',
}));

jest.mock('../../config/constants', () => ({
  TIMING: { SESSION_COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000 },
  HTTP_STATUS: { OK: 200, CREATED: 201, BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, INTERNAL_ERROR: 500 },
}));

jest.mock('../../utils/responseHelper', () => ({
  success: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
  successData: jest.fn((res, data) => res.status(200).json({ success: true, data })),
  created: jest.fn((res, data) => res.status(201).json({ success: true, ...data })),
  badRequest: jest.fn((res, msg) => res.status(400).json({ success: false, message: msg })),
  unauthorized: jest.fn((res, msg) => res.status(401).json({ success: false, message: msg })),
  notFound: jest.fn((res, msg) => res.status(404).json({ success: false, message: msg })),
  conflict: jest.fn((res, msg) => res.status(409).json({ success: false, message: msg })),
  serverError: jest.fn((res, msg) => res.status(500).json({ success: false, message: msg })),
}));

jest.mock('../../utils/security', () => ({
  validatePassword: jest.fn(() => ({ valid: true, errors: [] })),
  isValidEmail: jest.fn(() => true),
}));

jest.mock('../../utils/crypto', () => ({
  encryptField: jest.fn(v => `encrypted:${v}`),
  decryptField: jest.fn(v => v.replace('encrypted:', '')),
}));

jest.mock('../../services/emailService', () => ({
  getEmailService: jest.fn(() => ({
    enabled: false,
    sendPasswordReset: jest.fn(),
  })),
}));

jest.mock('../../models/User', () => {
  const makeMockUserObj = () => {
    if (!mockUser) return null;
    return {
      ...mockUser,
      save: jest.fn().mockImplementation(function () {
        mockUserSaved = true;
        return Promise.resolve();
      }),
      comparePassword: jest.fn().mockImplementation((pw) => {
        return Promise.resolve(pw === 'correct-password');
      }),
      generateAuthToken: jest.fn().mockReturnValue('mock-jwt-token'),
    };
  };

  return {
    findOne: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockImplementation(() => Promise.resolve(makeMockUserObj())),
      lean: jest.fn().mockImplementation(() => Promise.resolve(mockUser ? { ...mockUser } : null)),
      then: (resolve) => resolve(makeMockUserObj()),
    })),
    create: jest.fn().mockImplementation((data) => {
      mockUser = { ...data };
      return Promise.resolve(makeMockUserObj());
    }),
    getNextId: jest.fn().mockResolvedValue(100),
  };
});

jest.mock('../../models/PasswordResetToken', () => ({
  findOne: jest.fn().mockImplementation(() => {
    if (!mockResetToken) return Promise.resolve(null);
    return Promise.resolve({
      ...mockResetToken,
      save: jest.fn().mockImplementation(function () {
        mockResetTokenSaved = true;
        return Promise.resolve();
      }),
    });
  }),
  create: jest.fn().mockResolvedValue({}),
  deleteMany: jest.fn().mockResolvedValue({}),
}));

// ─── Import controller after mocks ───────────────────────────────

const authController = require('../authController');

// ─── Helpers ──────────────────────────────────────────────────────

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    cookies: {},
    status: jest.fn().mockImplementation(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn().mockImplementation(function (body) {
      this.body = body;
      return this;
    }),
    cookie: jest.fn().mockImplementation(function (name, value) {
      this.cookies[name] = value;
    }),
    clearCookie: jest.fn(),
  };
  return res;
};

// ─── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  mockUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
    is_staff: false,
    is_superuser: false,
    password: 'hashed-password',
  };
  mockUserSaved = false;
  mockResetToken = null;
  mockResetTokenSaved = false;
  jest.clearAllMocks();
});

// =====================================================================
// login
// =====================================================================

describe('login', () => {
  it('returns user data on successful login', async () => {
    const req = { body: { email: 'test@example.com', password: 'correct-password' } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.cookies.atoken).toBe('mock-jwt-token');
  });

  it('returns 401 for wrong password', async () => {
    const req = { body: { email: 'test@example.com', password: 'wrong-password' } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when user not found', async () => {
    mockUser = null;
    const req = { body: { email: 'nobody@example.com', password: 'password123' } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when email/password missing', async () => {
    const req = { body: {} };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when account is disabled', async () => {
    mockUser.is_active = false;
    const req = { body: { email: 'test@example.com', password: 'correct-password' } };
    const res = mockRes();

    await authController.login(req, res);

    expect(res.statusCode).toBe(401);
  });
});

// =====================================================================
// logout
// =====================================================================

describe('logout', () => {
  it('clears the auth cookie', () => {
    const req = {};
    const res = mockRes();

    authController.logout(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith('atoken', expect.objectContaining({
      httpOnly: true,
      path: '/',
    }));
    expect(res.statusCode).toBe(200);
  });
});

// =====================================================================
// refreshToken
// =====================================================================

describe('refreshToken', () => {
  const jwt = require('jsonwebtoken');

  it('refreshes token from cookie', async () => {
    const token = jwt.sign({ id: 1, iat: Math.floor(Date.now() / 1000) }, 'test-secret');
    const req = { cookies: { atoken: token }, headers: {} };
    const res = mockRes();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.cookies.atoken).toBe('mock-jwt-token');
  });

  it('refreshes token from Authorization header', async () => {
    const token = jwt.sign({ id: 1, iat: Math.floor(Date.now() / 1000) }, 'test-secret');
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(200);
  });

  it('returns 401 when no token', async () => {
    const req = { cookies: {}, headers: {} };
    const res = mockRes();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(401);
  });

  it('rejects token older than 30 days', async () => {
    const thirtyOneDaysAgo = Math.floor(Date.now() / 1000) - (31 * 24 * 60 * 60);
    const token = jwt.sign({ id: 1, iat: thirtyOneDaysAgo }, 'test-secret');
    const req = { cookies: { atoken: token }, headers: {} };
    const res = mockRes();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('Session expired');
  });

  it('returns 401 when user is inactive', async () => {
    mockUser.is_active = false;
    const token = jwt.sign({ id: 1, iat: Math.floor(Date.now() / 1000) }, 'test-secret');
    const req = { cookies: { atoken: token }, headers: {} };
    const res = mockRes();

    await authController.refreshToken(req, res);

    expect(res.statusCode).toBe(401);
  });
});

// =====================================================================
// changePassword
// =====================================================================

describe('changePassword', () => {
  it('changes password when current password is correct', async () => {
    const req = {
      user: { id: 1 },
      body: { current_password: 'correct-password', new_password: 'NewPass123!', confirm_password: 'NewPass123!' },
    };
    const res = mockRes();

    await authController.changePassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockUserSaved).toBe(true);
  });

  it('returns 400 when missing fields', async () => {
    const req = { user: { id: 1 }, body: {} };
    const res = mockRes();

    await authController.changePassword(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when passwords do not match', async () => {
    const req = {
      user: { id: 1 },
      body: { current_password: 'correct-password', new_password: 'NewPass1', confirm_password: 'Different1' },
    };
    const res = mockRes();

    await authController.changePassword(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 401 when current password is wrong', async () => {
    const req = {
      user: { id: 1 },
      body: { current_password: 'wrong-password', new_password: 'NewPass123!', confirm_password: 'NewPass123!' },
    };
    const res = mockRes();

    await authController.changePassword(req, res);

    expect(res.statusCode).toBe(401);
  });
});

// =====================================================================
// forgotPassword
// =====================================================================

describe('forgotPassword', () => {
  it('always returns generic success message', async () => {
    const req = { body: { email: 'test@example.com' } };
    const res = mockRes();

    await authController.forgotPassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('If an account');
  });

  it('returns success even for non-existent email (anti-enumeration)', async () => {
    mockUser = null;
    const req = { body: { email: 'nobody@example.com' } };
    const res = mockRes();

    await authController.forgotPassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('If an account');
  });

  it('returns success when email is empty', async () => {
    const req = { body: {} };
    const res = mockRes();

    await authController.forgotPassword(req, res);

    expect(res.statusCode).toBe(200);
  });
});

// =====================================================================
// resetPassword
// =====================================================================

describe('resetPassword', () => {
  beforeEach(() => {
    mockResetToken = {
      token: 'valid-token',
      user_id: 1,
      used: false,
      expires_at: new Date(Date.now() + 3600000),
    };
  });

  it('resets password with valid token', async () => {
    const req = { body: { token: 'valid-token', new_password: 'NewPass123!', confirm_password: 'NewPass123!' } };
    const res = mockRes();

    await authController.resetPassword(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockResetTokenSaved).toBe(true);
  });

  it('returns 400 when token is missing', async () => {
    const req = { body: { new_password: 'NewPass123!' } };
    const res = mockRes();

    await authController.resetPassword(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when passwords do not match', async () => {
    const req = { body: { token: 'valid-token', new_password: 'NewPass1', confirm_password: 'Different1' } };
    const res = mockRes();

    await authController.resetPassword(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid/expired token', async () => {
    mockResetToken = null;
    const req = { body: { token: 'bad-token', new_password: 'NewPass123!', confirm_password: 'NewPass123!' } };
    const res = mockRes();

    await authController.resetPassword(req, res);

    expect(res.statusCode).toBe(400);
  });
});
