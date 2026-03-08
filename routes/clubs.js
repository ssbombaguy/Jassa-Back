import express from 'express';
import { query } from '../db.js';
import { buildPagination, parsePaginationParams } from '../utils/query.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const paging = parsePaginationParams(req.query);
    if (paging.error) {
      return res.status(400).json({ success: false, error: paging.error });
    }

    const { page, limit } = paging;
    const { search, sort = 'name', order = 'asc' } = req.query;
    const leagueId = req.query.league_id ? Number.parseInt(req.query.league_id, 10) : undefined;

    if (req.query.league_id !== undefined && !Number.isInteger(leagueId)) {
      return res.status(400).json({ success: false, error: 'Invalid league_id parameter' });
    }

    const sortMap = {
      name: 'c.club_name',
      club_name: 'c.club_name',
      founded_year: 'c.founded_year',
      created_at: 'c.created_at',
    };

    const sortField = sortMap[sort] || 'c.club_name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['c.is_active = true'];
    const values = [];

    if (leagueId !== undefined) {
      values.push(leagueId);
      conditions.push(`c.league_id = $${values.length}`);
    }

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`c.club_name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
      FROM clubs c
      JOIN leagues l ON l.league_id = c.league_id
      ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);
    const listValues = [...values, pagination.limit, pagination.offset];

    const result = await query(
      `SELECT
        c.*,
        l.league_name,
        l.short_code
      FROM clubs c
      JOIN leagues l ON l.league_id = c.league_id
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
        c.*,
        l.league_name,
        l.short_code,
        l.country AS league_country,
        (SELECT COUNT(*)::int FROM jerseys j WHERE j.club_id = c.club_id AND j.is_active = true) AS jersey_count
      FROM clubs c
      JOIN leagues l ON l.league_id = c.league_id
      WHERE c.club_id = $1 AND c.is_active = true`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

router.get('/:id/jerseys', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: 'Invalid id parameter' });
    }

    const paging = parsePaginationParams(req.query);
    if (paging.error) {
      return res.status(400).json({ success: false, error: paging.error });
    }

    const { page, limit } = paging;
    const { search, sort = 'name', order = 'asc', jersey_type, season } = req.query;
    const sortMap = {
      name: 'j.name',
      price: 'j.price_usd',
      release_date: 'j.release_date',
      created_at: 'j.created_at',
    };
    const sortField = sortMap[sort] || 'j.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const clubCheck = await query(
      'SELECT club_id FROM clubs WHERE club_id = $1 AND is_active = true',
      [id]
    );
    if (!clubCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const conditions = ['j.club_id = $1', 'j.is_active = true'];
    const values = [id];

    if (jersey_type) {
      values.push(jersey_type);
      conditions.push(`j.jersey_type = $${values.length}`);
    }

    if (season) {
      values.push(season);
      conditions.push(`j.season = $${values.length}`);
    }

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`j.name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM jerseys j ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);
    const listValues = [...values, pagination.limit, pagination.offset];

    const result = await query(
      `SELECT
        j.*,
        c.club_name,
        c.short_name,
        l.league_name,
        l.short_code
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
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Something went wrong' });
  }
});

export default router;
