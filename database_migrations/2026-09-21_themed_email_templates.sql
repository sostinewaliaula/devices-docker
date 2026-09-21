-- =====================================================
-- THEMED EMAIL TEMPLATES (light + dark, solid company palette)
-- Date: 2026-09-21
--
-- Only the 'password_reset' template is read from this table at runtime
-- (backend/services/emailService.js -> sendPasswordResetEmail). Its body is a
-- content FRAGMENT that is rendered inside the shared themed wrapper from
-- backend/utils/emailTheme.js (which supplies the <html>/<head>/<style>,
-- the prefers-color-scheme dark overrides and the header/footer).
--
-- The code box uses the wrapper's "em-code" class so it flips in dark mode;
-- its inline styles are the light-mode fallback. Flat solid palette colours only:
--   Blue tint #152F52, Red #D90429, White #FFFFFF,
--   Golden brown #F7E7C6, Orange #E59730, Green #D9E021.
--
-- Idempotent: a plain UPDATE keyed on the unique template name; running it
-- again rewrites the same values. Rows that do not exist are left alone.
-- Older rows may still hold a full HTML document from the
-- 2024-12-19 migrations - this replaces them with the fragment.
-- =====================================================

UPDATE email_templates
SET
  subject = 'Your Password Reset Code - Caava Group',
  body = 'Hello {{user_name}},<br><br>Use the code below to reset your password:<br><br><div class="em-code" style="display: inline-block; font-family: Courier New, monospace; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #152F52; background-color: #FFFFFF; border: 2px solid #152F52; border-radius: 10px; padding: 14px 18px;">{{reset_code}}</div><br><br>This code expires in <strong>15 minutes</strong>. If you didn''t request this, you can safely ignore this email.',
  variables = '["user_name", "reset_code"]',
  is_active = TRUE
WHERE name = 'password_reset';
