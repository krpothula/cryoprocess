const { validateImportJob, NODE_TYPES } = require('../importSchema');

const VALID_DATA = {
  projectId: 'proj_001',
  inputFiles: '/data/movies/*.tiff',
};

describe('importSchema — valid input', () => {
  it('passes with minimal required fields', () => {
    const { value, error } = validateImportJob(VALID_DATA);
    expect(error).toBeNull();
    expect(value.projectId).toBe('proj_001');
    expect(value.inputFiles).toBe('/data/movies/*.tiff');
  });

  it('applies default values', () => {
    const { value } = validateImportJob(VALID_DATA);
    expect(value.angpix).toBe(1.4);
    expect(value.kV).toBe(300);
    expect(value.spherical).toBe(2.7);
    expect(value.amplitudeContrast).toBe(0.1);
    expect(value.executionMethod).toBe('slurm');
    expect(value.systemType).toBe('local');
    expect(value.mpiProcs).toBe(1);
    expect(value.numberOfThreads).toBe(1);
  });

  it('accepts custom microscope settings', () => {
    const { value, error } = validateImportJob({
      ...VALID_DATA,
      angpix: 0.85,
      kV: 200,
      spherical: 2.0,
      amplitudeContrast: 0.07,
    });
    expect(error).toBeNull();
    expect(value.angpix).toBe(0.85);
    expect(value.kV).toBe(200);
  });

  it('allows unknown fields (allowUnknown: true)', () => {
    const { error } = validateImportJob({
      ...VALID_DATA,
      customField: 'value',
    });
    expect(error).toBeNull();
  });
});

describe('importSchema — required fields', () => {
  it('fails without projectId', () => {
    const { error } = validateImportJob({ inputFiles: '/data/*.tiff' });
    expect(error).not.toBeNull();
    expect(error.details.some(d => d.field === 'projectId')).toBe(true);
  });

  it('fails without inputFiles for standard import', () => {
    const { error } = validateImportJob({ projectId: 'proj_001' });
    expect(error).not.toBeNull();
    expect(error.details.some(d => d.message.includes('custom validation'))).toBe(true);
  });
});

describe('importSchema — other node type import', () => {
  it('passes when nodeType=Yes with otherInputFile and otherNodeType', () => {
    const { error } = validateImportJob({
      projectId: 'proj_001',
      nodeType: 'Yes',
      otherInputFile: '/data/coords.star',
      otherNodeType: 'Particle coordinates',
    });
    expect(error).toBeNull();
  });

  it('fails when nodeType=Yes without otherInputFile', () => {
    const { error } = validateImportJob({
      projectId: 'proj_001',
      nodeType: 'Yes',
      otherNodeType: 'Particle coordinates',
    });
    expect(error).not.toBeNull();
    expect(error.details.some(d => d.message.includes('custom validation'))).toBe(true);
  });

  it('fails when nodeType=Yes without otherNodeType', () => {
    const { error } = validateImportJob({
      projectId: 'proj_001',
      nodeType: 'Yes',
      otherInputFile: '/data/coords.star',
    });
    expect(error).not.toBeNull();
    expect(error.details.some(d => d.message.includes('custom validation'))).toBe(true);
  });
});

describe('importSchema — yesNoBool conversion', () => {
  it('accepts "Yes" string value', () => {
    const { value, error } = validateImportJob({ ...VALID_DATA, rawMovies: 'Yes' });
    expect(error).toBeNull();
    // Joi alternatives passes the matched string through
    expect(['Yes', true]).toContain(value.rawMovies);
  });

  it('accepts "No" string value', () => {
    const { value, error } = validateImportJob({ ...VALID_DATA, rawMovies: 'No' });
    expect(error).toBeNull();
    expect(['No', false]).toContain(value.rawMovies);
  });

  it('accepts boolean true directly', () => {
    const { value } = validateImportJob({ ...VALID_DATA, rawMovies: true });
    expect(value.rawMovies).toBe(true);
  });

  it('defaults yesNoBool to false', () => {
    const { value } = validateImportJob(VALID_DATA);
    expect(value.rawMovies).toBe(false);
    expect(value.multiFrameMovies).toBe(false);
  });
});

describe('importSchema — execution settings', () => {
  it('accepts valid executionMethod', () => {
    const { error } = validateImportJob({ ...VALID_DATA, executionMethod: 'direct' });
    expect(error).toBeNull();
  });

  it('rejects invalid executionMethod', () => {
    const { error } = validateImportJob({ ...VALID_DATA, executionMethod: 'kubernetes' });
    expect(error).not.toBeNull();
  });

  it('accepts valid systemType', () => {
    const { error } = validateImportJob({ ...VALID_DATA, systemType: 'remote' });
    expect(error).toBeNull();
  });
});

describe('importSchema — NODE_TYPES', () => {
  it('contains expected node type mappings', () => {
    expect(NODE_TYPES['Particle coordinates']).toBe('coords');
    expect(NODE_TYPES['3D reference']).toBe('ref3d');
    expect(NODE_TYPES['3D mask']).toBe('mask');
  });
});
