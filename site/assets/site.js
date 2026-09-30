(() => {
  const html = document.documentElement;
  const langButton = document.querySelector('.language');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  const saved = localStorage.getItem('axes-language');
  let lang = saved === 'en' ? 'en' : 'ar';

  function renderLanguage() {
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ar][data-en]').forEach(node => {
      const value = node.dataset[lang];
      if (value.includes('|')) {
        node.replaceChildren(...value.split('|').flatMap((part, i) => (
          i === 0 ? [document.createTextNode(part)] : [document.createElement('br'), document.createTextNode(part)]
        )));
      } else {
        node.textContent = value;
      }
    });
    langButton.textContent = lang === 'ar' ? 'EN' : 'عربي';
    langButton.setAttribute('aria-label', lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
    menuButton.setAttribute('aria-label', lang === 'ar' ? 'القائمة' : 'Menu');
  }

  async function applyCmsContent() {
    try {
      const pageSlug = document.body.dataset.cmsPage;
      if (!pageSlug) return;
      const preview = new URLSearchParams(location.search).get('cmsPreview') === '1';
      const url = preview ? `/api/public/content/${pageSlug}?draft=1` : '/assets/cms-content.json';
      const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) return;
      const payload = await res.json();
      const page = preview ? payload.content : payload[pageSlug];
      if (!page) return;

      document.querySelectorAll('[data-cms]').forEach(node => {
        const key = node.getAttribute('data-cms');
        const entry = page[key];
        if (!entry) return;
        applyEntry(node, entry);
      });

      document.querySelectorAll('[data-cms-poster]').forEach(node => {
        const key = node.getAttribute('data-cms-poster');
        const entry = page[key];
        if (!entry) return;
        const src = entry.ar || entry.en;
        if (src) node.setAttribute('poster', src);
      });

      renderLanguage();
    } catch (_) {
      /* keep static fallback content */
    }
  }

  function applyEntry(node, entry) {
    const type = entry.type || 'text';
    const value = lang === 'en' ? (entry.en || entry.ar) : (entry.ar || entry.en);
    if (type === 'image') {
      if (value) node.setAttribute('src', value);
      return;
    }
    if (type === 'video') {
      if (value) {
        node.setAttribute('src', value);
        const video = node.closest('video');
        if (video) {
          try { video.load(); } catch (_) {}
        }
      }
      return;
    }
    if (node.hasAttribute('data-ar') && node.hasAttribute('data-en')) {
      node.setAttribute('data-ar', entry.ar);
      node.setAttribute('data-en', entry.en);
    } else if (type === 'text') {
      node.textContent = value;
    }
  }

  renderLanguage();
  applyCmsContent();
  langButton.addEventListener('click', () => {
    lang = lang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('axes-language', lang);
    renderLanguage();
  });
  menuButton.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }));

  const header = document.getElementById('site-header');
  const markScrolled = () => header.classList.toggle('scrolled', window.scrollY > 20);
  window.addEventListener('scroll', markScrolled, { passive: true });
  markScrolled();
  document.getElementById('year').textContent = String(new Date().getFullYear());

  const filters = [...document.querySelectorAll('[data-filter]')];
  filters.forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.filter;
    filters.forEach(b => b.classList.toggle('active', b === button));
    document.querySelectorAll('.projects-page .project-card').forEach(card => {
      card.hidden = value !== 'all' && card.dataset.category !== value;
    });
  }));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.querySelectorAll('video[autoplay]').forEach(video => video.pause());
  const counters = document.querySelectorAll('.counter');
  const animateCounter = el => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduced) { el.textContent = target + suffix; return; }
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 1050);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { animateCounter(entry.target); observer.unobserve(entry.target); }
    }), { threshold: .4 });
    counters.forEach(el => observer.observe(el));
  } else counters.forEach(animateCounter);

  const form = document.getElementById('contact-form');
  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const type = String(data.get('type') || '').trim();
    const details = String(data.get('details') || '').trim();
    const subject = `AXES GROUP — ${type} enquiry`;
    const body = `Name: ${name}\nEmail: ${email}\nProject type: ${type}\n\n${details}`;
    window.location.href = `mailto:aseeng2017@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
})();
