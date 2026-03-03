import express from 'express';
import { query } from '../db.js';
import {
  validateJerseyCreate,
  validateJerseyUpdate,
  handleValidationErrors,
} from '../validators/jerseyValidator.js';

const router = express.Router();

/**
 * GET /api/jerseys
 * List all jerseys with filters and pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const clubId = req.query.club_id ? parseInt(req.query.club_id) : null;
    const leagueId = req.query.league_id ? parseInt(req.query.league_id) : null;
    const jerseyType = req.query.type ? req.query.type.toLowerCase() : null;
    const season = req.query.season ? req.query.season : null;
    const inStock = req.query.in_stock ? req.query.in_stock === 'true' : null;

    // Build WHERE clause dynamically
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (clubId) {
      conditions.push(`j.club_id = $${paramIndex++}`);
      params.push(clubId);
    }
    if (leagueId) {
      conditions.push(`j.league_id = $${paramIndex++}`);
      params.push(leagueId);
    }
    if (jerseyType) {
      conditions.push(`j.jersey_type = $${paramIndex++}`);
      params.push(jerseyType);
    }
    if (season) {
      conditions.push(`j.season = $${paramIndex++}`);
      params.push(season);
    }
    if (inStock !== null) {
      conditions.push(`j.in_stock = $${paramIndex++}`);
      params.push(inStock);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM jerseys j ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    params.push(limit);
    params.push(offset);

    const result = await query(
      `SELECT 
        j.jersey_id, j.club_id, j.league_id, j.product_code, j.season, 
        j.jersey_type, j.name, j.price_usd, j.technology, j.in_stock, 
        j.release_date, j.created_at
       FROM jerseys j
       ${whereClause}
       ORDER BY j.season DESC, j.name ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/jerseys/:id
 * Single jersey with club and league info
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        j.jersey_id, j.club_id, j.league_id, j.product_code, j.season, 
        j.jersey_type, j.name, j.price_usd, j.technology, j.in_stock, 
        j.release_date, j.created_at,
        c.club_name, c.short_name, c.city, c.primary_color, c.secondary_color,
        l.league_name, l.short_code
       FROM jerseys j
       JOIN clubs c ON j.club_id = c.club_id
       JOIN leagues l ON j.league_id = l.league_id
       WHERE j.jersey_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/jerseys
 * Create a new jersey
 */
router.post(
  '/',
  validateJerseyCreate,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const {
        club_id,
        league_id,
        product_code,
        season,
        jersey_type,
        name,
        price_usd,
        technology,
        in_stock,
        release_date,
      } = req.body;

      // Check if club exists
      const clubCheck = await query('SELECT club_id FROM clubs WHERE club_id = $1', [
        club_id,
      ]);
      if (clubCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'club_id does not exist',
        });
      }

      // Check if league exists
      const leagueCheck = await query('SELECT league_id FROM leagues WHERE league_id = $1', [
        league_id,
      ]);
      if (leagueCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'league_id does not exist',
        });
      }

      // Check if product_code is unique
      const duplicateCheck = await query(
        'SELECT jersey_id FROM jerseys WHERE product_code = $1',
        [product_code]
      );
      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'product_code must be unique',
        });
      }

      // Insert jersey
      const result = await query(
        `INSERT INTO jerseys 
         (club_id, league_id, product_code, season, jersey_type, name, price_usd, technology, in_stock, release_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING 
           jersey_id, club_id, league_id, product_code, season, jersey_type, 
           name, price_usd, technology, in_stock, release_date, created_at`,
        [
          club_id,
          league_id,
          product_code,
          season,
          jersey_type,
          name,
          price_usd,
          technology || null,
          in_stock !== false,
          release_date || null,
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/jerseys/:id
 * Update a jersey (partial updates allowed)
 */
router.put(
  '/:id',
  validateJerseyUpdate,
  handleValidationErrors,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check if jersey exists
      const jerseyCheck = await query('SELECT jersey_id FROM jerseys WHERE jersey_id = $1', [
        id,
      ]);
      if (jerseyCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Not found',
        });
      }

      // Get current jersey to merge with updates
      const currentResult = await query(
        `SELECT 
          club_id, league_id, product_code, season, jersey_type, 
          name, price_usd, technology, in_stock, release_date
         FROM jerseys WHERE jersey_id = $1`,
        [id]
      );
      const current = currentResult.rows[0];

      // Build update object with only provided fields
      const updatedData = {
        club_id: req.body.club_id ?? current.club_id,
        league_id: req.body.league_id ?? current.league_id,
        product_code: req.body.product_code ?? current.product_code,
        season: req.body.season ?? current.season,
        jersey_type: req.body.jersey_type ?? current.jersey_type,
        name: req.body.name ?? current.name,
        price_usd: req.body.price_usd ?? current.price_usd,
        technology: req.body.technology ?? current.technology,
        in_stock: req.body.in_stock ?? current.in_stock,
        release_date: req.body.release_date ?? current.release_date,
      };

      // Validate references if changed
      if (updatedData.club_id !== current.club_id) {
        const clubCheck = await query('SELECT club_id FROM clubs WHERE club_id = $1', [
          updatedData.club_id,
        ]);
        if (clubCheck.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'club_id does not exist',
          });
        }
      }

      if (updatedData.league_id !== current.league_id) {
        const leagueCheck = await query('SELECT league_id FROM leagues WHERE league_id = $1', [
          updatedData.league_id,
        ]);
        if (leagueCheck.rows.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'league_id does not exist',
          });
        }
      }

      // Check uniqueness of product_code if changed
      if (updatedData.product_code !== current.product_code) {
        const duplicateCheck = await query(
          'SELECT jersey_id FROM jerseys WHERE product_code = $1 AND jersey_id != $2',
          [updatedData.product_code, id]
        );
        if (duplicateCheck.rows.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'product_code must be unique',
          });
        }
      }

      // Update jersey
      const result = await query(
        `UPDATE jerseys SET 
          club_id = $1, league_id = $2, product_code = $3, season = $4, 
          jersey_type = $5, name = $6, price_usd = $7, technology = $8, 
          in_stock = $9, release_date = $10
         WHERE jersey_id = $11
         RETURNING 
           jersey_id, club_id, league_id, product_code, season, jersey_type, 
           name, price_usd, technology, in_stock, release_date, created_at`,
        [
          updatedData.club_id,
          updatedData.league_id,
          updatedData.product_code,
          updatedData.season,
          updatedData.jersey_type,
          updatedData.name,
          updatedData.price_usd,
          updatedData.technology,
          updatedData.in_stock,
          updatedData.release_date,
          id,
        ]
      );

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/jerseys/:id
 * Delete a jersey
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if jersey exists
    const jerseyCheck = await query('SELECT jersey_id FROM jerseys WHERE jersey_id = $1', [id]);
    if (jerseyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
      });
    }

    // Delete jersey
    await query('DELETE FROM jerseys WHERE jersey_id = $1', [id]);

    res.json({
      success: true,
      data: { jersey_id: parseInt(id) },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
