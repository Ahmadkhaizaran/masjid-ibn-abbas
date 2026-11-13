(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const number=value=>Number(value||0).toLocaleString('ar-LB');
 const fields=['display_name','eyebrow','endowment','hero_note','hero_description','phone','phone_display'];
 let links=[];let activeTab='overview';let authenticated=false;let loadingStats=false;
 const status=(id,text,error=false)=>{const node=$(id);node.textContent=text;node.className='status '+(error?'error':'success');};
 async function api(path,body){
  let response;try{response=await fetch('/api/site/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new Error('تعذّر الاتصال. تأكّد من الإنترنت وجرّب مجدداً.');}
  let data;try{data=await response.json();}catch{throw new Error('تعذّر قراءة الرد. جرّب مجدداً.');}
  if(!response.ok){if(response.status===401&&authenticated)showLogin();throw new Error(data.error||'تعذّر إتمام الطلب.');}return data;
 }
 function showLogin(){authenticated=false;$('dashboard-screen').hidden=true;$('login-screen').hidden=false;}
 async function showDashboard(){
  authenticated=true;$('login-screen').hidden=true;$('dashboard-screen').hidden=false;$('password').value='';
  status('global-status','جارٍ تحميل البيانات…');
  const results=await Promise.allSettled([loadContent(),loadStats()]);
  const error=results.find(result=>result.status==='rejected');status('global-status',error?error.reason.message:'',Boolean(error));
 }
 function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
 const beirutDay=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Beirut',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;};
 async function loadStats(){
  if(loadingStats)return;loadingStats=true;$('refresh-stats').disabled=true;
  try{
   const days=Number($('period').value);const data=await api('dashboard?days='+days);
   $('online-count').textContent=number(data.online);for(const key of ['views','visitors','clicks','qr'])$('stat-'+key).textContent=number(data.totals[key]);
   const daily=new Map(data.daily.map(row=>[row.day,row]));const today=new Date(beirutDay()+'T12:00:00Z');const chart=$('daily-chart');chart.replaceChildren();
   const startDate=new Date(data.started_at);const actualDays=Math.max(1,Math.ceil((today-startDate)/86400000)+1);const count=Math.min(days,actualDays,90);const rows=[];
   for(let offset=count-1;offset>=0;offset--){const date=new Date(today);date.setUTCDate(date.getUTCDate()-offset);const day=date.toISOString().slice(0,10);rows.push({day,views:daily.get(day)?.views||0});}
   const max=Math.max(1,...rows.map(row=>row.views));
   if(!rows.some(row=>row.views)){chart.append(element('p','chart-empty','تبدأ الحكاية مع أول زيارة. لا زيارات مسجّلة في هذه الفترة.'));}
   else for(const row of rows){const column=element('div','chart-day');column.title=row.day+': '+number(row.views)+' زيارة';column.append(element('span','',number(row.views)));const bar=element('div','chart-bar');bar.style.height=Math.max(3,row.views/max*145)+'px';column.append(bar,element('small','',row.day.slice(5).replace('-','/')));chart.append(column);}
   const popular=$('popular-links');popular.replaceChildren();for(const row of data.links){const line=element('div','rank-row');line.append(element('span','',row.label),element('strong','',number(row.clicks)));popular.append(line);}if(!data.links.length)popular.append(element('p','muted','لا روابط بعد.'));
   const breakdown=(id,rows,key,names)=>{const holder=$(id);holder.replaceChildren();for(const [value,label] of Object.entries(names)){const row=element('div','breakdown-row');row.append(element('span','',label),element('strong','',number(rows.find(r=>r[key]===value)?.total)));holder.append(row);}};
   breakdown('traffic-sources',data.sources,'source',{direct:'فتح مباشر أو مصدر غير معروف',qr:'رابط QR المتتبَّع',social:'منصّات التواصل',referral:'مواقع أخرى'});
   breakdown('traffic-devices',data.devices,'device',{mobile:'هاتف',desktop:'كمبيوتر',tablet:'جهاز لوحي'});
   const date=new Date(data.started_at).toLocaleDateString('ar-LB',{timeZone:'Asia/Beirut'});const updated=new Date(data.updated_at).toLocaleTimeString('ar-LB',{timeZone:'Asia/Beirut',hour:'numeric',minute:'2-digit'});
   $('stats-footnote').textContent='بدأ جمع الإحصاءات في '+date+' · آخر تحديث '+updated+' · تحديث تلقائي كل ٣٠ ثانية.'+(days>90?' الرسم يعرض أحدث ٩٠ يوماً كحد أقصى.':'');
  }finally{loadingStats=false;$('refresh-stats').disabled=false;}
 }
 async function loadContent(){const content=await api('content');links=content.links;renderLinks();for(const field of fields)$('setting-'+field).value=content.settings[field]||'';}
 function renderLinks(){
  const holder=$('admin-links');holder.replaceChildren();
  for(const row of links){const card=element('article','admin-link-row');const copy=element('div','admin-link-copy');const name=element('div','admin-link-name');name.append(element('span','order-tag',number(row.sort_order)),element('strong','',row.label));copy.append(name,element('small','',row.url));const controls=element('div','link-controls');controls.append(element('span','badge'+(row.is_active?'':' off'),row.is_active?'ظاهر':'مخفي'));
   const edit=element('button','quiet','تعديل');edit.type='button';edit.addEventListener('click',()=>editLink(row));
   const toggle=element('button','quiet',row.is_active?'إخفاء':'إظهار');toggle.type='button';toggle.addEventListener('click',async()=>{toggle.disabled=true;try{await api('link',{...row,operation:'update',is_active:!row.is_active});await loadContent();status('global-status','تم تحديث ظهور الرابط.');}catch(error){status('global-status',error.message,true);}finally{toggle.disabled=false;}});
   controls.append(edit,toggle);card.append(copy,controls);holder.append(card);
  }
  if(!links.length)holder.append(element('p','muted','أضف أول رابط ليظهر هنا.'));
 }
 function editLink(row){
  $('link-form').hidden=false;$('link-form-title').textContent=row?'تعديل الرابط':'إضافة رابط جديد';$('link-id').value=row?.platform||'';$('link-label').value=row?.label||'';$('link-description').value=row?.description||'';$('link-url').value=row?.url||'';$('link-icon').value=row?.icon||'link';$('link-order').value=row?.sort_order??Math.min(1000,Math.max(0,...links.map(link=>link.sort_order))+1);$('link-active').checked=row?.is_active??true;$('link-featured').checked=row?.featured??false;status('link-status','');$('link-form').scrollIntoView({behavior:'smooth',block:'center'});$('link-label').focus({preventScroll:true});
 }
 $('login-form').addEventListener('submit',async event=>{event.preventDefault();$('login-submit').disabled=true;status('login-status','جارٍ التحقّق…');try{await api('login',{username:$('username').value,password:$('password').value});status('login-status','');await showDashboard();}catch(error){status('login-status',error.message,true);}finally{$('login-submit').disabled=false;}});
 $('show-password').addEventListener('click',()=>{const visible=$('password').type==='password';$('password').type=visible?'text':'password';$('show-password').textContent=visible?'إخفاء':'إظهار';$('show-password').setAttribute('aria-pressed',String(visible));});
 $('logout').addEventListener('click',async()=>{$('logout').disabled=true;try{await api('logout',{});showLogin();status('login-status','تم تسجيل الخروج.');}catch(error){status('global-status',error.message,true);}finally{$('logout').disabled=false;}});
 document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{activeTab=button.dataset.tab;document.querySelectorAll('[data-tab]').forEach(tab=>{const current=tab===button;tab.classList.toggle('active',current);if(current)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');});document.querySelectorAll('.panel').forEach(panel=>{panel.hidden=panel.id!=='panel-'+activeTab;});status('global-status','');if(activeTab==='overview')loadStats().catch(error=>status('global-status',error.message,true));}));
 $('period').addEventListener('change',()=>loadStats().catch(error=>status('global-status',error.message,true)));$('refresh-stats').addEventListener('click',()=>loadStats().catch(error=>status('global-status',error.message,true)));
 $('new-link').addEventListener('click',()=>editLink());$('cancel-link').addEventListener('click',()=>{$('link-form').hidden=true;});
 $('link-form').addEventListener('submit',async event=>{event.preventDefault();$('save-link').disabled=true;status('link-status','جارٍ الحفظ…');const id=$('link-id').value;try{await api('link',{operation:id?'update':'create',platform:id||'link_'+crypto.randomUUID().replaceAll('-','').slice(0,16),label:$('link-label').value,description:$('link-description').value,url:$('link-url').value,icon:$('link-icon').value,sort_order:Number($('link-order').value),is_active:$('link-active').checked,featured:$('link-featured').checked});await loadContent();$('link-form').hidden=true;status('global-status','تم حفظ الرابط. التعديل يظهر في الموقع مباشرة.');}catch(error){status('link-status',error.message,true);}finally{$('save-link').disabled=false;}});
 $('settings-form').addEventListener('submit',async event=>{event.preventDefault();$('save-settings').disabled=true;status('settings-status','جارٍ الحفظ…');try{await api('settings',Object.fromEntries(fields.map(field=>[field,$('setting-'+field).value])));status('settings-status','تم حفظ التعديلات ونشرها في الموقع.');}catch(error){status('settings-status',error.message,true);}finally{$('save-settings').disabled=false;}});
 $('copy-qr').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('tracked-qr-url').value);$('copy-qr').textContent='تم النسخ ✓';}catch{$('tracked-qr-url').select();status('global-status','حدّد الرابط وانسخه.');}});
 setInterval(()=>{if(authenticated&&activeTab==='overview'&&!document.hidden)loadStats().catch(error=>status('global-status',error.message,true));},30000);
 api('session').then(showDashboard).catch(()=>showLogin());
})();
