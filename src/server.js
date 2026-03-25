/**
 * src/server.js
 * Application entry point — mounts all routes and starts the HTTP server.
 */

'use strict';

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
require('dotenv').config();

const { pool } = require('./utils/db');
const webhookRouter = require('./routes/webhook');
const contactsRouter = require('./routes/contacts');
const messagesRouter = require('./routes/messages');
const broadcastsRouter = require('./routes/broadcasts');
const agentsRouter = require('./routes/agents');
const analyticsRouter = require('./routes/analytics');
const botRouter = require('./routes/bot');
const { requireAuth } = require('./middleware/auth');
const { startScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Parse JSON bodies ──────────────────────────────────────────────────────
// Webhook route needs raw body for HMAC verification, so we exclude it here
app.use((req, res, next) => {
  if (req.path === '/trust-webhook') {
    // Keep raw body available for signature verification
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Sessions ───────────────────────────────────────────────────────────────
app.set('trust proxy', 1); // Trust first proxy (e.g. for Render/Railway/AWS)
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    // Disable secure in production if we are not on HTTPS (useful for raw IP access)
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
  },
}));

// ── Static files ───────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/trust-webhook', webhookRouter);            // public — Meta handshake
app.use('/api/agents', agentsRouter);                // login is public; others require auth
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/messages', requireAuth, messagesRouter);
app.use('/api/broadcasts', requireAuth, broadcastsRouter);
app.use('/api/analytics', requireAuth, analyticsRouter);
app.use('/api/bot', requireAuth, botRouter);

// ── SPA fallback: serve index.html for all non-API routes ──────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[SERVER] Running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  // Start the scheduled-message cron job
  // startScheduler();
});
