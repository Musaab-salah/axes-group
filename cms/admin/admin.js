const app = document.getElementById('app');
const PAGE_URLS = {
  home: '/',
  about: '/about',
  services: '/services',
  projects: '/projects',
  quality: '/quality',
  contact: '/contact',
  sectors: '/sectors',
};

const state = {
  user: null,
  view: 'dashboard',
  dashboard: null,
  pages: [],
  media: [],
  editSlug: null,
  pageData: null,
  tree: [],
  selected: null,
  device: 'desktop',
  lang: 'ar',
  toast: '',
  sectors: [],
  sectorDetail: null,
  sectorForm: null,
  sectorOptions: { services: [], projects: [] },
  sectorMedia: [],
  mediaLimits: { imageMb: 12, videoMb: 200 },
  smLibraryMode: null, // null | 'attach' | 'replace:'+id | 'poster:'+id
  navDraft: null,
  navCatalog: null,
  pageSettings: null,
  works: [],
  workDetail: null,
  workForm: null,
  servicesList: [],
  serviceDetail: null,
  serviceForm: null,
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg) {
  state.toast = msg;
  render();
  setTimeout(() => {
    state.toast = '';
    render();
  }, 2200);
}

function loginView(error = '') {
  return `<div class="login-wrap"><form class="login-card" id="login-form">
    <h1>AXES Admin</h1><p>محرر الموقع المرئي</p>
    <label>البريد<input name="email" type="email" required value="admin@axessud.com"></label>
    <label>كلمة المرور<input name="password" type="password" required></label>
    <button class="btn btn-gold" type="submit">دخول</button>
    ${error ? `<div class="error">${error}</div>` : ''}
  </form></div>`;
}

function shell(content) {
  const nav = [
    ['dashboard', 'لوحة التحكم'],
    ['pages', 'الصفحات'],
    ['sectors', 'قطاعات الأعمال'],
    ['works', 'الأعمال المختارة'],
    ['services-cms', 'الخدمات'],
    ['media', 'الوسائط'],
  ];
  return `<div class="shell">
    <aside class="sidebar">
      <div class="brand">AXES <span>CMS</span></div>
      <nav class="nav">${nav.map(([id, label]) => `<button data-nav="${id}" class="${state.view === id || (id === 'works' && state.view === 'work-edit') || (id === 'services-cms' && state.view === 'service-edit') ? 'active' : ''}">${label}</button>`).join('')}</nav>
      <div class="muted" style="margin-top:20px">${state.user?.name || ''}<br>${state.user?.role || ''}</div>
      <button class="btn btn-ghost" id="logout" style="margin-top:12px;width:100%">خروج</button>
    </aside>
    <main class="main">${content}</main>
  </div>${state.toast ? `<div class="toast">${state.toast}</div>` : ''}`;
}

function dashboardView() {
  const s = state.dashboard?.stats || {};
  return shell(`
    <div class="topbar"><div><h2>لوحة التحكم</h2><div class="muted">إدارة محتوى اكسس قروب</div></div>
    <div class="actions"><button class="btn btn-gold" data-nav="sectors">قطاعات الأعمال</button><button class="btn btn-ghost" data-nav="pages">الصفحات</button><a class="btn btn-ghost" href="/" target="_blank">الموقع</a></div></div>
    <div class="grid">
      <div class="card"><div class="muted">قطاعات منشورة</div><b>${s.publishedSectors ?? 0}</b></div>
      <div class="card"><div class="muted">مسودات قطاعات</div><b>${s.draftSectors ?? 0}</b></div>
      <div class="card"><div class="muted">صفحات منشورة</div><b>${s.publishedPages ?? 0}</b></div>
      <div class="card"><div class="muted">صور</div><b>${s.images ?? 0}</b></div>
    </div>`);
}

function pagesView() {
  return shell(window.AxesNav.pagesView(state) + (state.pageSettings ? window.AxesNav.pageSettingsModal(state.pageSettings) : ''));
}

function navEditorView() {
  return shell(window.AxesNav.navEditorView(state));
}

function mediaSrc(path = '') {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('/')) return path;
  return '/' + path.replace(/^\.\//, '');
}

function mediaThumb(path, kind, name) {
  const src = mediaSrc(path);
  if (kind === 'video') {
    return `<div class="thumb-visual"><video src="${src}" muted preload="metadata"></video><span>${escapeHtml(name || '')}</span></div>`;
  }
  return `<div class="thumb-visual"><img src="${src}" alt="${escapeHtml(name || '')}" loading="lazy"><span>${escapeHtml(name || '')}</span></div>`;
}

function mediaView() {
  return shell(`
    <div class="topbar"><div><h2>مكتبة الوسائط</h2><div class="muted">معاينة بصرية لكل الصور والفيديوهات</div></div></div>
    <form class="card" id="upload-form" style="margin-bottom:14px">
      <label>رفع ملف<input type="file" name="file" required accept="image/*,video/mp4,video/webm"></label>
      <button class="btn btn-gold" type="submit">رفع</button>
    </form>
    <div class="library-grid">
      ${state.media
        .map(
          (i) => `<article class="library-card">
            ${mediaThumb(i.path, i.kind, i.originalName)}
            <div class="library-meta">
              <strong title="${escapeHtml(i.originalName)}">${escapeHtml(i.originalName)}</strong>
              <div class="muted">${i.kind}${i.size ? ` · ${(i.size / 1024).toFixed(0)} KB` : ''}</div>
            </div>
          </article>`,
        )
        .join('') || '<div class="muted">لا توجد ملفات</div>'}
    </div>`);
}

