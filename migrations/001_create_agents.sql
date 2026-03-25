-- Migration 001: agents table
-- Stores admin and agent users who manage the WhatsApp inbox.
-- role: 'admin' (full access) | 'agent' (inbox + reply only)

CREATE TABLE IF NOT EXISTS agents (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120)        NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT                NOT NULL,
  role          VARCHAR(20)         NOT NULL DEFAULT 'agent'
                  CHECK (role IN ('admin', 'agent')),
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Index for login lookup by email
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents (email);
