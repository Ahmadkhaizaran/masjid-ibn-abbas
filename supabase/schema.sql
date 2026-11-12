begin;

create table public.social_links (
  platform text primary key check (platform in ('whatsapp','facebook','instagram','youtube','telegram','tiktok')),
  label text not null,
  description text not null default '',
  url text not null check (url ~ '^https://'),
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  endowment text not null,
  phone text not null default '' check (phone = '' or phone ~ '^\+[0-9]{7,15}$'),
  phone_display text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.social_links enable row level security;
alter table public.site_settings enable row level security;

revoke all on table public.social_links, public.site_settings from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.social_links, public.site_settings to anon, authenticated;

create policy "Read published social links" on public.social_links
  for select to anon, authenticated using (is_active = true);
create policy "Read public mosque settings" on public.site_settings
  for select to anon, authenticated using (id = 1);

insert into public.social_links (platform,label,description,url,sort_order) values
 ('whatsapp','قناة واتساب','لتصلك إعلانات المسجد','https://whatsapp.com/channel/0029Vb9LzNT0LKZCU2IcXI1E',1),
 ('facebook','فيسبوك','الأخبار والأنشطة','https://www.facebook.com/masjid.abdullah.binabbas',2),
 ('instagram','إنستغرام','صور ولحظات من المسجد','https://www.instagram.com/masjid.bin.abbas/',3),
 ('youtube','يوتيوب','الدروس والمحاضرات','https://www.youtube.com/@masjidabdullahbinabbas-saida',4),
 ('telegram','تلغرام','تابع قناة المسجد','https://t.me/hbrl2omma',5),
 ('tiktok','تيك توك','مقاطع قصيرة وفوائد','https://www.tiktok.com/@masjid.ebin.abbas',6);

insert into public.site_settings (id,name,endowment)
  values (1,'مسجد حبر الأمة عبد الله بن عباس','وقف الإمام الشافعي');

commit;
