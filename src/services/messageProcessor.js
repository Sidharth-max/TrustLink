/**
 * src/services/messageProcessor.js
 * Handles all incoming WhatsApp message events received via the webhook POST.
 *
 * Responsibilities:
 *  - Upsert contact into DB (create if first message)
 *  - Store message in messages table
 *  - Check for opt-out keywords (STOP, UNSUBSCRIBE, etc.)
 *  - Run bot flow matching (keyword triggers, menu selections)
 *  - Open or update conversation record
 */

'use strict';

const { query } = require('../utils/db');
const { sendTextMessage } = require('./whatsappApi');
const { matchBotFlow } = require('../bot/flowEngine');

// Keywords that trigger an opt-out — case-insensitive
const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'quit', 'cancel', 'optout', 'opt out', 'opt-out'];

/**
 * Main entry point called by webhook router for each incoming message.
 *
 * @param {object} message   Single message object from Meta webhook payload
 * @param {object} metadata  Contains phone_number_id etc.
 * @param {Array}  contacts  Contact profile from Meta (display name)
 */
async function processIncomingMessage(message, metadata, contacts = []) {
  const fromPhone = message.from; // E.164 format, e.g. "919876543210"
  const wamId     = message.id;   // WhatsApp message ID, e.g. "wamid.xxx"
  const msgType   = message.type; // text | image | audio | document | interactive | etc.
  const timestamp = new Date(parseInt(message.timestamp, 10) * 1000);

  // Extract display name sent by Meta if available
  const metaContact = contacts.find(c => c.wa_id === fromPhone);
  const displayName = metaContact?.profile?.name || null;

  console.log(`[MSG] Incoming ${msgType} from ${fromPhone} (${wamId})`);

  // ── 1. Upsert contact ──────────────────────────────────────────────────
  const contactRes = await query(
    `INSERT INTO contacts (phone, name, opted_in)
     VALUES ($1, $2, true)
     ON CONFLICT (phone) DO UPDATE
       SET name     = COALESCE(contacts.name, EXCLUDED.name),
           opted_in = true
     RETURNING id, opted_in`,
    [fromPhone, displayName]
  );
  const contact = contactRes.rows[0];

  // ── 2. Extract text content (handle different message types) ───────────
  let textContent = null;
  let mediaId     = null;

  if (msgType === 'text') {
    textContent = message.text?.body || '';
  } else if (['image', 'audio', 'video', 'document', 'sticker'].includes(msgType)) {
    // Store the media ID so it can be downloaded later via Media API
    mediaId     = message[msgType]?.id || null;
    textContent = message[msgType]?.caption || null;
  } else if (msgType === 'interactive') {
    // User tapped a button or picked from a list
    if (message.interactive?.type === 'button_reply') {
      textContent = message.interactive.button_reply?.title || '';
    } else if (message.interactive?.type === 'list_reply') {
      textContent = message.interactive.list_reply?.title || '';
    }
  }

  // ── 3. Check for opt-out ───────────────────────────────────────────────
  if (textContent && OPT_OUT_KEYWORDS.includes(textContent.trim().toLowerCase())) {
    await query('UPDATE contacts SET opted_in = false WHERE id = $1', [contact.id]);
    console.log(`[MSG] Opt-out received from contact ${contact.id}`);
    // Acknowledge opt-out back to the user
    await sendTextMessage(fromPhone, 'You have been unsubscribed. Reply START to resubscribe.');
    return; // Don't process further
  }

  // ── 4. Store message in DB ─────────────────────────────────────────────
  const msgRes = await query(
    `INSERT INTO messages
       (contact_id, direction, type, content, status, wam_id, sent_at)
     VALUES ($1, 'inbound', $2, $3, 'received', $4, $5)
     RETURNING id`,
    [contact.id, msgType, textContent || mediaId, wamId, timestamp]
  );
  const dbMessageId = msgRes.rows[0].id;

  // ── 5. Upsert conversation ─────────────────────────────────────────────
  const convRes = await query(
    `INSERT INTO conversations (contact_id, status, bot_active)
     VALUES ($1, 'open', true)
     ON CONFLICT (contact_id) DO UPDATE
       SET status     = CASE WHEN conversations.status = 'resolved' THEN 'open' ELSE conversations.status END,
           updated_at = NOW()
     RETURNING id, bot_active, assigned_to`,
    [contact.id]
  );
  const conversation = convRes.rows[0];
  console.log(`[MSG] Conversation lookup for contact ${contact.id}: conv_id=${conversation.id} assigned_to=${conversation.assigned_to}`);

  // ── 6. Bot flow matching (only if bot is active for this conversation) ──
  if (conversation.bot_active && textContent) {
    await matchBotFlow(textContent, fromPhone, contact.id, conversation.id);
  }
}

module.exports = { processIncomingMessage };
