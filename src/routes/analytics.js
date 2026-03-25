/**
 * src/routes/analytics.js
 * Reporting and delivery analytics.
 *
 * GET /api/analytics/overview    — totals: messages sent/delivered/read, contacts, etc.
 * GET /api/analytics/timeline    — daily message counts for a date range (for charts)
 * GET /api/analytics/broadcasts  — per-broadcast stats
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { query } = require('../utils/db');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/overview
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res, next) => {
  try {
    const [contacts, messages, conversations, broadcasts] = await Promise.all([
      query(`SELECT
               COUNT(*)                                     AS total,
               COUNT(*) FILTER (WHERE opted_in = true)      AS opted_in,
               COUNT(*) FILTER (WHERE opted_in = false)     AS opted_out
             FROM contacts`, []),

      query(`SELECT
               COUNT(*) FILTER (WHERE direction = 'outbound')                    AS total_sent,
               COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'delivered') AS delivered,
               COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'read')      AS read,
               COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed')    AS failed,
               COUNT(*) FILTER (WHERE direction = 'inbound')                     AS total_received
             FROM messages`, []),

      query(`SELECT
               COUNT(*)                                      AS total,
               COUNT(*) FILTER (WHERE status = 'open')       AS open,
               COUNT(*) FILTER (WHERE status = 'pending')    AS pending,
               COUNT(*) FILTER (WHERE status = 'resolved')   AS resolved
             FROM conversations`, []),

      query(`SELECT COUNT(*) AS total,
               SUM(sent_count)   AS total_sent,
               SUM(failed_count) AS total_failed
             FROM broadcasts WHERE status = 'completed'`, []),
    ]);

    const msg = messages.rows[0];
    const totalSent = parseInt(msg.total_sent, 10) || 1; // avoid div-by-zero

    res.json({
      contacts:      contacts.rows[0],
      messages: {
        ...msg,
        delivery_rate: ((parseInt(msg.delivered, 10) / totalSent) * 100).toFixed(1) + '%',
        read_rate:     ((parseInt(msg.read,       10) / totalSent) * 100).toFixed(1) + '%',
      },
      conversations: conversations.rows[0],
      broadcasts:    broadcasts.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/timeline
// Query params: from (ISO date), to (ISO date), direction (inbound|outbound|all)
// Returns: array of { date, count } — one row per day
// ─────────────────────────────────────────────────────────────────────────────
router.get('/timeline', async (req, res, next) => {
  try {
    const from      = req.query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to        = req.query.to   || new Date().toISOString().slice(0, 10);
    const direction = req.query.direction || 'all';

    const conditions = [`DATE(created_at) BETWEEN $1 AND $2`];
    const params     = [from, to];

    if (direction !== 'all') {
      conditions.push(`direction = $3`);
      params.push(direction);
    }

    const result = await query(
      `SELECT
         DATE(created_at)  AS date,
         direction,
         COUNT(*)::int     AS count
       FROM messages
       WHERE ${conditions.join(' AND ')}
       GROUP BY date, direction
       ORDER BY date ASC`,
      params
    );

    res.json({ timeline: result.rows, from, to });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/broadcasts
// Shows per-broadcast delivery statistics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/broadcasts', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         id, name, template_name, segment_tag,
         status, sent_count, failed_count, created_at,
         CASE WHEN sent_count > 0
              THEN ROUND(sent_count::numeric / (sent_count + failed_count) * 100, 1)
              ELSE 0 END AS success_rate
       FROM broadcasts
       ORDER BY created_at DESC
       LIMIT 50`,
      []
    );
    res.json({ broadcasts: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
