/**
 * src/services/deliveryTracker.js
 * Updates the delivery status of outbound messages when Meta sends status webhooks.
 *
 * Status lifecycle (per Meta docs):
 *   sent → delivered → read
 *   or
 *   sent → failed
 */

'use strict';

const { query } = require('../utils/db');

/**
 * Handle a single status object from the webhook statuses array.
 *
 * @param {object} status Meta status event object
 * @param {string} status.id      wam_id of the original message
 * @param {string} status.status  'sent' | 'delivered' | 'read' | 'failed'
 * @param {string} status.timestamp Unix timestamp string
 */
async function updateDeliveryStatus(status) {
  const { id: wamId, status: deliveryStatus, timestamp, errors } = status;

  if (!wamId || !deliveryStatus) {
    console.warn('[DELIVERY] Skipping malformed status object:', JSON.stringify(status));
    return;
  }

  const eventTime = new Date(parseInt(timestamp, 10) * 1000);

  console.log(`[DELIVERY] wamId=${wamId} status=${deliveryStatus}`);

  // Update the matching message row using the WhatsApp message ID (wam_id)
  const result = await query(
    `UPDATE messages
     SET status   = $1,
         -- record sent_at only on first 'sent' event if not already set
         sent_at  = CASE WHEN $1 = 'sent' AND sent_at IS NULL THEN $3 ELSE sent_at END
     WHERE wam_id = $2
     RETURNING id`,
    [deliveryStatus, wamId, eventTime]
  );

  if (result.rowCount === 0) {
    // This can happen if the message was sent before DB migration or wam_id wasn't stored
    console.warn(`[DELIVERY] No message found for wamId=${wamId}`);
  }

  // If status is 'failed', log the error details for debugging
  if (deliveryStatus === 'failed' && Array.isArray(errors)) {
    for (const err of errors) {
      console.error(`[DELIVERY] Message ${wamId} failed: code=${err.code} title=${err.title}`);
    }
  }
}

module.exports = { updateDeliveryStatus };
