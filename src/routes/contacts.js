/**
 * src/routes/contacts.js
 * Full CRUD + CSV import for contacts.
 *
 * All routes require authentication (requireAuth applied in server.js).
 *
 * GET    /api/contacts              — list with search, tag filter, pagination
 * GET    /api/contacts/:id          — single contact + recent messages
 * POST   /api/contacts              — create single contact
 * PUT    /api/contacts/:id          — update contact
 * DELETE /api/contacts/:id          — delete contact
 * POST   /api/contacts/import/csv   — bulk import from CSV file
 * GET    /api/contacts/tags         — distinct tag list for filter dropdowns
 */

'use strict';

const express = require('express');
const multer  = require('multer');
const { parse } = require('csv-parse');
const path    = require('path');
const fs      = require('fs');
const { query } = require('../utils/db');

const router = express.Router();

// ── Multer config: accept CSV uploads up to 5 MB ─────────────────────────────
const upload = multer({
  dest: process.env.UPLOAD_DIR || './uploads',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && file.mimetype !== 'text/csv' && file.mimetype !== 'application/vnd.ms-excel') {
      return cb(new Error('Only .csv files are allowed'));
    }
    cb(null, true);
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a phone number to E.164-ish digits-only format.
 * Strips spaces, dashes, parens, leading + sign.
 * Does NOT do full country-code validation — just cleans obvious formatting.
 *
 * @param {string} raw Raw phone input
 * @returns {string} Cleaned phone string
 */
function normalizePhone(raw) {
  return String(raw).replace(/\D/g, '');
}

/**
 * Parse a tags string (comma-separated) into a normalised lowercase string.
 * e.g. " Devotee , Newsletter " → "devotee,newsletter"
 */
function normalizeTags(raw) {
  if (!raw) return '';
  return raw.split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .join(',');
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contacts/tags — must come BEFORE /:id to avoid route conflict
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tags', async (req, res, next) => {
  try {
    // Tags are stored as comma-separated strings — flatten and deduplicate in JS
    const result = await query(`SELECT tags FROM contacts WHERE tags IS NOT NULL AND tags != ''`, []);
    const tagSet = new Set();
    for (const row of result.rows) {
      row.tags.split(',').forEach(t => { if (t.trim()) tagSet.add(t.trim()); });
    }
    res.json({ tags: Array.from(tagSet).sort() });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contacts
// Query params: search, tag, opted_in, page (default 1), limit (default 50)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit   = Math.min(200, parseInt(req.query.limit || '50', 10));
    const offset  = (page - 1) * limit;
    const search  = req.query.search ? `%${req.query.search}%` : null;
    const tag     = req.query.tag    || null;
    const optedIn = req.query.opted_in; // 'true' | 'false' | undefined

    const conditions = [];
    const params = [];
    let p = 1;

    if (search) {
      conditions.push(`(name ILIKE $${p} OR phone ILIKE $${p})`);
      params.push(search);
      p++;
    }
    if (tag) {
      // Match if tags contains the tag as a whole word (comma-delimited)
      conditions.push(`(',' || tags || ',' ILIKE $${p})`);
      params.push(`%,${tag},%`);
      p++;
    }
    if (optedIn === 'true')  { conditions.push(`opted_in = true`);  }
    if (optedIn === 'false') { conditions.push(`opted_in = false`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(`SELECT COUNT(*) FROM contacts ${where}`, params);
    const total    = parseInt(countRes.rows[0].count, 10);

    const dataRes  = await query(
      `SELECT id, name, phone, tags, opted_in, created_at
       FROM contacts
       ${where}
       ORDER BY created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    res.json({
      contacts: dataRes.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/contacts/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const contactRes = await query(
      `SELECT c.*, conv.id AS conversation_id, conv.status AS conv_status,
              conv.bot_active, conv.assigned_to, a.name AS agent_name
       FROM contacts c
       LEFT JOIN conversations conv ON conv.contact_id = c.id
       LEFT JOIN agents a ON a.id = conv.assigned_to
       WHERE c.id = $1`,
      [id]
    );
    if (contactRes.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });

    // Fetch last 50 messages for this contact
    const msgRes = await query(
      `SELECT id, direction, type, content, status, wam_id, sent_at, created_at
       FROM messages
       WHERE contact_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    res.json({ contact: contactRes.rows[0], messages: msgRes.rows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contacts
// Body: { name, phone, tags, opted_in }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, tags, opted_in = true } = req.body;

    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const cleaned = normalizePhone(phone);
    if (cleaned.length < 7) return res.status(400).json({ error: 'Invalid phone number' });

    const result = await query(
      `INSERT INTO contacts (name, phone, tags, opted_in)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (phone) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, contacts.name),
             tags = EXCLUDED.tags,
             opted_in = EXCLUDED.opted_in
       RETURNING *`,
      [name?.trim() || null, cleaned, normalizeTags(tags), Boolean(opted_in)]
    );

    res.status(201).json({ contact: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/contacts/:id
// Body: any subset of { name, phone, tags, opted_in }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { name, phone, tags, opted_in } = req.body;

    // Build dynamic SET clause
    const sets   = [];
    const params = [];
    let p = 1;

    if (name    !== undefined) { sets.push(`name = $${p++}`);     params.push(name?.trim() || null); }
    if (phone   !== undefined) { sets.push(`phone = $${p++}`);    params.push(normalizePhone(phone)); }
    if (tags    !== undefined) { sets.push(`tags = $${p++}`);     params.push(normalizeTags(tags)); }
    if (opted_in !== undefined){ sets.push(`opted_in = $${p++}`); params.push(Boolean(opted_in)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const result = await query(
      `UPDATE contacts SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });

    res.json({ contact: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/contacts/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM contacts WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/contacts/import/csv
// Accepts a multipart/form-data upload with field name "file".
//
// Expected CSV columns (header row required):
//   phone       — required
//   name        — optional
//   tags        — optional (comma-separated within the cell, e.g. "devotee,newsletter")
//   opted_in    — optional (1/true/yes = opted in; anything else = false)
//
// Returns: { imported, skipped, errors } summary object
// ─────────────────────────────────────────────────────────────────────────────
router.post('/import/csv', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded (field name: file)' });

  const filePath = req.file.path;
  const results  = { imported: 0, skipped: 0, errors: [] };

  try {
    // Read and parse the CSV file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const records     = await new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true,          // use header row as keys
        skip_empty_lines: true,
        trim: true,
        bom: true,              // handle UTF-8 BOM from Excel exports
      }, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or has no data rows' });
    }

    // Process each row in a transaction-like loop (individual row errors don't abort the rest)
    for (const [idx, row] of records.entries()) {
      const lineNum = idx + 2; // +2 because line 1 is the header

      // Normalise column names — accept lowercase/uppercase variations
      const rawPhone   = row.phone   || row.Phone   || row.PHONE   || '';
      const rawName    = row.name    || row.Name    || row.NAME    || '';
      const rawTags    = row.tags    || row.Tags    || row.TAGS    || '';
      const rawOptedIn = row.opted_in ?? row.OptedIn ?? row.opted_in ?? '1';

      const phone = normalizePhone(rawPhone);

      if (phone.length < 7) {
        results.errors.push({ line: lineNum, phone: rawPhone, reason: 'Invalid or missing phone' });
        results.skipped++;
        continue;
      }

      // Parse opted_in — any truthy-ish value counts as opted in
      const falsy   = ['0', 'false', 'no', 'n', 'opt-out', 'optout', 'stop'];
      const optedIn = !falsy.includes(String(rawOptedIn).toLowerCase().trim());

      try {
        await query(
          `INSERT INTO contacts (name, phone, tags, opted_in)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (phone) DO UPDATE
             SET name     = COALESCE(EXCLUDED.name, contacts.name),
                 tags     = CASE WHEN EXCLUDED.tags != '' THEN EXCLUDED.tags ELSE contacts.tags END,
                 opted_in = EXCLUDED.opted_in`,
          [rawName.trim() || null, phone, normalizeTags(rawTags), optedIn]
        );
        results.imported++;
      } catch (err) {
        results.errors.push({ line: lineNum, phone, reason: err.message });
        results.skipped++;
      }
    }

    res.json({ success: true, ...results });
  } catch (err) {
    next(err);
  } finally {
    // Always clean up the temp upload file
    fs.unlink(filePath, () => {});
  }
});

module.exports = router;
