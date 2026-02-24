-- Inmo24x7 – Multitenant hardening (NO triggers) + RLS
-- Script idempotente (re-ejecutable) y robusto contra "already exists"
-- Ajustado a tu schema: tenants, profiles, leads, zp_postings, zp_posting_pictures
-- Importante:
-- - Si zp_posting_pictures tiene tenant_id NULL, primero hace backfill (incluido abajo)
-- - service_role bypassa RLS. RLS aplica para clientes autenticados (backoffice directo a Supabase).

begin;

--------------------------------------------------------------------------------
-- 0) BACKFILL (solo afecta filas con tenant_id NULL)
--    Copia tenant_id desde zp_postings usando posting_id
--------------------------------------------------------------------------------
update public.zp_posting_pictures p
set tenant_id = z.tenant_id
from public.zp_postings z
where p.tenant_id is null
  and p.posting_id = z.id;

--------------------------------------------------------------------------------
-- 1) NOT NULL (tenant_id obligatorio)
--------------------------------------------------------------------------------
alter table public.profiles
  alter column tenant_id set not null;

alter table public.leads
  alter column tenant_id set not null;

alter table public.zp_postings
  alter column tenant_id set not null;

alter table public.zp_posting_pictures
  alter column tenant_id set not null;

--------------------------------------------------------------------------------
-- 2) UNIQUE por tenant para zp_postings.url (robusto contra objetos existentes)
--------------------------------------------------------------------------------
do $$
begin
  -- si existe el UNIQUE global por url, sacarlo (nombre típico)
  if exists (
    select 1
    from pg_constraint
    where conname = 'zp_postings_url_key'
      and conrelid = 'public.zp_postings'::regclass
  ) then
    execute 'alter table public.zp_postings drop constraint zp_postings_url_key';
  end if;

  -- si el constraint tenant+url no existe, lo creamos
  if not exists (
    select 1
    from pg_constraint
    where conname = 'zp_postings_tenant_url_key'
      and conrelid = 'public.zp_postings'::regclass
  ) then
    -- si ya existe un índice con ese nombre (huérfano), lo borramos
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'i'
        and c.relname = 'zp_postings_tenant_url_key'
        and n.nspname = 'public'
    ) then
      execute 'drop index if exists public.zp_postings_tenant_url_key';
    end if;

    execute 'alter table public.zp_postings add constraint zp_postings_tenant_url_key unique (tenant_id, url)';
  end if;
end $$;

--------------------------------------------------------------------------------
-- 3) FOREIGN KEYS a tenants(id) (sin IF NOT EXISTS: usamos DO $$)
--------------------------------------------------------------------------------
do $$
begin
  -- leads.tenant_id -> tenants.id
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_tenant_id_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    execute 'alter table public.leads
             add constraint leads_tenant_id_fkey
             foreign key (tenant_id) references public.tenants(id) on delete cascade';
  end if;

  -- profiles.tenant_id -> tenants.id
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_tenant_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    execute 'alter table public.profiles
             add constraint profiles_tenant_id_fkey
             foreign key (tenant_id) references public.tenants(id) on delete restrict';
  end if;

  -- zp_postings.tenant_id -> tenants.id
  if not exists (
    select 1 from pg_constraint
    where conname = 'zp_postings_tenant_id_fkey'
      and conrelid = 'public.zp_postings'::regclass
  ) then
    execute 'alter table public.zp_postings
             add constraint zp_postings_tenant_id_fkey
             foreign key (tenant_id) references public.tenants(id) on delete cascade';
  end if;

  -- zp_posting_pictures.tenant_id -> tenants.id
  if not exists (
    select 1 from pg_constraint
    where conname = 'zp_posting_pictures_tenant_id_fkey'
      and conrelid = 'public.zp_posting_pictures'::regclass
  ) then
    execute 'alter table public.zp_posting_pictures
             add constraint zp_posting_pictures_tenant_id_fkey
             foreign key (tenant_id) references public.tenants(id) on delete cascade';
  end if;
end $$;

--------------------------------------------------------------------------------
-- 4) INDEXES (performance por tenant)
--------------------------------------------------------------------------------
create index if not exists profiles_user_id_idx
  on public.profiles (user_id);

create index if not exists leads_tenant_created_at_idx
  on public.leads (tenant_id, created_at desc);

create index if not exists zp_postings_tenant_id_idx
  on public.zp_postings (tenant_id);

create index if not exists zp_posting_pictures_tenant_posting_idx
  on public.zp_posting_pictures (tenant_id, posting_id);

--------------------------------------------------------------------------------
-- 5) ENABLE RLS
--------------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.zp_postings enable row level security;
alter table public.zp_posting_pictures enable row level security;

-- Si querés forzar RLS incluso para owner (NO recomendado si usás service_role para ingestión):
-- alter table public.tenants force row level security;
-- alter table public.profiles force row level security;
-- alter table public.leads force row level security;
-- alter table public.zp_postings force row level security;
-- alter table public.zp_posting_pictures force row level security;

--------------------------------------------------------------------------------
-- 6) POLICIES (tenant se deriva SOLO de profiles + auth.uid())
--------------------------------------------------------------------------------

-- Limpieza idempotente
drop policy if exists tenants_select_own on public.tenants;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

drop policy if exists leads_select_tenant on public.leads;
drop policy if exists leads_insert_tenant on public.leads;
drop policy if exists leads_update_tenant on public.leads;
drop policy if exists leads_delete_tenant on public.leads;

drop policy if exists zp_postings_select_tenant on public.zp_postings;
drop policy if exists zp_posting_pictures_select_tenant on public.zp_posting_pictures;

-----------------------
-- profiles: usuario ve y actualiza su perfil (no cambia tenant/user por WITH CHECK)
-----------------------
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-----------------------
-- tenants: lectura solo para miembros del tenant
-----------------------
create policy tenants_select_own
on public.tenants
for select
to authenticated
using (
  id in (select tenant_id from public.profiles where user_id = auth.uid())
);

-----------------------
-- leads: CRUD dentro del tenant del usuario
-----------------------
create policy leads_select_tenant
on public.leads
for select
to authenticated
using (
  tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
);

create policy leads_insert_tenant
on public.leads
for insert
to authenticated
with check (
  tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
);

create policy leads_update_tenant
on public.leads
for update
to authenticated
using (
  tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
)
with check (
  tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
);

create policy leads_delete_tenant
on public.leads
for delete
to authenticated
using (
  tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
);

-----------------------
-- zp_postings: lectura dentro del tenant
-----------------------
create policy zp_postings_select_tenant
on public.zp_postings
for select
to authenticated
using (
  tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
);

-----------------------
-- zp_posting_pictures: lectura dentro del tenant
-----------------------
create policy zp_posting_pictures_select_tenant
on public.zp_posting_pictures
for select
to authenticated
using (
  tenant_id in (select tenant_id from public.profiles where user_id = auth.uid())
);

commit;