-- Migration 006: bot_flows table
DROP TABLE IF EXISTS bot_flows CASCADE;

CREATE TABLE bot_flows (
  id               SERIAL PRIMARY KEY,
  trigger_keyword  VARCHAR(200) NOT NULL,
  response_type    VARCHAR(20)  NOT NULL DEFAULT 'text'
                     CHECK (response_type IN ('text','buttons','list','handoff')),
  response_content TEXT         NOT NULL DEFAULT '{}',
  active           BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bot_flows_active ON bot_flows (active, trigger_keyword);

-- Seed starter flows
INSERT INTO bot_flows (trigger_keyword, response_type, response_content) VALUES
  ('help',   'text',    '{"message":"Welcome! Reply:\n1 - Donation info\n2 - Events\n3 - Contact us\n\nType AGENT to speak with a team member."}'),
  ('1',      'text',    '{"message":"To donate, visit our website or contact us. We accept UPI and bank transfers."}'),
  ('2',      'text',    '{"message":"Our upcoming events and satsangs are announced on our notice board. Stay tuned!"}'),
  ('3',      'text',    '{"message":"You can reach us at our trust office. Our team will respond shortly."}'),
  ('agent',  'handoff', '{"message":"Connecting you to a team member. Please wait..."}'),
  ('start',  'text',    '{"message":"Welcome back! You have been resubscribed. Reply STOP anytime to opt out."}')
ON CONFLICT DO NOTHING;
