(() => {
  'use strict';
  const config = window.MOSQUE_CONFIG || {};
  const shareButton = document.getElementById('share-button');
  const dialog = document.getElementById('share-dialog');
  const shareUrl = document.getElementById('share-url');
  const copyButton = document.getElementById('copy-link');
  const status = document.getElementById('copy-status');
  const url = config.canonicalUrl || window.location.origin + window.location.pathname;
  shareUrl.value = url;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!reducedMotion.matches) {
    const links = document.querySelectorAll('.social-link');
    if ('IntersectionObserver' in window) {
      const reveal = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            reveal.unobserve(entry.target);
          }
        });
      }, {threshold: 0.12});
      links.forEach((link, index) => {
        link.style.setProperty('--delay', `${Math.min(index * 65, 260)}ms`);
        link.classList.add('reveal-ready');
        reveal.observe(link);
      });
    }
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const identity = document.querySelector('.identity');
      const art = document.querySelector('.identity-art');
      const light = document.querySelector('.pointer-light');
      let frame = 0;
      document.addEventListener('pointermove', event => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          light.style.transform = `translate(${event.clientX - 170}px, ${event.clientY - 170}px)`;
          light.style.opacity = '1';
        });
      }, {passive:true});
      document.documentElement.addEventListener('pointerleave', () => { light.style.opacity = '0'; });
      identity.addEventListener('pointermove', event => {
        const rect = identity.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        art.style.transform = `perspective(800px) rotateY(${x * -5}deg) rotateX(${y * 4}deg)`;
      }, {passive:true});
      identity.addEventListener('pointerleave', () => { art.style.transform = ''; });
    }
  }

  const applyPhone = (value, display) => {
    const phone = String(value || '').replace(/[\s()-]/g, '');
    const valid = /^\+\d{7,15}$/.test(phone);
    document.getElementById('contact-section').hidden = !valid;
    if (valid) {
      document.getElementById('phone-link').href = 'tel:' + phone;
      document.getElementById('phone-number').textContent = display || phone;
    }
  };
  applyPhone(config.phone, config.phoneDisplay);

  // The HTML keeps working immediately, even while Supabase is waking up.
  const loadPublishedContent = async () => {
    if (!config.supabaseUrl || !config.supabasePublishableKey) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const allowedIcons = new Set(['whatsapp','facebook','instagram','youtube','telegram','tiktok','link','location','phone']);
    const read = async path => {
      const response = await fetch(config.supabaseUrl + '/rest/v1/' + path, {
        headers: {apikey: config.supabasePublishableKey},
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Content temporarily unavailable');
      return response.json();
    };
    try {
      const [links, settings] = await Promise.all([
        read('social_links?select=platform,label,description,url,sort_order,icon,featured&order=sort_order.asc,platform.asc'),
        read('site_settings?select=phone,phone_display,name,endowment,display_name,eyebrow,hero_note,hero_description&id=eq.1&limit=1')
      ]);
      if (!Array.isArray(links) || !Array.isArray(settings)) return;
      const validLinks = links.filter(row => {
        try {
          const target = new URL(row.url);
          return target.protocol === 'https:' && !target.username && !target.password
            && /^[a-z0-9_-]{1,64}$/.test(row.platform) && typeof row.label === 'string';
        } catch { return false; }
      });
      if (validLinks.length !== links.length) return;
      const nav=document.querySelector('.social-links');
      const fragment=document.createDocumentFragment();
      const svgIcon=(id,className)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');if(className)svg.setAttribute('class',className);const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#i-'+id);svg.append(use);return svg;};
      for(const row of validLinks){
        const icon=allowedIcons.has(row.icon)?row.icon:'link';
        const link=document.createElement('a');link.className='social-link'+(row.featured?' featured':'');link.dataset.platform=row.platform;link.href=row.url;link.target='_self';link.rel='external';
        const badge=document.createElement('span');badge.className='platform-icon';badge.append(svgIcon(icon));
        const copy=document.createElement('span');copy.className='link-copy';const title=document.createElement('strong');title.textContent=row.label;const description=document.createElement('span');description.textContent=row.description||'';copy.append(title,description);link.append(badge,copy);
        if(row.featured){const label=document.createElement('span');label.className='featured-label';label.textContent=icon==='whatsapp'?'انضمّ الآن':'تابعنا';link.append(label);}
        else {const english={facebook:'Facebook',instagram:'Instagram',youtube:'YouTube',telegram:'Telegram',tiktok:'TikTok'}[icon];if(english){const label=document.createElement('span');label.className='platform-english';label.lang='en';label.dir='ltr';label.textContent=english;link.append(label);}}
        link.append(svgIcon('arrow','link-arrow'));fragment.append(link);
      }
      nav.replaceChildren(fragment);
      if(settings[0]){
        const value=settings[0];applyPhone(value.phone,value.phone_display);
        const set=(selector,text)=>{if(typeof text==='string')document.querySelector(selector).textContent=text;};
        set('#mosque-name',value.display_name);set('.eyebrow',value.eyebrow);set('.endowment-name',value.endowment);set('.hero-note',value.hero_note);set('.hero-description',value.hero_description);set('footer > span:first-child',value.name);set('footer .footer-dot + span',value.endowment);
        if(value.endowment)document.querySelector('.topbar .endowment').lastChild.textContent=' '+value.endowment;
      }
      document.documentElement.dataset.contentSource = 'supabase';
    } catch {
      // Preserve the original usable links when the network is unavailable.
      document.documentElement.dataset.contentSource = 'fallback';
    } finally {
      clearTimeout(timeout);
    }
  };
  loadPublishedContent();

  const openDialog = () => {
    status.textContent = '';
    copyButton.querySelector('span').textContent = 'نسخ';
    dialog.showModal();
  };
  shareButton.addEventListener('click', openDialog);
  document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  copyButton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      copyButton.querySelector('span').textContent = 'تم النسخ';
      status.textContent = 'تم نسخ الرابط، جزاك الله خيرًا.';
    } catch {
      shareUrl.focus();
      shareUrl.select();
      status.textContent = 'حدّد الرابط وانسخه من الحقل أعلاه.';
    }
  });
})();
