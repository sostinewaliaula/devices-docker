-- 1. First, let's fix the column names if they are still using old names (key/value)
-- If these fail because the columns are already named correctly, ignore the error and proceed to step 2.
ALTER TABLE system_settings CHANGE COLUMN `key` `setting_key` VARCHAR(255);
ALTER TABLE system_settings CHANGE COLUMN `value` `setting_value` TEXT;

-- 2. Update the brand name used across the system and in email sender display names
-- If step 1 failed but your columns were already 'setting_key', this will work.
UPDATE system_settings SET setting_value = 'Caava Group Assets' WHERE setting_key = 'brand_name';
