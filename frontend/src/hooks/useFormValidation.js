import { useMemo } from 'react';

/**
 * useFormValidation - Runs validation rules against form data.
 *
 * @param {Object} formData - The current form state
 * @param {Array} rules - Array of { field, validate(value, formData) => { level, message } | null }
 * @returns {{ getFieldStatus, hasErrors, errorCount, warningCount }}
 */
export function useFormValidation(formData, rules) {
  const results = useMemo(() => {
    const statuses = {};

    for (const rule of rules) {
      const value = formData[rule.field];
      const result = rule.validate(value, formData);
      if (result) {
        // Keep the highest severity per field (error > warning)
        const existing = statuses[rule.field];
        if (!existing || (result.level === 'error' && existing.level === 'warning')) {
          statuses[rule.field] = result;
        }
      }
    }

    let errorCount = 0;
    let warningCount = 0;
    for (const status of Object.values(statuses)) {
      if (status.level === 'error') errorCount++;
      else if (status.level === 'warning') warningCount++;
    }

    return { statuses, errorCount, warningCount };
  }, [formData, rules]);

  const getFieldStatus = (field) => results.statuses[field] || null;

  return {
    getFieldStatus,
    hasErrors: results.errorCount > 0,
    errorCount: results.errorCount,
    warningCount: results.warningCount,
  };
}
