/**
 * src/routes/messages.js
 * Outbound message sending and conversation history for the agent chat view.
 *
 * GET  /api/messages/conversations          — list all conversations (inbox)
 * GET  /api/messages/conversations/:id      — single conversation + messages
 * PUT  /api/messages/conversations/:id      — update status / assignment / bot toggle
 * POST /api/messages/send                   — send a message to a contact NOW
 * POST /api/messages/schedule               — schedule a future message
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { query }  = require('../utils/db');
const {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  sendButtonMessage,
  sendListMessage,
} = require('../services/whatsappApi');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/conversations
// Lists all conversations with contact info, agent name, and last message.
// Query params: status (open|pending|resolved|all), page, limit
// ─────────────────────────────────────────────────────────────────────────────
router.get('/conversations', async (req, res, next) => {
  try {
    const status = req.query.status || 'open';
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(100, parseInt(req.query.limit || '30', 10));
    const offset = (page - 1) * limit;

    const whereStatus = status !== 'all' ? `AND conv.status = '${status}'` : '';

    const result = await query(
      `SELECT
         conv.id, conv.status, conv.bot_active, conv.updated_at,
         c.id    AS contact_id,
         c.name  AS contact_name,
         c.phone AS contact_phone,
         a.id    AS agent_id,
         a.name  AS agent_name,
         -- Latest message snippet
         (SELECT content FROM messages
          WHERE contact_id = c.id
          ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT created_at FROM messages
          WHERE contact_id = c.id
          ORDER BY created_at DESC LIMIT 1) AS last_message_at,
         -- Count unread (inbound messages with no outbound reply after them)
         (SELECT COUNT(*) FROM messages m2
          WHERE m2.contact_id = c.id AND m2.direction = 'inbound'
            AND m2.created_at > COALESCE(
              (SELECT MAX(created_at) FROM messages
               WHERE contact_id = c.id AND direction = 'outbound'), '1970-01-01'
            )
         )::int AS unread_count
       FROM conversations conv
       JOIN contacts c ON c.id = conv.contact_id
       LEFT JOIN agents a ON a.id = conv.assigned_to
       WHERE 1=1 ${whereStatus}
       ORDER BY conv.updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) FROM conversations WHERE 1=1 ${whereStatus}`,
      []
    );

    res.json({
      conversations: result.rows,
      pagination: {
        page, limit,
        total: parseInt(countRes.rows[0].count, 10),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages/conversations/:id
// Single conversation with full message history (newest first, paginated)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
    const limit  = Math.min(100, parseInt(req.query.limit || '50', 10));
    const offset = (page - 1) * limit;

    const convRes = await query(
      `SELECT conv.*, c.name AS contact_name, c.phone AS contact_phone,
              c.tags, c.opted_in, a.name AS agent_name
       FROM conversations conv
       JOIN contacts c ON c.id = conv.contact_id
       LEFT JOIN agents a ON a.id = conv.assigned_to
       WHERE conv.id = $1`,
      [id]
    );
    if (convRes.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });

    const conv      = convRes.rows[0];
    const msgRes    = await query(
      `SELECT id, direction, type, content, status, wam_id, sent_at, created_at
       FROM messages WHERE contact_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [conv.contact_id, limit, offset]
    );

    res.json({ conversation: conv, messages: msgRes.rows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/messages/conversations/:id
// Update conversation: status, assigned_to, bot_active
// ─────────────────────────────────────────────────────────────────────────────
router.put('/conversations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, bot_active } = req.body;

    const sets   = [];
    const params = [];
    let p = 1;

    if (status !== undefined) {
      if (!['open', 'pending', 'resolved'].includes(status)) {
        return res.status(400).json({ error: 'status must be open | pending | resolved' });
      }
      sets.push(`status = $${p++}`); params.push(status);
    }
    if (assigned_to !== undefined) { sets.push(`assigned_to = $${p++}`); params.push(assigned_to || null); }
    if (bot_active  !== undefined) { sets.push(`bot_active = $${p++}`);  params.push(Boolean(bot_active)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const result = await query(
      `UPDATE conversations SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ conversation: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messages/send
// Immediately send a message to a contact.
// Body: { contact_id, type, content }
//
// type = 'text'      → content: "Your message here"
// type = 'template'  → content: { templateName, languageCode, components }
// type = 'image'|'document'|'audio'|'video'
//                    → content: { url, caption, filename }
// type = 'buttons'   → content: { message, buttons: [{id,title}] }
// type = 'list'      → content: { message, buttonLabel, sections }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/send', async (req, res, next) => {
  try {
    const { contact_id, type = 'text', content } = req.body;
    if (!contact_id || !content) {
      return res.status(400).json({ error: 'contact_id and content are required' });
    }

    // Fetch contact phone
    const contactRes = await query(
      'SELECT id, phone, opted_in FROM contacts WHERE id = $1',
      [contact_id]
    );
    if (contactRes.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    const contact = contactRes.rows[0];

    if (!contact.opted_in) {
      return res.status(403).json({ error: 'Contact has opted out — cannot send messages' });
    }

    let wamId;
    switch (type) {
      case 'text':
        wamId = await sendTextMessage(contact.phone, content, contact_id);
        break;
      case 'template':
        wamId = await sendTemplateMessage(
          contact.phone, content.templateName, content.languageCode,
          content.components || [], contact_id
        );
        break;
      case 'image': case 'document': case 'audio': case 'video':
        wamId = await sendMediaMessage(
          contact.phone, type, content.url, content.caption, content.filename, contact_id
        );
        break;
      case 'buttons':
        wamId = await sendButtonMessage(contact.phone, content.message, content.buttons, contact_id);
        break;
      case 'list':
        wamId = await sendListMessage(
          contact.phone, content.message, content.buttonLabel, content.sections, contact_id
        );
        break;
      default:
        return res.status(400).json({ error: `Unsupported message type: ${type}` });
    }

    // Ensure conversation exists and is open
    await query(
      `INSERT INTO conversations (contact_id, status, bot_active)
       VALUES ($1, 'open', false)
       ON CONFLICT (contact_id) DO UPDATE
         SET status = CASE WHEN conversations.status = 'resolved' THEN 'open' ELSE conversations.status END,
             bot_active = false,
             updated_at = NOW()`,
      [contact_id]
    );

    res.json({ success: true, wam_id: wamId });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messages/schedule
// Queue a message for future delivery (picked up by the scheduler cron).
// Body: { contact_id, type, content, scheduled_at }  (scheduled_at is ISO 8601)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schedule', async (req, res, next) => {
  try {
    const { contact_id, type = 'text', content, scheduled_at } = req.body;
    if (!contact_id || !content || !scheduled_at) {
      return res.status(400).json({ error: 'contact_id, content, and scheduled_at are required' });
    }

    const schedDate = new Date(scheduled_at);
    if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
      return res.status(400).json({ error: 'scheduled_at must be a future datetime' });
    }

    // Verify contact exists and is opted in
    const contactRes = await query('SELECT opted_in FROM contacts WHERE id = $1', [contact_id]);
    if (contactRes.rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    if (!contactRes.rows[0].opted_in) {
      return res.status(403).json({ error: 'Contact has opted out' });
    }

    // Store as JSON string for non-text types
    const storedContent = typeof content === 'object' ? JSON.stringify(content) : content;

    const result = await query(
      `INSERT INTO messages (contact_id, direction, type, content, status, scheduled_at)
       VALUES ($1, 'outbound', $2, $3, 'scheduled', $4)
       RETURNING id, scheduled_at`,
      [contact_id, type, storedContent, schedDate.toISOString()]
    );

    res.status(201).json({ success: true, scheduled_message: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
