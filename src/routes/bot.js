/**
 * src/routes/bot.js
 * Admin CRUD for chatbot keyword flows.
 * All routes require authentication (requireAuth applied in server.js).
 *
 * GET    /api/bot                 — list all flows
 * POST   /api/bot                 — create a flow
 * PUT    /api/bot/:id             — update a flow
 * DELETE /api/bot/:id             — delete a flow
 * PATCH  /api/bot/:id/toggle      — toggle active boolean
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { query } = require('../utils/db');

const VALID_TYPES = ['text', 'buttons', 'list', 'handoff'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/bot
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM bot_flows ORDER BY active DESC, trigger_keyword ASC',
      []
    );
    // Parse response_content from JSON string back to object for the UI
    const flows = result.rows.map(row => ({
      ...row,
      response_content: parseJsonSafe(row.response_content),
    }));
    res.json({ flows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/bot
// Body: { trigger_keyword, response_type, response_content, active }
// response_content can be a JS object or a JSON string
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { trigger_keyword, response_type, response_content, active = true } = req.body;

    if (!trigger_keyword || !response_type || !response_content) {
      return res.status(400).json({ error: 'trigger_keyword, response_type, and response_content are required' });
    }
    if (!VALID_TYPES.includes(response_type)) {
      return res.status(400).json({ error: `response_type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const contentStr = serializeContent(response_content);

    const result = await query(
      `INSERT INTO bot_flows (trigger_keyword, response_type, response_content, active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [trigger_keyword.trim().toLowerCase(), response_type, contentStr, Boolean(active)]
    );

    res.status(201).json({ flow: { ...result.rows[0], response_content: parseJsonSafe(result.rows[0].response_content) } });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/bot/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { trigger_keyword, response_type, response_content, active } = req.body;

    const sets   = [];
    const params = [];
    let p = 1;

    if (trigger_keyword !== undefined) { sets.push(`trigger_keyword = $${p++}`);  params.push(trigger_keyword.trim().toLowerCase()); }
    if (response_type   !== undefined) {
      if (!VALID_TYPES.includes(response_type)) return res.status(400).json({ error: 'Invalid response_type' });
      sets.push(`response_type = $${p++}`); params.push(response_type);
    }
    if (response_content !== undefined) { sets.push(`response_content = $${p++}`); params.push(serializeContent(response_content)); }
    if (active          !== undefined) { sets.push(`active = $${p++}`);            params.push(Boolean(active)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const result = await query(
      `UPDATE bot_flows SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });

    res.json({ flow: { ...result.rows[0], response_content: parseJsonSafe(result.rows[0].response_content) } });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/bot/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM bot_flows WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/bot/:id/toggle  — flip active state
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE bot_flows SET active = NOT active WHERE id = $1 RETURNING id, active',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ id: result.rows[0].id, active: result.rows[0].active });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseJsonSafe(val) {
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return val; }
}

function serializeContent(val) {
  if (typeof val === 'string') {
    // Validate it's valid JSON if it looks like one
    try { JSON.parse(val); return val; } catch { /* treat as plain text */ }
    return JSON.stringify({ message: val });
  }
  return JSON.stringify(val);
}

module.exports = router;