function editorView() {
  const sel = state.selected;
  const block = state.pageData?.blocks?.find((b) => b.key === sel?.key);
  const frameSrc = `${PAGE_URLS[state.editSlug] || '/'}?cmsEdit=1&cmsPreview=1`;
  return `<div class="editor-shell">
    <div class="editor-toolbar">
      <button class="btn btn-ghost" data-nav="pages">← الصفحات</button>
      <strong>${state.pageData?.titleAr || state.editSlug}</strong>
      <span class="muted">${state.editSlug}</span>
      <div style="flex:1"></div>
      <button class="btn btn-ghost" data-device="desktop">Desktop</button>
      <button class="btn btn-ghost" data-device="tablet">Tablet</button>
      <button class="btn btn-ghost" data-device="mobile">Mobile</button>
      <button class="btn btn-ghost" data-lang="ar">عربي</button>
      <button class="btn btn-ghost" data-lang="en">EN</button>
      <button class="btn btn-ghost" id="save-draft">حفظ مسودة</button>
      <a class="btn btn-ghost" href="${PAGE_URLS[state.editSlug]}?cmsPreview=1" target="_blank">معاينة</a>
      <button class="btn btn-gold" id="publish-page">نشر</button>
    </div>
    <div class="editor-body">
      <aside class="panel">
        <h3>هيكل الصفحة</h3>
        ${state.tree
          .map(
            (t) =>
              `<button class="tree-item ${sel?.key === t.key ? 'active' : ''}" data-focus="${t.key}">${t.type} · ${t.key}</button>`,
          )
          .join('') || '<div class="muted">انتظر تحميل الصفحة...</div>'}
      </aside>
      <div class="canvas-wrap device-${state.device}">
        <div class="canvas-bar muted">انقر أي صورة / فيديو / نص عليه إطار ذهبي للتعديل</div>
        <iframe class="canvas-frame" id="editor-frame" src="${frameSrc}"></iframe>
      </div>
      <aside class="panel right">
        <h3>خصائص العنصر</h3>
        ${
          !sel
            ? `<div class="muted" style="margin-bottom:12px">انقر نصًا أو صورة في الصفحة، أو اختر من قائمة النصوص:</div>
               <div class="text-list">${(state.pageData?.blocks || [])
                 .filter((b) => b.type === 'text')
                 .map(
                   (b) =>
                     `<button type="button" class="tree-item" data-edit-text="${escapeHtml(b.key)}">${escapeHtml(
                       (b.draftAr || b.valueAr || b.key).slice(0, 60),
                     )}</button>`,
                 )
                 .join('') || '<div class="muted">لا نصوص مسجّلة</div>'}</div>`
            : propsPanel(sel, block)
        }
      </aside>
    </div>
  </div>${state.toast ? `<div class="toast">${state.toast}</div>` : ''}`;
}

function propsPanel(sel, block) {
  // Prefer live selection type; never treat bilingual text as media
  let type = sel.elementType || block?.type || 'text';
  if (sel.textAr || sel.textEn || (block && block.type === 'text')) {
    if (type !== 'image' && type !== 'video' && type !== 'poster') type = 'text';
  }
  if (sel.tag && !['IMG', 'SOURCE', 'VIDEO'].includes(sel.tag) && type !== 'poster') {
    type = 'text';
  }
  if (type === 'image' || type === 'video' || type === 'poster') {
    const current = block?.draftAr ?? block?.valueAr ?? sel.current ?? '';
    const src = mediaSrc(current);
    const preview =
      type === 'video'
        ? `<video class="prop-preview" src="${src}" controls muted></video>`
        : `<img class="prop-preview" src="${src}" alt="preview">`;
    return `
      <div class="muted" style="margin-bottom:8px">${escapeHtml(sel.key)}</div>
      <div class="prop-preview-wrap">${src ? preview : '<div class="muted">لا توجد صورة محددة</div>'}
        <div class="prop-file-meta">${escapeHtml((current || '').split('/').pop() || '')}</div>
      </div>
      <label class="btn btn-gold replace-btn">
        استبدال الصورة / الفيديو
        <input type="file" id="replace-file" accept="${type === 'video' ? 'video/*' : 'image/*'}" hidden>
      </label>
      <input type="hidden" id="media-path" value="${escapeHtml(current)}">
      <div class="actions" style="margin:10px 0 12px">
        <button class="btn btn-danger" id="clear-media">إزالة</button>
      </div>
      <h3 style="margin-top:8px">اختر من المكتبة</h3>
      <div class="media-grid" id="media-picker">
        ${state.media
          .filter((m) => (type === 'video' ? m.kind === 'video' : m.kind !== 'video'))
          .slice(0, 36)
          .map(
            (m) =>
              `<button type="button" data-pick="${escapeHtml(m.path)}" title="${escapeHtml(m.originalName)}">
                ${
                  m.kind === 'video'
                    ? `<video src="${mediaSrc(m.path)}" muted preload="metadata"></video>`
                    : `<img src="${mediaSrc(m.path)}" alt="" loading="lazy">`
                }
              </button>`,
          )
          .join('') || '<div class="muted">لا توجد وسائط</div>'}
      </div>`;
  }
  return `
    <div class="muted" style="margin-bottom:8px">${escapeHtml(sel.key)}</div>
    <label>العربية<textarea id="text-ar">${escapeHtml(block?.draftAr ?? block?.valueAr ?? sel.textAr ?? '')}</textarea></label>
    <label>English<textarea id="text-en">${escapeHtml(block?.draftEn ?? block?.valueEn ?? sel.textEn ?? '')}</textarea></label>
    <button class="btn btn-gold" id="apply-text">تطبيق النص</button>`;
}

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function showLogin(error = '') {
  app.innerHTML = loginView(error);
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
      });
      state.user = data.user;
      state.view = 'dashboard';
      await loadDashboard();
      render();
    } catch (err) {
      showLogin(err.message);
    }
  });
}

