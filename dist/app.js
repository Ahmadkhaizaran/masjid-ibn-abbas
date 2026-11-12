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
    const allowedHosts = {
      whatsapp: ['whatsapp.com', 'www.whatsapp.com'],
      facebook: ['facebook.com', 'www.facebook.com'],
      instagram: ['instagram.com', 'www.instagram.com'],
      youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
      telegram: ['t.me', 'telegram.me'],
      tiktok: ['tiktok.com', 'www.tiktok.com']
    };
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
        read('social_links?select=platform,label,description,url,sort_order&order=sort_order.asc'),
        read('site_settings?select=phone,phone_display&id=eq.1&limit=1')
      ]);
      if (!Array.isArray(links) || !Array.isArray(settings)) return;
      const validLinks = links.filter(row => {
        try {
          const target = new URL(row.url);
          return target.protocol === 'https:' && !target.username && !target.password
            && allowedHosts[row.platform]?.includes(target.hostname);
        } catch { return false; }
      });
      if (validLinks.length !== links.length) return;
      const byPlatform = new Map(validLinks.map(row => [row.platform, row]));
      document.querySelectorAll('a[data-platform]').forEach(link => {
        const row = byPlatform.get(link.dataset.platform);
        link.hidden = !row;
        if (!row) return;
        link.href = row.url;
        link.style.order = String(Number(row.sort_order) || 0);
        link.querySelector('.link-copy strong').textContent = row.label;
        link.querySelector('.link-copy > span').textContent = row.description;
      });
      if (settings[0]) applyPhone(settings[0].phone, settings[0].phone_display);
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
