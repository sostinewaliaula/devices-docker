-- Add notification and comment tables for asset requests
-- This migration adds the necessary tables for the notification and comments system

-- Create notifications table (if it doesn't exist with the right structure)
CREATE TABLE IF NOT EXISTS `notifications_new` (
  `id` char(36) NOT NULL DEFAULT uuid(),
  `user_id` char(36) NOT NULL,
  `asset_request_id` char(36) DEFAULT NULL,
  `type` enum('status_change','comment_added','request_created','request_approved','request_rejected','request_fulfilled') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `asset_request_id` (`asset_request_id`),
  KEY `created_at` (`created_at`),
  CONSTRAINT `notifications_new_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_new_ibfk_2` FOREIGN KEY (`asset_request_id`) REFERENCES `asset_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Create asset_request_comments table
CREATE TABLE IF NOT EXISTS `asset_request_comments` (
  `id` char(36) NOT NULL DEFAULT uuid(),
  `asset_request_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `comment` text NOT NULL,
  `parent_comment_id` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `asset_request_id` (`asset_request_id`),
  KEY `user_id` (`user_id`),
  KEY `parent_comment_id` (`parent_comment_id`),
  KEY `created_at` (`created_at`),
  CONSTRAINT `asset_request_comments_ibfk_1` FOREIGN KEY (`asset_request_id`) REFERENCES `asset_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_request_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_request_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `asset_request_comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Add email notification preferences to users table (if not exists)
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `email_notifications` tinyint(1) DEFAULT 1,
ADD COLUMN IF NOT EXISTS `in_app_notifications` tinyint(1) DEFAULT 1;

-- Add notification tracking to asset_requests table (if not exists)
ALTER TABLE `asset_requests`
ADD COLUMN IF NOT EXISTS `last_notified_at` timestamp NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `notification_count` int DEFAULT 0;
