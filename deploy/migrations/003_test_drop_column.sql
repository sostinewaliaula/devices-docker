-- Removes the throwaway column added by 002_test_alter_column.sql.
-- Confirms the migration system can also safely drop a column.
ALTER TABLE departments DROP COLUMN IF EXISTS migration_test_column;
