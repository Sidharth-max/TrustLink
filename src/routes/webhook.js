/**
 * src/routes/webhook.js
 * Handles Meta WhatsApp Cloud API webhook.
 *
 * GET  /webhook  — token verification handshake (called once by Meta when you save the webhook URL)
 * POST /webhook  — incoming messages, statuses, and other notification events
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { processIncomingMessage } = require('../services/messageProcessor');
const { updateDeliveryStatus } = require('../services/deliveryTracker');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify the X-Hub-Signature-256 header that Meta sends with every POST.
 * Only enforced if WEBHOOK_SECRET is set in .env.
 *
 * @param {Buffer} rawBody   Raw request body bytes
 * @param {string} signature Value of X-Hub-Signature-256 header
 * @returns {boolean}
 */
function isValidSignature(rawBody, signature) {
  if (!process.env.WEBHOOK_SECRET) return true; // skip if not configured
  if (!signature || !signature.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Safely extract the first change object from any Meta webhook payload.
 * Meta always wraps events in entry[].changes[].
 *
 * @param {object} body Parsed webhook JSON body
 * @returns {object[]} Flat array of all change value objects
 */
function extractChanges(body) {
  const changes = [];
  if (!Array.isArray(body.entry)) return changes;

  for (const entry of body.entry) {
    if (!Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (change.value) changes.push(change.value);
    }
  }
  return changes;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /webhook — Meta verification handshake
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') {
    console.warn('[WEBHOOK] GET — unexpected hub.mode:', mode);
    return res.sendStatus(400);
  }

  if (token !== process.env.VERIFY_TOKEN) {
    console.warn('[WEBHOOK] GET — verify token mismatch');
    return res.sendStatus(403);
  }

  console.log('[WEBHOOK] GET — verification successful');
  // Must return the challenge value as plain text for Meta to confirm
  res.status(200).send(challenge);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /webhook — receive messages and status updates
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // ── Signature verification ──────────────────────────────────────────────
  const signature = req.headers['x-hub-signature-256'];
  const rawBody   = req.body; // Buffer because of express.raw() in server.js

  if (!isValidSignature(rawBody, signature)) {
    console.warn('[WEBHOOK] POST — invalid signature, rejecting');
    return res.sendStatus(403);
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    console.error('[WEBHOOK] POST — failed to parse JSON:', err.message);
    return res.sendStatus(400);
  }

  // Validate top-level structure
  if (payload.object !== 'whatsapp_business_account') {
    // Could be a different Meta product — just acknowledge and ignore
    return res.sendStatus(200);
  }

  // ── Acknowledge immediately (Meta requires < 20 s response) ─────────────
  res.sendStatus(200);

  // ── Process asynchronously so we never block the HTTP response ──────────
  const changes = extractChanges(payload);

  for (const value of changes) {
    try {
      // Process incoming messages (text, image, audio, etc.)
      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          await processIncomingMessage(message, value.metadata, value.contacts);
        }
      }

      // Process delivery / read status updates
      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          await updateDeliveryStatus(status);
        }
      }
    } catch (err) {
      // Log but don't crash — Meta will retry if we 5xx'd, but we already 200'd
      console.error('[WEBHOOK] Processing error:', err.message);
    }
  }
});

module.exports = router;
