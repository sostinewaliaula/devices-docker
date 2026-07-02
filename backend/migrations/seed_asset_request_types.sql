INSERT INTO `asset_request_types` (`id`, `name`, `description`, `is_active`)
VALUES
  (UUID(), 'Laptop', 'Portable computers for mobility-focused roles', 1),
  (UUID(), 'Desktop', 'Workstations for office-based setups', 1),
  (UUID(), 'Monitor', 'Standalone displays or multi-monitor setups', 1),
  (UUID(), 'Keyboard', 'Mechanical, ergonomic or standard keyboards', 1),
  (UUID(), 'Mouse', 'Standard, ergonomic or vertical mice', 1),
  (UUID(), 'Phone', 'Mobile or desk phones for communication needs', 1),
  (UUID(), 'Tablet', 'Tablets for field or presentation work', 1),
  (UUID(), 'Printer', 'Printers or multi-function devices', 1),
  (UUID(), 'Server', 'On‑prem or edge compute hardware', 1),
  (UUID(), 'Router', 'Networking routers or firewalls', 1),
  (UUID(), 'Switch', 'Network switches and hubs', 1),
  (UUID(), 'Projector', 'Presentation projectors', 1),
  (UUID(), 'Camera', 'Webcams or DSLR/mirrorless cameras', 1),
  (UUID(), 'Furniture', 'Desks, chairs and ergonomic accessories', 1),
  (UUID(), 'Vehicle', 'Pool cars, vans or field vehicles', 1),
  (UUID(), 'Software License', 'Licensed software subscriptions or renewals', 1),
  (UUID(), 'Other', 'Catch-all for custom asset needs', 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`);

