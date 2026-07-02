-- Create audit_logs table if not exists
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid null references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_action on public.audit_logs (action);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_user on public.audit_logs (user_id);

-- Ensure row level security is off unless policies are defined separately
alter table public.audit_logs enable row level security;
-- Basic policy to allow authenticated users to read audit logs (adjust as needed)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'Allow read for authenticated') then
    create policy "Allow read for authenticated" on public.audit_logs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'audit_logs' and policyname = 'Allow insert for service role') then
    create policy "Allow insert for service role" on public.audit_logs for insert to service_role with check (true);
  end if;
end $$;


