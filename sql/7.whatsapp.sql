create table if not exists public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,

  phone_number_id text not null,       -- Meta: value.metadata.phone_number_id
  display_phone_number text,
  business_phone_number text,
  name text,

  -- Token para llamar Graph API (MVP)
  access_token text,
  token_expires_at timestamptz,

  status text not null default 'active'
    check (status in ('active','inactive','pending','disabled')),
  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint whatsapp_numbers_tenant_fk
    foreign key (tenant_id) references public.tenants(id) on delete cascade,

  constraint whatsapp_numbers_unique_per_tenant
    unique (tenant_id, phone_number_id)
);

create index if not exists whatsapp_numbers_tenant_id_idx
  on public.whatsapp_numbers (tenant_id);

create index if not exists whatsapp_numbers_phone_number_id_idx
  on public.whatsapp_numbers (phone_number_id);

create unique index if not exists whatsapp_numbers_one_default_per_tenant
  on public.whatsapp_numbers (tenant_id)
  where is_default = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_numbers_updated_at on public.whatsapp_numbers;

create trigger trg_whatsapp_numbers_updated_at
before update on public.    
for each row execute function public.set_updated_at();

-- enable RLS
alter table public.whatsapp_numbers enable row level security;

-- SELECT: cualquier usuario del tenant
drop policy if exists whatsapp_numbers_select_tenant on public.whatsapp_numbers;
create policy whatsapp_numbers_select_tenant
on public.whatsapp_numbers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = whatsapp_numbers.tenant_id
  )
);

-- WRITE (INSERT/UPDATE/DELETE): solo owner/admin
drop policy if exists whatsapp_numbers_write_owner_admin on public.whatsapp_numbers;
create policy whatsapp_numbers_write_owner_admin
on public.whatsapp_numbers
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = whatsapp_numbers.tenant_id
      and p.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = whatsapp_numbers.tenant_id
      and p.role in ('owner','admin')
  )
);