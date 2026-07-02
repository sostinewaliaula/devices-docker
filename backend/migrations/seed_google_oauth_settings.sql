INSERT INTO system_settings (setting_key, setting_value, description, category)
VALUES
  ('google_client_id',      '', 'Google OAuth Client ID from Google Cloud Console', 'google_oauth'),
  ('google_client_secret',  '', 'Google OAuth Client Secret from Google Cloud Console', 'google_oauth'),
  ('google_allowed_domain', '', 'Restrict Google sign-in to this domain (e.g. caavagroup.com). Leave empty to allow any Google account.', 'google_oauth'),
  ('google_oauth_enabled',  'false', 'Enable or disable Google sign-in (true/false)', 'google_oauth')
ON DUPLICATE KEY UPDATE setting_key = setting_key
