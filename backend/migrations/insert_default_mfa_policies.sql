-- Insert default MFA policies
INSERT INTO `mfa_policies` (`name`, `description`, `enforcement_level`, `target_roles`, `grace_period_days`, `created_by`) VALUES
('Admin MFA Required', 'All administrators must have MFA enabled for security', 'required', '["admin"]', 7, 'system'),
('Manager MFA Recommended', 'Managers are recommended to enable MFA for enhanced security', 'recommended', '["manager"]', 14, 'system'),
('User MFA Optional', 'Regular users may optionally enable MFA', 'optional', '["user"]', 0, 'system');
