import express from 'express';
import { query } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, error: 'Missing q parameter' });
    }

    if (q.length < 2) {
      return res.status(400).json({ success: false, error: 'q must be at least 2 characters' });
    }

    const like = `%${q}%`;

    const jerseysResult = await query(
      `SELECT
        j.jersey_id,
        j.name,
        j.price_usd,
        j.discount_pct,
        j.is_discounted,
        j.image_url,
        j.season,
        j.jersey_type,
        c.club_name,
        c.primary_color,
        l.league_name
      FROM jerseys j
      JOIN clubs c ON c.club_id = j.club_id
      JOIN leagues l ON l.league_id = j.league_id
      WHERE j.is_active = true
        AND (j.name ILIKE $1 OR c.club_name ILIKE $1)
      ORDER BY j.name
      LIMIT 10`,
      [like]
    );

    const jerseyTotalResult = await query(
      `SELECT COUNT(*)::int AS total
      FROM jerseys j
      JOIN clubs c ON c.club_id = j.club_id
      WHERE j.is_active = true
        AND (j.name ILIKE $1 OR c.club_name ILIKE $1)`,
      [like]
    );

    const productsResult = await query(
      `SELECT
        p.product_id,
        p.name,
        p.price,
        p.discount_pct,
        p.is_discounted,
        p.image_url,
        b.name AS brand_name,
        c.name AS category_name,
        s.name AS subcategory_name
      FROM products p
      JOIN brands b ON b.brand_id = p.brand_id
      JOIN categories c ON c.category_id = p.category_id
      JOIN subcategories s ON s.subcategory_id = p.subcategory_id
      WHERE p.is_active = true
        AND (
          p.name ILIKE $1
          OR p.description ILIKE $1
          OR b.name ILIKE $1
        )
      ORDER BY p.name
      LIMIT 10`,
      [like]
    );

    const productTotalResult = await query(
      `SELECT COUNT(*)::int AS total
      FROM products p
      JOIN brands b ON b.brand_id = p.brand_id
      WHERE p.is_active = true
        AND (
          p.name ILIKE $1
          OR p.description ILIKE $1
          OR b.name ILIKE $1
        )`,
      [like]
    );

    const jerseyTotal = jerseyTotalResult.rows[0]?.total || 0;
    const productTotal = productTotalResult.rows[0]?.total || 0;

    return res.json({
      success: true,
      query: q,
      results: {
        jerseys: {
          data: jerseysResult.rows,
          total: jerseyTotal,
        },
        products: {
          data: productsResult.rows,
          total: productTotal,
        },
        total: jerseyTotal + productTotal,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

export const featuredHandler = async (_req, res) => {
  try {
    const [featuredJerseys, featuredProducts, leagues] = await Promise.all([
      query(
        `SELECT
          j.jersey_id,
          j.name,
          j.price_usd,
          j.discount_pct,
          j.is_discounted,
          j.image_url,
          j.season,
          j.jersey_type,
          j.club_id,
          j.league_id,
          c.primary_color,
          c.club_name
        FROM jerseys j
        JOIN clubs c ON c.club_id = j.club_id
        WHERE j.is_active = true AND j.is_featured = true
        ORDER BY j.created_at DESC
        LIMIT 6`
      ),
      query(
        `SELECT
          product_id,
          name,
          price,
          discount_pct,
          is_discounted,
          image_url,
          category_id,
          subcategory_id,
          brand_id
        FROM products
        WHERE is_active = true AND is_featured = true
        ORDER BY created_at DESC
        LIMIT 6`
      ),
      query(
        `SELECT *
        FROM leagues
        WHERE is_active = true
        ORDER BY league_name`
      ),
    ]);

    const [newJerseys, newProducts, saleJerseys, saleProducts] = await Promise.all([
      query(
        `SELECT
          j.jersey_id,
          j.name,
          j.price_usd,
          j.discount_pct,
          j.is_discounted,
          j.image_url,
          j.created_at,
          c.primary_color,
          j.jersey_type,
          c.club_name,
          'jersey' AS item_type
        FROM jerseys j
        JOIN clubs c ON c.club_id = j.club_id
        WHERE j.is_active = true AND j.is_new_arrival = true
        ORDER BY j.created_at DESC
        LIMIT 8`
      ),
      query(
        `SELECT
          product_id,
          name,
          price,
          discount_pct,
          is_discounted,
          image_url,
          created_at,
          'product' AS item_type
        FROM products
        WHERE is_active = true AND is_new_arrival = true
        ORDER BY created_at DESC
        LIMIT 8`
      ),
      query(
        `SELECT
          j.jersey_id,
          j.name,
          j.price_usd,
          j.discount_pct,
          j.is_discounted,
          j.image_url,
          j.created_at,
          c.primary_color,
          j.jersey_type,
          c.club_name,
          'jersey' AS item_type
        FROM jerseys j
        JOIN clubs c ON c.club_id = j.club_id
        WHERE j.is_active = true AND j.is_discounted = true
        ORDER BY j.created_at DESC
        LIMIT 8`
      ),
      query(
        `SELECT
          product_id,
          name,
          price,
          discount_pct,
          is_discounted,
          image_url,
          created_at,
          'product' AS item_type
        FROM products
        WHERE is_active = true AND is_discounted = true
        ORDER BY created_at DESC
        LIMIT 8`
      ),
    ]);

    const newArrivals = [...newJerseys.rows, ...newProducts.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);

    const saleItems = [...saleJerseys.rows, ...saleProducts.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);

    return res.json({
      success: true,
      data: {
        featured_jerseys: featuredJerseys.rows,
        featured_products: featuredProducts.rows,
        new_arrivals: newArrivals,
        sale_items: saleItems,
        leagues: leagues.rows,
      },
    });
  } catch (error) {
     console.error('Featured error:', error);
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
};

export default router;