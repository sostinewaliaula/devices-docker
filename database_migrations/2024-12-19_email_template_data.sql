-- =====================================================
-- EMAIL TEMPLATE DATA MIGRATION
-- =====================================================

-- Insert default password reset email template
INSERT INTO email_templates (name, subject, body, variables) VALUES (
  'password_reset',
  'Reset Your Password - Assets Management System',
  'Hello {{user_name}},\n\nYou have requested to reset your password for the Assets Management System.\n\nTo reset your password, click the link below:\n{{reset_link}}\n\nThis link will expire in 24 hours.\n\nIf you did not request this password reset, please ignore this email.\n\nBest regards,\nAssets Management Team',
  '["user_name", "reset_link"]'
) ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  body = VALUES(body),
  variables = VALUES(variables);
