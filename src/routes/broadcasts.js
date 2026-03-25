/**
 * src/routes/broadcasts.js
 * Bulk broadcast campaign management.
 *
 * GET    /api/broadcasts          — list all broadcasts
 * GET    /api/broadcasts/:id      — single broadcast detail
 * POST   /api/broadcasts          — create a new broadcast (draft)
 * POST   /api/broadcasts/:id/send — trigger immediate send of a broadcast
 * DELETE /api/broadcasts/:id      — delete a draft broadcast
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { query }                = require('../utils/db');
const { sendTemplateMessage }  = require('../services/whatsappApi');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/broadcasts
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 100',
      []
    );
    res.json({ broadcasts: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/broadcasts/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM broadcasts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Broadcast not found' });
    res.json({ broadcast: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/broadcasts
// Body: { name, template_name, language_code, segment_tag, scheduled_at }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const {
      name, template_name, language_code = 'en_US',
      segment_tag = '', recipients = '', scheduled_at = null,
    } = req.body;

    if (!name || !template_name) {
      return res.status(400).json({ error: 'name and template_name are required' });
    }

    // Validate scheduled_at if provided
    let schedDate = null;
    if (scheduled_at) {
      schedDate = new Date(scheduled_at);
      if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
        return res.status(400).json({ error: 'scheduled_at must be a future datetime' });
      }
    }

    const result = await query(
      `INSERT INTO broadcasts (name, template_name, language_code, segment_tag, recipients, scheduled_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name.trim(), template_name.trim(), language_code, 
        segment_tag ? segment_tag.trim() : '', 
        recipients ? recipients.trim() : '',
        schedDate ? schedDate.toISOString() : null,
        schedDate ? 'scheduled' : 'draft',
      ]
    );

    res.status(201).json({ broadcast: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/broadcasts/:id/send
// Sends the broadcast to all matching opted-in contacts.
// This runs synchronously for small lists; for large lists consider a queue.
// Body (optional): { components } — template component params applied to all recipients
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/send', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { components = [] } = req.body;

    // Load the broadcast
    const bcastRes = await query('SELECT * FROM broadcasts WHERE id = $1', [id]);
    if (bcastRes.rows.length === 0) return res.status(404).json({ error: 'Broadcast not found' });
    const broadcast = bcastRes.rows[0];

    if (!['draft', 'scheduled', 'failed'].includes(broadcast.status)) {
      return res.status(409).json({ error: `Broadcast is already ${broadcast.status}` });
    }

    // Mark as running
    await query("UPDATE broadcasts SET status = 'running' WHERE id = $1", [id]);

    // Fetch target contacts
    let contactsQuery = `SELECT id, phone FROM contacts WHERE opted_in = true`;
    const params = [];

    if (broadcast.recipients && broadcast.recipients.trim() !== '') {
      // Priority 1: Specific phone numbers
      const phones = broadcast.recipients.split(',').map(p => p.trim()).filter(Boolean);
      contactsQuery += ` AND phone = ANY($1)`;
      params.push(phones);
    } else if (broadcast.segment_tag && broadcast.segment_tag.trim() !== '') {
      // Priority 2: Segment tag
      contactsQuery += ` AND (',' || tags || ',' ILIKE $1)`;
      params.push(`%,${broadcast.segment_tag.trim()},%`);
    }

    const contactRes = await query(contactsQuery, params);
    const contacts   = contactRes.rows;

    if (contacts.length === 0) {
      await query("UPDATE broadcasts SET status = 'completed' WHERE id = $1", [id]);
      return res.json({ success: true, sent: 0, failed: 0, message: 'No matching contacts' });
    }

    // Send to each contact — continue on individual failures
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const contact of contacts) {
      try {
        await sendTemplateMessage(
          contact.phone,
          broadcast.template_name,
          broadcast.language_code,
          components,
          contact.id
        );
        sentCount++;
        // Small delay to avoid hitting Meta rate limits on large lists
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        failedCount++;
        errors.push({ phone: contact.phone, error: err.message });
        console.error(`[BROADCAST] Failed to send to ${contact.phone}:`, err.message);
      }
    }

    // Update final status
    await query(
      `UPDATE broadcasts
       SET status = 'completed', sent_count = $2, failed_count = $3
       WHERE id = $1`,
      [id, sentCount, failedCount]
    );

    res.json({ success: true, sent: sentCount, failed: failedCount, errors });
  } catch (err) {
    // Mark as failed if something went critically wrong
    await query("UPDATE broadcasts SET status = 'failed' WHERE id = $1", [req.params.id]).catch(() => {});
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/broadcasts/:id  (only draft broadcasts can be deleted)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await query(
      "DELETE FROM broadcasts WHERE id = $1 AND status IN ('draft','scheduled') RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Broadcast not found or cannot be deleted (not a draft)' });
    }
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
