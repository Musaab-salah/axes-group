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

  function esc(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function isVideoPath(path = '') {
    return /\.(mp4|webm|ogg)(\?|$)/i.test(path);
  }

  function projectCardHtml(p, { link = true } = {}) {
    const media = p.imagePath || '';
    const mediaHtml = isVideoPath(media)
      ? `<video src="${esc(media)}" muted loop playsinline autoplay preload="metadata"></video>`
      : `<img src="${esc(media || '/assets/service-construction.jpg')}" alt="" loading="lazy">`;
    const cat = p.sectorSlug || 'general';
    const labelAr = p.sectorNameAr || p.categoryAr || '';
    const labelEn = p.sectorNameEn || p.categoryEn || '';
    const tag = link && p.href ? 'a' : 'article';
    const hrefAttr = link && p.href ? ` href="${esc(p.href)}"` : '';
    return `<${tag} class="project-card"${hrefAttr} data-category="${esc(cat)}">
      <div class="project-media">${mediaHtml}<span data-ar="${esc(labelAr)}" data-en="${esc(labelEn)}">${esc(lang === 'en' ? labelEn || labelAr : labelAr || labelEn)}</span></div>
      <div class="project-meta">
        <small data-ar="${esc(labelAr)}" data-en="${esc(labelEn)}">${esc(lang === 'en' ? labelEn || labelAr : labelAr || labelEn)}</small>
        <h3 data-ar="${esc(p.nameAr)}" data-en="${esc(p.nameEn)}">${esc(lang === 'en' ? p.nameEn || p.nameAr : p.nameAr)}</h3>
        <p data-ar="${esc(p.summaryAr || '')}" data-en="${esc(p.summaryEn || '')}">${esc(lang === 'en' ? p.summaryEn || p.summaryAr || '' : p.summaryAr || p.summaryEn || '')}</p>
      </div>
    </${tag}>`;
  }

  function bindProjectFilters(scope) {
    const root = scope || document;
    const filters = [...root.querySelectorAll('[data-filter]')];
    filters.forEach(button => button.addEventListener('click', () => {
      const value = button.dataset.filter;
      filters.forEach(b => b.classList.toggle('active', b === button));
      root.querySelectorAll('.project-card').forEach(card => {
        card.hidden = value !== 'all' && card.dataset.category !== value;
      });
    }));
  }

  async function loadHomeProjects() {
    const grid = document.getElementById('home-projects-grid');
    if (!grid) return;
    try {
      const res = await fetch('/api/public/projects?featured=1', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const projects = data.projects || [];
      if (!projects.length) {
        grid.innerHTML = '<p data-ar="ستظهر هنا الأعمال المميزة المرتبطة بالقطاعات." data-en="Featured sector works will appear here.">ستظهر هنا الأعمال المميزة المرتبطة بالقطاعات.</p>';
        renderLanguage();
        return;
      }
      grid.innerHTML = projects.slice(0, 3).map(p => projectCardHtml(p)).join('');
      renderLanguage();
    } catch (_) {}
  }

  async function loadProjectsPage() {
    const grid = document.getElementById('projects-grid');
    const filtersHost = document.getElementById('projects-filters');
    if (!grid) return;
    try {
      const res = await fetch('/api/public/projects', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const projects = data.projects || [];
      if (filtersHost) {
        const sectors = [];
        const seen = new Set();
        projects.forEach(p => {
          if (p.sectorSlug && !seen.has(p.sectorSlug)) {
            seen.add(p.sectorSlug);
            sectors.push({ slug: p.sectorSlug, nameAr: p.sectorNameAr || p.sectorSlug, nameEn: p.sectorNameEn || p.sectorSlug });
          }
        });
        filtersHost.innerHTML = [
          '<button class="active" data-filter="all"><span data-ar="الكل" data-en="All">الكل</span></button>',
          ...sectors.map(s => `<button data-filter="${esc(s.slug)}"><span data-ar="${esc(s.nameAr)}" data-en="${esc(s.nameEn)}">${esc(lang === 'en' ? s.nameEn : s.nameAr)}</span></button>`),
        ].join('');
      }
      if (!projects.length) {
        grid.innerHTML = '<p data-ar="أضف أعمالاً من لوحة التحكم واربطها بقطاع." data-en="Add works from the admin and link them to a sector.">أضف أعمالاً من لوحة التحكم واربطها بقطاع.</p>';
      } else {
        grid.innerHTML = projects.map(p => projectCardHtml(p)).join('');
      }
      bindProjectFilters(document.querySelector('.projects-page') || document);
      renderLanguage();
    } catch (_) {}
  }

  async function loadServicesPage() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    try {
      const res = await fetch('/api/public/services', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const services = data.services || [];
      if (!services.length) {
        grid.innerHTML = '<p data-ar="أضف خدمات من لوحة التحكم واربطها بقطاع." data-en="Add services from the admin and link them to a sector.">أضف خدمات من لوحة التحكم واربطها بقطاع.</p>';
        renderLanguage();
        return;
      }
      grid.innerHTML = services.map(s => {
        const img = s.imagePath || '/assets/service-construction.jpg';
        const sectorNoteAr = s.sectorNameAr ? `قطاع: ${s.sectorNameAr}` : '';
        const sectorNoteEn = s.sectorNameEn ? `Sector: ${s.sectorNameEn}` : '';
        return `<a class="service-card" id="service-${esc(s.slug)}" href="${esc(s.href)}">
          <div class="service-photo"><img src="${esc(img)}" alt="" loading="lazy">${sectorNoteAr ? `<span class="image-note" data-ar="${esc(sectorNoteAr)}" data-en="${esc(sectorNoteEn)}">${esc(lang === 'en' ? sectorNoteEn : sectorNoteAr)}</span>` : ''}</div>
          <div class="service-body">
            <span class="service-index">${esc(s.index || '')}</span>
            <h3 data-ar="${esc(s.nameAr)}" data-en="${esc(s.nameEn)}">${esc(lang === 'en' ? s.nameEn || s.nameAr : s.nameAr)}</h3>
            <p data-ar="${esc(s.summaryAr || '')}" data-en="${esc(s.summaryEn || '')}">${esc(lang === 'en' ? s.summaryEn || s.summaryAr || '' : s.summaryAr || s.summaryEn || '')}</p>
            <span class="service-link" data-ar="عرض القطاع ↗" data-en="View sector ↗">${lang === 'en' ? 'View sector ↗' : 'عرض القطاع ↗'}</span>
          </div>
        </a>`;
      }).join('');
      renderLanguage();
    } catch (_) {}
  }

  async function loadHomeSectors() {
    const grid = document.getElementById('home-sectors-grid');
    if (!grid) return;
    try {
      const res = await fetch('/api/public/sectors?home=1', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const sectors = data.sectors || [];
      if (!sectors.length) {
        grid.innerHTML = '<p data-ar="ستظهر هنا القطاعات المنشورة." data-en="Published sectors will appear here.">ستظهر هنا القطاعات المنشورة.</p>';
        return;
      }
      grid.innerHTML = sectors.map(s => {
        const cover = s.coverPath || '/assets/service-construction.jpg';
        const face = /engineer|portrait|team|selfie|crew|duo|workers|brick-branded|cover-engineer|main-portrait/i.test(cover);
        return `<a class="home-sector-card" href="/sectors/${s.slug}"><img class="${face ? 'shot-face' : 'shot-scene'}" src="${cover}" alt="" loading="lazy"><div><h3 data-ar="${s.nameAr}" data-en="${s.nameEn}">${lang === 'en' ? (s.nameEn || s.nameAr) : s.nameAr}</h3><p data-ar="${s.summaryAr || ''}" data-en="${s.summaryEn || ''}">${lang === 'en' ? (s.summaryEn || s.summaryAr || '') : (s.summaryAr || s.summaryEn || '')}</p></div></a>`;
      }).join('');
      renderLanguage();
    } catch (_) {}
  }
  loadHomeSectors();
  loadHomeProjects();
  loadProjectsPage();
  loadServicesPage();

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