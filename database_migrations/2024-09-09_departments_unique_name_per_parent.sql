-- Migration: Allow duplicate department names under different parents
-- Remove the old unique constraint on name
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_name_key;

-- Add a new unique constraint on (name, parent_id)
ALTER TABLE public.departments
  ADD CONSTRAINT departments_name_parent_unique UNIQUE (name, parent_id);
