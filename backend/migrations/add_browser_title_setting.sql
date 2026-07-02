-- Insert browser_title setting
DROP PROCEDURE IF EXISTS upgrade_system_settings_for_browser_title;
DELIMITER //
CREATE PROCEDURE upgrade_system_settings_for_browser_title()
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

CALL upgrade_system_settings_for_browser_title();
DROP PROCEDURE upgrade_system_settings_for_browser_title;

INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category) 
VALUES ('browser_title', 'Caava Assets Management', 'Title shown in browser tab', 'branding');
