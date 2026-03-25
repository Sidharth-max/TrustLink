-- Migration 003: conversations table
-- One conversation per contact (UNIQUE on contact_id).
-- status: 'open' | 'pending' | 'resolved'
-- bot_active: when true, the chatbot handles replies; when false, a human agent takes over
-- assigned_to: foreign key to agents.id — NULL means unassigned

CREATE TABLE IF NOT EXISTS conversations (
  id          SERIAL PRIMARY KEY,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES agents(id) ON DELETE SET NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'pending', 'resolved')),
  bot_active  BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each contact can appear at most once in the conversations list
  CONSTRAINT uq_conversations_contact UNIQUE (contact_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_status      ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations (assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at  ON conversations (updated_at DESC);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_conversations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_updated_at ON conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_conversations_updated_at();
