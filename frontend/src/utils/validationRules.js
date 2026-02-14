/**
 * Reusable validation rule factories for RELION job forms.
 * Each factory returns { field, validate(value, formData) => { level, message } | null }
 */

export const mustBeEven = (field, label) => ({
  field,
  validate: (v) => {
    if (v === undefined || v === '' || v === null) return null;
    return Number(v) % 2 !== 0
      ? { level: 'error', message: `${label} must be an even number` }
      : null;
  },
});

export const mustBePositive = (field, label) => ({
  field,
  validate: (v) => {
    if (v === undefined || v === '' || v === null) return null;
    return Number(v) <= 0
      ? { level: 'error', message: `${label} must be greater than 0` }
      : null;
  },
});

export const mustBeAtLeast = (field, label, min) => ({
  field,
  validate: (v) => {
    if (v === undefined || v === '' || v === null) return null;
    return Number(v) < min
      ? { level: 'error', message: `${label} must be at least ${min}` }
      : null;
  },
});

export const warnIfAbove = (field, label, max) => ({
  field,
  validate: (v) => {
    if (v === undefined || v === '' || v === null) return null;
    return Number(v) > max
      ? { level: 'warning', message: `${label} seems very large (>${max})` }
      : null;
  },
});

export const gpuIdsFormat = (field) => ({
  field,
  validate: (v, formData) => {
    if (!v || v === '') return null;
    const gpuEnabled = formData.gpuAcceleration === 'Yes';
    if (!gpuEnabled) return null;
    return !/^[\d,\s]*$/.test(String(v))
      ? { level: 'warning', message: 'GPU IDs should be comma-separated numbers (e.g., 0,1,2)' }
      : null;
  },
});

export const maskDiameterRules = () => [
  {
    field: 'maskDiameter',
    validate: (v) => {
      if (v === undefined || v === '' || v === null) return null;
      if (Number(v) <= 0) return { level: 'error', message: 'Mask diameter must be greater than 0' };
      if (Number(v) > 500) return { level: 'warning', message: 'Mask diameter >500 A is unusual. Verify this matches your particle size.' };
      return null;
    },
  },
];

export const vdamMiniBatchesRule = () => ({
  field: 'vdamMiniBatches',
  validate: (v, formData) => {
    if (formData.useVDAM !== 'Yes') return null;
    if (v === undefined || v === '' || v === null) return null;
    const n = Number(v);
    if (n < 50) return { level: 'warning', message: 'Mini-batches below 50 may not converge' };
    if (n > 1000) return { level: 'warning', message: 'Mini-batches above 1000 is unusual' };
    return null;
  },
});

export const conditionalEven = (field, label, conditionField, conditionValue) => ({
  field,
  validate: (v, formData) => {
    if (formData[conditionField] !== conditionValue) return null;
    if (v === undefined || v === '' || v === null) return null;
    return Number(v) % 2 !== 0
      ? { level: 'error', message: `${label} must be an even number` }
      : null;
  },
});
