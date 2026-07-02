-- Add estimated_cost column to asset_requests table (MySQL / MariaDB)
ALTER TABLE `asset_requests`
ADD COLUMN IF NOT EXISTS `estimated_cost` DECIMAL(12,2) DEFAULT NULL AFTER `notes`;

-- Add estimated_cost column to asset_requests table (PostgreSQL)
ALTER TABLE asset_requests
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12,2);

