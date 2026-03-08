import express from 'express';
import { query } from '../db.js';
import {
  buildPagination,
  calcDiscountedPrice,
  parseBoolean,
  parsePaginationParams,
} from '../utils/query.js';

const router = express.Router();

const IMAGES_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(
      json_build_object(
        'image_id',   pi.image_id,
        'image_url',  pi.image_url,
        'label',      pi.label,
        'sort_order', pi.sort_order
      ) ORDER BY pi.sort_order
    ) FROM product_images pi WHERE pi.product_id = p.product_id),
    '[]'
  ) AS images
`;

const listProducts = async (req, res, extraFilters = {}) => {
  const paging = parsePaginationParams(req.query);
  if (paging.error) {
    return res.status(400).json({ success: false, error: paging.error });
  }

  const { page, limit } = paging;
  const { search, order = 'asc' } = req.query;
  const sortParam = extraFilters.sort || req.query.sort || 'name';

  const sortMap = {
    name: 'p.name',
    price: 'p.price',
    release_date: 'p.release_date',
    created_at: 'p.created_at',
  };

  const sortField = sortMap[sortParam] || 'p.name';
  const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const conditions = ['p.is_active = true'];
  const values = [];

  const slugFilters = {
    category:    extraFilters.category    || req.query.category,
    subcategory: extraFilters.subcategory || req.query.subcategory,
    brand:       extraFilters.brand       || req.query.brand,
  };

  if (slugFilters.category) {
    values.push(slugFilters.category);
    conditions.push(`c.slug = $${values.length}`);
  }
  if (slugFilters.subcategory) {
    values.push(slugFilters.subcategory);
    conditions.push(`s.slug = $${values.length}`);
  }
  if (slugFilters.brand) {
    values.push(slugFilters.brand);
    conditions.push(`b.slug = $${values.length}`);
  }

  const boolFilters = {
    is_featured:    extraFilters.is_featured    ?? parseBoolean(req.query.is_featured),
    is_new_arrival: extraFilters.is_new_arrival ?? parseBoolean(req.query.is_new_arrival),
    is_discounted:  extraFilters.is_discounted  ?? parseBoolean(req.query.is_discounted),
    in_stock:       extraFilters.in_stock       ?? parseBoolean(req.query.in_stock),
  };

  Object.entries(boolFilters).forEach(([field, value]) => {
    if (value === undefined) return;
    values.push(value);
    conditions.push(`p.${field} = $${values.length}`);
  });

  const minPrice = extraFilters.min_price ?? req.query.min_price;
  const maxPrice = extraFilters.max_price ?? req.query.max_price;

  if (minPrice !== undefined) {
    const parsed = Number(minPrice);
    if (Number.isNaN(parsed)) return res.status(400).json({ success: false, error: 'Invalid min_price parameter' });
    values.push(parsed);
    conditions.push(`p.price >= $${values.length}`);
  }
  if (maxPrice !== undefined) {
    const parsed = Number(maxPrice);
    if (Number.isNaN(parsed)) return res.status(400).json({ success: false, error: 'Invalid max_price parameter' });
    values.push(parsed);
    conditions.push(`p.price <= $${values.length}`);
  }

  if (search) {
    values.push(`%${String(search).trim()}%`);
    conditions.push(`p.name ILIKE $${values.length}`);
  }

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
  const forcedLimit = extraFilters.force_limit ? Math.min(extraFilters.force_limit, 100) : limit;
  const forcedPage  = extraFilters.force_page || page;
  const pagination  = buildPagination(forcedPage, forcedLimit, total);
  const listValues  = [...values, pagination.limit, pagination.offset];

  const result = await query(
    `SELECT
      p.*,
      b.name         AS brand_name,
      b.slug         AS brand_slug,
      b.logo_url     AS brand_logo_url,
      b.brand_color,
      c.name         AS category_name,
      c.slug         AS category_slug,
      s.name         AS subcategory_name,
      s.slug         AS subcategory_slug,
      ${IMAGES_SUBQUERY}
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

router.get('/featured', async (req, res) => {
  try {
    return await listProducts(req, res, { is_featured: true, force_limit: 8, force_page: 1 });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/new-arrivals', async (req, res) => {
  try {
    return await listProducts(req, res, { is_new_arrival: true, force_limit: 12, force_page: 1 });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/sale', async (req, res) => {
  try {
    return await listProducts(req, res, { is_discounted: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/', async (req, res) => {
  try {
    return await listProducts(req, res);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/:id/sizes', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: 'Invalid id parameter' });
    }

    const productCheck = await query(
      'SELECT product_id FROM products WHERE product_id = $1 AND is_active = true',
      [id]
    );
    if (!productCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const sizesResult = await query(
      `SELECT size, stock_qty, (stock_qty > 0) AS in_stock
       FROM product_sizes
       WHERE product_id = $1
       ORDER BY size`,
      [id]
    );

    return res.json({ success: true, data: sizesResult.rows });
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

    const productResult = await query(
      `SELECT
        p.*,
        b.brand_id,
        b.name         AS brand_name,
        b.slug         AS brand_slug,
        b.logo_url     AS brand_logo_url,
        b.brand_color,
        b.website_url,
        c.category_id,
        c.name         AS category_name,
        c.slug         AS category_slug,
        c.description  AS category_description,
        s.subcategory_id,
        s.name         AS subcategory_name,
        s.slug         AS subcategory_slug,
        s.description  AS subcategory_description,
        ${IMAGES_SUBQUERY}
      FROM products p
      JOIN brands b ON b.brand_id = p.brand_id
      JOIN categories c ON c.category_id = p.category_id
      JOIN subcategories s ON s.subcategory_id = p.subcategory_id
      WHERE p.product_id = $1 AND p.is_active = true`,
      [id]
    );

    if (!productResult.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const sizesResult = await query(
      `SELECT size, stock_qty
       FROM product_sizes
       WHERE product_id = $1
       ORDER BY size`,
      [id]
    );

    const bootDetailsResult = await query(
      `SELECT boot_type, upper_material, stud_type, colorway, is_laceless, created_at
       FROM boot_details
       WHERE product_id = $1`,
      [id]
    );

    const product = productResult.rows[0];
    product.sizes        = sizesResult.rows;
    product.boot_details = bootDetailsResult.rows[0] || null;

    if (product.is_discounted) {
      product.discounted_price = calcDiscountedPrice(product.price, product.discount_pct || 0);
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

export default router;