import express from 'express';
import { query } from '../db.js';
import {
  buildPagination,
  calcDiscountedPrice,
  parseBoolean,
  parsePaginationParams,
} from '../utils/query.js';

const router = express.Router();

const listJerseys = async (req, res, extraFilters = {}) => {
  const paging = parsePaginationParams(req.query);
  if (paging.error) {
    return res.status(400).json({ success: false, error: paging.error });
  }

  const { page, limit } = paging;
  const { search, order = 'asc' } = req.query;
  const sortParam = extraFilters.sort || req.query.sort || 'name';
  const sortMap = {
    name: 'j.name',
    price: 'j.price_usd',
    release_date: 'j.release_date',
    created_at: 'j.created_at',
  };

  const sortField = sortMap[sortParam] || 'j.name';
  const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const conditions = ['j.is_active = true'];
  const values = [];

  const numericFilters = {
    league_id: req.query.league_id,
    club_id: req.query.club_id,
  };

  Object.entries(numericFilters).forEach(([field, raw]) => {
    if (raw === undefined) return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isInteger(parsed)) {
      values.push(parsed);
      conditions.push(`j.${field} = $${values.length}`);
    }
  });

  if (req.query.league_id !== undefined && !Number.isInteger(Number.parseInt(req.query.league_id, 10))) {
    return res.status(400).json({ success: false, error: 'Invalid league_id parameter' });
  }

  if (req.query.club_id !== undefined && !Number.isInteger(Number.parseInt(req.query.club_id, 10))) {
    return res.status(400).json({ success: false, error: 'Invalid club_id parameter' });
  }

  const jerseyType = extraFilters.jersey_type || req.query.jersey_type;
  if (jerseyType) {
    values.push(jerseyType);
    conditions.push(`j.jersey_type = $${values.length}`);
  }

  const season = extraFilters.season || req.query.season;
  if (season) {
    values.push(season);
    conditions.push(`j.season = $${values.length}`);
  }

  const technology = extraFilters.technology || req.query.technology;
  if (technology) {
    values.push(technology);
    conditions.push(`j.technology = $${values.length}`);
  }

  const boolFilters = {
    is_featured: extraFilters.is_featured ?? parseBoolean(req.query.is_featured),
    is_new_arrival: extraFilters.is_new_arrival ?? parseBoolean(req.query.is_new_arrival),
    is_discounted: extraFilters.is_discounted ?? parseBoolean(req.query.is_discounted),
    is_ucl: extraFilters.is_ucl ?? parseBoolean(req.query.is_ucl),
  };

  Object.entries(boolFilters).forEach(([field, value]) => {
    if (value === undefined) return;
    values.push(value);
    conditions.push(`j.${field} = $${values.length}`);
  });

  const minPrice = extraFilters.min_price ?? req.query.min_price;
  const maxPrice = extraFilters.max_price ?? req.query.max_price;

  if (minPrice !== undefined) {
    const parsed = Number(minPrice);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ success: false, error: 'Invalid min_price parameter' });
    }
    values.push(parsed);
    conditions.push(`j.price_usd >= $${values.length}`);
  }

  if (maxPrice !== undefined) {
    const parsed = Number(maxPrice);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ success: false, error: 'Invalid max_price parameter' });
    }
    values.push(parsed);
    conditions.push(`j.price_usd <= $${values.length}`);
  }

  if (search) {
    values.push(`%${String(search).trim()}%`);
    conditions.push(`j.name ILIKE $${values.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM jerseys j
    JOIN clubs c ON c.club_id = j.club_id
    JOIN leagues l ON l.league_id = j.league_id
    ${whereClause}`,
    values
  );

  const total = countResult.rows[0]?.total || 0;
  const forcedLimit = extraFilters.force_limit ? Math.min(extraFilters.force_limit, 100) : limit;
  const forcedPage = extraFilters.force_page || page;
  const pagination = buildPagination(forcedPage, forcedLimit, total);
  const listValues = [...values, pagination.limit, pagination.offset];

  const result = await query(
    `SELECT
      j.*,
      c.club_name,
      c.short_name,
      c.crest_url,
      c.primary_color,
      l.league_name,
      l.short_code,
      COALESCE(
        (SELECT json_agg(
          json_build_object(
            'image_id',   ji.image_id,
            'image_url',  ji.image_url,
            'label',      ji.label,
            'sort_order', ji.sort_order
          ) ORDER BY ji.sort_order
        ) FROM jersey_images ji WHERE ji.jersey_id = j.jersey_id),
        '[]'
      ) AS images
    FROM jerseys j
    JOIN clubs c ON c.club_id = j.club_id
    JOIN leagues l ON l.league_id = j.league_id
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  return res.json({
    success: true,
    data: result.rows,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  });
};

router.get('/featured', async (req, res) => {
  try {
    return await listJerseys(req, res, { is_featured: true, force_limit: 8, force_page: 1 });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/new-arrivals', async (req, res) => {
  try {
    return await listJerseys(req, res, { is_new_arrival: true, force_limit: 12, force_page: 1 });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/sale', async (req, res) => {
  try {
    return await listJerseys(req, res, { is_discounted: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/', async (req, res) => {
  try {
    return await listJerseys(req, res);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: 'Invalid id parameter' });
    }

    const result = await query(
      `SELECT
        j.*,
        c.club_name,
        c.short_name,
        c.city          AS club_city,
        c.country       AS club_country,
        c.primary_color,
        c.secondary_color,
        c.crest_url,
        l.league_name,
        l.short_code,
        l.country       AS league_country,
        l.confederation,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'image_id',   ji.image_id,
              'image_url',  ji.image_url,
              'label',      ji.label,
              'sort_order', ji.sort_order
            ) ORDER BY ji.sort_order
          ) FROM jersey_images ji WHERE ji.jersey_id = j.jersey_id),
          '[]'
        ) AS images
      FROM jerseys j
      JOIN clubs c ON c.club_id = j.club_id
      JOIN leagues l ON l.league_id = j.league_id
      WHERE j.jersey_id = $1 AND j.is_active = true`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const jersey = result.rows[0];
    jersey.discounted_price = calcDiscountedPrice(jersey.price_usd, jersey.discount_pct || 0);

    const sizesResult = await query(
      `SELECT size, stock_qty, in_stock
       FROM jersey_sizes
       WHERE jersey_id = $1
       ORDER BY CASE size
         WHEN 'XS'  THEN 1
         WHEN 'S'   THEN 2
         WHEN 'M'   THEN 3
         WHEN 'L'   THEN 4
         WHEN 'XL'  THEN 5
         WHEN 'XXL' THEN 6
       END`,
      [id]
    );
    jersey.sizes = sizesResult.rows;

    return res.json({ success: true, data: jersey });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

export default router;