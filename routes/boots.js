import express from 'express';
import { query } from '../db.js';
import {
  buildPagination,
  calcDiscountedPrice,
  parseBoolean,
  parsePaginationParams,
} from '../utils/query.js';

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
      name: 'p.name',
      price: 'p.price',
      release_date: 'p.release_date',
      created_at: 'p.created_at',
    };

    const sortField = sortMap[sort] || 'p.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['p.is_active = true', "c.slug = 'boot'"];
    const values = [];

    const bootType = req.query.boot_type;
    if (bootType) {
      values.push(bootType);
      conditions.push(`bd.boot_type = $${values.length}`);
    }

    const upperMaterial = req.query.upper_material;
    if (upperMaterial) {
      values.push(upperMaterial);
      conditions.push(`bd.upper_material = $${values.length}`);
    }

    const isLaceless = parseBoolean(req.query.is_laceless);
    if (isLaceless !== undefined) {
      values.push(isLaceless);
      conditions.push(`bd.is_laceless = $${values.length}`);
    }

    const brandSlug = req.query.brand;
    if (brandSlug) {
      values.push(brandSlug);
      conditions.push(`b.slug = $${values.length}`);
    }

    const inStock = parseBoolean(req.query.in_stock);
    if (inStock !== undefined) {
      values.push(inStock);
      conditions.push(`p.in_stock = $${values.length}`);
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

    if (req.query.min_price !== undefined) {
      const minPrice = Number(req.query.min_price);
      if (Number.isNaN(minPrice)) {
        return res.status(400).json({ success: false, error: 'Invalid min_price parameter' });
      }
      values.push(minPrice);
      conditions.push(`p.price >= $${values.length}`);
    }

    if (req.query.max_price !== undefined) {
      const maxPrice = Number(req.query.max_price);
      if (Number.isNaN(maxPrice)) {
        return res.status(400).json({ success: false, error: 'Invalid max_price parameter' });
      }
      values.push(maxPrice);
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
      JOIN brands b ON b.brand_id = p.brand_id
      JOIN boot_details bd ON bd.product_id = p.product_id
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
        bd.boot_type,
        bd.upper_material,
        bd.stud_type,
        bd.colorway,
        bd.is_laceless
      FROM products p
      JOIN categories c ON c.category_id = p.category_id
      JOIN brands b ON b.brand_id = p.brand_id
      JOIN boot_details bd ON bd.product_id = p.product_id
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

router.get('/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: 'Invalid id parameter' });
    }

    const result = await query(
      `SELECT
        p.*,
        b.name AS brand_name,
        b.slug AS brand_slug,
        c.name AS category_name,
        c.slug AS category_slug,
        s.name AS subcategory_name,
        s.slug AS subcategory_slug,
        bd.boot_type,
        bd.upper_material,
        bd.stud_type,
        bd.colorway,
        bd.is_laceless
      FROM products p
      JOIN categories c ON c.category_id = p.category_id
      JOIN subcategories s ON s.subcategory_id = p.subcategory_id
      JOIN brands b ON b.brand_id = p.brand_id
      JOIN boot_details bd ON bd.product_id = p.product_id
      WHERE p.product_id = $1 AND p.is_active = true AND c.slug = 'boot'`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const sizesResult = await query(
      `SELECT size, stock_qty, (stock_qty > 0) AS in_stock
      FROM product_sizes
      WHERE product_id = $1
      ORDER BY size`,
      [id]
    );

    const boot = result.rows[0];
    boot.sizes = sizesResult.rows;

    if (boot.is_discounted) {
      boot.discounted_price = calcDiscountedPrice(boot.price, boot.discount_pct || 0);
    }

    return res.json({ success: true, data: boot });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

export default router;
