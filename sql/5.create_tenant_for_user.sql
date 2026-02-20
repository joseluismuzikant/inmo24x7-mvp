create or replace function public.handle_new_user_create_tenant()
returns trigger
language plpgsql
security definer
as $$
declare
  v_tenant_id uuid;
  v_slug text;
begin
  v_slug := 't_' || replace(new.id::text, '-', '');

  insert into public.tenants (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'company', 'Tenant ' || left(new.id::text, 8)),
    v_slug
  )
  returning id into v_tenant_id;

  insert into public.profiles (user_id, tenant_id, role)
  values (new.id, v_tenant_id, 'owner');

  return new;
end;
$$;

drop trigger if exists trg_create_tenant_on_signup on auth.users;

create trigger trg_create_tenant_on_signup
after insert on auth.users
for each row execute function public.handle_new_user_create_tenant();


create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','agent')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_tenant_idx on public.profiles(tenant_id);



insert into public.profiles (user_id, tenant_id, role)
select
  u.id as user_id,
  t.id as tenant_id,
  'owner' as role
from auth.users u
cross join (select id from public.tenants where slug = 'demo' limit 1) t
left join public.profiles p on p.user_id = u.id
where p.user_id is null;
