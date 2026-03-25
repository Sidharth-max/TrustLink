-- Migration 004: messages table
-- Drops and recreates to ensure the schema is correct on fresh dev installs.
-- In production, use a proper ALTER TABLE migration instead.

DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  id           SERIAL PRIMARY KEY,
  contact_id   INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  direction    VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  type         VARCHAR(20) NOT NULL DEFAULT 'text',
  content      TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'sent'
                 CHECK (status IN ('scheduled','sent','delivered','read','failed','received')),
  wam_id       VARCHAR(120),
  scheduled_at TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Core lookup: all messages for a contact, newest first
CREATE INDEX idx_messages_contact_id ON messages (contact_id, created_at DESC);

-- Delivery status webhook updates use wam_id
CREATE INDEX idx_messages_wam_id ON messages (wam_id);

-- Scheduler polls this to find pending scheduled messages
CREATE INDEX idx_messages_scheduled ON messages (status, scheduled_at)
  WHERE status = 'scheduled';
