const {
  JOB_DEFINITIONS,
  JOB_BUILDERS,
  JOB_VALIDATORS,
  STAGE_NAMES,
  ALIAS_TO_CANONICAL,
  getJobDefinition,
  getBuilder,
  getValidator,
  getStageName,
  isValidJobType,
  getAllJobTypes,
  getCanonicalJobTypes,
  genericValidator
} = require('../jobRegistry');

describe('jobRegistry — JOB_DEFINITIONS', () => {
  it('has 22 canonical job types', () => {
    expect(Object.keys(JOB_DEFINITIONS)).toHaveLength(22);
  });

  it('every definition has builder, validator, stageName, aliases, computeTier', () => {
    for (const [key, def] of Object.entries(JOB_DEFINITIONS)) {
      expect(def.builder).toBeDefined();
      expect(typeof def.validator).toBe('function');
      expect(typeof def.stageName).toBe('string');
      expect(Array.isArray(def.aliases)).toBe(true);
      expect(def.aliases.length).toBeGreaterThan(0);
      expect(['mpi', 'gpu', 'local']).toContain(def.computeTier);
    }
  });

  it('every canonical key appears in its own aliases', () => {
    for (const [key, def] of Object.entries(JOB_DEFINITIONS)) {
      expect(def.aliases).toContain(key);
    }
  });
});

describe('jobRegistry — alias resolution', () => {
  it.each([
    ['class_2d', 'class_2d'],
    ['class2d', 'class_2d'],
    ['classification_2d', 'class_2d'],
    ['class_3d', 'class_3d'],
    ['class3d', 'class_3d'],
    ['classification_3d', 'class_3d'],
    ['auto_refine', 'auto_refine'],
    ['autorefine', 'auto_refine'],
    ['refine3d', 'auto_refine'],
    ['ctf_estimation', 'ctf_estimation'],
    ['ctf', 'ctf_estimation'],
    ['auto_picking', 'auto_picking'],
    ['autopick', 'auto_picking'],
    ['import', 'import'],
    ['motion_correction', 'motion_correction'],
    ['motioncorr', 'motion_correction'],
  ])('alias "%s" resolves to canonical "%s"', (alias, canonical) => {
    expect(ALIAS_TO_CANONICAL[alias]).toBe(canonical);
  });
});

describe('jobRegistry — getJobDefinition', () => {
  it('returns definition for valid type', () => {
    const def = getJobDefinition('import');
    expect(def).toBeDefined();
    expect(def.stageName).toBe('Import');
  });

  it('returns definition for alias', () => {
    const def = getJobDefinition('class2d');
    expect(def).toBeDefined();
    expect(def.stageName).toBe('Class2D');
  });

  it('returns null for unknown type', () => {
    expect(getJobDefinition('nonexistent')).toBeNull();
  });
});

describe('jobRegistry — getBuilder', () => {
  it('returns builder class for valid type', () => {
    const Builder = getBuilder('import');
    expect(Builder).toBeDefined();
    expect(typeof Builder).toBe('function');
  });

  it('returns same builder for alias', () => {
    expect(getBuilder('class_2d')).toBe(getBuilder('class2d'));
    expect(getBuilder('class_2d')).toBe(getBuilder('classification_2d'));
  });

  it('returns null for unknown type', () => {
    expect(getBuilder('nonexistent')).toBeNull();
  });
});

describe('jobRegistry — getValidator', () => {
  it('returns specific validator for import', () => {
    const validator = getValidator('import');
    expect(validator).toBeDefined();
    expect(validator).not.toBe(genericValidator);
  });

  it('returns genericValidator for other types', () => {
    expect(getValidator('motion_correction')).toBe(genericValidator);
    expect(getValidator('ctf')).toBe(genericValidator);
  });

  it('returns null for unknown type', () => {
    expect(getValidator('nonexistent')).toBeNull();
  });
});

describe('jobRegistry — getStageName', () => {
  it.each([
    ['import', 'Import'],
    ['motion_correction', 'MotionCorr'],
    ['ctf', 'CtfFind'],
    ['auto_picking', 'AutoPick'],
    ['class_2d', 'Class2D'],
    ['class_3d', 'Class3D'],
    ['initial_model', 'InitialModel'],
    ['auto_refine', 'AutoRefine'],
    ['postprocess', 'PostProcess'],
    ['polish', 'Polish'],
    ['ctf_refine', 'CtfRefine'],
    ['mask_create', 'MaskCreate'],
    ['dynamight', 'Dynamight'],
    ['model_angelo', 'ModelAngelo'],
  ])('type "%s" → stageName "%s"', (type, expected) => {
    expect(getStageName(type)).toBe(expected);
  });

  it('returns null for unknown type', () => {
    expect(getStageName('nonexistent')).toBeNull();
  });
});

describe('jobRegistry — isValidJobType', () => {
  it('returns true for canonical types', () => {
    expect(isValidJobType('import')).toBe(true);
    expect(isValidJobType('class_2d')).toBe(true);
  });

  it('returns true for aliases', () => {
    expect(isValidJobType('class2d')).toBe(true);
    expect(isValidJobType('ctf')).toBe(true);
  });

  it('returns false for unknown types', () => {
    expect(isValidJobType('nonexistent')).toBe(false);
    expect(isValidJobType('')).toBe(false);
  });
});

describe('jobRegistry — getAllJobTypes', () => {
  it('returns array of all aliases', () => {
    const all = getAllJobTypes();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(21);
    expect(all).toContain('import');
    expect(all).toContain('class2d');
    expect(all).toContain('classification_2d');
  });
});

describe('jobRegistry — getCanonicalJobTypes', () => {
  it('returns only canonical keys (22)', () => {
    const canonical = getCanonicalJobTypes();
    expect(canonical).toHaveLength(22);
    expect(canonical).toContain('import');
    expect(canonical).toContain('class_2d');
    expect(canonical).not.toContain('class2d');
  });
});

describe('jobRegistry — genericValidator', () => {
  it('passes data through with no error', () => {
    const data = { foo: 'bar', num: 42 };
    const result = genericValidator(data);
    expect(result.value).toEqual(data);
    expect(result.error).toBeNull();
  });
});
