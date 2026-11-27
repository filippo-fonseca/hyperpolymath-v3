-- Widget builder: chart kinds, live widgets and widget requests.
--
-- kind: six new custom kinds (line, bar, donut, progress, heatmap, blocks).
-- source: a live widget's data source ({ "id": "tasks_done", "days": 30 }).
--   The app computes its payload on read from the owner's own data.
-- brief: what the owner asked a bot to put in a widget, in their words.
--   Bots read it (get_overview widget_requests) and publish to match.
alter table public.widgets drop constraint widgets_kind_check;
alter table public.widgets add constraint widgets_kind_check check (kind in (
  'tasks', 'calendar', 'habits', 'capture', 'kiwi', 'projects',
  'digest', 'list', 'stat', 'timeline', 'markdown', 'table',
  'line', 'bar', 'donut', 'progress', 'heatmap', 'blocks'
));

alter table public.widgets add column source jsonb check (source is null or jsonb_typeof(source) = 'object');
alter table public.widgets add column brief text check (brief is null or length(brief) <= 2000);
