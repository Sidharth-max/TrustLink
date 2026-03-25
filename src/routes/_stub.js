/**
 * src/routes/contacts.js   — stub, fully implemented in Step 5
 * src/routes/messages.js   — stub, fully implemented in Step 7
 * src/routes/broadcasts.js — stub, fully implemented in Step 6
 * src/routes/agents.js     — stub, fully implemented later
 * src/routes/analytics.js  — stub, fully implemented in Step 12
 * src/routes/bot.js        — stub, fully implemented in Step 9
 *
 * Each stub exports an express.Router() so server.js can mount it without errors
 * even before the route is fully implemented.
 */

'use strict';
const express = require('express');
const router  = express.Router();

router.all('*', (req, res) => {
  res.status(501).json({ error: 'Not yet implemented — coming in a future step' });
});

module.exports = router;
