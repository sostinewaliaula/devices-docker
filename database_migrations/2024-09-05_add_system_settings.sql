-- Migration: Add system_settings table for feature toggles
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default: allow users to add their own assets
INSERT INTO public.system_settings (key, value)
VALUES ('user_asset_self_add_enabled', 'true')
ON CONFLICT (key) DO NOTHING;


