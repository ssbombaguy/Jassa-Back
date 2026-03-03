import express from 'express';
import { query } from '../db.js';

const router = express.Router();

/**
 * GET /api/clubs
 * List all clubs with optional league_id filter
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const leagueId = req.query.league_id ? parseInt(req.query.league_id) : null;

    let whereClause = '';
    let params = [];

    if (leagueId) {
      whereClause = 'WHERE league_id = $1';
      params = [leagueId];
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM clubs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await query(
      `SELECT 
        club_id, league_id, club_name, short_name, founded_year, 
        city, country, primary_color, secondary_color, adidas_partner, created_at 
       FROM clubs 
       ${whereClause}
       ORDER BY club_name ASC 
       LIMIT ${leagueId ? '$2' : '$1'} OFFSET ${leagueId ? '$3' : '$2'}`,
      leagueId ? [...params, limit, offset] : [limit, offset]
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
 * GET /api/clubs/:id
 * Single club with league info
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        c.club_id, c.league_id, c.club_name, c.short_name, c.founded_year, 
        c.city, c.country, c.primary_color, c.secondary_color, c.adidas_partner, c.created_at,
        l.league_name, l.short_code, l.confederation
       FROM clubs c
       LEFT JOIN leagues l ON c.league_id = l.league_id
       WHERE c.club_id = $1`,
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
 * GET /api/clubs/:id/jerseys
 * All jerseys for a club
 */
router.get('/:id/jerseys', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Check if club exists
    const clubCheck = await query(
      'SELECT club_id FROM clubs WHERE club_id = $1',
      [id]
    );

    if (clubCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
      });
    }

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM jerseys WHERE club_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await query(
      `SELECT 
        j.jersey_id, j.club_id, j.league_id, j.product_code, j.season, 
        j.jersey_type, j.name, j.price_usd, j.technology, j.in_stock, 
        j.release_date, j.created_at,
        c.club_name, c.short_name,
        l.league_name
       FROM jerseys j
       JOIN clubs c ON j.club_id = c.club_id
       JOIN leagues l ON j.league_id = l.league_id
       WHERE j.club_id = $1
       ORDER BY j.season DESC, j.jersey_type ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
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

export default router;
