/* AXES Admin — Business Sectors module */
window.AxesSectors = (() => {
  const emptyForm = () => ({
    slug: '',
    nameAr: '',
    nameEn: '',
    summaryAr: '',
    summaryEn: '',
    bodyAr: '',
    bodyEn: '',
    iconPath: '',
    coverPath: '',
    galleryJson: '[]',
    videoPath: '',
    contactPhone: '',
    contactEmail: 'info@axessud.com',
    contactWhatsapp: '',
    ctaLabelAr: 'طلب الخدمة',
    ctaLabelEn: 'Request Service',
    ctaUrl: '/contact',
    seoTitleAr: '',
    seoTitleEn: '',
    seoDescAr: '',
    seoDescEn: '',
    sortOrder: 0,
    showInHome: true,
    showInNav: true,
    serviceIds: [],
    projectIds: [],
  });

  function esc(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function listView(state) {
    const rows = (state.sectors || [])
      .map(
        (s) => `<div class="list-item" draggable="true" data-sector-id="${esc(s.id)}">
        <div>
          <strong>${esc(s.nameAr)}</strong> / ${esc(s.nameEn)}
          <div class="muted">/${esc(s.slug)} · ${esc(s.status)} · خدمات ${s._count?.services || 0} · مشاريع ${s._count?.projects || 0}</div>
        </div>
        <div class="actions">
          <button class="btn btn-gold" data-sector-edit="${esc(s.id)}">تعديل</button>
          <a class="btn btn-ghost" href="/sectors/${esc(s.slug)}?cmsPreview=1" target="_blank">معاينة</a>
          <a class="btn btn-ghost" href="/sectors/${esc(s.slug)}?cmsEdit=1" target="_blank">محرر مرئي</a>
          <button class="btn btn-ghost" data-sector-dup="${esc(s.id)}">نسخ</button>
          ${
            s.status === 'PUBLISHED'
              ? `<button class="btn btn-ghost" data-sector-unpublish="${esc(s.id)}">إلغاء نشر</button>`
              : `<button class="btn btn-gold" data-sector-publish="${esc(s.id)}">نشر</button>`
          }
          <button class="btn btn-ghost" data-sector-archive="${esc(s.id)}">أرشفة</button>
        </div>
      </div>`,
      )
      .join('');
    return `
      <div class="topbar">
        <div><h2>قطاعات الأعمال</h2><div class="muted">المجموعة ← القطاعات ← الخدمات/المشاريع</div></div>
        <div class="actions">
          <button class="btn btn-gold" id="sector-new">قطاع جديد</button>
          <button class="btn btn-ghost" id="sector-save-order">حفظ الترتيب</button>
        </div>
      </div>
      <div class="list" id="sectors-list">${rows || '<div class="muted">لا توجد قطاعات بعد</div>'}</div>`;
  }

  function formView(state) {
    const f = state.sectorForm || emptyForm();
    const sector = state.sectorDetail;
    const services = state.sectorOptions?.services || [];
    const projects = state.sectorOptions?.projects || [];
    const versions = sector?.versions || [];
    return `
      <div class="topbar">
        <div><h2>${sector ? 'تعديل قطاع' : 'قطاع جديد'}</h2><div class="muted">${esc(f.slug || 'slug')}</div></div>
        <div class="actions">
          <button class="btn btn-ghost" data-nav="sectors">رجوع</button>
          <button class="btn btn-ghost" id="sector-save-draft">حفظ مسودة</button>
          ${sector ? `<a class="btn btn-ghost" href="/sectors/${esc(sector.slug)}?cmsPreview=1" target="_blank">معاينة خاصة</a>` : ''}
          ${sector ? `<button class="btn btn-gold" id="sector-publish">نشر</button>` : ''}
        </div>
      </div>
      <form class="card sector-form" id="sector-form" style="display:grid;gap:12px">
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
          <label>الاسم عربي<input name="nameAr" required value="${esc(f.nameAr)}"></label>
          <label>Name EN<input name="nameEn" required value="${esc(f.nameEn)}"></label>
          <label>الرابط الفريد (slug)<input name="slug" required value="${esc(f.slug)}" ${sector ? '' : ''}></label>
          <label>ترتيب العرض<input name="sortOrder" type="number" value="${esc(f.sortOrder)}"></label>
        </div>
        <label>وصف مختصر عربي<textarea name="summaryAr">${esc(f.summaryAr)}</textarea></label>
        <label>Short summary EN<textarea name="summaryEn">${esc(f.summaryEn)}</textarea></label>
        <label>المحتوى التفصيلي عربي<textarea name="bodyAr" style="min-height:140px">${esc(f.bodyAr)}</textarea></label>
        <label>Detailed content EN<textarea name="bodyEn" style="min-height:140px">${esc(f.bodyEn)}</textarea></label>
        <label>أيقونة القطاع (مسار اختياري)<input name="iconPath" value="${esc(f.iconPath || '')}"></label>
        <input type="hidden" name="coverPath" value="${esc(f.coverPath || '')}">
        <input type="hidden" name="videoPath" value="${esc(f.videoPath || '')}">
        <input type="hidden" name="galleryJson" value="${esc(f.galleryJson || '[]')}">
        ${mediaManagerHtml(state)}
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:12px">
          <label>هاتف<input name="contactPhone" value="${esc(f.contactPhone || '')}"></label>
          <label>بريد<input name="contactEmail" value="${esc(f.contactEmail || '')}"></label>
          <label>WhatsApp<input name="contactWhatsapp" value="${esc(f.contactWhatsapp || '')}"></label>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:12px">
          <label>نص زر CTA عربي<input name="ctaLabelAr" value="${esc(f.ctaLabelAr || '')}"></label>
          <label>CTA EN<input name="ctaLabelEn" value="${esc(f.ctaLabelEn || '')}"></label>
          <label>رابط الزر<input name="ctaUrl" value="${esc(f.ctaUrl || '/contact')}"></label>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
          <label>SEO عنوان عربي<input name="seoTitleAr" value="${esc(f.seoTitleAr || '')}"></label>
          <label>SEO title EN<input name="seoTitleEn" value="${esc(f.seoTitleEn || '')}"></label>
          <label>SEO وصف عربي<textarea name="seoDescAr">${esc(f.seoDescAr || '')}</textarea></label>
          <label>SEO desc EN<textarea name="seoDescEn">${esc(f.seoDescEn || '')}</textarea></label>
        </div>
        <div class="actions">
          <label><input type="checkbox" name="showInHome" ${f.showInHome ? 'checked' : ''}> إظهار في الرئيسية</label>
          <label><input type="checkbox" name="showInNav" ${f.showInNav ? 'checked' : ''}> إظهار في القائمة</label>
        </div>
        <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <h3 style="margin:0 0 8px;color:var(--gold)">الخدمات المرتبطة</h3>
            ${services
              .map(
                (s) =>
                  `<label style="font-weight:500"><input type="checkbox" name="serviceIds" value="${esc(s.id)}" ${
                    f.serviceIds?.includes(s.id) || s.sectorId === sector?.id ? 'checked' : ''
                  }> ${esc(s.nameAr)}</label>`,
              )
              .join('') || '<div class="muted">لا خدمات</div>'}
          </div>
          <div>
            <h3 style="margin:0 0 8px;color:var(--gold)">المشاريع المرتبطة</h3>
            ${projects
              .map(
                (p) =>
                  `<label style="font-weight:500"><input type="checkbox" name="projectIds" value="${esc(p.id)}" ${
                    f.projectIds?.includes(p.id) || p.sectorId === sector?.id ? 'checked' : ''
                  }> ${esc(p.nameAr)}</label>`,
              )
              .join('') || '<div class="muted">لا مشاريع مسجّلة بعد</div>'}
          </div>
        </div>
      </form>
      ${
        versions.length
          ? `<div class="card" style="margin-top:14px"><h3 style="margin-top:0;color:var(--gold)">إصدارات سابقة</h3>
        <div class="list">${versions
          .map(
            (v) => `<div class="list-item"><div><strong>${esc(v.label)}</strong><div class="muted">${new Date(
              v.createdAt,
            ).toLocaleString()}</div></div>
            <button class="btn btn-ghost" data-sector-restore="${esc(v.id)}">استعادة كمسودة</button></div>`,
          )
          .join('')}</div></div>`
          : ''
      }`;
  }

  function roleLabel(role) {
    return (
      {
        cover: 'غلاف القطاع',
        main: 'صورة رئيسية',
        gallery: 'معرض صور',
        intro_video: 'فيديو تعريفي',
      }[role] || role
    );
  }

  function mediaManagerHtml(state) {
    const sector = state.sectorDetail;
    if (!sector?.id) {
      return `<div class="card media-manager"><div class="muted">احفظ القطاع كمسودة أولًا لتفعيل رفع الصور والفيديوهات وربطها.</div></div>`;
    }
    const items = state.sectorMedia || [];
    const limits = state.mediaLimits || { imageMb: 12, videoMb: 200 };
    const cards = items
      .map((item) => {
        const src = item.media?.path || '';
        const isVideo = item.media?.kind === 'video';
        const thumb = isVideo
          ? `<video src="${esc(src)}" muted preload="metadata"></video>`
          : `<img src="${esc(src)}" alt="">`;
        return `<article class="sm-card" draggable="true" data-sm-id="${esc(item.id)}">
          <div class="sm-thumb">${thumb}<span class="sm-role">${esc(roleLabel(item.role))}</span></div>
          <div class="sm-fields">
            <label>الاستخدام
              <select data-sm-field="role" data-sm-id="${esc(item.id)}">
                <option value="cover" ${item.role === 'cover' ? 'selected' : ''}>غلاف القطاع</option>
                <option value="main" ${item.role === 'main' ? 'selected' : ''}>صورة رئيسية</option>
                <option value="gallery" ${item.role === 'gallery' ? 'selected' : ''}>معرض صور</option>
                <option value="intro_video" ${item.role === 'intro_video' ? 'selected' : ''}>فيديو تعريفي</option>
              </select>
            </label>
            <label>عنوان عربي<input data-sm-field="titleAr" data-sm-id="${esc(item.id)}" value="${esc(item.titleAr || '')}"></label>
            <label>Title EN<input data-sm-field="titleEn" data-sm-id="${esc(item.id)}" value="${esc(item.titleEn || '')}"></label>
            <label>وصف عربي<textarea data-sm-field="descriptionAr" data-sm-id="${esc(item.id)}">${esc(item.descriptionAr || '')}</textarea></label>
            <label>Description EN<textarea data-sm-field="descriptionEn" data-sm-id="${esc(item.id)}">${esc(item.descriptionEn || '')}</textarea></label>
            <label>نص بديل (Alt)<input data-sm-field="altAr" data-sm-id="${esc(item.id)}" value="${esc(item.altAr || '')}" placeholder="للصور — وصول وSEO"></label>
            <label>Alt EN<input data-sm-field="altEn" data-sm-id="${esc(item.id)}" value="${esc(item.altEn || '')}"></label>
            <label class="sm-check"><input type="checkbox" data-sm-field="showCaptions" data-sm-id="${esc(item.id)}" ${item.showCaptions ? 'checked' : ''}> إظهار العنوان والوصف للزوار</label>
            ${
              isVideo
                ? `<div class="actions"><button type="button" class="btn btn-ghost" data-sm-poster="${esc(item.id)}">صورة غلاف للفيديو</button>
                   ${item.posterMedia ? `<span class="muted">غلاف: ${esc(item.posterMedia.originalName || item.posterMedia.path)}</span>` : ''}</div>`
                : ''
            }
            <div class="actions">
              <button type="button" class="btn btn-ghost" data-sm-replace="${esc(item.id)}">استبدال الملف</button>
              <button type="button" class="btn btn-danger" data-sm-remove="${esc(item.id)}">إزالة من القطاع</button>
            </div>
          </div>
        </article>`;
      })
      .join('');

    return `<div class="card media-manager" id="sector-media-manager">
      <div class="topbar" style="margin:0 0 12px">
        <div><h3 style="margin:0;color:var(--gold)">وسائط القطاع</h3>
        <div class="muted">رفع مباشر أو من المكتبة · حدود: صور ${limits.imageMb}MB / فيديو ${limits.videoMb}MB · JPG PNG WebP / MP4 WebM</div></div>
      </div>
      <div class="upload-drop" id="sm-dropzone" tabindex="0">
        <strong>رفع صور أو فيديوهات</strong>
        <span>اسحب الملفات هنا أو انقر للاختيار — يمكن رفع عدة ملفات</span>
        <input type="file" id="sm-file-input" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden>
      </div>
      <div class="actions" style="margin:10px 0">
        <button type="button" class="btn btn-ghost" id="sm-pick-library">اختيار من مكتبة الوسائط</button>
        <label>الدور الافتراضي للملفات الجديدة
          <select id="sm-default-role">
            <option value="gallery">معرض صور</option>
            <option value="cover">غلاف القطاع</option>
            <option value="main">صورة رئيسية</option>
            <option value="intro_video">فيديو تعريفي</option>
          </select>
        </label>
      </div>
      <div id="sm-upload-progress" class="sm-progress hidden"></div>
      <div id="sm-upload-errors" class="error" style="display:none"></div>
      <div class="sm-list" id="sm-list">${cards || '<div class="muted">لا وسائط بعد — ارفع أو اختر من المكتبة</div>'}</div>
      <div class="library-picker hidden" id="sm-library-picker">
        <div class="topbar"><strong>مكتبة الوسائط</strong><button type="button" class="btn btn-ghost" id="sm-library-close">إغلاق</button></div>
        <div class="library-grid" id="sm-library-grid"></div>
      </div>
    </div>`;
  }

  function readForm() {
    const form = document.getElementById('sector-form');
    if (!form) return null;
    const fd = new FormData(form);
    const serviceIds = [...form.querySelectorAll('[name=serviceIds]:checked')].map((el) => el.value);
    const projectIds = [...form.querySelectorAll('[name=projectIds]:checked')].map((el) => el.value);
    return {
      slug: String(fd.get('slug') || ''),
      nameAr: String(fd.get('nameAr') || ''),
      nameEn: String(fd.get('nameEn') || ''),
      summaryAr: String(fd.get('summaryAr') || ''),
      summaryEn: String(fd.get('summaryEn') || ''),
      bodyAr: String(fd.get('bodyAr') || ''),
      bodyEn: String(fd.get('bodyEn') || ''),
      iconPath: String(fd.get('iconPath') || '') || null,
      coverPath: String(fd.get('coverPath') || '') || null,
      galleryJson: String(fd.get('galleryJson') || '[]'),
      videoPath: String(fd.get('videoPath') || '') || null,
      contactPhone: String(fd.get('contactPhone') || ''),
      contactEmail: String(fd.get('contactEmail') || ''),
      contactWhatsapp: String(fd.get('contactWhatsapp') || ''),
      ctaLabelAr: String(fd.get('ctaLabelAr') || ''),
      ctaLabelEn: String(fd.get('ctaLabelEn') || ''),
      ctaUrl: String(fd.get('ctaUrl') || '/contact'),
      seoTitleAr: String(fd.get('seoTitleAr') || ''),
      seoTitleEn: String(fd.get('seoTitleEn') || ''),
      seoDescAr: String(fd.get('seoDescAr') || ''),
      seoDescEn: String(fd.get('seoDescEn') || ''),
      sortOrder: Number(fd.get('sortOrder') || 0),
      showInHome: form.querySelector('[name=showInHome]')?.checked || false,
      showInNav: form.querySelector('[name=showInNav]')?.checked || false,
      serviceIds,
      projectIds,
    };
  }

  return { emptyForm, listView, formView, readForm, mediaManagerHtml, roleLabel };
})();
