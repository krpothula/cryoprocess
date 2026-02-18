/**
 * Recursively convert all snake_case object keys to camelCase.
 * Used at the API boundary to transform DB (.lean()) documents
 * into camelCase JSON responses.
 *
 * - Arrays are recursed element-by-element
 * - Keys starting with '_' (e.g. _id, __v) are dropped
 * - Date and Buffer values are left untouched
 */

function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function mapKeys(obj) {
  if (Array.isArray(obj)) return obj.map(mapKeys);
  if (obj && typeof obj === 'object' && !(obj instanceof Date) && !Buffer.isBuffer(obj)) {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => [snakeToCamel(k), mapKeys(v)])
    );
  }
  return obj;
}

module.exports = { snakeToCamel, mapKeys };
