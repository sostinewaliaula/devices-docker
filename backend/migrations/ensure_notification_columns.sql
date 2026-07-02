-- Ensure notification preference columns exist in users table
-- This migration adds the required columns if they don't exist

-- Add email_notifications column if it doesn't exist
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `email_notifications` tinyint(1) DEFAULT 1;

-- Add in_app_notifications column if it doesn't exist  
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `in_app_notifications` tinyint(1) DEFAULT 1;

-- Update existing users to have default values
UPDATE `users` 
SET `email_notifications` = 1 
WHERE `email_notifications` IS NULL;

UPDATE `users` 
SET `in_app_notifications` = 1 
WHERE `in_app_notifications` IS NULL;
