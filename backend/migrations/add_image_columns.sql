-- Migration to add image support to assets and asset_request_types
ALTER TABLE assets ADD COLUMN image_data LONGBLOB NULL AFTER notes;
ALTER TABLE assets ADD COLUMN image_type VARCHAR(50) NULL AFTER image_data;

ALTER TABLE asset_request_types ADD COLUMN image_data LONGBLOB NULL AFTER is_active;
ALTER TABLE asset_request_types ADD COLUMN image_type VARCHAR(50) NULL AFTER image_data;
