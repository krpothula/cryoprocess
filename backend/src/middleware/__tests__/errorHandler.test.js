jest.mock('../../utils/logger');

const errorHandler = require('../errorHandler');

const mockReq = { path: '/api/test', method: 'POST' };

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

const mockNext = jest.fn();

describe('errorHandler', () => {
  it('handles ValidationError with 400', () => {
    const err = new Error('field invalid');
    err.name = 'ValidationError';
    err.details = [{ message: 'field invalid' }];
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation error');
  });

  it('handles CastError with 400', () => {
    const err = new Error('cast failed');
    err.name = 'CastError';
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid ID format');
  });

  it('handles MongoDB duplicate key (code 11000) with 409', () => {
    const err = new Error('duplicate');
    err.code = 11000;
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Duplicate entry');
  });

  it('handles UnauthorizedError with 401', () => {
    const err = new Error('unauthorized');
    err.name = 'UnauthorizedError';
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Authentication required');
  });

  it('returns 500 for unknown errors in test env', () => {
    const err = new Error('Something broke');
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Something broke');
  });

  it('respects custom statusCode on error', () => {
    const err = new Error('Rate limited');
    err.statusCode = 429;
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.statusCode).toBe(429);
  });

  it('hides error message in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Secret internal details');
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.body.message).toBe('Internal server error');

    process.env.NODE_ENV = originalEnv;
  });

  it('returns consistent error format', () => {
    const err = new Error('test');
    const res = mockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('status', 'error');
    expect(res.body).toHaveProperty('message');
  });
});
