create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_requests_status_created_idx
on public.account_requests (status, created_at desc);
