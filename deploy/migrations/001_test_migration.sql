-- Sample migration to verify the migration system end-to-end.
-- Harmless: creates a standalone table the app never reads/writes.
CREATE TABLE IF NOT EXISTS migration_test (
  id INT AUTO_INCREMENT PRIMARY KEY,
  note VARCHAR(255) DEFAULT 'migration system test',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