async function render() {
  if (!state.user) return showLogin();
  if (state.view === 'editor') {
    app.innerHTML = editorView();
    bindEditor();
    return;
  }
  if (state.view === 'dashboard') app.innerHTML = dashboardView();
  else if (state.view === 'pages') app.innerHTML = pagesView();
  else if (state.view === 'nav-editor') app.innerHTML = navEditorView();
  else if (state.view === 'media') app.innerHTML = mediaView();
  else if (state.view === 'sectors') app.innerHTML = shell(window.AxesSectors.listView(state));
  else if (state.view === 'sector-edit') app.innerHTML = shell(window.AxesSectors.formView(state));
  else if (state.view === 'works') app.innerHTML = shell(window.AxesWorks.listView(state));
  else if (state.view === 'work-edit') app.innerHTML = shell(window.AxesWorks.formView(state));
  else if (state.view === 'services-cms') app.innerHTML = shell(window.AxesWorks.servicesListView(state));
  else if (state.view === 'service-edit') app.innerHTML = shell(window.AxesWorks.serviceFormView(state));
  bindShell();
  if (state.view === 'sectors' || state.view === 'sector-edit') bindSectors();
  if (state.view === 'works' || state.view === 'work-edit') bindWorks();
  if (state.view === 'services-cms' || state.view === 'service-edit') bindServicesCms();
  if (state.view === 'pages' || state.view === 'nav-editor') bindPagesNav();
}

function bindShell() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-nav');
      state.view = id;
      if (id === 'dashboard') await loadDashboard();
      if (id === 'pages') {
        await loadPages();
        await loadNavDraft();
      }
      if (id === 'nav-editor') {
        await loadNavDraft();
        await loadNavCatalog();
      }
      if (id === 'media') await loadMedia();
      if (id === 'sectors') await loadSectors();
      if (id === 'works') {
        await loadSectors();
        await loadWorks();
      }
      if (id === 'services-cms') {
        await loadSectors();
        await loadServicesList();
      }
      render();
    });
  });
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.editSlug = btn.getAttribute('data-edit');
      state.selected = null;
      state.tree = [];
      await loadPage(state.editSlug);
      await loadMedia();
      state.view = 'editor';
      render();
    });
  });
  // allow opening sector CMS pages in visual editor
  document.querySelectorAll('[data-edit-sector-page]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.editSlug = btn.getAttribute('data-edit-sector-page');
      PAGE_URLS[state.editSlug] = `/sectors/${state.editSlug.replace(/^sector-/, '')}`;
      state.selected = null;
      state.tree = [];
      await loadPage(state.editSlug);
      await loadMedia();
      state.view = 'editor';
      render();
    });
  });
  document.getElementById('logout')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    render();
  });
  document.getElementById('upload-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'فشل الرفع');
    toast('تم الرفع');
    await loadMedia();
    render();
  });
}

function bindEditor() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.view = btn.getAttribute('data-nav');
      if (state.view === 'pages') await loadPages();
      render();
    });
  });
  document.querySelectorAll('[data-device]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.device = btn.getAttribute('data-device');
      render();
    });
  });
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lang = btn.getAttribute('data-lang');
      const frame = document.getElementById('editor-frame');
      frame?.contentWindow?.postMessage({ type: 'cms-set-lang', lang: state.lang }, '*');
    });
  });
  document.querySelectorAll('[data-focus]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-focus');
      document.getElementById('editor-frame')?.contentWindow?.postMessage({ type: 'cms-focus', key }, '*');
    });
  });
  document.getElementById('save-draft')?.addEventListener('click', () => saveSelectedDraft(false));
  document.getElementById('publish-page')?.addEventListener('click', publishPage);
  document.getElementById('apply-text')?.addEventListener('click', applyText);
  document.getElementById('apply-media-path')?.addEventListener('click', () => applyMediaPath());
  document.getElementById('clear-media')?.addEventListener('click', () => applyMediaPath(''));
  document.getElementById('replace-file')?.addEventListener('change', replaceUpload);
  document.querySelectorAll('[data-pick]').forEach((btn) => {
    btn.addEventListener('click', () => applyMediaPath(btn.getAttribute('data-pick')));
  });
  document.querySelectorAll('[data-edit-text]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-edit-text');
      const block = state.pageData?.blocks?.find((b) => b.key === key);
      state.selected = {
        key,
        elementType: 'text',
        tag: 'TEXT',
        textAr: block?.draftAr ?? block?.valueAr ?? '',
        textEn: block?.draftEn ?? block?.valueEn ?? '',
      };
      document.getElementById('editor-frame')?.contentWindow?.postMessage({ type: 'cms-focus', key }, '*');
      render();
    });
  });

  window.removeEventListener('message', onFrameMessage);
  window.addEventListener('message', onFrameMessage);
}

function onFrameMessage(event) {
  const data = event.data || {};
  if (data.type === 'cms-tree') {
    state.tree = data.tree || [];
    const panel = document.querySelector('.panel');
    if (panel && state.view === 'editor') {
      const sel = state.selected;
      panel.innerHTML = `<h3>هيكل الصفحة</h3>${
        state.tree
          .map(
            (t) =>
              `<button class="tree-item ${sel?.key === t.key ? 'active' : ''}" data-focus="${t.key}">${t.type} · ${t.key}</button>`,
          )
          .join('') || '<div class="muted">لا عناصر</div>'
      }`;
      panel.querySelectorAll('[data-focus]').forEach((btn) => {
        btn.addEventListener('click', () => {
          document
            .getElementById('editor-frame')
            ?.contentWindow?.postMessage({ type: 'cms-focus', key: btn.getAttribute('data-focus') }, '*');
        });
      });
    }
    return;
  }
  if (data.type === 'cms-select') {
    state.selected = data;
    const right = document.querySelector('.panel.right');
    if (right && state.view === 'editor') {
      const block = state.pageData?.blocks?.find((b) => b.key === data.key);
      right.innerHTML = `<h3>خصائص العنصر</h3>${propsPanel(data, block)}`;
      document.getElementById('apply-text')?.addEventListener('click', applyText);
      document.getElementById('apply-media-path')?.addEventListener('click', () => applyMediaPath());
      document.getElementById('clear-media')?.addEventListener('click', () => applyMediaPath(''));
      document.getElementById('replace-file')?.addEventListener('change', replaceUpload);
      document.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', () => applyMediaPath(btn.getAttribute('data-pick')));
      });
    }
  }
}

