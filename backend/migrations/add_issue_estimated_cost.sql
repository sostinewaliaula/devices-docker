-- Add estimated_cost column to issues table (MySQL / MariaDB)
ALTER TABLE `issues`
ADD COLUMN IF NOT EXISTS `estimated_cost` DECIMAL(12,2) DEFAULT NULL AFTER `category`;

-- Add estimated_cost column to issues table (PostgreSQL)
ALTER TABLE issues
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2);

