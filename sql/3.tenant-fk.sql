alter table public.zp_postings
  add column if not exists tenant_id uuid;

-- después lo hacés NOT NULL cuando backfillees
-- alter table public.zp_postings alter column tenant_id set not null;

alter table public.zp_postings
  add constraint zp_postings_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

-- URL unique por tenant (en vez de global)
alter table public.zp_postings
  drop constraint if exists zp_postings_url_key;

alter table public.zp_postings
  add constraint zp_postings_tenant_url_key unique (tenant_id, url);

create index if not exists zp_postings_tenant_id_idx on public.zp_postings (tenant_id);


alter table public.zp_posting_pictures
  add column if not exists tenant_id uuid;

alter table public.zp_posting_pictures
  add constraint zp_posting_pictures_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

create index if not exists zp_posting_pictures_tenant_posting_idx
  on public.zp_posting_pictures (tenant_id, posting_id);


-- 1) Asegurar que existe el tenant demo y obtener su id
with demo as (
  insert into public.tenants (name, slug)
  values ('Demo', 'demo')
  on conflict (slug) do update set name = excluded.name
  returning id
),
demo_id as (
  select id from demo
  union all
  select id from public.tenants where slug = 'demo' limit 1
)

-- 2) Backfill: asignar tenant_id donde esté null
update public.zp_postings p
set tenant_id = (select id from demo_id)
where p.tenant_id is null;

-- 3) Verificación rápida
select
  count(*) as total,
  count(tenant_id) as con_tenant,
  count(*) - count(tenant_id) as sin_tenant
from public.zp_postings;

-- 4) Si todo ok (sin_tenant = 0), hacer NOT NULL
alter table public.zp_postings
  alter column tenant_id set not null;

-- 5) Índice útil
create index if not exists zp_postings_tenant_id_idx
  on public.zp_postings (tenant_id);
