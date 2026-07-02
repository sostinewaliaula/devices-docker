-- =====================================================
-- UPDATE PASSWORD RESET EMAIL TEMPLATE (BRANDED WRAPPER FRIENDLY)
-- - Converts the template body to a content fragment (not a full HTML document)
-- - Keeps variables: user_name, reset_code
-- - Modern subject line
-- =====================================================

UPDATE email_templates 
SET 
  subject = 'Your Password Reset Code - Caava Group',
  body = 'Hello {{user_name}},<br><br>Use the code below to reset your password:<br><br><div style="font-family: \"Courier New\", monospace; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0f172a; background: #f1f5f9; border: 2px solid #cbd5e1; border-radius: 10px; padding: 14px 18px; display: inline-block;">{{reset_code}}</div><br><br>This code expires in <strong>15 minutes</strong>. If you didn\'t request this, you can safely ignore this email.',
  variables = '["user_name", "reset_code"]'
WHERE name = 'password_reset';


