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
    alter table buildings
    add constraint buildings_price_cents_check
    check (price_cents in (100, 200, 300, 400))
  `;
}
