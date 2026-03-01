'use strict';

/**
 * Calculates the SQL offset and sanitized limit for paginated queries.
 *
 * @param {number} page - Current page number (1-based, defaults to 1)
 * @param {number} limit - Number of records per page (defaults to 20, max 100)
 * @returns {{ offset: number, limit: number }}
 */
const getPagination = (page = 1, limit = 20) => {
  const sanitizedPage = Math.max(1, Math.floor(Number(page) || 1));
  const sanitizedLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));

  const offset = (sanitizedPage - 1) * sanitizedLimit;

  return {
    offset,
    limit: sanitizedLimit,
  };
};

/**
 * Builds a pagination metadata object for inclusion in API responses.
 *
 * @param {number} total - Total number of records matching the query
 * @param {number} page - Current page number (1-based, defaults to 1)
 * @param {number} limit - Number of records per page (defaults to 20)
 * @returns {{ page: number, limit: number, total: number, totalPages: number }}
 */
const getPaginationMeta = (total, page = 1, limit = 20) => {
  const sanitizedPage = Math.max(1, Math.floor(Number(page) || 1));
  const sanitizedLimit = Math.max(1, Math.floor(Number(limit) || 20));
  const totalRecords = Math.max(0, Math.floor(Number(total) || 0));

  return {
    page: sanitizedPage,
    limit: sanitizedLimit,
    total: totalRecords,
    totalPages: Math.ceil(totalRecords / sanitizedLimit),
  };
};

module.exports = {
  getPagination,
  getPaginationMeta,
};
