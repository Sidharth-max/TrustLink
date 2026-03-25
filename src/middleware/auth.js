/**
 * src/middleware/auth.js
 * Session-based authentication middleware for admin routes.
 */

'use strict';

const { query } = require('../utils/db');
const bcrypt = require('bcryptjs');

/**
 * Middleware: require an active session (agent logged in).
 * Attaches req.agent = { id, name, email, role } on success.
 */
function requireAuth(req, res, next) {
  if (!req.session?.agentId) {
    return res.status(401).json({ error: 'Unauthorized — please log in' });
  }
  next();
}

/**
 * Middleware: require admin role.
 * Must be used after requireAuth.
 */
function requireAdmin(req, res, next) {
  if (req.session?.agentRole !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — admin only' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
