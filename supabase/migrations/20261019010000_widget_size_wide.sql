-- A fourth widget size: "w" spans the full row of the grid (3 units tall on
-- desktop, the same as large on phones).
alter table public.widgets drop constraint widgets_size_check;
alter table public.widgets add constraint widgets_size_check check (size in ('s', 'm', 'l', 'w'));
