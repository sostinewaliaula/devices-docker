-- User avatars stored in the database (Google profile photo or a local upload).
-- Dev runner: node run-migration.js add_user_avatars.sql
-- Run it once, a second run fails on the duplicate columns.
ALTER TABLE users ADD COLUMN avatar_data MEDIUMBLOB NULL AFTER avatar_url;
ALTER TABLE users ADD COLUMN avatar_type VARCHAR(50) NULL AFTER avatar_data;
ALTER TABLE users ADD COLUMN avatar_source ENUM('google','upload','none') NULL AFTER avatar_type;
ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMP NULL DEFAULT NULL AFTER avatar_source
