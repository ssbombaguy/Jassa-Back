import express from 'express';
import { query } from '../db.js';

const router = express.Router();

/**
 * GET /api/leagues
 * List all leagues with pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query('SELECT COUNT(*) as count FROM leagues');
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await query(
      `SELECT 
        league_id, league_name, short_code, country, confederation, 
        tier, adidas_partner, contract_start, contract_end, created_at 
       FROM leagues 
       ORDER BY tier ASC, league_name ASC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
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
 * GET /api/leagues/:id
 * Single league or 404
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        league_id, league_name, short_code, country, confederation, 
        tier, adidas_partner, contract_start, contract_end, created_at 
       FROM leagues 
       WHERE league_id = $1`,
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
 * GET /api/leagues/:id/clubs
 * All clubs in a league or 404
 */
router.get('/:id/clubs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Check if league exists
    const leagueCheck = await query(
      'SELECT league_id FROM leagues WHERE league_id = $1',
      [id]
    );

    if (leagueCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
      });
    }

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM clubs WHERE league_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await query(
      `SELECT 
        club_id, league_id, club_name, short_name, founded_year, 
        city, country, primary_color, secondary_color, adidas_partner, created_at 
       FROM clubs 
       WHERE league_id = $1 
       ORDER BY club_name ASC 
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

/**
 * GET /api/leagues/:id/jerseys
 * All jerseys in a league with club and league info
 */
router.get('/:id/jerseys', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Check if league exists
    const leagueCheck = await query(
      'SELECT league_id FROM leagues WHERE league_id = $1',
      [id]
    );

    if (leagueCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not found',
      });
    }

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM jerseys WHERE league_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results with JOINs
    const result = await query(
      `SELECT 
        j.jersey_id, j.club_id, j.league_id, j.product_code, j.season, 
        j.jersey_type, j.name, j.price_usd, j.technology, j.in_stock, 
        j.release_date, j.created_at,
        c.club_name, c.short_name, c.city as club_city,
        l.league_name, l.short_code
       FROM jerseys j
       JOIN clubs c ON j.club_id = c.club_id
       JOIN leagues l ON j.league_id = l.league_id
       WHERE j.league_id = $1
       ORDER BY c.club_name ASC, j.jersey_type ASC
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
