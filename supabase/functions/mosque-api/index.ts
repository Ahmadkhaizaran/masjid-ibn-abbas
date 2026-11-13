// All credentials and session records stay server-side. No client-side password checks.
const base = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const site = 'https://masjid-ibn-abbas.vercel.app';
const cookieName = '__Host-mosque_admin';
const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const icons = new Set(['whatsapp','facebook','instagram','youtube','telegram','tiktok','link','location','phone']);
const hmacKey = crypto.subtle.importKey('raw',encoder.encode(service),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const hex = (data: ArrayBuffer) => Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');
const hash = async (text: string) => hex(await crypto.subtle.digest('SHA-256',encoder.encode(text)));
const privateHash = async (text: string) => hex(await crypto.subtle.sign('HMAC',await hmacKey,encoder.encode(text)));
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);

async function db(path: string,method='GET',body?: unknown,prefer='return=representation') {
 const response = await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok) throw new Error('Database operation failed');
 const text=await response.text(); return text?JSON.parse(text):null;
}
const sessionCookie = (token: string,age: number) => `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const tokenFrom = (req: Request) => (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
async function session(req: Request) {
 const token=tokenFrom(req);if(!/^[a-f0-9]{64}$/.test(token))return false;
 const rows=await db('site_admin_sessions?select=token_hash&token_hash=eq.'+await hash(token)+'&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&limit=1');
 return rows?.length===1;
}
async function rate(req: Request,kind: string,limit: number,seconds: number) {
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('cf-connecting-ip')||'unknown';
 return await db('rpc/site_take_rate','POST',{p_key:await privateHash(kind+':'+ip),p_limit:limit,p_seconds:seconds});
}
function cleanLink(value: Record<string,unknown>) {
 const platform=String(value.platform||'');const label=String(value.label||'').trim();const description=String(value.description||'').trim();
 const url=new URL(String(value.url||''));const order=Number(value.sort_order);
 if(!/^[a-z0-9_-]{1,64}$/.test(platform)||!label||label.length>80||description.length>160||url.href.length>2048||url.protocol!=='https:'||url.username||url.password||!Number.isInteger(order)||order<0||order>1000||!icons.has(String(value.icon))||typeof value.is_active!=='boolean'||typeof value.featured!=='boolean')throw new Error('Invalid link');
 return {platform,label,description,url:url.href,sort_order:order,icon:value.icon,is_active:value.is_active,featured:value.featured,updated_at:new Date().toISOString()};
}
function cleanSettings(value: Record<string,unknown>) {
 const limits:Record<string,number>={display_name:100,eyebrow:100,endowment:120,hero_note:140,hero_description:300,phone:20,phone_display:40};
 const result:Record<string,string>={};for(const [key,max] of Object.entries(limits)){const text=String(value[key]??'').trim();if(text.length>max||(!text&&!['phone','phone_display'].includes(key)))throw new Error('Invalid settings');result[key]=text;}
 if(result.phone&&!/^\+[0-9]{7,15}$/.test(result.phone))throw new Error('Invalid phone');
 result.name=result.eyebrow+' '+result.display_name;result.updated_at=new Date().toISOString();return result;
}

Deno.serve(async (req: Request) => {
 const origin=req.headers.get('Origin');
 const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
 if(origin===site){headers['Access-Control-Allow-Origin']=site;headers['Access-Control-Allow-Credentials']='true';}
 const answer=(value:unknown,status=200,extra:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{...headers,...extra}});
 if(origin&&origin!==site)return answer({error:'غير مسموح'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, apikey','Access-Control-Max-Age':'3600'}});
 const action=new URL(req.url).pathname.split('/').filter(Boolean).pop();
 if(req.method==='POST'&&origin!==site)return answer({error:'غير مسموح'},403);
 if(Number(req.headers.get('content-length')||0)>8192)return answer({error:'الطلب كبير'},413);
 try {
  let input:Record<string,unknown>={};
  if(req.method==='POST'){const text=await req.text();if(text.length>8192)return answer({error:'الطلب كبير'},413);try{input=JSON.parse(text);}catch{return answer({error:'بيانات غير صالحة'},400);}if(!input||typeof input!=='object'||Array.isArray(input))return answer({error:'بيانات غير صالحة'},400);}
  if(action==='login'&&req.method==='POST') {
   if(!await rate(req,'login',10,600))return answer({error:'محاولات كثيرة. جرّب بعد عشر دقائق.'},429);
   const owners=await db('site_owner?select=username,password_hash,password_salt&id=eq.1&limit=1');
   const owner=owners?.[0];if(!owner)return answer({error:'الحساب غير جاهز'},503);
   const password=String(input.password||'');if(password.length>256)return answer({error:'بيانات الدخول غير صحيحة'},401);
   const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
   const salt=Uint8Array.from(owner.password_salt.match(/.{2}/g).map((x:string)=>parseInt(x,16)));
   const derived=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},key,256));
   let difference=derived.length^owner.password_hash.length;for(let i=0;i<derived.length;i++)difference|=derived.charCodeAt(i)^owner.password_hash.charCodeAt(i);
   if(difference||String(input.username||'').trim().toLowerCase()!==owner.username.toLowerCase())return answer({error:'بيانات الدخول غير صحيحة'},401);
   const token=randomToken();await db('site_admin_sessions','POST',{token_hash:await hash(token),expires_at:new Date(Date.now()+8*3600000).toISOString()});
   await db('site_admin_sessions?expires_at=lt.'+encodeURIComponent(new Date().toISOString()),'DELETE',undefined,'return=minimal');
   return answer({ok:true,username:owner.username},200,{'Set-Cookie':sessionCookie(token,28800)});
  }
  if(action==='track'&&req.method==='POST') {
   if(await session(req))return answer({ok:true,excluded:true},202);
   if(/bot|crawler|spider|headless/i.test(req.headers.get('user-agent')||''))return answer({ok:true},202);
   if(!await rate(req,'track',120,60))return answer({ok:true},202);
   const type=String(input.type);const sid=String(input.session_id);const visitor=String(input.visitor_id);const eventId=String(input.event_id);
   if(!['view','click','heartbeat'].includes(type)||!uuid.test(sid)||!uuid.test(visitor)||(type!=='heartbeat'&&!uuid.test(eventId)))return answer({error:'بيانات غير صالحة'},400);
   const visitorHash=await privateHash('visitor:'+visitor);
   await db('site_presence?on_conflict=session_id','POST',{session_id:sid,visitor_hash:visitorHash,last_seen:new Date().toISOString()},'resolution=merge-duplicates,return=minimal');
   if(type==='heartbeat')return answer({ok:true},202);
   const source=String(input.source);const device=String(input.device);const link=type==='click'?String(input.link_id):null;
   if(!['direct','qr','social','referral'].includes(source)||!['mobile','desktop','tablet'].includes(device)||(link&&!/^[a-z0-9_-]{1,64}$/.test(link)))return answer({error:'بيانات غير صالحة'},400);
   if(link){const valid=await db('social_links?select=platform&platform=eq.'+encodeURIComponent(link)+'&is_active=eq.true&limit=1');if(!valid?.length)return answer({error:'الرابط غير موجود'},400);}
   let referrer='';try{referrer=new URL(String(input.referrer)).hostname.slice(0,160);}catch{/* no referrer */}
   await db('site_events?on_conflict=id','POST',{id:eventId,event_type:type,visitor_hash:visitorHash,session_id:sid,link_id:link,source,device,referrer},'resolution=ignore-duplicates,return=minimal');
   return answer({ok:true},202);
  }
  if(!await session(req))return answer({error:'يلزم تسجيل الدخول'},401);
  if(action==='session'&&req.method==='GET')return answer({ok:true});
  if(action==='logout'&&req.method==='POST'){await db('site_admin_sessions?token_hash=eq.'+await hash(tokenFrom(req)),'DELETE',undefined,'return=minimal');return answer({ok:true},200,{'Set-Cookie':sessionCookie('',0)});}
  if(action==='dashboard'&&req.method==='GET'){
   const days=Number(new URL(req.url).searchParams.get('days')||7);if(![1,7,30,90,3650].includes(days))return answer({error:'فترة غير صالحة'},400);
   return answer(await db('rpc/site_dashboard','POST',{p_days:days}));
  }
  if(action==='content'&&req.method==='GET')return answer({links:await db('social_links?select=*&order=sort_order.asc,platform.asc'),settings:(await db('site_settings?select=*&id=eq.1'))[0]});
  if(action==='link'&&req.method==='POST'){
   let row;try{row=cleanLink(input);}catch{return answer({error:'تأكّد من عنوان الرابط والنصوص؛ الرابط يجب أن يبدأ بـ https://'},400);}
   const update=input.operation==='update';if(!update&&input.operation!=='create')return answer({error:'عملية غير صالحة'},400);
   if(update){const rows=await db('social_links?platform=eq.'+encodeURIComponent(row.platform),'PATCH',row);if(!rows?.length)return answer({error:'الرابط غير موجود'},404);}
   else {const exists=await db('social_links?select=platform&platform=eq.'+encodeURIComponent(row.platform));if(exists.length)return answer({error:'هذا المعرّف مستخدم'},409);await db('social_links','POST',row);}
   return answer({ok:true});
  }
  if(action==='settings'&&req.method==='POST'){
   let settings;try{settings=cleanSettings(input);}catch{return answer({error:'تأكّد من النصوص ورقم الهاتف بصيغة +961…'},400);}
   await db('site_settings?id=eq.1','PATCH',settings);return answer({ok:true});
  }
  return answer({error:'غير موجود'},404);
 }catch{return answer({error:'تعذّر إتمام الطلب. جرّب مرة أخرى.'},500);}
});
