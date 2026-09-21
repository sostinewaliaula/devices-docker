-- User avatars stored in the database (Google profile photo or a local upload).
-- Idempotent: safe to run against instances that already have these columns.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_data MEDIUMBLOB NULL AFTER avatar_url,
  ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(50) NULL AFTER avatar_data,
  ADD COLUMN IF NOT EXISTS avatar_source ENUM('google','upload','none') NULL AFTER avatar_type,
  ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP NULL DEFAULT NULL AFTER avatar_source;
