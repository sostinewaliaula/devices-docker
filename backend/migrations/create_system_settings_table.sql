-- Migration: Create or Update system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(255) PRIMARY KEY,
  setting_value TEXT,
  description TEXT,
  category VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Check if we need to rename old columns (handle existing table from other migrations)
SET @key_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'key' AND TABLE_SCHEMA = DATABASE());
SET @value_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'value' AND TABLE_SCHEMA = DATABASE());

-- We use a procedure to safely run ALTER TABLE because MySQL 8.0 doesn't support IF EXISTS on ALTER TABLE
DROP PROCEDURE IF EXISTS upgrade_system_settings;
DELIMITER //
CREATE PROCEDURE upgrade_system_settings()
BEGIN
    -- Rename 'key' to 'setting_key' if it exists
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'key' AND TABLE_SCHEMA = DATABASE()) > 0 THEN
        ALTER TABLE system_settings RENAME COLUMN `key` TO setting_key;
    END IF;
    
    -- Rename 'value' to 'setting_value' if it exists
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'value' AND TABLE_SCHEMA = DATABASE()) > 0 THEN
        ALTER TABLE system_settings RENAME COLUMN `value` TO setting_value;
    END IF;
    
    -- Add description if it doesn't exist
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'description' AND TABLE_SCHEMA = DATABASE()) = 0 THEN
        ALTER TABLE system_settings ADD COLUMN description TEXT;
    END IF;
    
    -- Add category if it doesn't exist
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'category' AND TABLE_SCHEMA = DATABASE()) = 0 THEN
        ALTER TABLE system_settings ADD COLUMN category VARCHAR(50);
    END IF;

    -- Add updated_at if it doesn't exist
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'updated_at' AND TABLE_SCHEMA = DATABASE()) = 0 THEN
        ALTER TABLE system_settings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
    END IF;
END //
DELIMITER ;

CALL upgrade_system_settings();
DROP PROCEDURE upgrade_system_settings;

-- Initial SMTP settings (using current env values as defaults or placeholders)
INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category) VALUES
('smtp_host', '', 'SMTP server host address', 'smtp'),
('smtp_port', '587', 'SMTP server port', 'smtp'),
('smtp_user', '', 'SMTP username/email', 'smtp'),
('smtp_pass', '', 'SMTP password', 'smtp'),
('smtp_secure', 'false', 'Use TLS/SSL (true/false)', 'smtp'),
('smtp_from', 'noreply@example.com', 'Email address to send from', 'smtp'),
('email_logo_url', '', 'URL for the email logo', 'smtp'),
('brand_name', 'Assets Management', 'Organization name for emails', 'smtp');
