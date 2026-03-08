import express from 'express';
import { query } from '../db.js';
import { buildPagination, parseBoolean, parsePaginationParams } from '../utils/query.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const paging = parsePaginationParams(req.query);
    if (paging.error) {
      return res.status(400).json({ success: false, error: paging.error });
    }

    const { page, limit } = paging;
    const { search, sort = 'name', order = 'asc' } = req.query;

    const sortMap = {
      name: 'b.name',
      created_at: 'b.created_at',
    };

    const sortField = sortMap[sort] || 'b.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['b.is_active = true'];
    const values = [];

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`b.name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM brands b ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);
    const listValues = [...values, pagination.limit, pagination.offset];

    const result = await query(
      `SELECT
        b.*,
        (SELECT COUNT(*)::int FROM products p WHERE p.brand_id = b.brand_id AND p.is_active = true) AS product_count
      FROM brands b
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/:slug/products', async (req, res) => {
  try {
    const slug = req.params.slug;

    const brandCheck = await query(
      'SELECT brand_id FROM brands WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (!brandCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const paging = parsePaginationParams(req.query);
    if (paging.error) {
      return res.status(400).json({ success: false, error: paging.error });
    }

    const { page, limit } = paging;
    const { search, sort = 'name', order = 'asc' } = req.query;

    const sortMap = {
      name: 'p.name',
      price: 'p.price',
      release_date: 'p.release_date',
      created_at: 'p.created_at',
    };

    const sortField = sortMap[sort] || 'p.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['p.is_active = true', 'b.slug = $1'];
    const values = [slug];

    if (req.query.category) {
      values.push(req.query.category);
      conditions.push(`c.slug = $${values.length}`);
    }

    const isFeatured = parseBoolean(req.query.is_featured);
    if (isFeatured !== undefined) {
      values.push(isFeatured);
      conditions.push(`p.is_featured = $${values.length}`);
    }

    const isNewArrival = parseBoolean(req.query.is_new_arrival);
    if (isNewArrival !== undefined) {
      values.push(isNewArrival);
      conditions.push(`p.is_new_arrival = $${values.length}`);
    }

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`p.name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
      FROM products p
      JOIN brands b ON b.brand_id = p.brand_id
      JOIN categories c ON c.category_id = p.category_id
      ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);
    const listValues = [...values, pagination.limit, pagination.offset];

    const result = await query(
      `SELECT
        p.*,
        b.name AS brand_name,
        b.slug AS brand_slug,
        c.name AS category_name,
        c.slug AS category_slug,
        s.name AS subcategory_name,
        s.slug AS subcategory_slug
      FROM products p
      JOIN brands b ON b.brand_id = p.brand_id
      JOIN categories c ON c.category_id = p.category_id
      JOIN subcategories s ON s.subcategory_id = p.subcategory_id
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;

    const result = await query(
      `SELECT *
      FROM brands
      WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

export default router;
