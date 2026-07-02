-- Create MFA-related tables for user authentication
-- This migration sets up the foundation for TOTP-based 2FA

-- Create user_mfa_factors table
CREATE TABLE IF NOT EXISTS `user_mfa_factors` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `factor_id` VARCHAR(255) NOT NULL,
  `factor_type` ENUM('totp', 'webauthn') NOT NULL DEFAULT 'totp',
  `friendly_name` VARCHAR(255) NOT NULL,
  `secret` TEXT NOT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_factor` (`user_id`, `factor_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_factor_type` (`factor_type`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_mfa_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Create user_recovery_codes table
CREATE TABLE IF NOT EXISTS `user_recovery_codes` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `user_id` VARCHAR(36) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `is_used` TINYINT(1) DEFAULT 0,
  `used_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_code_hash` (`code_hash`),
  KEY `idx_is_used` (`is_used`),
  CONSTRAINT `fk_recovery_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Add MFA-related columns to users table
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `mfa_enabled` TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS `mfa_enrolled_at` TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS `last_mfa_verification` TIMESTAMP NULL;

-- Create index for MFA queries (after columns are added)
CREATE INDEX IF NOT EXISTS `idx_users_mfa_enabled` ON `users` (`mfa_enabled`);
CREATE INDEX IF NOT EXISTS `idx_users_mfa_enrolled` ON `users` (`mfa_enrolled_at`);
