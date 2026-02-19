const response = require('../responseHelper');

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

describe('responseHelper — success', () => {
  it('returns 200 with success: true', () => {
    const res = mockRes();
    response.success(res, { message: 'ok' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('ok');
  });

  it('spreads extra data', () => {
    const res = mockRes();
    response.success(res, { count: 5, items: [1, 2] });
    expect(res.body.count).toBe(5);
    expect(res.body.items).toEqual([1, 2]);
  });
});

describe('responseHelper — successData', () => {
  it('wraps data in data property', () => {
    const res = mockRes();
    response.successData(res, { name: 'test' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ name: 'test' });
  });

  it('accepts custom status code', () => {
    const res = mockRes();
    response.successData(res, {}, 503);
    expect(res.statusCode).toBe(503);
  });
});

describe('responseHelper — created', () => {
  it('returns 201', () => {
    const res = mockRes();
    response.created(res, { id: '123' });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBe('123');
  });
});

describe('responseHelper — error', () => {
  it('returns error with status code and message', () => {
    const res = mockRes();
    response.error(res, 'Something failed', 422);
    expect(res.statusCode).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Something failed');
  });

  it('includes extra fields', () => {
    const res = mockRes();
    response.error(res, 'fail', 400, { field: 'email' });
    expect(res.body.field).toBe('email');
  });
});

describe('responseHelper — convenience error methods', () => {
  it('badRequest returns 400', () => {
    const res = mockRes();
    response.badRequest(res, 'Bad input');
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Bad input');
  });

  it('unauthorized returns 401 with default message', () => {
    const res = mockRes();
    response.unauthorized(res);
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  it('forbidden returns 403 with default message', () => {
    const res = mockRes();
    response.forbidden(res);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Access denied');
  });

  it('notFound returns 404 with default message', () => {
    const res = mockRes();
    response.notFound(res);
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe('Not found');
  });

  it('conflict returns 409', () => {
    const res = mockRes();
    response.conflict(res, 'Already exists');
    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe('Already exists');
  });

  it('serverError returns 500 with default message', () => {
    const res = mockRes();
    response.serverError(res);
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Internal server error');
  });
});

describe('responseHelper — validationError', () => {
  it('formats array of errors', () => {
    const res = mockRes();
    response.validationError(res, [
      { message: 'Email is required' },
      { message: 'Name too short' },
    ]);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Email is required, Name too short');
    expect(res.body.errors).toHaveLength(2);
  });

  it('formats single error object', () => {
    const res = mockRes();
    response.validationError(res, { message: 'Invalid input' });
    expect(res.body.message).toBe('Invalid input');
    expect(res.body.errors).toHaveLength(1);
  });
});

describe('responseHelper — paginated', () => {
  it('returns data with pagination metadata', () => {
    const res = mockRes();
    response.paginated(res, [1, 2, 3], { page: 1, limit: 10, total: 25 });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([1, 2, 3]);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 25,
      pages: 3,
    });
  });

  it('calculates pages correctly', () => {
    const res = mockRes();
    response.paginated(res, [], { page: 1, limit: 50, total: 150 });
    expect(res.body.pagination.pages).toBe(3);
  });

  it('uses defaults', () => {
    const res = mockRes();
    response.paginated(res, [], {});
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(50);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.pages).toBe(0);
  });
});
