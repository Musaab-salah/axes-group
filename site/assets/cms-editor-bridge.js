(() => {
  if (window.parent === window) return;
  const style = document.createElement('style');
  style.textContent = `
    [data-cms], [data-cms-poster] { cursor: pointer !important; transition: outline .15s, box-shadow .15s; }
    [data-cms]:hover, [data-cms-poster]:hover { outline: 2px dashed #c5a74a !important; outline-offset: 2px; }
    .cms-selected { outline: 3px solid #c5a74a !important; outline-offset: 3px; box-shadow: 0 0 0 4px rgba(197,167,74,.25) !important; }
  `;
  document.head.appendChild(style);

  let selected = null;

  function selectEl(el) {
    if (selected) selected.classList.remove('cms-selected');
    selected = el;
    if (!el) return;
    el.classList.add('cms-selected');
    const key = el.getAttribute('data-cms') || el.getAttribute('data-cms-poster');
    const hasTextAttrs = el.hasAttribute('data-ar') || el.hasAttribute('data-en');
    const type = el.getAttribute('data-cms-poster')
      ? 'poster'
      : el.tagName === 'IMG'
        ? 'image'
        : el.tagName === 'SOURCE' || el.tagName === 'VIDEO'
          ? 'video'
          : hasTextAttrs || !['IMG', 'SOURCE', 'VIDEO'].includes(el.tagName)
            ? 'text'
            : 'text';
    const current =
      type === 'image' || type === 'video' || type === 'poster'
        ? el.getAttribute(type === 'poster' ? 'poster' : 'src')
        : el.getAttribute('data-ar') || el.textContent || '';
    window.parent.postMessage(
      {
        type: 'cms-select',
        key,
        elementType: type,
        tag: el.tagName,
        current,
        textAr: el.getAttribute('data-ar') || '',
        textEn: el.getAttribute('data-en') || '',
      },
      '*',
    );
  }

  function bind(el) {
    el.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectEl(el);
      },
      true,
    );
  }

  document.querySelectorAll('[data-cms], [data-cms-poster]').forEach(bind);

  const tree = [...document.querySelectorAll('[data-cms], [data-cms-poster]')].map((el) => ({
    key: el.getAttribute('data-cms') || el.getAttribute('data-cms-poster'),
    tag: el.tagName,
    type: el.getAttribute('data-cms-poster')
      ? 'poster'
      : el.tagName === 'IMG'
        ? 'image'
        : el.tagName === 'SOURCE' || el.tagName === 'VIDEO'
          ? 'video'
          : 'text',
  }));
  window.parent.postMessage({ type: 'cms-tree', tree }, '*');

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'cms-focus' && data.key) {
      const el =
        document.querySelector(`[data-cms="${data.key}"]`) ||
        document.querySelector(`[data-cms-poster="${data.key}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        selectEl(el);
      }
    }
    if (data.type === 'cms-apply' && data.key) {
      const el =
        document.querySelector(`[data-cms="${data.key}"]`) ||
        document.querySelector(`[data-cms-poster="${data.key}"]`);
      if (!el) return;
      if (data.elementType === 'image' && data.value) el.setAttribute('src', data.value);
      if (data.elementType === 'video' && data.value) {
        el.setAttribute('src', data.value);
        const video = el.closest('video') || el;
        if (video && video.tagName === 'VIDEO') {
          try {
            video.load();
          } catch (_) {}
        }
      }
      if (data.elementType === 'poster' && data.value) el.setAttribute('poster', data.value);
      if (data.elementType === 'text') {
        if (data.textAr != null) el.setAttribute('data-ar', data.textAr);
        if (data.textEn != null) el.setAttribute('data-en', data.textEn);
        const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
        el.textContent = lang === 'en' ? data.textEn || data.textAr : data.textAr || data.textEn;
      }
      selectEl(el);
    }
    if (data.type === 'cms-set-lang') {
      const btn = document.querySelector('.language');
      const want = data.lang;
      const cur = document.documentElement.lang;
      if (btn && want && want !== cur) btn.click();
    }
  });
})();
