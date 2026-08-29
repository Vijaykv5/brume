alter table buildings
  add column if not exists dodo_payment_id text,
  add column if not exists dodo_checkout_id text,
  add column if not exists building_order_id uuid,
  add column if not exists paid_at timestamptz;

create unique index if not exists buildings_building_order_id_idx
  on buildings (building_order_id)
  where building_order_id is not null;

create index if not exists buildings_dodo_payment_id_idx
  on buildings (dodo_payment_id)
  where dodo_payment_id is not null;

create table if not exists building_orders (
  id uuid primary key,
  building_type text not null check (
    building_type in ('billboard', 'small-office', 'office-building', 'tower')
  ),
  price_cents integer not null check (price_cents in (200, 500, 700, 1000)),
  company_name text not null,
  domain text not null,
  logo_url text,
  status text not null default 'pending' check (
    status in ('pending', 'checkout_created', 'paid', 'failed', 'expired')
  ),
  dodo_checkout_id text,
  dodo_payment_id text,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists building_orders_status_created_at_idx
  on building_orders (status, created_at desc);

create index if not exists building_orders_dodo_payment_id_idx
  on building_orders (dodo_payment_id)
  where dodo_payment_id is not null;
