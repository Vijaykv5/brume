create table if not exists buildings (
  id uuid primary key,
  building_type text not null check (
    building_type in ('billboard', 'small-office', 'office-building', 'tower')
  ),
  price_cents integer not null check (price_cents in (100, 200, 300, 400)),
  company_name text not null,
  domain text not null,
  logo_url text,
  position_x numeric not null,
  position_y numeric not null,
  position_z numeric not null,
  click_count integer not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buildings_status_created_at_idx
on buildings (status, created_at desc);
