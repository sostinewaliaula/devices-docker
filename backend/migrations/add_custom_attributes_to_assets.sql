-- Add a JSON column to store arbitrary custom attributes defined by the asset type
ALTER TABLE assets 
ADD COLUMN custom_attributes JSON;
