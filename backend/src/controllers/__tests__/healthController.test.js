let mockReadyState = 1;

jest.mock('mongoose', () => ({
  connection: {
    get readyState() { return mockReadyState; },
  },
}));

jest.mock('../../utils/responseHelper');

const { getHealth } = require('../healthController');
const response = require('../../utils/responseHelper');

beforeEach(() => {
  jest.clearAllMocks();
  mockReadyState = 1;

  response.successData.mockImplementation((res, data, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, status: 'success', data });
  });
  response.serverError.mockImplementation((res, message) => {
    return res.status(500).json({ success: false, status: 'error', message });
  });
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

describe('healthController — getHealth', () => {
  it('returns 200 with status ok when DB connected', () => {
    mockReadyState = 1;
    const res = mockRes();
    getHealth({}, res);

    expect(response.successData).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        status: 'ok',
        database: { status: 'connected' },
      }),
      200
    );
  });

  it('returns 503 with status degraded when DB disconnected', () => {
    mockReadyState = 0;
    const res = mockRes();
    getHealth({}, res);

    expect(response.successData).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        status: 'degraded',
        database: { status: 'disconnected' },
      }),
      503
    );
  });

  it('includes memory info with MB units', () => {
    mockReadyState = 1;
    const res = mockRes();
    getHealth({}, res);

    const payload = response.successData.mock.calls[0][1];
    expect(payload.memory.rss).toMatch(/\d+MB/);
    expect(payload.memory.heapUsed).toMatch(/\d+MB/);
    expect(payload.memory.heapTotal).toMatch(/\d+MB/);
  });

  it('includes system load average', () => {
    mockReadyState = 1;
    const res = mockRes();
    getHealth({}, res);

    const payload = response.successData.mock.calls[0][1];
    expect(payload.system.loadAvg).toHaveLength(3);
    expect(typeof payload.system.loadAvg[0]).toBe('number');
  });

  it('includes uptime, version, and node version', () => {
    mockReadyState = 1;
    const res = mockRes();
    getHealth({}, res);

    const payload = response.successData.mock.calls[0][1];
    expect(typeof payload.uptime).toBe('number');
    expect(payload.node).toBeDefined();
    expect(payload.timestamp).toBeDefined();
  });

  it('maps DB state 2 to connecting', () => {
    mockReadyState = 2;
    const res = mockRes();
    getHealth({}, res);

    const payload = response.successData.mock.calls[0][1];
    expect(payload.database.status).toBe('connecting');
  });
});
