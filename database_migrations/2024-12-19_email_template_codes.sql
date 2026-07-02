-- =====================================================
-- EMAIL TEMPLATE FOR CODES MIGRATION
-- =====================================================

-- Update the email template for code-based reset
UPDATE email_templates 
SET subject = 'Your Password Reset Code - Assets Management System',
    body = 'Hello {{user_name}},\n\nYou have requested to reset your password for the Assets Management System.\n\nYour password reset code is: {{reset_code}}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this password reset, please ignore this email.\n\nBest regards,\nAssets Management Team',
    variables = '["user_name", "reset_code"]'
WHERE name = 'password_reset';
