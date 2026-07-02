ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER password_hash;
ALTER TABLE users ADD COLUMN profile_complete TINYINT(1) NOT NULL DEFAULT 1 AFTER google_id;
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL AFTER profile_complete;
UPDATE users SET profile_complete = 1 WHERE password_hash IS NOT NULL AND password_hash != '';
CREATE INDEX idx_users_google_id ON users (google_id)
