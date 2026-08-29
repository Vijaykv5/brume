import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DB_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or DB_URL is not configured.");
}

export const sql = neon(databaseUrl);

export async function ensureBuildingsTable() {
  await sql`
    create table if not exists buildings (
      id uuid primary key,
      building_type text not null check (
        building_type in ('billboard', 'small-office', 'office-building', 'tower')
      ),
      price_cents integer not null check (price_cents in (200, 500, 700, 1000)),
      company_name text not null,
      domain text not null,
      logo_url text,
      dodo_payment_id text,
      dodo_checkout_id text,
      building_order_id uuid,
      paid_at timestamptz,
      position_x numeric not null,
      position_y numeric not null,
      position_z numeric not null,
      click_count integer not null default 0,
      status text not null default 'active' check (status in ('active', 'hidden')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists buildings_status_created_at_idx
    on buildings (status, created_at desc)
  `;

  await sql`
    alter table buildings
    add column if not exists click_count integer not null default 0
  `;

  await sql`
    alter table buildings
    add column if not exists dodo_payment_id text
  `;

  await sql`
    alter table buildings
    add column if not exists dodo_checkout_id text
  `;

  await sql`
    alter table buildings
    add column if not exists building_order_id uuid
  `;

  await sql`
    alter table buildings
    add column if not exists paid_at timestamptz
  `;

  await sql`
    create unique index if not exists buildings_building_order_id_idx
    on buildings (building_order_id)
    where building_order_id is not null
  `;

  await sql`
    create index if not exists buildings_dodo_payment_id_idx
    on buildings (dodo_payment_id)
    where dodo_payment_id is not null
  `;

  await sql`
    alter table buildings
    drop constraint if exists buildings_building_type_check
  `;

  await sql`
    alter table buildings
    add constraint buildings_building_type_check
    check (building_type in ('billboard', 'small-office', 'office-building', 'tower'))
  `;

  await sql`
    alter table buildings
    drop constraint if exists buildings_price_cents_check
  `;

  await sql`
    update buildings
    set price_cents = case building_type
      when 'billboard' then 200
      when 'small-office' then 500
      when 'office-building' then 700
      when 'tower' then 1000
      else price_cents
    end
    where price_cents not in (200, 500, 700, 1000)
  `;

  await sql`
    alter table buildings
    add constraint buildings_price_cents_check
    check (price_cents in (200, 500, 700, 1000))
  `;
}

export async function ensureBuildingOrdersTable() {
  await sql`
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
    )
  `;

  await sql`
    create index if not exists building_orders_status_created_at_idx
    on building_orders (status, created_at desc)
  `;

  await sql`
    create index if not exists building_orders_dodo_payment_id_idx
    on building_orders (dodo_payment_id)
    where dodo_payment_id is not null
  `;
}

export async function ensureSiteAnalyticsTables() {
  await sql`
    create table if not exists site_analytics_daily (
      analytics_date date primary key,
      views integer not null default 0,
      unique_visitors integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists site_analytics_daily_visitors (
      analytics_date date not null,
      visitor_hash text not null,
      created_at timestamptz not null default now(),
      primary key (analytics_date, visitor_hash)
    )
  `;

  await sql`
    create index if not exists site_analytics_daily_visitors_date_idx
    on site_analytics_daily_visitors (analytics_date)
  `;
}
