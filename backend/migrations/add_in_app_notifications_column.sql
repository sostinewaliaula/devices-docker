-- Add in_app_notifications column to users table
-- This column is missing and causing the 500 error

-- Add in_app_notifications column
ALTER TABLE `users` 
ADD COLUMN `in_app_notifications` tinyint(1) DEFAULT 1;

-- Update existing users to have default value
UPDATE `users` 
SET `in_app_notifications` = 1 
WHERE `in_app_notifications` IS NULL;
