-- Migration: Add email_notifications column to users table
-- Date: 2025-01-27

-- Add email_notifications column to users table
ALTER TABLE `users` ADD COLUMN `email_notifications` tinyint(1) DEFAULT 1 AFTER `is_active`;

-- Update existing users to have email notifications enabled by default
UPDATE `users` SET `email_notifications` = 1 WHERE `email_notifications` IS NULL;
