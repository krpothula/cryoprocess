jest.mock('../logger');

const {
  sanitizePartition,
  sanitizeUsername,
  sanitizeSlurmJobId,
  sanitizeGpuIds,
  escapeShellArg,
  isPathSafe,
  isValidEmail,
  validatePassword
} = require('../security');

// ── sanitizePartition ──────────────────────────────────────────────

describe('sanitizePartition', () => {
  it('accepts valid partition names', () => {
    expect(sanitizePartition('gpu')).toBe('gpu');
    expect(sanitizePartition('gpu-short')).toBe('gpu-short');
    expect(sanitizePartition('batch_01')).toBe('batch_01');
  });

  it('trims whitespace', () => {
    expect(sanitizePartition('  gpu  ')).toBe('gpu');
  });

  it('rejects names with special characters', () => {
    expect(sanitizePartition('gpu;rm -rf /')).toBeNull();
    expect(sanitizePartition('part name')).toBeNull();
    expect(sanitizePartition('part$var')).toBeNull();
  });

  it('rejects names longer than 64 chars', () => {
    expect(sanitizePartition('a'.repeat(65))).toBeNull();
    expect(sanitizePartition('a'.repeat(64))).toBe('a'.repeat(64));
  });

  it('returns null for empty/falsy input', () => {
    expect(sanitizePartition('')).toBeNull();
    expect(sanitizePartition(null)).toBeNull();
    expect(sanitizePartition(undefined)).toBeNull();
    expect(sanitizePartition(123)).toBeNull();
  });
});

// ── sanitizeUsername ───────────────────────────────────────────────

describe('sanitizeUsername', () => {
  it('accepts valid UNIX usernames', () => {
    expect(sanitizeUsername('john')).toBe('john');
    expect(sanitizeUsername('john.doe')).toBe('john.doe');
    expect(sanitizeUsername('user-01')).toBe('user-01');
    expect(sanitizeUsername('user_name')).toBe('user_name');
  });

  it('rejects usernames with spaces or special chars', () => {
    expect(sanitizeUsername('john doe')).toBeNull();
    expect(sanitizeUsername('user;whoami')).toBeNull();
  });

  it('rejects names longer than 64 chars', () => {
    expect(sanitizeUsername('a'.repeat(65))).toBeNull();
  });

  it('returns null for falsy input', () => {
    expect(sanitizeUsername('')).toBeNull();
    expect(sanitizeUsername(null)).toBeNull();
  });
});

// ── sanitizeSlurmJobId ────────────────────────────────────────────

describe('sanitizeSlurmJobId', () => {
  it('accepts numeric job IDs', () => {
    expect(sanitizeSlurmJobId('12345')).toBe('12345');
    expect(sanitizeSlurmJobId(12345)).toBe('12345');
  });

  it('accepts array job IDs (underscore separator)', () => {
    expect(sanitizeSlurmJobId('12345_1')).toBe('12345_1');
  });

  it('rejects non-numeric IDs', () => {
    expect(sanitizeSlurmJobId('abc')).toBeNull();
    expect(sanitizeSlurmJobId('123;whoami')).toBeNull();
  });

  it('rejects IDs longer than 20 chars', () => {
    expect(sanitizeSlurmJobId('1'.repeat(21))).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(sanitizeSlurmJobId(null)).toBeNull();
    expect(sanitizeSlurmJobId(undefined)).toBeNull();
  });
});

// ── sanitizeGpuIds ────────────────────────────────────────────────

describe('sanitizeGpuIds', () => {
  it('accepts valid GPU ID strings', () => {
    expect(sanitizeGpuIds('0')).toBe('0');
    expect(sanitizeGpuIds('0,1,2')).toBe('0,1,2');
    expect(sanitizeGpuIds('0:1')).toBe('0:1');
  });

  it('rejects non-numeric GPU IDs', () => {
    expect(sanitizeGpuIds('abc')).toBeNull();
    expect(sanitizeGpuIds('0;whoami')).toBeNull();
  });

  it('returns null for falsy input', () => {
    expect(sanitizeGpuIds('')).toBeNull();
    expect(sanitizeGpuIds(null)).toBeNull();
  });
});

// ── escapeShellArg ────────────────────────────────────────────────

describe('escapeShellArg', () => {
  it('wraps string in single quotes', () => {
    expect(escapeShellArg('hello')).toBe("'hello'");
  });

  it('escapes single quotes within string', () => {
    expect(escapeShellArg("it's")).toBe("'it'\\''s'");
  });

  it('returns empty string for falsy input', () => {
    expect(escapeShellArg('')).toBe('');
    expect(escapeShellArg(null)).toBe('');
  });
});

// ── isPathSafe ────────────────────────────────────────────────────

describe('isPathSafe', () => {
  it('accepts clean paths', () => {
    expect(isPathSafe('/home/user/data/file.mrc')).toBe(true);
    expect(isPathSafe('/data/projects/my-project')).toBe(true);
  });

  it('rejects paths with shell metacharacters', () => {
    expect(isPathSafe('/tmp/file;rm -rf /')).toBe(false);
    expect(isPathSafe('/tmp/$(whoami)')).toBe(false);
    expect(isPathSafe('/tmp/file`ls`')).toBe(false);
    expect(isPathSafe('/tmp/file|cat')).toBe(false);
  });

  it('rejects paths with null bytes', () => {
    expect(isPathSafe('/tmp/file\0.txt')).toBe(false);
  });

  it('returns false for falsy input', () => {
    expect(isPathSafe('')).toBe(false);
    expect(isPathSafe(null)).toBe(false);
  });
});

// ── isValidEmail ──────────────────────────────────────────────────

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
  });

  it('rejects emails longer than 254 chars', () => {
    const long = 'a'.repeat(245) + '@test.com'; // 254 chars
    expect(isValidEmail(long)).toBe(true);
    const tooLong = 'a'.repeat(246) + '@test.com'; // 255 chars
    expect(isValidEmail(tooLong)).toBe(false);
  });

  it('returns false for falsy input', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

// ── validatePassword ──────────────────────────────────────────────

describe('validatePassword', () => {
  it('accepts passwords >= 8 chars', () => {
    const result = validatePassword('MyPass12');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects passwords < 8 chars', () => {
    const result = validatePassword('short');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('at least 8');
  });

  it('rejects passwords > 128 chars', () => {
    const result = validatePassword('a'.repeat(129));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('less than 128');
  });

  it('returns error for falsy input', () => {
    expect(validatePassword('').valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
  });
});