async function applyText() {
  if (!state.selected) return;
  try {
    const textAr = document.getElementById('text-ar')?.value || '';
    const textEn = document.getElementById('text-en')?.value || '';
    await updateBlock(state.selected.key, { draftAr: textAr, draftEn: textEn, type: 'text' });
    state.selected.textAr = textAr;
    state.selected.textEn = textEn;
    document.getElementById('editor-frame')?.contentWindow?.postMessage(
      { type: 'cms-apply', key: state.selected.key, elementType: 'text', textAr, textEn },
      '*',
    );
    toast('تم تحديث النص (مسودة) — اضغط نشر لإظهاره للزوار');
  } catch (err) {
    toast(err.message || 'فشل حفظ النص');
  }
}

async function applyMediaPath(forced) {
  if (!state.selected) return;
  const value = forced !== undefined ? forced : document.getElementById('media-path')?.value || '';
  const type = state.selected.elementType || 'image';
  await updateBlock(state.selected.key, { draftAr: value, draftEn: value, type });
  document.getElementById('editor-frame')?.contentWindow?.postMessage(
    { type: 'cms-apply', key: state.selected.key, elementType: type, value },
    '*',
  );
  state.selected.current = value;
  toast(value ? 'تم استبدال الوسائط (مسودة)' : 'تم تفريغ الوسائط (مسودة)');
}

async function replaceUpload(e) {
  const file = e.target.files?.[0];
  if (!file || !state.selected) return;
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd });
  const data = await res.json();
  if (!res.ok) return toast(data.error || 'فشل الرفع');
  await loadMedia();
  await applyMediaPath(data.item.path);
}

