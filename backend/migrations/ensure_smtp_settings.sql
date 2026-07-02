-- Ensure system_settings has the metadata columns and SMTP rows used by Settings > SMTP Configuration.
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(255) PRIMARY KEY,
  setting_value TEXT,
  description TEXT,
  category VARCHAR(50),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

DROP PROCEDURE IF EXISTS ensure_smtp_settings_schema;
DELIMITER //
CREATE PROCEDURE ensure_smtp_settings_schema()
BEGIN
    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'description') = 0 THEN
        ALTER TABLE system_settings ADD COLUMN description TEXT;
    END IF;

    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'category') = 0 THEN
        ALTER TABLE system_settings ADD COLUMN category VARCHAR(50);
    END IF;

    IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings' AND COLUMN_NAME = 'updated_at') = 0 THEN
        ALTER TABLE system_settings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
    END IF;
END //
DELIMITER ;

CALL ensure_smtp_settings_schema();
DROP PROCEDURE ensure_smtp_settings_schema;

INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES
('smtp_host', '', 'SMTP server host address', 'smtp'),
('smtp_port', '587', 'SMTP server port', 'smtp'),
('smtp_user', '', 'SMTP username/email', 'smtp'),
('smtp_pass', '', 'SMTP password', 'smtp'),
('smtp_secure', 'false', 'Use TLS/SSL (true/false)', 'smtp'),
('smtp_from', 'noreply@example.com', 'Email address to send from', 'smtp'),
('email_logo_url', '', 'URL for the email logo', 'smtp'),
('brand_name', 'Assets Management', 'Organization name for emails', 'smtp')
ON DUPLICATE KEY UPDATE
description = VALUES(description),
category = VALUES(category);
