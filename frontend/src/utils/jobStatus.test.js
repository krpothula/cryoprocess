import {
  JOB_STATUS,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  isActiveStatus,
  isTerminalStatus,
  getStatusColor,
  getStatusCssVar,
} from './jobStatus';

describe('JOB_STATUS constants', () => {
  it('has the five canonical statuses', () => {
    expect(JOB_STATUS.PENDING).toBe('pending');
    expect(JOB_STATUS.RUNNING).toBe('running');
    expect(JOB_STATUS.SUCCESS).toBe('success');
    expect(JOB_STATUS.FAILED).toBe('failed');
    expect(JOB_STATUS.CANCELLED).toBe('cancelled');
  });
});

describe('TERMINAL_STATUSES', () => {
  it('includes success, failed, cancelled', () => {
    expect(TERMINAL_STATUSES).toContain('success');
    expect(TERMINAL_STATUSES).toContain('failed');
    expect(TERMINAL_STATUSES).toContain('cancelled');
  });

  it('does not include active statuses', () => {
    expect(TERMINAL_STATUSES).not.toContain('pending');
    expect(TERMINAL_STATUSES).not.toContain('running');
  });
});

describe('ACTIVE_STATUSES', () => {
  it('includes pending and running', () => {
    expect(ACTIVE_STATUSES).toContain('pending');
    expect(ACTIVE_STATUSES).toContain('running');
  });

  it('does not include terminal statuses', () => {
    expect(ACTIVE_STATUSES).not.toContain('success');
    expect(ACTIVE_STATUSES).not.toContain('failed');
    expect(ACTIVE_STATUSES).not.toContain('cancelled');
  });
});

describe('isActiveStatus', () => {
  it('returns true for pending', () => {
    expect(isActiveStatus('pending')).toBe(true);
  });

  it('returns true for running', () => {
    expect(isActiveStatus('running')).toBe(true);
  });

  it.each(['success', 'failed', 'cancelled', 'unknown', undefined, null])(
    'returns false for %s',
    (status) => {
      expect(isActiveStatus(status)).toBe(false);
    }
  );
});

describe('isTerminalStatus', () => {
  it.each(['success', 'failed', 'cancelled'])(
    'returns true for %s',
    (status) => {
      expect(isTerminalStatus(status)).toBe(true);
    }
  );

  it.each(['pending', 'running', 'unknown', undefined, null])(
    'returns false for %s',
    (status) => {
      expect(isTerminalStatus(status)).toBe(false);
    }
  );
});

describe('getStatusColor', () => {
  it('returns green for success', () => {
    expect(getStatusColor('success')).toBe('#10b981');
  });

  it('returns amber for running', () => {
    expect(getStatusColor('running')).toBe('#f59e0b');
  });

  it('returns amber for pending', () => {
    expect(getStatusColor('pending')).toBe('#f59e0b');
  });

  it('returns red for failed', () => {
    expect(getStatusColor('failed')).toBe('#ef4444');
  });

  it('returns gray for cancelled', () => {
    expect(getStatusColor('cancelled')).toBe('#94a3b8');
  });

  it('returns gray for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('#94a3b8');
  });
});

describe('getStatusCssVar', () => {
  it('returns --color-success for success', () => {
    expect(getStatusCssVar('success')).toBe('var(--color-success)');
  });

  it('returns --color-warning for running', () => {
    expect(getStatusCssVar('running')).toBe('var(--color-warning)');
  });

  it('returns --color-warning for pending', () => {
    expect(getStatusCssVar('pending')).toBe('var(--color-warning)');
  });

  it('returns --color-danger for failed', () => {
    expect(getStatusCssVar('failed')).toBe('var(--color-danger)');
  });

  it('returns --color-text-muted for cancelled', () => {
    expect(getStatusCssVar('cancelled')).toBe('var(--color-text-muted)');
  });

  it('returns --color-text-muted for unknown status', () => {
    expect(getStatusCssVar('unknown')).toBe('var(--color-text-muted)');
  });
});
