-- Life areas and projects (grouped like v2): every project sits in an area;
-- tasks and captures can belong to a project, habits to an area.

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 80),
  emoji text,
  color text,
  position double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index areas_user_idx on public.areas (user_id) where deleted_at is null;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  name text not null check (length(name) between 1 and 120),
  description text,
  emoji text,
  status text not null default 'active' check (status in ('active', 'paused', 'done')),
  start_date date,
  end_date date,
  -- Classes are projects too (course code, term), as in v2.
  is_class boolean not null default false,
  course_code text,
  term text,
  position double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index projects_user_area_idx on public.projects (user_id, area_id) where deleted_at is null;

alter table public.tasks add column project_id uuid references public.projects (id) on delete set null;
alter table public.captures add column project_id uuid references public.projects (id) on delete set null;
alter table public.habits add column area_id uuid references public.areas (id) on delete set null;
create index tasks_project_idx on public.tasks (project_id) where deleted_at is null;

create trigger areas_touch before update on public.areas for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

alter table public.areas enable row level security;
alter table public.projects enable row level security;
create policy areas_owner_read on public.areas for select to authenticated using (user_id = (select auth.uid()));
create policy projects_owner_read on public.projects for select to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.areas, public.projects;

-- The Projects widget joins the fixed widgets.
alter table public.widgets drop constraint widgets_kind_check;
alter table public.widgets add constraint widgets_kind_check check (kind in (
  'tasks', 'calendar', 'habits', 'capture', 'kiwi', 'projects',
  'digest', 'list', 'stat', 'timeline', 'markdown', 'table'
));

-- Carry over free-text task lists as projects (in a "General" area).
do $$
declare r record; a uuid; p uuid;
begin
  for r in select distinct user_id, list from public.tasks where list is not null and deleted_at is null loop
    select id into a from public.areas where user_id = r.user_id and name = 'General' and deleted_at is null limit 1;
    if a is null then
      insert into public.areas (user_id, name, emoji) values (r.user_id, 'General', '🗂') returning id into a;
    end if;
    insert into public.projects (user_id, area_id, name) values (r.user_id, a, r.list) returning id into p;
    update public.tasks set project_id = p where user_id = r.user_id and list = r.list;
  end loop;
end $$;
