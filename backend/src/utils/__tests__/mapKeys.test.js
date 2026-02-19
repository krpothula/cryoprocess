const { snakeToCamel, camelToSnake, mapKeys, mapKeysToSnake } = require('../mapKeys');

describe('snakeToCamel', () => {
  it('converts basic snake_case', () => {
    expect(snakeToCamel('project_name')).toBe('projectName');
  });

  it('handles multiple underscores', () => {
    expect(snakeToCamel('is_super_user')).toBe('isSuperUser');
  });

  it('handles numbers', () => {
    expect(snakeToCamel('class_2d')).toBe('class2d');
  });

  it('passes through already camelCase', () => {
    expect(snakeToCamel('projectName')).toBe('projectName');
  });

  it('handles single word', () => {
    expect(snakeToCamel('name')).toBe('name');
  });
});

describe('camelToSnake', () => {
  it('converts basic camelCase', () => {
    expect(camelToSnake('projectName')).toBe('project_name');
  });

  it('handles consecutive capitals', () => {
    expect(camelToSnake('getHTTPResponse')).toBe('get_h_t_t_p_response');
  });

  it('passes through already snake_case', () => {
    expect(camelToSnake('project_name')).toBe('project_name');
  });

  it('handles single word', () => {
    expect(camelToSnake('name')).toBe('name');
  });
});

describe('mapKeys — snake_case to camelCase', () => {
  it('converts flat object keys', () => {
    const result = mapKeys({ project_name: 'Test', is_staff: true });
    expect(result).toEqual({ projectName: 'Test', isStaff: true });
  });

  it('converts nested objects', () => {
    const result = mapKeys({
      user_data: { first_name: 'John', last_name: 'Doe' }
    });
    expect(result).toEqual({
      userData: { firstName: 'John', lastName: 'Doe' }
    });
  });

  it('converts arrays of objects', () => {
    const result = mapKeys([
      { project_name: 'A' },
      { project_name: 'B' }
    ]);
    expect(result).toEqual([
      { projectName: 'A' },
      { projectName: 'B' }
    ]);
  });

  it('drops keys starting with _', () => {
    const result = mapKeys({ _id: '123', __v: 0, name: 'test' });
    expect(result).toEqual({ name: 'test' });
    expect(result._id).toBeUndefined();
    expect(result.__v).toBeUndefined();
  });

  it('preserves Date values', () => {
    const date = new Date('2025-01-01');
    const result = mapKeys({ created_at: date });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt).toBe(date);
  });

  it('preserves Buffer values', () => {
    const buf = Buffer.from('test');
    const result = mapKeys({ data_buf: buf });
    expect(Buffer.isBuffer(result.dataBuf)).toBe(true);
  });

  it('handles null and primitives', () => {
    expect(mapKeys(null)).toBeNull();
    expect(mapKeys(42)).toBe(42);
    expect(mapKeys('string')).toBe('string');
  });
});

describe('mapKeysToSnake — camelCase to snake_case', () => {
  it('converts flat object keys', () => {
    const result = mapKeysToSnake({ projectName: 'Test', isStaff: true });
    expect(result).toEqual({ project_name: 'Test', is_staff: true });
  });

  it('converts nested objects', () => {
    const result = mapKeysToSnake({
      userData: { firstName: 'John' }
    });
    expect(result).toEqual({
      user_data: { first_name: 'John' }
    });
  });

  it('converts arrays of objects', () => {
    const result = mapKeysToSnake([{ projectName: 'A' }]);
    expect(result).toEqual([{ project_name: 'A' }]);
  });

  it('preserves Date and Buffer values', () => {
    const date = new Date();
    const buf = Buffer.from('test');
    const result = mapKeysToSnake({ createdAt: date, dataBuf: buf });
    expect(result.created_at).toBe(date);
    expect(result.data_buf).toBe(buf);
  });

  it('handles null and primitives', () => {
    expect(mapKeysToSnake(null)).toBeNull();
    expect(mapKeysToSnake(42)).toBe(42);
  });
});
