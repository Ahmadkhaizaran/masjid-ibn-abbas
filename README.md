# مسجد حبر الأمة عبد الله بن عباس — وقف الإمام الشافعي

صفحة روابط عربية خفيفة ومتجاوبة، مبنية بـHTML وCSS وJavaScript، مع بيانات الروابط والتواصل على Supabase.

الرابط: https://masjid-ibn-abbas.vercel.app/

## الملفات والنشر

- `dist/`: الموقع الجاهز للنشر، مع الخطوط والشعار محليًا.
- `vercel.json`: موقع ثابت وOutput Directory هو `dist`، دون build أو install.
- `supabase/schema.sql`: مرجع البنية والسياسات والبيانات الأولية؛ طُبّق بالفعل على المشروع الجديد، ولا يلزم تشغيله مرة ثانية.

مستودع الكود: https://github.com/Ahmadkhaizaran/masjid-ibn-abbas

اسم مشروع Vercel هو `masjid-ibn-abbas`، والفرع الرئيسي هو `main`.

المستودع مرتبط بالمشروع الحالي على Vercel. أي تحديث على `main` يشغّل نشر الإنتاج تلقائيًا على الرابط نفسه؛ أما الفروع الأخرى فتعطي نسخ معاينة. تعديلات الروابط والهاتف في Supabase لا تحتاج رفع كود جديد.

## تحديث الروابط والهاتف

من لوحة Supabase، عدّل جدول `social_links` لتحديث رابط أو عنوان أو وصف، أو `sort_order` لترتيبه، أو `is_active` لإظهاره وإخفائه. تظهر التعديلات عند فتح الصفحة أو تحديثها.

في جدول `site_settings`، أضف الرقم الرسمي في `phone` بالصيغة الدولية، مثل `+961...`، وأضف تنسيقه المرئي في `phone_display`. يظل زر الاتصال مخفيًا عندما يكون الرقم فارغًا.

معرّف مشروع Supabase: `lgtsoledzmiiqqivmqzh`.

تستخدم الصفحة Publishable Key للقراءة فقط. RLS مفعّل على الجدولين؛ الزائر لا يملك صلاحيات الإضافة أو التعديل أو الحذف، بما في ذلك المستخدم المسجّل. التعديلات الإدارية من لوحة Supabase بصلاحيات مالك المشروع. لا يحتوي المشروع على مفاتيح Service Role أو كلمات مرور.

تبقى الروابط الأصلية داخل HTML جاهزة للاستخدام فورًا، وتعمل أيضًا إذا تعذّر الوصول إلى Supabase. رابط واتساب قناة وليس رقم محادثة.

## الهوية

اسم «عبد الله بن عباس» بخط Reem Kufi، والعبارات التعريفية بخط Alexandria، والأزرار بخط IBM Plex Sans Arabic. التراخيص داخل `dist/assets/licenses/`. حركات الصفحة تحترم إعداد تقليل الحركة.

الروابط والشعار من المصدر الذي قدّمه صاحب المشروع:
https://me-qr.com/social-media/kakaguh7/show

## التشغيل المحلي

شغّل `python -m http.server --directory dist 8000` وافتح `http://localhost:8000`.


## Owner administration and traffic

Open `/admin` or the small lock button at the lower left of the public page. The owner account is provisioned out of band; credentials are never committed to this repository. There is no registration route.

`vercel.json` proxies `/api/site/*` to the Supabase `mosque-api` function. It uses server-side PBKDF2-SHA256 (600,000 iterations), per-IP login throttling, random 256-bit session tokens stored only as hashes, and 8-hour Secure/HttpOnly/SameSite=Strict cookies. Every administrative request validates the server-side session. API mutations require the production Origin. Private tables have RLS enabled and no browser-role grants or policies, deliberately denying all direct visitor access; the service role is used only inside the Edge Function. The security advisor's `rls_enabled_no_policy` informational notices for these private tables are intentional.

The owner can add arbitrary HTTPS links, choose their icons, reorder them, hide/re-enable them, and edit page text and phone settings. Public content reads remain protected by existing published-only RLS. Rendered text uses DOM textContent, and link URLs are validated on the server and client.

Traffic begins when the instrumentation is deployed. Page views, approximate unique browsers, active browsers within 5 minutes, link clicks, daily totals, coarse device categories and referrer hostnames are available in the panel. Owner visits while logged in are excluded. Do Not Track is respected. Raw IPs and full referrer URLs are not stored; rate limiting uses keyed hashes. Event UUIDs make retries idempotent; heartbeats do not add page views. These are approximate first-party measurements, not an exact count of people.

The original static QR encodes the plain homepage URL, so its visits cannot be separated from direct visits. New QR artwork may encode `https://masjid-ibn-abbas.vercel.app/?source=qr`; this counts opens attributed to that URL, not scans that never open the page.

Backend schema: `supabase/admin-schema.sql`. Deploy `supabase/functions/mosque-api/index.ts` with `verify_jwt=false` as specified in `supabase/config.toml`; the function performs its own authentication. The Supabase-provided service key remains in the function environment. The private owner record must be provisioned separately and must never be included in SQL source or seed data.

