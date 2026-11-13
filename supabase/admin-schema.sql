-- Owner-only administration and first-party, approximate traffic statistics.
begin;
alter table public.social_links drop constraint social_links_platform_check;
alter table public.social_links add constraint social_links_platform_format check (platform ~ '^[a-z0-9_-]{1,64}$');
alter table public.social_links add column icon text not null default 'link';
alter table public.social_links add column featured boolean not null default false;
update public.social_links set icon=platform,featured=(platform='whatsapp');
alter table public.site_settings add column display_name text not null default 'عبد الله بن عباس';
alter table public.site_settings add column eyebrow text not null default 'مسجد حَبْر الأمّة';
alter table public.site_settings add column hero_note text not null default 'علمٌ يُنير، وأثرٌ يبقى.';
alter table public.site_settings add column hero_description text not null default E'تابع دروس المسجد وأنشطته وإعلاناته،\nوكن قريبًا من كلّ جديد.';
alter table public.site_settings add column tracking_started_at timestamptz not null default now();

create table public.site_owner (
 id smallint primary key check(id=1), username text not null unique,
 password_hash text not null, password_salt text not null,
 created_at timestamptz not null default now()
);
create table public.site_admin_sessions (
 token_hash text primary key, expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table public.site_events (
 id uuid primary key, event_type text not null check(event_type in ('view','click')),
 visitor_hash text not null, session_id uuid not null,
 link_id text, source text not null check(source in ('direct','qr','social','referral')),
 device text not null check(device in ('mobile','desktop','tablet')),
 referrer text not null default '', created_at timestamptz not null default now()
);
create index site_events_created on public.site_events(created_at);
create index site_events_link on public.site_events(link_id,created_at) where event_type='click';
create table public.site_presence (
 session_id uuid primary key, visitor_hash text not null,
 last_seen timestamptz not null default now()
);
create index site_presence_seen on public.site_presence(last_seen);
create table public.site_rate_limits (
 bucket_key text not null, window_start timestamptz not null, hits integer not null,
 primary key(bucket_key,window_start)
);
alter table public.site_owner enable row level security;
alter table public.site_admin_sessions enable row level security;
alter table public.site_events enable row level security;
alter table public.site_presence enable row level security;
alter table public.site_rate_limits enable row level security;
revoke all on public.site_owner,public.site_admin_sessions,public.site_events,public.site_presence,public.site_rate_limits from public,anon,authenticated;
grant all on public.site_owner,public.site_admin_sessions,public.site_events,public.site_presence,public.site_rate_limits to service_role;
grant all on public.social_links,public.site_settings to service_role;

create function public.site_take_rate(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_hits integer; v_window timestamptz;
begin
 v_window:=to_timestamp(floor(extract(epoch from now())/p_seconds)*p_seconds);
 insert into public.site_rate_limits values(p_key,v_window,1)
 on conflict(bucket_key,window_start) do update set hits=site_rate_limits.hits+1 returning hits into v_hits;
 delete from public.site_rate_limits where window_start<now()-interval '1 day';
 return v_hits<=p_limit;
end $$;
revoke all on function public.site_take_rate(text,integer,integer) from public,anon,authenticated;
grant execute on function public.site_take_rate(text,integer,integer) to service_role;

create function public.site_dashboard(p_days integer default 7)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_start timestamptz; v_result jsonb;
begin
 if p_days not in (1,7,30,90,3650) then raise exception 'Invalid period'; end if;
 v_start:=((now() at time zone 'Asia/Beirut')::date-(p_days-1))::timestamp at time zone 'Asia/Beirut';
 select jsonb_build_object(
  'totals',(select jsonb_build_object('views',count(*) filter(where event_type='view'),
   'visitors',count(distinct visitor_hash) filter(where event_type='view'),
   'clicks',count(*) filter(where event_type='click'),
   'qr',count(*) filter(where event_type='view' and source='qr')) from public.site_events where created_at>=v_start),
  'online',(select count(distinct visitor_hash) from public.site_presence where last_seen>now()-interval '5 minutes'),
  'daily',(select coalesce(jsonb_agg(x order by x.day),'[]'::jsonb) from (
   select (created_at at time zone 'Asia/Beirut')::date as day,
    count(*) filter(where event_type='view') as views,
    count(distinct visitor_hash) filter(where event_type='view') as visitors,
    count(*) filter(where event_type='click') as clicks
   from public.site_events where created_at>=v_start group by 1) x),
  'links',(select coalesce(jsonb_agg(x order by x.clicks desc),'[]'::jsonb) from (
   select l.platform,l.label,l.is_active,count(e.id) as clicks from public.social_links l
   left join public.site_events e on e.link_id=l.platform and e.event_type='click' and e.created_at>=v_start
   group by l.platform,l.label,l.is_active) x),
  'sources',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select source,count(*) as total from public.site_events where event_type='view' and created_at>=v_start group by source) x),
  'devices',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select device,count(*) as total from public.site_events where event_type='view' and created_at>=v_start group by device) x),
  'started_at',(select tracking_started_at from public.site_settings where id=1),
  'updated_at',now()
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.site_dashboard(integer) from public,anon,authenticated;
grant execute on function public.site_dashboard(integer) to service_role;
commit;
