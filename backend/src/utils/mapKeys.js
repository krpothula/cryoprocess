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

function camelToSnake(str) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
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

/**
 * Recursively convert all camelCase object keys to snake_case.
 * Used at the API boundary to transform incoming camelCase request data
 * into snake_case for MongoDB storage.
 */
function mapKeysToSnake(obj) {
  if (Array.isArray(obj)) return obj.map(mapKeysToSnake);
  if (obj && typeof obj === 'object' && !(obj instanceof Date) && !Buffer.isBuffer(obj)) {
    return Object.fromEntries(
      Object.entries(obj)
        .map(([k, v]) => [camelToSnake(k), mapKeysToSnake(v)])
    );
  }
  return obj;
}

module.exports = { snakeToCamel, camelToSnake, mapKeys, mapKeysToSnake };
