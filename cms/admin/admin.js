const app = document.getElementById('app');
const PAGE_URLS = {
  home: '/',
  about: '/about',
  services: '/services',
  projects: '/projects',
  quality: '/quality',
  contact: '/contact',
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
    ['media', 'الوسائط'],
  ];
  return `<div class="shell">
    <aside class="sidebar">
      <div class="brand">AXES <span>CMS</span></div>
      <nav class="nav">${nav.map(([id, label]) => `<button data-nav="${id}" class="${state.view === id ? 'active' : ''}">${label}</button>`).join('')}</nav>
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
    <div class="actions"><button class="btn btn-gold" data-nav="pages">فتح الصفحات</button><a class="btn btn-ghost" href="/" target="_blank">الموقع</a></div></div>
    <div class="grid">
      <div class="card"><div class="muted">صفحات منشورة</div><b>${s.publishedPages ?? 0}</b></div>
      <div class="card"><div class="muted">مسودات</div><b>${s.draftPages ?? 0}</b></div>
      <div class="card"><div class="muted">صور</div><b>${s.images ?? 0}</b></div>
      <div class="card"><div class="muted">فيديوهات</div><b>${s.videos ?? 0}</b></div>
    </div>`);
}

function pagesView() {
  return shell(`
    <div class="topbar"><div><h2>الصفحات</h2><div class="muted">اختر صفحة وافتح المحرر المرئي</div></div></div>
    <div class="list">${state.pages
      .map(
        (p) => `<div class="list-item">
        <div><strong>${p.titleAr}</strong> / ${p.titleEn}<div class="muted">/${p.slug === 'home' ? '' : p.slug} · ${p.status} · ${p._count?.blocks || 0} عنصر</div></div>
        <div class="actions">
          <button class="btn btn-gold" data-edit="${p.slug}">تحرير مرئي</button>
          <a class="btn btn-ghost" href="${PAGE_URLS[p.slug] || '/'}" target="_blank">معاينة</a>
        </div></div>`,
      )
      .join('')}</div>`);
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
  else if (state.view === 'media') app.innerHTML = mediaView();
  bindShell();
}

function bindShell() {
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-nav');
      state.view = id;
      if (id === 'dashboard') await loadDashboard();
      if (id === 'pages') await loadPages();
      if (id === 'media') await loadMedia();
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
  state.pages = data.pages;
}
async function loadPage(slug) {
  const data = await api(`/api/cms/pages/${slug}`);
  state.pageData = data.page;
}
async function loadMedia() {
  const data = await api('/api/media');
  state.media = data.items;
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
