-- Create user_mfa_compliance table to track compliance
CREATE TABLE IF NOT EXISTS `user_mfa_compliance` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `policy_id` INT NOT NULL,
  `is_compliant` TINYINT(1) DEFAULT 0,
  `compliance_date` TIMESTAMP NULL,
  `grace_period_end` TIMESTAMP NULL,
  `last_reminder_sent` TIMESTAMP NULL,
  `reminder_count` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_user_policy` (`user_id`, `policy_id`),
  CONSTRAINT `fk_compliance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_compliance_policy` FOREIGN KEY (`policy_id`) REFERENCES `mfa_policies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