async function updateBlock(key, payload) {
  let block = state.pageData.blocks.find((b) => b.key === key);
  if (!block) {
    // create via save on existing publish page by fetching after manual create endpoint - use PUT after ensuring
    // For now upsert by publishing a synthetic create API - add create-block route quickly via draft on known page
    const created = await api(`/api/cms/pages/${state.editSlug}/blocks`, {
      method: 'POST',
      body: JSON.stringify({ key, ...payload }),
    });
    block = created.block;
    state.pageData.blocks.push(block);
  }
  const updated = await api(`/api/cms/blocks/${block.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const idx = state.pageData.blocks.findIndex((b) => b.id === updated.block.id);
  if (idx >= 0) state.pageData.blocks[idx] = updated.block;
}

async function saveSelectedDraft() {
  toast('المسودات تُحفظ تلقائيًا عند التطبيق');
}

async function publishPage() {
  await api(`/api/cms/pages/${state.editSlug}/publish`, { method: 'POST' });
  toast('تم النشر على الموقع العام');
  await loadPage(state.editSlug);
}

async function loadDashboard() {
  state.dashboard = await api('/api/cms/dashboard');
}
async function loadPages() {
  const data = await api('/api/cms/pages');
  state.pages = (data.pages || []).map((p) => ({
    ...p,
    href: PAGE_URLS[p.slug] || (p.slug.startsWith('sector-') ? `/sectors/${p.slug.slice(7)}` : p.slug === 'sectors' ? '/sectors' : `/${p.slug}`),
  }));
}
async function loadNavDraft() {
  state.navDraft = await api('/api/cms/nav?layer=draft');
}
async function loadNavCatalog() {
  state.navCatalog = await api('/api/cms/nav/catalog');
}

function bindPagesNav() {
  document.getElementById('nav-publish')?.addEventListener('click', async () => {
    try {
      await api('/api/cms/nav/publish', { method: 'POST' });
      toast('تم نشر القائمة على الموقع');
      await loadNavDraft();
      render();
    } catch (err) {
      toast(err.message);
    }
  });

  document.querySelectorAll('[data-page-flag]').forEach((el) => {
    el.addEventListener('change', async () => {
      const slug = el.getAttribute('data-page-slug');
      const flag = el.getAttribute('data-page-flag');
      try {
        await api(`/api/cms/pages/${slug}`, {
          method: 'PUT',
          body: JSON.stringify({ [flag]: el.checked }),
        });
        // ensure nav draft item exists / updated
        await syncPageToNav(slug);
        await loadPages();
        await loadNavDraft();
        render();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  document.querySelectorAll('[data-page-publish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/pages/${btn.getAttribute('data-page-publish')}/publish`, { method: 'POST' });
      toast('تم نشر الصفحة');
      await loadPages();
      render();
    });
  });

  document.querySelectorAll('[data-page-unpublish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.getAttribute('data-page-unpublish');
      try {
        await api(`/api/cms/pages/${slug}/unpublish`, { method: 'POST' });
        toast('تم إلغاء النشر');
      } catch (err) {
        if (String(err.message).includes('روابط واردة') || String(err.message).includes('confirm')) {
          const ok = confirm('تحذير: توجد روابط واردة إلى هذه الصفحة. هل تريد إلغاء النشر؟');
          if (!ok) return;
          await api(`/api/cms/pages/${slug}/unpublish?confirm=1`, { method: 'POST' });
          toast('تم إلغاء النشر مع التحذير');
        } else {
          toast(err.message);
          return;
        }
      }
      await loadPages();
      await loadNavDraft();
      render();
    });
  });

  document.querySelectorAll('[data-page-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.getAttribute('data-page-edit');
      const page = state.pages.find((p) => p.slug === slug);
      state.pageSettings = page;
      render();
    });
  });

  document.getElementById('page-settings-cancel')?.addEventListener('click', () => {
    state.pageSettings = null;
    render();
  });

  document.getElementById('page-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const slug = state.pageSettings.slug;
    const payload = {
      navLabelAr: form.navLabelAr.value,
      navLabelEn: form.navLabelEn.value,
      titleAr: form.titleAr.value,
      titleEn: form.titleEn.value,
      showInHeader: form.showInHeader.checked,
      showInFooter: form.showInFooter.checked,
    };
    if (!form.slug.disabled && form.slug.value !== slug) payload.slug = form.slug.value;
    try {
      await api(`/api/cms/pages/${slug}`, { method: 'PUT', body: JSON.stringify(payload) });
      await syncPageToNav(payload.slug || slug);
      state.pageSettings = null;
      toast('تم حفظ إعدادات الصفحة');
      await loadPages();
      await loadNavDraft();
      render();
    } catch (err) {
      toast(err.message);
    }
  });

  // page list reorder
  const list = document.getElementById('pages-list');
  let dragId = null;
  list?.querySelectorAll('.page-row').forEach((row) => {
    row.addEventListener('dragstart', () => {
      dragId = row.getAttribute('data-page-id');
    });
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      const target = row.getAttribute('data-page-id');
      if (!dragId || dragId === target) return;
      const ids = [...list.querySelectorAll('.page-row')].map((r) => r.getAttribute('data-page-id'));
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(target);
      ids.splice(from, 1);
      ids.splice(to, 0, dragId);
      await api('/api/cms/pages/reorder', { method: 'POST', body: JSON.stringify({ ids }) });
      await loadPages();
      render();
    });
  });

  // nav editor bindings
  document.getElementById('add-nav-page')?.addEventListener('click', async () => {
    const id = document.getElementById('add-page')?.value;
    const page = state.navCatalog?.pages?.find((p) => p.id === id);
    if (!page) return toast('اختر صفحة');
    await api('/api/cms/nav/items', {
      method: 'POST',
      body: JSON.stringify({
        targetType: 'page',
        pageId: page.id,
        labelAr: page.navLabelAr || page.titleAr,
        labelEn: page.navLabelEn || page.titleEn,
        showInHeader: true,
        showInFooter: !!page.showInFooter,
      }),
    });
    await loadNavDraft();
    render();
  });
  document.getElementById('add-nav-sector')?.addEventListener('click', async () => {
    const id = document.getElementById('add-sector')?.value;
    const sector = state.navCatalog?.sectors?.find((s) => s.id === id);
    if (!sector) return toast('اختر قطاعًا');
    await api('/api/cms/nav/items', {
      method: 'POST',
      body: JSON.stringify({
        targetType: 'sector',
        sectorId: sector.id,
        labelAr: sector.nameAr,
        labelEn: sector.nameEn,
        showInHeader: true,
      }),
    });
    await loadNavDraft();
    render();
  });
  document.getElementById('add-nav-service')?.addEventListener('click', async () => {
    const id = document.getElementById('add-service')?.value;
    const service = state.navCatalog?.services?.find((s) => s.id === id);
    if (!service) return toast('اختر خدمة');
    await api('/api/cms/nav/items', {
      method: 'POST',
      body: JSON.stringify({
        targetType: 'service',
        serviceId: service.id,
        labelAr: service.nameAr,
        labelEn: service.nameEn,
        showInHeader: true,
        parentId: state.navDraft?.items?.find((i) => i.href === '/services' && !i.parentId)?.id || null,
      }),
    });
    await loadNavDraft();
    render();
  });

  document.querySelectorAll('[data-nav-flag]').forEach((el) => {
    el.addEventListener('change', async () => {
      await api(`/api/cms/nav/items/${el.getAttribute('data-nav-id')}`, {
        method: 'PUT',
        body: JSON.stringify({ [el.getAttribute('data-nav-flag')]: el.checked }),
      });
      await loadNavDraft();
      render();
    });
  });
  document.querySelectorAll('[data-nav-parent]').forEach((el) => {
    el.addEventListener('change', async () => {
      await api(`/api/cms/nav/items/${el.getAttribute('data-nav-parent')}`, {
        method: 'PUT',
        body: JSON.stringify({ parentId: el.value || null }),
      });
      await loadNavDraft();
      render();
    });
  });
  document.querySelectorAll('[data-nav-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/nav/items/${btn.getAttribute('data-nav-del')}`, { method: 'DELETE' });
      await loadNavDraft();
      render();
    });
  });

  const navList = document.getElementById('nav-items-list');
  let navDrag = null;
  navList?.querySelectorAll('.nav-row').forEach((row) => {
    row.addEventListener('dragstart', () => {
      navDrag = row.getAttribute('data-nav-id');
    });
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      const target = row.getAttribute('data-nav-id');
      if (!navDrag || navDrag === target) return;
      const ids = [...navList.querySelectorAll('.nav-row')].map((r) => r.getAttribute('data-nav-id'));
      const from = ids.indexOf(navDrag);
      const to = ids.indexOf(target);
      ids.splice(from, 1);
      ids.splice(to, 0, navDrag);
      await api('/api/cms/nav/items/reorder', {
        method: 'PUT',
        body: JSON.stringify({ items: ids.map((id, sortOrder) => ({ id, sortOrder })) }),
      });
      await loadNavDraft();
      render();
    });
  });
}

