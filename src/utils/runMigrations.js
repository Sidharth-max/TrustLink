/**
 * src/utils/runMigrations.js
 * Applies migration SQL files in order.
 * Run with:  node src/utils/runMigrations.js
 * Or via:    npm run migrate
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          SERIAL PRIMARY KEY,
        filename    TEXT UNIQUE NOT NULL,
        applied_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get list of already-applied migrations
    const applied = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.rows.map(r => r.filename));

    // Read migration files sorted alphabetically (001_, 002_, etc.)
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[MIGRATE] Skipping (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[MIGRATE] Applying: ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATE] ✓ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATE] ✗ Failed on ${file}:`, err.message);
        process.exit(1);
      }
    }

    console.log('[MIGRATE] All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('[MIGRATE] Fatal:', err.message);
  process.exit(1);
});
