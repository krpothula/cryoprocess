/**
 * Shared pagination parser.
 *
 * Extracts page/limit/skip (or offset/limit) from Express query params
 * with safe defaults and bounds clamping.
 *
 * @param {Object} query - req.query
 * @param {Object} [opts]
 * @param {number} [opts.defaultLimit=50]
 * @param {number} [opts.maxLimit=500]
 * @returns {{ page: number, limit: number, skip: number }}
 */
function parsePagination(query, { defaultLimit = 50, maxLimit = 500 } = {}) {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit) || defaultLimit, 1), maxLimit);
  const skip = query.skip !== undefined
    ? Math.max(parseInt(query.skip) || 0, 0)
    : (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { parsePagination };
