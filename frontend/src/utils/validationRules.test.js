import {
  mustBeEven,
  mustBePositive,
  mustBeAtLeast,
  warnIfAbove,
  gpuIdsFormat,
  maskDiameterRules,
  vdamMiniBatchesRule,
  conditionalEven,
} from './validationRules';

describe('mustBeEven', () => {
  const rule = mustBeEven('boxSize', 'Box size');

  it('has correct field name', () => {
    expect(rule.field).toBe('boxSize');
  });

  it('returns null for even numbers', () => {
    expect(rule.validate(64)).toBeNull();
    expect(rule.validate(128)).toBeNull();
    expect(rule.validate(0)).toBeNull();
  });

  it('returns error for odd numbers', () => {
    const result = rule.validate(65);
    expect(result).toEqual({ level: 'error', message: 'Box size must be an even number' });
  });

  it.each([undefined, '', null])('returns null for empty value: %s', (v) => {
    expect(rule.validate(v)).toBeNull();
  });
});

describe('mustBePositive', () => {
  const rule = mustBePositive('angpix', 'Pixel size');

  it('returns null for positive numbers', () => {
    expect(rule.validate(1.4)).toBeNull();
    expect(rule.validate(0.85)).toBeNull();
  });

  it('returns error for zero', () => {
    const result = rule.validate(0);
    expect(result).toEqual({ level: 'error', message: 'Pixel size must be greater than 0' });
  });

  it('returns error for negative numbers', () => {
    const result = rule.validate(-5);
    expect(result).toEqual({ level: 'error', message: 'Pixel size must be greater than 0' });
  });

  it.each([undefined, '', null])('returns null for empty value: %s', (v) => {
    expect(rule.validate(v)).toBeNull();
  });
});

describe('mustBeAtLeast', () => {
  const rule = mustBeAtLeast('mpiProcs', 'MPI processes', 1);

  it('returns null when value meets minimum', () => {
    expect(rule.validate(1)).toBeNull();
    expect(rule.validate(10)).toBeNull();
  });

  it('returns error when value is below minimum', () => {
    const result = rule.validate(0);
    expect(result).toEqual({ level: 'error', message: 'MPI processes must be at least 1' });
  });

  it.each([undefined, '', null])('returns null for empty value: %s', (v) => {
    expect(rule.validate(v)).toBeNull();
  });
});

describe('warnIfAbove', () => {
  const rule = warnIfAbove('iterations', 'Iterations', 500);

  it('returns null when value is at or below max', () => {
    expect(rule.validate(500)).toBeNull();
    expect(rule.validate(200)).toBeNull();
  });

  it('returns warning when value exceeds max', () => {
    const result = rule.validate(501);
    expect(result).toEqual({ level: 'warning', message: 'Iterations seems very large (>500)' });
  });

  it.each([undefined, '', null])('returns null for empty value: %s', (v) => {
    expect(rule.validate(v)).toBeNull();
  });
});

describe('gpuIdsFormat', () => {
  const rule = gpuIdsFormat('gpuIds');

  it('returns null when GPU acceleration is not enabled', () => {
    expect(rule.validate('abc', { gpuAcceleration: 'No' })).toBeNull();
  });

  it('returns null for empty value', () => {
    expect(rule.validate('', { gpuAcceleration: 'Yes' })).toBeNull();
    expect(rule.validate(null, { gpuAcceleration: 'Yes' })).toBeNull();
  });

  it('returns null for valid GPU IDs', () => {
    expect(rule.validate('0', { gpuAcceleration: 'Yes' })).toBeNull();
    expect(rule.validate('0,1,2', { gpuAcceleration: 'Yes' })).toBeNull();
    expect(rule.validate('0, 1', { gpuAcceleration: 'Yes' })).toBeNull();
  });

  it('returns warning for invalid GPU IDs', () => {
    const result = rule.validate('gpu0', { gpuAcceleration: 'Yes' });
    expect(result.level).toBe('warning');
    expect(result.message).toMatch(/comma-separated numbers/);
  });
});

describe('maskDiameterRules', () => {
  const rules = maskDiameterRules();
  const rule = rules[0];

  it('returns an array with one rule for maskDiameter', () => {
    expect(rules).toHaveLength(1);
    expect(rule.field).toBe('maskDiameter');
  });

  it('returns null for valid diameter', () => {
    expect(rule.validate(200)).toBeNull();
  });

  it('returns error for zero', () => {
    const result = rule.validate(0);
    expect(result.level).toBe('error');
  });

  it('returns error for negative', () => {
    const result = rule.validate(-10);
    expect(result.level).toBe('error');
  });

  it('returns warning for diameter > 500', () => {
    const result = rule.validate(600);
    expect(result.level).toBe('warning');
    expect(result.message).toMatch(/500/);
  });

  it.each([undefined, '', null])('returns null for empty value: %s', (v) => {
    expect(rule.validate(v)).toBeNull();
  });
});

describe('vdamMiniBatchesRule', () => {
  const rule = vdamMiniBatchesRule();

  it('returns null when VDAM is not enabled', () => {
    expect(rule.validate(10, { useVDAM: 'No' })).toBeNull();
  });

  it('returns null for value in normal range', () => {
    expect(rule.validate(200, { useVDAM: 'Yes' })).toBeNull();
    expect(rule.validate(50, { useVDAM: 'Yes' })).toBeNull();
  });

  it('returns warning for value below 50', () => {
    const result = rule.validate(30, { useVDAM: 'Yes' });
    expect(result.level).toBe('warning');
    expect(result.message).toMatch(/below 50/);
  });

  it('returns warning for value above 1000', () => {
    const result = rule.validate(1500, { useVDAM: 'Yes' });
    expect(result.level).toBe('warning');
    expect(result.message).toMatch(/above 1000/);
  });

  it.each([undefined, '', null])('returns null for empty value: %s', (v) => {
    expect(rule.validate(v, { useVDAM: 'Yes' })).toBeNull();
  });
});

describe('conditionalEven', () => {
  const rule = conditionalEven('rescaledBox', 'Rescaled box', 'doRescale', 'Yes');

  it('returns null when condition is not met', () => {
    expect(rule.validate(65, { doRescale: 'No' })).toBeNull();
  });

  it('returns null for even number when condition is met', () => {
    expect(rule.validate(64, { doRescale: 'Yes' })).toBeNull();
  });

  it('returns error for odd number when condition is met', () => {
    const result = rule.validate(65, { doRescale: 'Yes' });
    expect(result).toEqual({ level: 'error', message: 'Rescaled box must be an even number' });
  });

  it.each([undefined, '', null])('returns null for empty value: %s', (v) => {
    expect(rule.validate(v, { doRescale: 'Yes' })).toBeNull();
  });
});
