-- Migration 005: broadcasts table
DROP TABLE IF EXISTS broadcasts CASCADE;

CREATE TABLE broadcasts (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  template_name VARCHAR(200) NOT NULL,
  language_code VARCHAR(20)  NOT NULL DEFAULT 'en_US',
  segment_tag   VARCHAR(100) DEFAULT '',
  scheduled_at  TIMESTAMPTZ,
  status        VARCHAR(20)  NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','running','completed','failed')),
  sent_count    INTEGER NOT NULL DEFAULT 0,
  failed_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_broadcasts_status       ON broadcasts (status);
CREATE INDEX idx_broadcasts_scheduled_at ON broadcasts (scheduled_at)
  WHERE status = 'scheduled';
