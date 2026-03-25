-- Migration 002: contacts table
-- Stores WhatsApp contacts — everyone who has messaged us or been imported.
-- opted_in: false means they have sent STOP / unsubscribed — we must not message them.
-- tags: comma-separated or JSON array for segment-based broadcasts.

CREATE TABLE IF NOT EXISTS contacts (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200),
  phone      VARCHAR(20) UNIQUE NOT NULL,  -- E.164 format e.g. "919876543210"
  tags       TEXT   DEFAULT '',            -- e.g. "devotee,newsletter" — comma-separated
  opted_in   BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup by phone is the most common query (webhook upsert, send)
CREATE INDEX IF NOT EXISTS idx_contacts_phone     ON contacts (phone);
CREATE INDEX IF NOT EXISTS idx_contacts_opted_in  ON contacts (opted_in);

-- Full-text search on name + phone for the contacts list UI
CREATE INDEX IF NOT EXISTS idx_contacts_name      ON contacts (name);
