begin;
create table public.site_traffic_history (
 id text primary key,source text not null,period_start timestamptz not null,period_end timestamptz not null,
 request_count bigint not null check(request_count>=0),network_count bigint not null check(network_count>=0),
 daily jsonb not null,notes text not null,captured_at timestamptz not null default now()
);
alter table public.site_traffic_history enable row level security;
revoke all on public.site_traffic_history from public,anon,authenticated;
grant all on public.site_traffic_history to service_role;
CREATE OR REPLACE FUNCTION public.site_dashboard(p_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_start timestamptz; v_result jsonb;
begin
 if p_days not in (1,7,30,90,3650) then raise exception 'Invalid period'; end if;
 v_start:=((now() at time zone 'Asia/Beirut')::date-(p_days-1))::timestamp at time zone 'Asia/Beirut';
 select jsonb_build_object(
  'totals',(select jsonb_build_object('views',count(*) filter(where event_type='view'),
   'visitors',count(distinct visitor_hash) filter(where event_type='view'),
   'clicks',count(*) filter(where event_type='click'),
   'qr',count(*) filter(where event_type='view' and source='qr')) from public.site_events where created_at>=v_start and not is_test),
  'online',(select count(distinct visitor_hash) from public.site_presence where last_seen>now()-interval '5 minutes' and not is_test),
  'daily',(select coalesce(jsonb_agg(x order by x.day),'[]'::jsonb) from (
   select (created_at at time zone 'Asia/Beirut')::date as day,
    count(*) filter(where event_type='view') as views,
    count(distinct visitor_hash) filter(where event_type='view') as visitors,
    count(*) filter(where event_type='click') as clicks
   from public.site_events where created_at>=v_start and not is_test group by 1) x),
  'links',(select coalesce(jsonb_agg(x order by x.clicks desc),'[]'::jsonb) from (
   select l.platform,l.label,l.is_active,count(e.id) as clicks from public.social_links l
   left join public.site_events e on e.link_id=l.platform and e.event_type='click' and e.created_at>=v_start and not e.is_test
   group by l.platform,l.label,l.is_active) x),
  'sources',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select source,count(*) as total from public.site_events where event_type='view' and created_at>=v_start and not is_test group by source) x),
  'devices',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select device,count(*) as total from public.site_events where event_type='view' and created_at>=v_start and not is_test group by device) x),
  'started_at',(select tracking_started_at from public.site_settings where id=1),
  'legacy_history',(select coalesce(jsonb_agg(to_jsonb(h) order by h.period_start),'[]'::jsonb) from public.site_traffic_history h),
  'updated_at',now()
 ) into v_result;
 return v_result;
end $function$;

commit;

