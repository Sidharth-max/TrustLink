/**
 * scripts/seed.js
 * One-time seed script to create the first admin agent.
 *
 * Usage:
 *   node scripts/seed.js
 *   (Will prompt for name, email, password, or use env defaults)
 *
 * Or with env vars:
 *   SEED_NAME="Admin" SEED_EMAIL="admin@trust.org" SEED_PASS="MySecure123" node scripts/seed.js
 */

'use strict';

const bcrypt = require('bcryptjs');
require('dotenv').config();

const { pool } = require('../src/utils/db');
const readline = require('readline');

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n═══════════════════════════════════════');
  console.log('  WhatsApp Trust Manager — Seed Admin');
  console.log('═══════════════════════════════════════\n');

  const name     = process.env.SEED_NAME  || await ask(rl, 'Admin name:  ');
  const email    = process.env.SEED_EMAIL || await ask(rl, 'Admin email: ');
  const password = process.env.SEED_PASS  || await ask(rl, 'Password:    ');
  rl.close();

  if (!name || !email || !password) {
    console.error('❌ All fields are required'); process.exit(1);
  }
  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters'); process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  try {
    const result = await pool.query(
      `INSERT INTO agents (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE
         SET name = EXCLUDED.name,
             password_hash = EXCLUDED.password_hash,
             role = 'admin'
       RETURNING id, name, email, role`,
      [name.trim(), email.toLowerCase().trim(), hash]
    );

    const a = result.rows[0];
    console.log(`\n✅ Admin agent ready:`);
    console.log(`   ID:    ${a.id}`);
    console.log(`   Name:  ${a.name}`);
    console.log(`   Email: ${a.email}`);
    console.log(`   Role:  ${a.role}`);
    console.log('\nYou can now log in at /\n');
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
