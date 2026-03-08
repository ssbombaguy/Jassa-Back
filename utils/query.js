export const parseBoolean = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};

export const buildPagination = (page = 1, limit = 20, total = 0) => {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const boundedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const totalRows = Number.isInteger(total) ? total : Number(total) || 0;
  const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / boundedLimit);
  const offset = (safePage - 1) * boundedLimit;

  return {
    page: safePage,
    limit: boundedLimit,
    total: totalRows,
    totalPages,
    offset,
  };
};

export const buildWhereClause = (filters = {}, startIndex = 1) => {
  const clauses = [];
  const values = [];
  let idx = startIndex;

  Object.entries(filters).forEach(([field, rawValue]) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return;

    let value = rawValue;
    if (typeof rawValue === 'string') {
      const boolValue = parseBoolean(rawValue);
      if (boolValue !== undefined) value = boolValue;
    }

    clauses.push(`${field} = $${idx}`);
    values.push(value);
    idx += 1;
  });

  return {
    whereStr: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
    nextIndex: idx,
  };
};

export const calcDiscountedPrice = (price, discountPct) => {
  const safePrice = Number(price) || 0;
  const safeDiscount = Number(discountPct) || 0;
  return parseFloat((safePrice - (safePrice * safeDiscount) / 100).toFixed(2));
};

export const parsePaginationParams = (query) => {
  const pageRaw = query.page !== undefined ? Number.parseInt(query.page, 10) : 1;
  const limitRaw = query.limit !== undefined ? Number.parseInt(query.limit, 10) : 20;

  if (!Number.isInteger(pageRaw) || pageRaw < 1) {
    return { error: 'Invalid page parameter' };
  }

  if (!Number.isInteger(limitRaw) || limitRaw < 1) {
    return { error: 'Invalid limit parameter' };
  }

  return { page: pageRaw, limit: Math.min(limitRaw, 100) };
};

export const applySearchFilter = (search, column, values, startIndex) => {
  if (!search || typeof search !== 'string') {
    return { clause: '', nextIndex: startIndex };
  }

  values.push(`%${search.trim()}%`);
  return { clause: `${column} ILIKE $${startIndex}`, nextIndex: startIndex + 1 };
};
