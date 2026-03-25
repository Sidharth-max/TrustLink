/**
 * src/services/scheduler.js
 * Cron job that polls for scheduled messages and sends them at/after their scheduled_at time.
 * Runs every minute using node-cron.
 */

'use strict';

const cron = require('node-cron');
const { query } = require('../utils/db');
const { sendTextMessage, sendTemplateMessage, sendMediaMessage } = require('./whatsappApi');

/**
 * Process any messages due for delivery (scheduled_at <= NOW and status = 'scheduled').
 */
async function processDueMessages() {
  // Fetch all due messages — join with contacts to get phone number
  const res = await query(
    `SELECT m.id, m.type, m.content, m.contact_id, c.phone, c.opted_in
     FROM messages m
     JOIN contacts c ON c.id = m.contact_id
     WHERE m.status = 'scheduled'
       AND m.scheduled_at <= NOW()
       AND c.opted_in = true
     ORDER BY m.scheduled_at ASC
     LIMIT 50`,
    []
  );

  if (res.rows.length === 0) return;
  console.log(`[SCHEDULER] Processing ${res.rows.length} scheduled message(s)`);

  for (const msg of res.rows) {
    try {
      // Parse content — stored as JSON for non-text types
      let content;
      try {
        content = JSON.parse(msg.content);
      } catch {
        content = msg.content; // plain text
      }

      if (msg.type === 'text') {
        await sendTextMessage(msg.phone, content, msg.contact_id);
      } else if (msg.type === 'template') {
        // content: { templateName, languageCode, components }
        await sendTemplateMessage(
          msg.phone,
          content.templateName,
          content.languageCode,
          content.components || [],
          msg.contact_id
        );
      } else if (['image', 'document', 'audio', 'video'].includes(msg.type)) {
        // content: { url, caption, filename }
        await sendMediaMessage(msg.phone, msg.type, content.url, content.caption, content.filename, msg.contact_id);
      }

      // Mark original row as 'sent' (sendPayload inserts a new row; mark this one done)
      await query("UPDATE messages SET status = 'sent', sent_at = NOW() WHERE id = $1", [msg.id]);
    } catch (err) {
      console.error(`[SCHEDULER] Failed to send message id=${msg.id}:`, err.message);
      await query("UPDATE messages SET status = 'failed' WHERE id = $1", [msg.id]);
    }
  }
}

/**
 * Start the scheduler — runs every minute.
 * Called once from server.js on startup.
 */
function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      await processDueMessages();
    } catch (err) {
      console.error('[SCHEDULER] Cron error:', err.message);
    }
  });
  console.log('[SCHEDULER] Started — polling every minute for scheduled messages');
}

module.exports = { startScheduler };
