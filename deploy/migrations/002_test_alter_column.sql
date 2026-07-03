-- Sample migration to verify altering an existing table without affecting data.
-- Adds a harmless nullable column; existing rows are unaffected (NULL by default).
ALTER TABLE departments ADD COLUMN IF NOT EXISTS migration_test_column VARCHAR(50) DEFAULT NULL;
