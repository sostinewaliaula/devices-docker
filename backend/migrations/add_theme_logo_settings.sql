-- Add separate company logo settings for light and dark mode.
DROP PROCEDURE IF EXISTS upgrade_system_settings_for_theme_logos;
DELIMITER //
CREATE PROCEDURE upgrade_system_settings_for_theme_logos()
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

CALL upgrade_system_settings_for_theme_logos();
DROP PROCEDURE upgrade_system_settings_for_theme_logos;

ALTER TABLE system_settings MODIFY setting_value LONGTEXT NOT NULL;

INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category)
VALUES ('company_logo_light', '', 'Company Logo for Light Mode (Base64 or URL)', 'branding');

INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category)
VALUES ('company_logo_dark', '', 'Company Logo for Dark Mode (Base64 or URL)', 'branding');
