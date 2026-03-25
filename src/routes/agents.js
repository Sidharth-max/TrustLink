/**
 * src/routes/agents.js
 * Agent authentication and admin management.
 *
 * POST /api/agents/login           — public (no auth required)
 * POST /api/agents/logout          — authenticated
 * GET  /api/agents/me              — return current session info
 * GET  /api/agents                 — admin only: list all agents
 * POST /api/agents                 — admin only: create agent
 * PUT  /api/agents/:id             — admin only: update agent
 * DELETE /api/agents/:id           — admin only: delete agent
 */

'use strict';

const express = require('express');
const bcrypt  = require('bcryptjs');
const { query }        = require('../utils/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/login  (public)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const result = await query('SELECT * FROM agents WHERE email = $1', [email.toLowerCase().trim()]);
    const agent  = result.rows[0];

    if (!agent) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid)  return res.status(401).json({ error: 'Invalid email or password' });

    // Persist agent info in session
    req.session.agentId   = agent.id;
    req.session.agentRole = agent.role;
    req.session.agentName = agent.name;

    res.json({ agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role } });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, created_at FROM agents WHERE id = $1',
      [req.session.agentId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agent: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agents  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, created_at FROM agents ORDER BY created_at ASC',
      []
    );
    res.json({ agents: result.rows });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agents  (admin only — create a new agent)
// Body: { name, email, password, role }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role = 'agent' } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (!['admin', 'agent'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin or agent' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash   = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      'INSERT INTO agents (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
      [name.trim(), email.toLowerCase().trim(), hash, role]
    );
    res.status(201).json({ agent: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/agents/:id  (admin only)
// Body: any subset of { name, email, password, role }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    const sets   = [];
    const params = [];
    let p = 1;

    if (name)     { sets.push(`name = $${p++}`);          params.push(name.trim()); }
    if (email)    { sets.push(`email = $${p++}`);         params.push(email.toLowerCase().trim()); }
    if (role)     {
      if (!['admin', 'agent'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
      sets.push(`role = $${p++}`); params.push(role);
    }
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password too short' });
      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      sets.push(`password_hash = $${p++}`); params.push(hash);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const result = await query(
      `UPDATE agents SET ${sets.join(', ')} WHERE id = $${p} RETURNING id, name, email, role, created_at`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agent: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/agents/:id  (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    // Prevent self-deletion
    if (parseInt(req.params.id, 10) === req.session.agentId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const result = await query('DELETE FROM agents WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
