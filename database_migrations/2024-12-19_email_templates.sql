-- =====================================================
-- EMAIL TEMPLATES TABLE MIGRATION
-- =====================================================

-- Add email configuration table for password reset emails
CREATE TABLE IF NOT EXISTS email_templates (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  variables JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
