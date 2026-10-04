-- Store role: admin-allotted maintenance code quotas.
-- Apply to the Supabase project used by Vercel (SQL Editor or Supabase CLI).
begin;
alter table public.maintenance_codes
  add column if not exists generated_by_store_id uuid references public.members(id);

create table if not exists public.store_code_quotas (
  id uuid primary key default gen_random_uuid(),
  store_member_id uuid references public.members(id) on delete cascade,
  quota_amount int default 0,
  set_by_admin_id uuid references public.members(id),
  created_date timestamptz default now()
);
create index if not exists idx_store_quotas_store_member on public.store_code_quotas(store_member_id);

grant select, insert, update, delete on public.store_code_quotas to anon;
notify pgrst, 'reload schema';
commit;
