/* Pages + Navigation admin */
window.AxesNav = (() => {
  function esc(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function pagesView(state) {
    const pages = state.pages || [];
    return `
      <div class="topbar">
        <div><h2>الصفحات والقوائم</h2><div class="muted">حالة النشر · الظهور في القوائم · الترتيب · القوائم الفرعية</div></div>
        <div class="actions">
          <button class="btn btn-ghost" data-nav="nav-editor">تحرير القائمة</button>
          <button class="btn btn-gold" id="nav-publish">نشر القائمة</button>
        </div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="muted">معاينة القائمة الرئيسية (مسودة)</div>
        <div class="nav-preview" id="nav-preview-header">${previewStrip(state.navDraft?.headerPreview || [])}</div>
        <div class="muted" style="margin-top:10px">معاينة التذييل (مسودة)</div>
        <div class="nav-preview" id="nav-preview-footer">${previewStrip(state.navDraft?.footerPreview || [])}</div>
      </div>
      <div class="list" id="pages-list">
        ${pages
          .map((p) => {
            const url = p.href || (p.slug === 'home' ? '/' : p.slug.startsWith('sector-') ? `/sectors/${p.slug.slice(7)}` : `/${p.slug}`);
            return `<div class="list-item page-row" draggable="true" data-page-id="${esc(p.id)}">
              <div>
                <strong>${esc(p.navLabelAr || p.titleAr)}</strong> / ${esc(p.navLabelEn || p.titleEn)}
                <div class="muted">${esc(url)} · ${esc(p.status)}${p.isHome ? ' · رئيسية' : ''}</div>
              </div>
              <div class="actions">
                <label class="chip"><input type="checkbox" data-page-flag="showInHeader" data-page-slug="${esc(p.slug)}" ${p.showInHeader ? 'checked' : ''}> قائمة</label>
                <label class="chip"><input type="checkbox" data-page-flag="showInFooter" data-page-slug="${esc(p.slug)}" ${p.showInFooter ? 'checked' : ''}> تذييل</label>
                <button class="btn btn-ghost" data-page-edit="${esc(p.slug)}">إعدادات</button>
                <button class="btn btn-gold" data-edit="${esc(p.slug)}">محرر مرئي</button>
                ${
                  p.status === 'PUBLISHED'
                    ? `<button class="btn btn-ghost" data-page-unpublish="${esc(p.slug)}">إلغاء نشر</button>`
                    : `<button class="btn btn-gold" data-page-publish="${esc(p.slug)}">نشر</button>`
                }
                <a class="btn btn-ghost" href="${esc(url)}${p.status !== 'PUBLISHED' ? '?cmsPreview=1' : ''}" target="_blank">معاينة</a>
              </div>
            </div>`;
          })
          .join('')}
      </div>`;
  }

  function previewStrip(tree) {
    if (!tree?.length) return '<span class="muted">لا عناصر</span>';
    return tree
      .map((t) => {
        const kids = (t.children || []).map((c) => esc(c.labelAr)).join(' · ');
        return `<span class="nav-pill">${esc(t.labelAr)}${kids ? `<small>${kids}</small>` : ''}</span>`;
      })
      .join('');
  }

  function navEditorView(state) {
    const items = state.navDraft?.items || [];
    const catalog = state.navCatalog || { pages: [], sectors: [], services: [] };
    const roots = items.filter((i) => !i.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const childMap = {};
    for (const i of items) {
      if (!i.parentId) continue;
      if (!childMap[i.parentId]) childMap[i.parentId] = [];
      childMap[i.parentId].push(i);
    }
    Object.values(childMap).forEach((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder));

    const row = (item, depth = 0) => {
      const kids = childMap[item.id] || [];
      return `<div class="list-item nav-row" draggable="true" data-nav-id="${esc(item.id)}" style="margin-inline-start:${depth * 18}px">
        <div>
          <strong>${esc(item.labelAr)}</strong> / ${esc(item.labelEn)}
          <div class="muted">${esc(item.targetType)} · ${esc(item.href)} ${item.showInHeader ? '· قائمة' : ''} ${item.showInFooter ? '· تذييل' : ''}</div>
        </div>
        <div class="actions">
          <label class="chip"><input type="checkbox" data-nav-flag="showInHeader" data-nav-id="${esc(item.id)}" ${item.showInHeader ? 'checked' : ''}> قائمة</label>
          <label class="chip"><input type="checkbox" data-nav-flag="showInFooter" data-nav-id="${esc(item.id)}" ${item.showInFooter ? 'checked' : ''}> تذييل</label>
          <select data-nav-parent="${esc(item.id)}">
            <option value="">— بدون أب —</option>
            ${roots
              .filter((r) => r.id !== item.id)
              .map((r) => `<option value="${esc(r.id)}" ${item.parentId === r.id ? 'selected' : ''}>تحت: ${esc(r.labelAr)}</option>`)
              .join('')}
          </select>
          <button class="btn btn-danger" data-nav-del="${esc(item.id)}">حذف</button>
        </div>
      </div>${kids.map((c) => row(c, depth + 1)).join('')}`;
    };

    return `
      <div class="topbar">
        <div><h2>تحرير القائمة</h2><div class="muted">أضف صفحات/قطاعات/خدمات، رتّب، ثم انشر</div></div>
        <div class="actions">
          <button class="btn btn-ghost" data-nav="pages">رجوع للصفحات</button>
          <button class="btn btn-gold" id="nav-publish">نشر القائمة</button>
        </div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <h3 style="margin-top:0;color:var(--gold)">إضافة إلى القائمة</h3>
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
          <label>من الصفحات
            <select id="add-page">
              <option value="">اختر صفحة…</option>
              ${(catalog.pages || []).map((p) => `<option value="${esc(p.id)}">${esc(p.navLabelAr || p.titleAr)} (${esc(p.status)})</option>`).join('')}
            </select>
          </label>
          <label>من القطاعات المنشورة
            <select id="add-sector">
              <option value="">اختر قطاعًا…</option>
              ${(catalog.sectors || []).map((s) => `<option value="${esc(s.id)}">${esc(s.nameAr)}</option>`).join('')}
            </select>
          </label>
          <label>من الخدمات المنشورة
            <select id="add-service">
              <option value="">اختر خدمة…</option>
              ${(catalog.services || []).map((s) => `<option value="${esc(s.id)}">${esc(s.nameAr)}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="actions" style="margin-top:10px">
          <button class="btn btn-gold" id="add-nav-page">إضافة صفحة</button>
          <button class="btn btn-ghost" id="add-nav-sector">إضافة قطاع</button>
          <button class="btn btn-ghost" id="add-nav-service">إضافة خدمة</button>
        </div>
      </div>
      <div class="list" id="nav-items-list">${roots.map((r) => row(r)).join('') || '<div class="muted">القائمة فارغة</div>'}</div>
      <div class="card" style="margin-top:14px">
        <div class="muted">معاينة</div>
        <div class="nav-preview">${previewStrip(state.navDraft?.headerPreview || [])}</div>
      </div>`;
  }

  function pageSettingsModal(page) {
    if (!page) return '';
    return `<div class="modal-backdrop" id="page-settings-modal">
      <form class="card modal" id="page-settings-form">
        <h3 style="margin-top:0">إعدادات الصفحة</h3>
        <label>اسم العرض عربي<input name="navLabelAr" value="${esc(page.navLabelAr || page.titleAr || '')}"></label>
        <label>Display name EN<input name="navLabelEn" value="${esc(page.navLabelEn || page.titleEn || '')}"></label>
        <label>العنوان عربي<input name="titleAr" value="${esc(page.titleAr || '')}"></label>
        <label>Title EN<input name="titleEn" value="${esc(page.titleEn || '')}"></label>
        <label>الرابط (slug)<input name="slug" value="${esc(page.slug || '')}" ${page.isHome || page.slug === 'home' ? 'disabled' : ''}></label>
        <div class="actions">
          <label class="chip"><input type="checkbox" name="showInHeader" ${page.showInHeader ? 'checked' : ''}> إظهار في القائمة</label>
          <label class="chip"><input type="checkbox" name="showInFooter" ${page.showInFooter ? 'checked' : ''}> إظهار في التذييل</label>
        </div>
        <div class="actions" style="margin-top:12px">
          <button type="button" class="btn btn-ghost" id="page-settings-cancel">إلغاء</button>
          <button type="submit" class="btn btn-gold">حفظ</button>
        </div>
      </form>
    </div>`;
  }

  return { pagesView, navEditorView, pageSettingsModal, previewStrip };
})();
