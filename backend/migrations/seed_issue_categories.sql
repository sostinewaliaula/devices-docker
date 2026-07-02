INSERT INTO `issue_categories` (`id`, `name`, `description`, `is_active`)
VALUES
  (UUID(), 'Hardware Failure', 'Physical component malfunction (power, motherboard, etc.)', 1),
  (UUID(), 'Software Issue', 'Application bugs, crashes or configuration errors', 1),
  (UUID(), 'Connectivity Problem', 'Network, Wi-Fi or VPN disruptions', 1),
  (UUID(), 'Security Incident', 'Security alerts, suspicious activity or access issues', 1),
  (UUID(), 'Performance Degradation', 'Slow systems or degraded experience', 1),
  (UUID(), 'Upgrade Request', 'Request for updated hardware or software', 1),
  (UUID(), 'Replacement Request', 'Lost, damaged or end-of-life replacement', 1),
  (UUID(), 'Maintenance', 'Preventive maintenance or servicing', 1),
  (UUID(), 'Accessory', 'Peripherals such as adapters, cables, docks', 1),
  (UUID(), 'Other', 'Catch-all category for edge cases', 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`);