async function syncPageToNav(slug) {
  await loadNavCatalog();
  await loadNavDraft();
  const page = (state.navCatalog?.pages || []).find((p) => p.slug === slug) || state.pages.find((p) => p.slug === slug);
  if (!page) return;
  const existing = state.navDraft?.items?.find((i) => i.pageId === page.id && i.layer === 'draft');
  if (page.showInHeader || page.showInFooter) {
    if (existing) {
      await api(`/api/cms/nav/items/${existing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          labelAr: page.navLabelAr || page.titleAr,
          labelEn: page.navLabelEn || page.titleEn,
          showInHeader: !!page.showInHeader,
          showInFooter: !!page.showInFooter,
        }),
      });
    } else {
      await api('/api/cms/nav/items', {
        method: 'POST',
        body: JSON.stringify({
          targetType: 'page',
          pageId: page.id,
          labelAr: page.navLabelAr || page.titleAr,
          labelEn: page.navLabelEn || page.titleEn,
          showInHeader: !!page.showInHeader,
          showInFooter: !!page.showInFooter,
        }),
      });
    }
  } else if (existing) {
    await api(`/api/cms/nav/items/${existing.id}`, {
      method: 'PUT',
      body: JSON.stringify({ showInHeader: false, showInFooter: false }),
    });
  }
}

async function loadPage(slug) {
  const data = await api(`/api/cms/pages/${slug}`);
  state.pageData = data.page;
  if (slug.startsWith('sector-')) {
    PAGE_URLS[slug] = `/sectors/${slug.replace(/^sector-/, '')}`;
  }
}
async function loadMedia() {
  const data = await api('/api/media');
  state.media = data.items;
}

async function loadSectors() {
  const data = await api('/api/cms/sectors');
  state.sectors = data.sectors;
}

async function loadWorks() {
  const data = await api('/api/cms/projects');
  state.works = data.projects || [];
}

async function loadServicesList() {
  const data = await api('/api/cms/services');
  state.servicesList = data.services || [];
}

function readWorkForm() {
  const form = document.getElementById('work-form');
  if (!form) return null;
  const fd = new FormData(form);
  return {
    nameAr: String(fd.get('nameAr') || '').trim(),
    nameEn: String(fd.get('nameEn') || '').trim(),
    slug: String(fd.get('slug') || '').trim() || undefined,
    sectorId: String(fd.get('sectorId') || '') || null,
    categoryAr: String(fd.get('categoryAr') || ''),
    categoryEn: String(fd.get('categoryEn') || ''),
    locationAr: String(fd.get('locationAr') || ''),
    locationEn: String(fd.get('locationEn') || ''),
    summaryAr: String(fd.get('summaryAr') || ''),
    summaryEn: String(fd.get('summaryEn') || ''),
    imagePath: String(fd.get('imagePath') || '') || null,
    sortOrder: Number(fd.get('sortOrder') || 0),
    status: String(fd.get('status') || 'PUBLISHED'),
    featured: form.querySelector('[name=featured]')?.checked || false,
  };
}

function bindWorks() {
  document.querySelector('[data-work-new]')?.addEventListener('click', () => {
    state.workDetail = null;
    state.workForm = window.AxesWorks.emptyForm();
    state.view = 'work-edit';
    render();
  });
  document.querySelectorAll('[data-work-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-work-edit');
      const data = await api(`/api/cms/projects/${id}`);
      state.workDetail = data.project;
      state.workForm = {
        ...data.project,
        imagePath: data.project.imagePath || '',
        sectorId: data.project.sectorId || '',
      };
      state.view = 'work-edit';
      render();
    });
  });
  document.querySelectorAll('[data-work-publish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/projects/${btn.getAttribute('data-work-publish')}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'PUBLISHED' }),
      });
      await loadWorks();
      toast('تم النشر');
      render();
    });
  });
  document.querySelectorAll('[data-work-unpublish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/projects/${btn.getAttribute('data-work-unpublish')}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'DRAFT' }),
      });
      await loadWorks();
      toast('أُلغي النشر');
      render();
    });
  });
  document.getElementById('work-save')?.addEventListener('click', async () => {
    const payload = readWorkForm();
    if (!payload?.nameAr || !payload?.nameEn || !payload.sectorId) {
      toast('أكمل الاسم والقطاع');
      return;
    }
    try {
      if (state.workDetail?.id) {
        await api(`/api/cms/projects/${state.workDetail.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/cms/projects', { method: 'POST', body: JSON.stringify(payload) });
      }
      await loadWorks();
      state.view = 'works';
      toast('تم الحفظ');
      render();
    } catch (err) {
      toast(err.message || 'فشل الحفظ');
    }
  });
}

function readServiceForm() {
  const form = document.getElementById('service-form');
  if (!form) return null;
  const fd = new FormData(form);
  return {
    nameAr: String(fd.get('nameAr') || '').trim(),
    nameEn: String(fd.get('nameEn') || '').trim(),
    slug: String(fd.get('slug') || '').trim() || undefined,
    sectorId: String(fd.get('sectorId') || '') || null,
    summaryAr: String(fd.get('summaryAr') || ''),
    summaryEn: String(fd.get('summaryEn') || ''),
    imagePath: String(fd.get('imagePath') || '') || null,
    sortOrder: Number(fd.get('sortOrder') || 0),
    status: String(fd.get('status') || 'PUBLISHED'),
  };
}

