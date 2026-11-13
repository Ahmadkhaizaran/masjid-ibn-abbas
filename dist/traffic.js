(() => {
 'use strict';
 if(navigator.doNotTrack==='1')return;
 const id=(storage,key)=>{try{let value=storage.getItem(key);if(!/^[0-9a-f-]{36}$/i.test(value||'')){value=crypto.randomUUID();storage.setItem(key,value);}return value;}catch{return crypto.randomUUID();}};
 const visitor=id(localStorage,'mosque-visitor-v1');const session=id(sessionStorage,'mosque-session-v1');
 let referrer='';try{referrer=new URL(document.referrer).origin;}catch{/* direct visit */}
 const social=/\b(facebook|instagram|youtube|tiktok|whatsapp|t\.co|t\.me|telegram)\b/i.test(referrer);
 const source=new URLSearchParams(location.search).get('source')==='qr'?'qr':social?'social':referrer&&referrer!==location.origin?'referral':'direct';
 const device=/iPad|Tablet/i.test(navigator.userAgent)?'tablet':/Mobi|Android|iPhone/i.test(navigator.userAgent)?'mobile':'desktop';
 const send=(type,link)=>{if(document.hidden&&type==='heartbeat')return;fetch('/api/site/track',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({type,event_id:crypto.randomUUID(),session_id:session,visitor_id:visitor,source,device,referrer,link_id:link||null})}).catch(()=>{});};
 send('view');
 document.querySelector('.social-links')?.addEventListener('click',event=>{const anchor=event.target.closest('a[data-platform]');if(anchor)send('click',anchor.dataset.platform);});
 setInterval(()=>send('heartbeat'),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)send('heartbeat');});
})();
