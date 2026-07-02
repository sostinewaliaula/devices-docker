-- Migration: Create MFA policies table and related functionality

-- Create mfa_policies table
CREATE TABLE IF NOT EXISTS `mfa_policies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `enabled` TINYINT(1) DEFAULT 1,
  `enforcement_level` ENUM('optional', 'recommended', 'required') DEFAULT 'optional',
  `target_roles` JSON NOT NULL,
  `exempt_roles` JSON DEFAULT NULL,
  `grace_period_days` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` VARCHAR(255) NOT NULL,
  `updated_by` VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Add MFA policy columns to users table
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `mfa_policy_required` TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS `mfa_grace_period_end` TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS `mfa_policy_violations` INT DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS `idx_mfa_policies_enabled` ON `mfa_policies` (`enabled`);
CREATE INDEX IF NOT EXISTS `idx_mfa_policies_enforcement` ON `mfa_policies` (`enforcement_level`);
CREATE INDEX IF NOT EXISTS `idx_user_compliance_user` ON `user_mfa_compliance` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_user_compliance_policy` ON `user_mfa_compliance` (`policy_id`);
CREATE INDEX IF NOT EXISTS `idx_user_compliance_compliant` ON `user_mfa_compliance` (`is_compliant`);
CREATE INDEX IF NOT EXISTS `idx_violations_user` ON `mfa_policy_violations` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_violations_policy` ON `mfa_policy_violations` (`policy_id`);
CREATE INDEX IF NOT EXISTS `idx_violations_resolved` ON `mfa_policy_violations` (`resolved`);

-- Insert default MFA policies
INSERT INTO `mfa_policies` (`name`, `description`, `enforcement_level`, `target_roles`, `grace_period_days`, `created_by`) VALUES
('Admin MFA Required', 'All administrators must have MFA enabled for security', 'required', '["admin"]', 7, 'system'),
('Manager MFA Recommended', 'Managers are recommended to enable MFA for enhanced security', 'recommended', '["manager"]', 14, 'system'),
('User MFA Optional', 'Regular users may optionally enable MFA', 'optional', '["user"]', 0, 'system');
