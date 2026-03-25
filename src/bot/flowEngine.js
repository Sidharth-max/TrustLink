/**
 * src/bot/flowEngine.js
 * Chatbot flow engine — matches incoming text against bot_flows table
 * and sends the configured response.
 *
 * Supports:
 *  - Exact keyword match (case-insensitive)
 *  - Response types: text, buttons, list, handoff
 */

'use strict';

const { query } = require('../utils/db');
const { sendTextMessage, sendButtonMessage, sendListMessage } = require('../services/whatsappApi');

/**
 * Match the incoming text against active bot flows and respond.
 * If a 'handoff' flow matches, bot is deactivated for the conversation.
 *
 * @param {string} text           Incoming message text
 * @param {string} fromPhone      Sender's phone number
 * @param {number} contactId      DB contact ID
 * @param {number} conversationId DB conversation ID
 */
async function matchBotFlow(text, fromPhone, contactId, conversationId) {
  const normalizedText = text.trim().toLowerCase();

  // Fetch all active flows — ordered so more specific (longer) keywords match first
  const flowsRes = await query(
    `SELECT * FROM bot_flows WHERE active = true ORDER BY LENGTH(trigger_keyword) DESC`,
    []
  );

  const matchedFlow = flowsRes.rows.find(
    flow => normalizedText === flow.trigger_keyword.toLowerCase()
  );

  if (!matchedFlow) {
    // No match — optionally send a default fallback (commented out to avoid spam)
    // await sendTextMessage(fromPhone, 'Sorry, I did not understand that. Type HELP for options.');
    return;
  }

  console.log(`[BOT] Matched flow id=${matchedFlow.id} keyword="${matchedFlow.trigger_keyword}"`);

  // Parse response_content — stored as JSON in DB
  let responseContent;
  try {
    responseContent = typeof matchedFlow.response_content === 'string'
      ? JSON.parse(matchedFlow.response_content)
      : matchedFlow.response_content;
  } catch (e) {
    console.error('[BOT] Failed to parse response_content:', e.message);
    return;
  }

  switch (matchedFlow.response_type) {
    case 'text':
      // Simple text reply
      await sendTextMessage(fromPhone, responseContent.message, contactId);
      break;

    case 'buttons':
      // Interactive quick-reply buttons: { message, buttons: [{id, title}] }
      await sendButtonMessage(fromPhone, responseContent.message, responseContent.buttons, contactId);
      break;

    case 'list':
      // Interactive list picker: { message, buttonLabel, sections: [{title, rows}] }
      await sendListMessage(
        fromPhone,
        responseContent.message,
        responseContent.buttonLabel,
        responseContent.sections,
        contactId
      );
      break;

    case 'handoff':
      // Escalate to human — deactivate bot for this conversation
      await query(
        'UPDATE conversations SET bot_active = false WHERE id = $1',
        [conversationId]
      );
      if (responseContent?.message) {
        await sendTextMessage(fromPhone, responseContent.message, contactId);
      }
      console.log(`[BOT] Handoff triggered — conversation ${conversationId} assigned to human`);
      break;

    default:
      console.warn('[BOT] Unknown response_type:', matchedFlow.response_type);
  }
}

module.exports = { matchBotFlow };
