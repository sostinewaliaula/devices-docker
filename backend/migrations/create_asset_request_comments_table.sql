-- Migration: Create asset_request_comments table
-- Date: 2025-01-27

-- Create asset_request_comments table
CREATE TABLE IF NOT EXISTS `asset_request_comments` (
  `id` char(36) NOT NULL DEFAULT uuid(),
  `asset_request_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `user_name` varchar(255) NOT NULL,
  `comment` text NOT NULL,
  `parent_comment_id` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `asset_request_id` (`asset_request_id`),
  KEY `user_id` (`user_id`),
  KEY `parent_comment_id` (`parent_comment_id`),
  CONSTRAINT `asset_request_comments_ibfk_1` FOREIGN KEY (`asset_request_id`) REFERENCES `asset_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_request_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `asset_request_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `asset_request_comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
