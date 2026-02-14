let mockReadyState = 1;

jest.mock('mongoose', () => ({
  connection: {
    get readyState() { return mockReadyState; },
  },
}));

const { getHealth } = require('../healthController');

// ─── Helpers ──────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────

describe('healthController', () => {
  it('returns 200 with status ok when DB connected', () => {
    mockReadyState = 1;

    const res = mockRes();
    getHealth({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database.status).toBe('connected');
    expect(res.body.uptime).toBeDefined();
    expect(res.body.memory).toBeDefined();
    expect(res.body.system).toBeDefined();
    expect(res.body.node).toBeDefined();
  });

  it('returns 503 with status degraded when DB disconnected', () => {
    mockReadyState = 0;

    const res = mockRes();
    getHealth({}, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.database.status).toBe('disconnected');
  });

  it('includes memory info with MB units', () => {
    mockReadyState = 1;

    const res = mockRes();
    getHealth({}, res);

    expect(res.body.memory.rss).toMatch(/\d+MB/);
    expect(res.body.memory.heapUsed).toMatch(/\d+MB/);
    expect(res.body.memory.heapTotal).toMatch(/\d+MB/);
  });

  it('includes system load average', () => {
    mockReadyState = 1;

    const res = mockRes();
    getHealth({}, res);

    expect(res.body.system.loadAvg).toHaveLength(3);
    expect(typeof res.body.system.loadAvg[0]).toBe('number');
  });
});
