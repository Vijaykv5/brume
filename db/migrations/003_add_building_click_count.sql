alter table buildings
add column if not exists click_count integer not null default 0;