function bindServicesCms() {
  document.querySelector('[data-service-new]')?.addEventListener('click', () => {
    state.serviceDetail = null;
    state.serviceForm = {
      slug: '',
      nameAr: '',
      nameEn: '',
      summaryAr: '',
      summaryEn: '',
      status: 'PUBLISHED',
      sortOrder: 0,
      imagePath: '',
      sectorId: '',
    };
    state.view = 'service-edit';
    render();
  });
  document.querySelectorAll('[data-service-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-service-edit');
      const data = await api(`/api/cms/services/${id}`);
      state.serviceDetail = data.service;
      state.serviceForm = {
        ...data.service,
        imagePath: data.service.imagePath || '',
        sectorId: data.service.sectorId || '',
      };
      state.view = 'service-edit';
      render();
    });
  });
  document.getElementById('service-save')?.addEventListener('click', async () => {
    const payload = readServiceForm();
    if (!payload?.nameAr || !payload?.nameEn || !payload.sectorId) {
      toast('أكمل الاسم والقطاع');
      return;
    }
    try {
      if (state.serviceDetail?.id) {
        await api(`/api/cms/services/${state.serviceDetail.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/cms/services', { method: 'POST', body: JSON.stringify(payload) });
      }
      await loadServicesList();
      state.view = 'services-cms';
      toast('تم الحفظ');
      render();
    } catch (err) {
      toast(err.message || 'فشل الحفظ');
    }
  });
}

async function loadSectorOptions() {
  state.sectorOptions = await api('/api/cms/sectors/meta/options');
}

async function loadSectorMediaDraft(sectorId) {
  if (!sectorId) {
    state.sectorMedia = [];
    return;
  }
  const data = await api(`/api/cms/sectors/${sectorId}/media?layer=draft`);
  state.sectorMedia = data.items || [];
}

async function loadMediaLimits() {
  try {
    // limits endpoint is before auth in router... actually it's before requireAuth - but we call with credentials
    const res = await fetch('/api/media/limits', { credentials: 'include' });
    if (res.ok) state.mediaLimits = await res.json();
  } catch {
    /* defaults */
  }
}

async function openSectorEditor(id) {
  await loadSectorOptions();
  await loadMediaLimits();
  await loadMedia();
  if (!id) {
    state.sectorDetail = null;
    state.sectorForm = window.AxesSectors.emptyForm();
    state.sectorMedia = [];
    state.view = 'sector-edit';
    render();
    return;
  }
  const data = await api(`/api/cms/sectors/${id}`);
  state.sectorDetail = data.sector;
  state.sectorForm = {
    ...window.AxesSectors.emptyForm(),
    ...data.fields,
    slug: data.sector.slug,
    serviceIds: (data.sector.services || []).map((s) => s.id),
    projectIds: (data.sector.projects || []).map((p) => p.id),
  };
  await loadSectorMediaDraft(data.sector.id);
  state.view = 'sector-edit';
  render();
}

function bindSectors() {
  document.getElementById('sector-new')?.addEventListener('click', () => openSectorEditor(null));
  document.getElementById('sector-save-order')?.addEventListener('click', async () => {
    const ids = [...document.querySelectorAll('#sectors-list [data-sector-id]')].map((el) =>
      el.getAttribute('data-sector-id'),
    );
    await api('/api/cms/sectors/reorder', { method: 'POST', body: JSON.stringify({ ids }) });
    toast('تم حفظ الترتيب');
    await loadSectors();
    render();
  });
  document.querySelectorAll('[data-sector-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openSectorEditor(btn.getAttribute('data-sector-edit')));
  });
  document.querySelectorAll('[data-sector-dup]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/sectors/${btn.getAttribute('data-sector-dup')}/duplicate`, { method: 'POST' });
      toast('تم نسخ القطاع');
      await loadSectors();
      render();
    });
  });
  document.querySelectorAll('[data-sector-publish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/cms/sectors/${btn.getAttribute('data-sector-publish')}/publish`, { method: 'POST' });
        toast('تم النشر');
        await loadSectors();
        render();
      } catch (err) {
        toast(err.message);
      }
    });
  });
  document.querySelectorAll('[data-sector-unpublish]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/sectors/${btn.getAttribute('data-sector-unpublish')}/unpublish`, { method: 'POST' });
      toast('تم إلغاء النشر');
      await loadSectors();
      render();
    });
  });
  document.querySelectorAll('[data-sector-archive]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/sectors/${btn.getAttribute('data-sector-archive')}/archive`, { method: 'POST' });
      toast('تمت الأرشفة');
      await loadSectors();
      render();
    });
  });
  document.getElementById('sector-save-draft')?.addEventListener('click', async () => {
    const payload = window.AxesSectors.readForm();
    if (!payload) return;
    try {
      if (state.sectorDetail?.id) {
        const data = await api(`/api/cms/sectors/${state.sectorDetail.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...payload, saveMode: 'draft' }),
        });
        state.sectorDetail = data.sector;
        toast('تم حفظ المسودة');
      } else {
        const data = await api('/api/cms/sectors', { method: 'POST', body: JSON.stringify(payload) });
        state.sectorDetail = data.sector;
        toast('تم إنشاء القطاع كمسودة');
        await openSectorEditor(data.sector.id);
        return;
      }
    } catch (err) {
      toast(err.message);
    }
  });
  document.getElementById('sector-publish')?.addEventListener('click', async () => {
    if (!state.sectorDetail?.id) return;
    try {
      const payload = window.AxesSectors.readForm();
      await api(`/api/cms/sectors/${state.sectorDetail.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, saveMode: 'draft' }),
      });
      await api(`/api/cms/sectors/${state.sectorDetail.id}/publish`, { method: 'POST' });
      toast('تم نشر القطاع');
      await openSectorEditor(state.sectorDetail.id);
    } catch (err) {
      toast(err.message);
    }
  });
  document.querySelectorAll('[data-sector-restore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/sectors/${state.sectorDetail.id}/restore/${btn.getAttribute('data-sector-restore')}`, {
        method: 'POST',
      });
      toast('تمت الاستعادة إلى المسودة');
      await openSectorEditor(state.sectorDetail.id);
    });
  });
  bindSectorMediaManager();
}

