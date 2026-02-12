// Manual Jest mock for logger — prevents Winston from creating log files during tests
const noop = () => {};

const logger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  job: { start: noop, step: noop, success: noop, error: noop, params: noop, command: noop },
  api: { request: noop, response: noop, error: noop },
  slurm: { submit: noop, statusChange: noop, query: noop },
  project: { start: noop, step: noop, info: noop, warn: noop, command: noop, success: noop, error: noop },
};

module.exports = logger;
