/**
 * src/utils/db.js
 * PostgreSQL connection pool — single shared instance used across the app.
 */

'use strict';

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Allow disabling SSL via DB_SSL=false for local Docker production environments
  ssl: (process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false'))
    ? { rejectUnauthorized: false }
    : false,
  max: 10,               // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log connectivity problems without crashing the process
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Convenience wrapper — run a single query with optional params.
 * @param {string} text   SQL string with $1, $2 … placeholders
 * @param {Array}  params Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DB] query (${duration}ms):`, text.slice(0, 80));
    }
    return res;
  } catch (err) {
    console.error('[DB] Query error:', err.message, '\nSQL:', text);
    throw err;
  }
}

module.exports = { pool, query };
