-- Create mfa_policy_violations table for tracking violations
CREATE TABLE IF NOT EXISTS `mfa_policy_violations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(255) NOT NULL,
  `policy_id` INT NOT NULL,
  `violation_type` ENUM('login_without_mfa', 'grace_period_expired', 'policy_violation') NOT NULL,
  `violation_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `resolved` TINYINT(1) DEFAULT 0,
  `resolved_date` TIMESTAMP NULL,
  `notes` TEXT,
  CONSTRAINT `fk_violation_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_violation_policy` FOREIGN KEY (`policy_id`) REFERENCES `mfa_policies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
