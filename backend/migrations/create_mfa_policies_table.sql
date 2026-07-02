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
