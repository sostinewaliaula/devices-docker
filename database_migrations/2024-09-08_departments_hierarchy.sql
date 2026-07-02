-- Add parent-child hierarchy to departments
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON public.departments(parent_id);

-- Seed major root departments if missing
INSERT INTO public.departments (name, description)
SELECT 'Turnkey', 'Root department: Turnkey'
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'Turnkey');

INSERT INTO public.departments (name, description)
SELECT 'Agencify', 'Root department: Agencify'
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'Agencify');

INSERT INTO public.departments (name, description)
SELECT 'Caava AI', 'Root department: Caava AI'
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE name = 'Caava AI');