function bindSectorMediaManager() {
  const sectorId = state.sectorDetail?.id;
  if (!sectorId || state.view !== 'sector-edit') return;

  const drop = document.getElementById('sm-dropzone');
  const input = document.getElementById('sm-file-input');
  const progress = document.getElementById('sm-upload-progress');
  const errBox = document.getElementById('sm-upload-errors');

  const openPicker = (mode) => {
    state.smLibraryMode = mode || 'attach';
    const picker = document.getElementById('sm-library-picker');
    const grid = document.getElementById('sm-library-grid');
    if (!picker || !grid) return;
    picker.classList.remove('hidden');
    grid.innerHTML = (state.media || [])
      .map((m) => {
        const thumb =
          m.kind === 'video'
            ? `<video src="${mediaSrc(m.path)}" muted preload="metadata"></video>`
            : `<img src="${mediaSrc(m.path)}" alt="" loading="lazy">`;
        return `<button type="button" class="library-card" data-lib-pick="${m.id}" title="${escapeHtml(m.originalName)}">${thumb}<div class="library-meta"><strong>${escapeHtml(
          m.originalName,
        )}</strong><div class="muted">${m.kind}${m.isDraft ? ' · مسودة' : ''}</div></div></button>`;
      })
      .join('');
    grid.querySelectorAll('[data-lib-pick]').forEach((btn) => {
      btn.addEventListener('click', () => onLibraryPick(btn.getAttribute('data-lib-pick')));
    });
  };

  async function onLibraryPick(mediaId) {
    const mode = state.smLibraryMode || 'attach';
    try {
      if (mode === 'attach') {
        const role = document.getElementById('sm-default-role')?.value || 'gallery';
        await api(`/api/cms/sectors/${sectorId}/media`, {
          method: 'POST',
          body: JSON.stringify({ mediaId, role }),
        });
        toast('تمت إضافة الملف إلى مسودة القطاع');
      } else if (mode.startsWith('replace:')) {
        const attachmentId = mode.slice(8);
        await api(`/api/cms/sectors/${sectorId}/media/${attachmentId}`, {
          method: 'PUT',
          body: JSON.stringify({ mediaId }),
        });
        toast('تم استبدال الملف (المكتبة الأصلية محفوظة)');
      } else if (mode.startsWith('poster:')) {
        const attachmentId = mode.slice(7);
        await api(`/api/cms/sectors/${sectorId}/media/${attachmentId}`, {
          method: 'PUT',
          body: JSON.stringify({ posterMediaId: mediaId }),
        });
        toast('تم تعيين صورة غلاف الفيديو');
      }
      state.smLibraryMode = null;
      document.getElementById('sm-library-picker')?.classList.add('hidden');
      await loadSectorMediaDraft(sectorId);
      render();
    } catch (err) {
      toast(err.message);
    }
  }

  async function uploadFiles(fileList, roleOverride) {
    const files = [...fileList];
    if (!files.length) return;
    const role = roleOverride || document.getElementById('sm-default-role')?.value || 'gallery';
    if (errBox) {
      errBox.style.display = 'none';
      errBox.textContent = '';
    }
    if (progress) {
      progress.classList.remove('hidden');
      progress.innerHTML = files.map((f, i) => `<div data-up="${i}"><span>${escapeHtml(f.name)}</span><b>0%</b></div>`).join('');
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append('file', file);
      fd.append('isDraft', '1');
      try {
        const item = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/media');
          xhr.withCredentials = true;
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable || !progress) return;
            const pct = Math.round((e.loaded / e.total) * 100);
            const row = progress.querySelector(`[data-up="${i}"] b`);
            if (row) row.textContent = pct + '%';
          };
          xhr.onload = () => {
            let data = {};
            try {
              data = JSON.parse(xhr.responseText);
            } catch {
              /* */
            }
            if (xhr.status >= 200 && xhr.status < 300) resolve(data.item);
            else reject(new Error(data.error || 'فشل الرفع'));
          };
          xhr.onerror = () => reject(new Error('تعذر الاتصال أثناء الرفع'));
          xhr.send(fd);
        });
        await api(`/api/cms/sectors/${sectorId}/media`, {
          method: 'POST',
          body: JSON.stringify({
            mediaId: item.id,
            role: item.kind === 'video' && role !== 'intro_video' ? 'intro_video' : role === 'intro_video' && item.kind !== 'video' ? 'gallery' : role,
            titleAr: '',
            titleEn: '',
          }),
        });
        if (progress) {
          const row = progress.querySelector(`[data-up="${i}"] b`);
          if (row) row.textContent = 'تم';
        }
      } catch (err) {
        if (progress) {
          const row = progress.querySelector(`[data-up="${i}"] b`);
          if (row) row.textContent = 'فشل';
        }
        if (errBox) {
          errBox.style.display = 'block';
          errBox.textContent += (errBox.textContent ? '\n' : '') + `${file.name}: ${err.message}`;
        }
      }
    }
    await loadMedia();
    await loadSectorMediaDraft(sectorId);
    render();
  }

  drop?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', () => {
    if (input.files?.length) uploadFiles(input.files);
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) => {
    drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((ev) => {
    drop?.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('dragover');
    });
  });
  drop?.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files?.length) uploadFiles(files);
  });

  document.getElementById('sm-pick-library')?.addEventListener('click', () => openPicker('attach'));
  document.getElementById('sm-library-close')?.addEventListener('click', () => {
    document.getElementById('sm-library-picker')?.classList.add('hidden');
    state.smLibraryMode = null;
  });

  document.querySelectorAll('[data-sm-field]').forEach((el) => {
    const save = async () => {
      const id = el.getAttribute('data-sm-id');
      const field = el.getAttribute('data-sm-field');
      const value = el.type === 'checkbox' ? el.checked : el.value;
      try {
        await api(`/api/cms/sectors/${sectorId}/media/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ [field]: value }),
        });
      } catch (err) {
        toast(err.message);
      }
    };
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'blur', save);
  });

  document.querySelectorAll('[data-sm-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(`/api/cms/sectors/${sectorId}/media/${btn.getAttribute('data-sm-remove')}`, { method: 'DELETE' });
      toast('أُزيل من القطاع (الملف ما زال في المكتبة)');
      await loadSectorMediaDraft(sectorId);
      render();
    });
  });
  document.querySelectorAll('[data-sm-replace]').forEach((btn) => {
    btn.addEventListener('click', () => openPicker('replace:' + btn.getAttribute('data-sm-replace')));
  });
  document.querySelectorAll('[data-sm-poster]').forEach((btn) => {
    btn.addEventListener('click', () => openPicker('poster:' + btn.getAttribute('data-sm-poster')));
  });

  // drag reorder
  const list = document.getElementById('sm-list');
  let dragId = null;
  list?.querySelectorAll('.sm-card').forEach((card) => {
    card.addEventListener('dragstart', () => {
      dragId = card.getAttribute('data-sm-id');
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetId = card.getAttribute('data-sm-id');
      if (!dragId || dragId === targetId) return;
      const ids = [...list.querySelectorAll('.sm-card')].map((c) => c.getAttribute('data-sm-id'));
      const from = ids.indexOf(dragId);
      const to = ids.indexOf(targetId);
      ids.splice(from, 1);
      ids.splice(to, 0, dragId);
      await api(`/api/cms/sectors/${sectorId}/media/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) });
      await loadSectorMediaDraft(sectorId);
      render();
    });
  });
}

async function boot() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    await loadDashboard();
  } catch {
    state.user = null;
  }
  render();
}

boot();
