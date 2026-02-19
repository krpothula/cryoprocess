import { transformApiResponseToTree } from './tree';

// We need to mock the jobStatus module since tree.js imports getStatusColor from it
jest.mock('./jobStatus', () => ({
  getStatusColor: (status) => {
    const colors = {
      success: '#10b981',
      running: '#f59e0b',
      pending: '#f59e0b',
      failed: '#ef4444',
      cancelled: '#94a3b8',
    };
    return colors[status] || '#94a3b8';
  },
}));

describe('transformApiResponseToTree — empty/invalid input', () => {
  it('returns "No Data" root for null input', () => {
    const result = transformApiResponseToTree(null);
    expect(result.id).toBe('root');
    expect(result.label).toBe('No Data');
    expect(result.children).toEqual([]);
  });

  it('returns "No Data" root for undefined input', () => {
    const result = transformApiResponseToTree(undefined);
    expect(result.label).toBe('No Data');
  });

  it('returns "No Data" root when data is not an array', () => {
    const result = transformApiResponseToTree({ data: 'not-an-array' });
    expect(result.label).toBe('No Data');
  });

  it('returns empty children for empty data array', () => {
    const result = transformApiResponseToTree({ data: [] });
    expect(result.id).toBe('root');
    expect(result.label).toBe('Pipeline');
    expect(result.children).toEqual([]);
  });
});

describe('transformApiResponseToTree — node building', () => {
  it('builds a single root job node', () => {
    const api = {
      data: [{
        id: 'job001',
        jobName: 'Import Movies',
        jobType: 'Import',
        status: 'success',
        parentId: '',
        children: [],
      }],
    };
    const tree = transformApiResponseToTree(api);
    expect(tree.children).toHaveLength(1);
    const node = tree.children[0];
    expect(node.id).toBe('job001');
    expect(node.label).toBe('Import Movies');
    expect(node.jobType).toBe('Import');
    expect(node.status).toBe('success');
    expect(node.statusColor).toBe('#10b981');
  });

  it('builds nested children recursively', () => {
    const api = {
      data: [{
        id: 'job001',
        jobName: 'Import',
        jobType: 'Import',
        status: 'success',
        parentId: '',
        children: [{
          id: 'job002',
          jobName: 'MotionCorr',
          jobType: 'MotionCorr',
          status: 'running',
          children: [{
            id: 'job003',
            jobName: 'CtfFind',
            jobType: 'CtfFind',
            status: 'pending',
            children: [],
          }],
        }],
      }],
    };
    const tree = transformApiResponseToTree(api);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].children).toHaveLength(1);
    expect(tree.children[0].children[0].children[0].label).toBe('CtfFind');
  });

  it('filters out nodes with no id', () => {
    const api = {
      data: [{
        id: 'job001',
        jobName: 'Import',
        jobType: 'Import',
        status: 'success',
        parentId: '',
        children: [{ jobName: 'Bad Node' }],
      }],
    };
    const tree = transformApiResponseToTree(api);
    expect(tree.children[0].children).toHaveLength(0);
  });

  it('only includes root nodes (parentId === "")', () => {
    const api = {
      data: [
        { id: 'job001', jobName: 'Root', jobType: 'Import', status: 'success', parentId: '', children: [] },
        { id: 'job002', jobName: 'Child', jobType: 'MotionCorr', status: 'running', parentId: 'job001', children: [] },
      ],
    };
    const tree = transformApiResponseToTree(api);
    // Only the root node (parentId === '') should be in children
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].id).toBe('job001');
  });

  it('defaults label to "Unnamed" when jobName is missing', () => {
    const api = {
      data: [{
        id: 'job001',
        jobType: 'Import',
        status: 'success',
        parentId: '',
        children: [],
      }],
    };
    const tree = transformApiResponseToTree(api);
    expect(tree.children[0].label).toBe('Unnamed');
  });
});

describe('transformApiResponseToTree — job type colors', () => {
  const makeJob = (jobType) => ({
    data: [{
      id: 'j1',
      jobName: 'Test',
      jobType,
      status: 'success',
      parentId: '',
      children: [],
    }],
  });

  it.each([
    ['Import', '#93c5fd'],
    ['MotionCorr', '#3b82f6'],
    ['CtfFind', '#1d4ed8'],
    ['AutoPick', '#c4b5fd'],
    ['Extract', '#8b5cf6'],
    ['Class2D', '#6d28d9'],
    ['Class3D', '#67e8f9'],
    ['AutoRefine', '#06b6d4'],
    ['Polish', '#5eead4'],
    ['PostProcess', '#14b8a6'],
    ['MaskCreate', '#0f766e'],
    ['LocalRes', '#0e7490'],
    ['ModelAngelo', '#e879f9'],
    ['Dynamight', '#a21caf'],
    ['Subtract', '#94a3b8'],
    ['JoinStar', '#475569'],
  ])('assigns correct color for %s', (jobType, expectedBg) => {
    const tree = transformApiResponseToTree(makeJob(jobType));
    expect(tree.children[0].style.backgroundColor).toBe(expectedBg);
  });

  it('assigns default color for unknown job type', () => {
    const tree = transformApiResponseToTree(makeJob('UnknownType'));
    expect(tree.children[0].style.backgroundColor).toBe('#64748b');
  });

  it('assigns default color for null job type', () => {
    const api = {
      data: [{
        id: 'j1',
        jobName: 'Test',
        status: 'success',
        parentId: '',
        children: [],
      }],
    };
    const tree = transformApiResponseToTree(api);
    expect(tree.children[0].style.backgroundColor).toBe('#64748b');
  });
});

describe('transformApiResponseToTree — root node style', () => {
  it('root uses CSS variables for theming', () => {
    const tree = transformApiResponseToTree({ data: [] });
    expect(tree.style.backgroundColor).toBe('var(--color-text)');
    expect(tree.style.borderColor).toBe('var(--color-text-heading)');
  });
});
