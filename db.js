import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  // Required for Neon serverless PostgreSQL
  ssl: {
    rejectUnauthorized: false,
  },
});

// Handle pool errors
pool.on('error', (err) => {
  console.log('Idle client error:', err);
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {array} params - Parameter values matched to placeholders
 * @returns {Promise} Query result
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query:', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
};

/**
 * Get a single client for a transaction
 */
export const getClient = async () => {
  return await pool.connect();
};

/**
 * Get database connection info
 */
export const getConnectionInfo = () => {
  const config = pool.options;
  return {
    host: config.host || 'neon.tech',
    port: config.port || 5432,
    database: config.database,
  };
};

/**
 * Close the pool (for graceful shutdown)
 */
export const closePool = async () => {
  await pool.end();
};

export default pool;
