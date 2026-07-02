-- =====================================================
-- PASSWORD RESET CODES MIGRATION
-- =====================================================

-- Add code field to password_reset_tokens table
ALTER TABLE password_reset_tokens 
ADD COLUMN code VARCHAR(6) NOT NULL DEFAULT '000000' AFTER token;
