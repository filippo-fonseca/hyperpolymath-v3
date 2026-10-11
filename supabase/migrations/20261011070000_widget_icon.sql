-- Widget icon: an emoji or an https image URL (domains are stored as their
-- favicon URL). Set by bots over MCP or by the owner in widget settings.
alter table public.widgets add column icon text check (icon is null or length(icon) <= 500);
