-- Migration 006: Add recipients column to broadcasts
-- This column will store a comma-separated list of phone numbers if the broadcast is not segment-based.

ALTER TABLE broadcasts ADD COLUMN recipients TEXT;

-- Update comment or metadata if needed
COMMENT ON COLUMN broadcasts.recipients IS 'Comma-separated list of E.164 phone numbers for targeted broadcasts';
