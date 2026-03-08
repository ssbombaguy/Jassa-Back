import express from 'express';
import { query } from '../db.js';
import { buildPagination, parseBoolean, parsePaginationParams } from '../utils/query.js';

const router = express.Router();

const buildProductFilters = (req, baseSlugField, slugValue) => {
  const conditions = ['p.is_active = true'];
  const values = [];

  if (slugValue) {
    values.push(slugValue);
    conditions.push(`${baseSlugField} = $${values.length}`);
  }

  if (req.query.brand) {
    values.push(req.query.brand);
    conditions.push(`b.slug = $${values.length}`);
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

  const isDiscounted = parseBoolean(req.query.is_discounted);
  if (isDiscounted !== undefined) {
    values.push(isDiscounted);
    conditions.push(`p.is_discounted = $${values.length}`);
  }

  if (req.query.in_stock !== undefined) {
    const inStock = parseBoolean(req.query.in_stock);
    if (inStock !== undefined) {
      values.push(inStock);
      conditions.push(`p.in_stock = $${values.length}`);
    }
  }

  if (req.query.min_price !== undefined) {
    const minPrice = Number(req.query.min_price);
    if (!Number.isNaN(minPrice)) {
      values.push(minPrice);
      conditions.push(`p.price >= $${values.length}`);
    }
  }

  if (req.query.max_price !== undefined) {
    const maxPrice = Number(req.query.max_price);
    if (!Number.isNaN(maxPrice)) {
      values.push(maxPrice);
      conditions.push(`p.price <= $${values.length}`);
    }
  }

  if (req.query.search) {
    values.push(`%${String(req.query.search).trim()}%`);
    conditions.push(`p.name ILIKE $${values.length}`);
  }

  return { conditions, values };
};

const listProductsByScope = async (req, res, scope) => {
  const paging = parsePaginationParams(req.query);
  if (paging.error) {
    return res.status(400).json({ success: false, error: paging.error });
  }

  const { page, limit } = paging;
  const { order = 'asc', sort = 'name' } = req.query;
  const sortMap = {
    name: 'p.name',
    price: 'p.price',
    release_date: 'p.release_date',
    created_at: 'p.created_at',
  };

  const sortField = sortMap[sort] || 'p.name';
  const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const { conditions, values } = buildProductFilters(req, scope.field, scope.slug);
  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
    FROM products p
    JOIN categories c ON c.category_id = p.category_id
    JOIN subcategories s ON s.subcategory_id = p.subcategory_id
    JOIN brands b ON b.brand_id = p.brand_id
    ${whereClause}`,
    values
  );

  const total = countResult.rows[0]?.total || 0;
  const pagination = buildPagination(page, limit, total);
  const listValues = [...values, pagination.limit, pagination.offset];

  const result = await query(
    `SELECT
      p.*,
      c.name AS category_name,
      c.slug AS category_slug,
      s.name AS subcategory_name,
      s.slug AS subcategory_slug,
      b.name AS brand_name,
      b.slug AS brand_slug
    FROM products p
    JOIN categories c ON c.category_id = p.category_id
    JOIN subcategories s ON s.subcategory_id = p.subcategory_id
    JOIN brands b ON b.brand_id = p.brand_id
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

router.get('/', async (req, res) => {
  try {
    const paging = parsePaginationParams(req.query);
    if (paging.error) {
      return res.status(400).json({ success: false, error: paging.error });
    }

    const { page, limit } = paging;
    const { search, order = 'asc', sort = 'name' } = req.query;

    const sortMap = {
      name: 'c.name',
      created_at: 'c.created_at',
    };

    const sortField = sortMap[sort] || 'c.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['c.is_active = true'];
    const values = [];

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`c.name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM categories c ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);
    const listValues = [...values, pagination.limit, pagination.offset];

    const categoriesResult = await query(
      `SELECT
        c.*,
        (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.category_id AND p.is_active = true) AS product_count
      FROM categories c
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues
    );

    const subcategoriesResult = await query(
      `SELECT subcategory_id, category_id, name, slug, description, is_active, created_at
      FROM subcategories
      WHERE is_active = true`
    );

    const grouped = subcategoriesResult.rows.reduce((acc, subcategory) => {
      if (!acc[subcategory.category_id]) acc[subcategory.category_id] = [];
      acc[subcategory.category_id].push(subcategory);
      return acc;
    }, {});

    const data = categoriesResult.rows.map((category) => ({
      ...category,
      subcategories: grouped[category.category_id] || [],
    }));

    return res.json({
      success: true,
      data,
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

    const categoryCheck = await query(
      'SELECT category_id FROM categories WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (!categoryCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    return await listProductsByScope(req, res, { field: 'c.slug', slug });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;

    const result = await query(
      `SELECT
        c.*,
        (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.category_id AND p.is_active = true) AS product_count
      FROM categories c
      WHERE c.slug = $1 AND c.is_active = true`,
      [slug]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const subcategoriesResult = await query(
      `SELECT subcategory_id, category_id, name, slug, description, is_active, created_at
      FROM subcategories
      WHERE category_id = $1 AND is_active = true
      ORDER BY name`,
      [result.rows[0].category_id]
    );

    const category = result.rows[0];
    category.subcategories = subcategoriesResult.rows;

    return res.json({ success: true, data: category });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

export const subcategoriesHandler = async (req, res) => {
  try {
    const paging = parsePaginationParams(req.query);
    if (paging.error) {
      return res.status(400).json({ success: false, error: paging.error });
    }

    const { page, limit } = paging;
    const { search, sort = 'name', order = 'asc' } = req.query;

    const sortMap = {
      name: 's.name',
      created_at: 's.created_at',
    };
    const sortField = sortMap[sort] || 's.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['s.is_active = true'];
    const values = [];

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`s.name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
      FROM subcategories s
      JOIN categories c ON c.category_id = s.category_id
      ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);
    const listValues = [...values, pagination.limit, pagination.offset];

    const result = await query(
      `SELECT
        s.*,
        c.name AS category_name,
        c.slug AS category_slug
      FROM subcategories s
      JOIN categories c ON c.category_id = s.category_id
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
};

export const subcategoryProductsHandler = async (req, res) => {
  try {
    const slug = req.params.slug;

    const subcategoryCheck = await query(
      'SELECT subcategory_id FROM subcategories WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (!subcategoryCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    return await listProductsByScope(req, res, { field: 's.slug', slug });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
};

export default router;
