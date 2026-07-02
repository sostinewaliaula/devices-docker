-- 1. Ensure older system_settings tables have the columns used by the app.
DROP PROCEDURE IF EXISTS upgrade_system_settings_for_branding;
DELIMITER //
CREATE PROCEDURE upgrade_system_settings_for_branding()
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

CALL upgrade_system_settings_for_branding();
DROP PROCEDURE upgrade_system_settings_for_branding;

-- 2. Modify column to support larger text (images)
ALTER TABLE system_settings MODIFY setting_value LONGTEXT NOT NULL;

-- 3. Insert default branding settings
INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category) 
VALUES ('site_name', 'Caava Assets', 'Application Name', 'branding');

INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category) 
VALUES ('company_logo', '', 'Company Logo (Base64 or URL)', 'branding');

INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category) 
VALUES ('company_logo_light', '', 'Company Logo for Light Mode (Base64 or URL)', 'branding');

INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category) 
VALUES ('company_logo_dark', '', 'Company Logo for Dark Mode (Base64 or URL)', 'branding');

INSERT IGNORE INTO system_settings (setting_key, setting_value, description, category) 
VALUES ('favicon', '', 'Favicon (Base64 or URL)', 'branding');
