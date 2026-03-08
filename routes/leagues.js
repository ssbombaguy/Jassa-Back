import express from 'express';
import { query } from '../db.js';
import { buildPagination, parsePaginationParams, parseBoolean } from '../utils/query.js';

const router = express.Router();

const leagueSortMap = {
  name: 'l.league_name',
  league_name: 'l.league_name',
  country: 'l.country',
  tier: 'l.tier',
  created_at: 'l.created_at',
};

router.get('/', async (req, res) => {
  try {
    const paging = parsePaginationParams(req.query);
    if (paging.error) {
      return res.status(400).json({ success: false, error: paging.error });
    }

    const { page, limit } = paging;
    const { search, sort = 'name', order = 'asc' } = req.query;
    const sortField = leagueSortMap[sort] || 'l.league_name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions = ['l.is_active = true'];
    const values = [];

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`l.league_name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM leagues l ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);

    const listValues = [...values, pagination.limit, pagination.offset];

    const result = await query(
      `SELECT
        l.*,
        COUNT(j.jersey_id)::int AS jersey_count
      FROM leagues l
      LEFT JOIN jerseys j ON j.league_id = l.league_id AND j.is_active = true
      ${whereClause}
      GROUP BY l.league_id
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
        l.*,
        (SELECT COUNT(*)::int FROM clubs c WHERE c.league_id = l.league_id AND c.is_active = true) AS club_count,
        (SELECT COUNT(*)::int FROM jerseys j WHERE j.league_id = l.league_id AND j.is_active = true) AS jersey_count
      FROM leagues l
      WHERE l.league_id = $1 AND l.is_active = true`,
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

router.get('/:id/clubs', async (req, res) => {
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
    const { search, sort = 'name', order = 'asc' } = req.query;
    const sortMap = {
      name: 'c.club_name',
      club_name: 'c.club_name',
      founded_year: 'c.founded_year',
      created_at: 'c.created_at',
    };
    const sortField = sortMap[sort] || 'c.club_name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const leagueCheck = await query(
      'SELECT league_id FROM leagues WHERE league_id = $1 AND is_active = true',
      [id]
    );
    if (!leagueCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const conditions = ['c.is_active = true', 'c.league_id = $1'];
    const values = [id];

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`c.club_name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM clubs c ${whereClause}`,
      values
    );

    const total = countResult.rows[0]?.total || 0;
    const pagination = buildPagination(page, limit, total);
    const listValues = [...values, pagination.limit, pagination.offset];

    const result = await query(
      `SELECT c.*
      FROM clubs c
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
    const { search, sort = 'name', order = 'asc', jersey_type } = req.query;
    const sortMap = {
      name: 'j.name',
      price: 'j.price_usd',
      release_date: 'j.release_date',
      created_at: 'j.created_at',
    };
    const sortField = sortMap[sort] || 'j.name';
    const sortOrder = String(order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const leagueCheck = await query(
      'SELECT league_id FROM leagues WHERE league_id = $1 AND is_active = true',
      [id]
    );
    if (!leagueCheck.rows.length) {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    const conditions = ['j.is_active = true', 'j.league_id = $1'];
    const values = [id];

    if (jersey_type) {
      values.push(jersey_type);
      conditions.push(`j.jersey_type = $${values.length}`);
    }

    const boolFilters = {
      is_featured: parseBoolean(req.query.is_featured),
      is_new_arrival: parseBoolean(req.query.is_new_arrival),
      is_discounted: parseBoolean(req.query.is_discounted),
    };

    Object.entries(boolFilters).forEach(([field, value]) => {
      if (value !== undefined) {
        values.push(value);
        conditions.push(`j.${field} = $${values.length}`);
      }
    });

    if (search) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(`j.name ILIKE $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total
      FROM jerseys j
      JOIN clubs c ON c.club_id = j.club_id
      ${whereClause}`,
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
        c.crest_url,
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
