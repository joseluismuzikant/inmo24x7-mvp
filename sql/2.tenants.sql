-- Tenants (multi-tenant root table)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Useful index for searching by name
create index if not exists tenants_name_idx on public.tenants (name);

-- Optional: auto-update updated_at on change
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

-- Seed tenant demo (idempotent)
insert into public.tenants (name, slug)
values ('Demo', 'demo')
on conflict (slug) do nothing;
