alter table buildings
drop constraint if exists buildings_building_type_check;

alter table buildings
add constraint buildings_building_type_check
check (building_type in ('billboard', 'small-office', 'office-building', 'tower'));

alter table buildings
drop constraint if exists buildings_price_cents_check;

alter table buildings
add constraint buildings_price_cents_check
check (price_cents in (100, 200, 300, 400));
