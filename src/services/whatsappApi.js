/**
 * src/services/whatsappApi.js
 * Thin wrapper around the Meta WhatsApp Cloud API.
 * All outbound message sending goes through these functions.
 *
 * Meta Cloud API base: https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
 */

'use strict';

const axios = require('axios');
const { query } = require('../utils/db');

const BASE_URL = `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`;

/**
 * Build Axios headers with the Bearer token.
 */
function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Core send function — posts a message payload to Meta and stores the result.
 *
 * @param {object} payload      Meta-formatted message payload
 * @param {number} contactId    DB contact ID (for storing the message)
 * @param {string} [msgType]    Message type string for DB storage
 * @param {string} [content]    Human-readable content for DB log
 * @returns {Promise<string>}   wam_id returned by Meta
 */
async function sendPayload(payload, contactId, msgType = 'text', content = '') {
  try {
    const response = await axios.post(BASE_URL, payload, { headers: getHeaders() });
    const wamId    = response.data?.messages?.[0]?.id;

    console.log(`[WA-API] Sent ${msgType} to ${payload.to} — wamId: ${wamId}`);

    // Persist to messages table
    if (contactId) {
      await query(
        `INSERT INTO messages (contact_id, direction, type, content, status, wam_id, sent_at)
         VALUES ($1, 'outbound', $2, $3, 'sent', $4, NOW())`,
        [contactId, msgType, content, wamId]
      );
    }

    return wamId;
  } catch (err) {
    const errData = err.response?.data;
    console.error('[WA-API] Send error:', JSON.stringify(errData) || err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public send functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a plain text message.
 * @param {string} to          Recipient phone in E.164 (e.g. "919876543210")
 * @param {string} text        Message body
 * @param {number} [contactId] DB contact ID
 */
async function sendTextMessage(to, text, contactId = null) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  };
  return sendPayload(payload, contactId, 'text', text);
}

/**
 * Send an approved template message.
 * @param {string} to           Recipient phone
 * @param {string} templateName Approved template name
 * @param {string} languageCode e.g. "en_US" or "hi"
 * @param {Array}  components   Template component params (header, body, buttons)
 * @param {number} [contactId]  DB contact ID
 */
async function sendTemplateMessage(to, templateName, languageCode, components = [], contactId = null) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  };
  return sendPayload(payload, contactId, 'template', templateName);
}

/**
 * Send a media message (image, document, audio, video).
 * @param {string} to       Recipient phone
 * @param {'image'|'document'|'audio'|'video'} mediaType
 * @param {string} mediaUrl Publicly accessible URL of the media
 * @param {string} [caption] Optional caption (not for audio)
 * @param {string} [filename] Required for documents
 * @param {number} [contactId]
 */
async function sendMediaMessage(to, mediaType, mediaUrl, caption = '', filename = '', contactId = null) {
  const mediaObj = { link: mediaUrl };
  if (caption && mediaType !== 'audio') mediaObj.caption = caption;
  if (filename && mediaType === 'document') mediaObj.filename = filename;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: mediaType,
    [mediaType]: mediaObj,
  };
  return sendPayload(payload, contactId, mediaType, mediaUrl);
}

/**
 * Send an interactive reply-button message (up to 3 buttons).
 * @param {string} to        Recipient phone
 * @param {string} bodyText  Main message body text
 * @param {Array}  buttons   Array of { id, title } objects (max 3)
 * @param {number} [contactId]
 */
async function sendButtonMessage(to, bodyText, buttons, contactId = null) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title.slice(0, 20) }, // Meta: max 20 chars
        })),
      },
    },
  };
  return sendPayload(payload, contactId, 'interactive', bodyText);
}

/**
 * Send an interactive list-picker message.
 * @param {string} to          Recipient phone
 * @param {string} bodyText    Message body
 * @param {string} buttonLabel Label for the list-open button (max 20 chars)
 * @param {Array}  sections    Array of { title, rows: [{ id, title, description }] }
 * @param {number} [contactId]
 */
async function sendListMessage(to, bodyText, buttonLabel, sections, contactId = null) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonLabel.slice(0, 20),
        sections,
      },
    },
  };
  return sendPayload(payload, contactId, 'interactive', bodyText);
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  sendButtonMessage,
  sendListMessage,
};
