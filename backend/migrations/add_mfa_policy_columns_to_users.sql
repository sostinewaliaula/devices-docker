-- Add MFA policy columns to users table
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `mfa_policy_required` TINYINT(1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS `mfa_grace_period_end` TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS `mfa_policy_violations` INT DEFAULT 0;
