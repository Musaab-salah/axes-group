window.AxesWorks = {
  esc(str = '') {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  },

  emptyForm() {
    return {
      slug: '',
      nameAr: '',
      nameEn: '',
      summaryAr: '',
      summaryEn: '',
      categoryAr: '',
      categoryEn: '',
      locationAr: '',
      locationEn: '',
      featured: true,
      status: 'PUBLISHED',
      sortOrder: 0,
      imagePath: '',
      sectorId: '',
    };
  },

  listView(state) {
    const esc = this.esc;
    const rows = (state.works || [])
      .map(
        (p) => `<div class="list-row" data-work-id="${esc(p.id)}">
        <div>
          <b>${esc(p.nameAr)}</b>
          <div class="muted">${esc(p.nameEn)} · ${esc(p.sector?.nameAr || 'بدون قطاع')} · ${p.featured ? 'مميز' : 'عادي'} · ${esc(p.status)}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost" data-work-edit="${esc(p.id)}">تعديل</button>
          ${p.status === 'PUBLISHED' ? `<button class="btn btn-ghost" data-work-unpublish="${esc(p.id)}">إلغاء نشر</button>` : `<button class="btn btn-ghost" data-work-publish="${esc(p.id)}">نشر</button>`}
        </div>
      </div>`,
      )
      .join('');
    return `<div class="topbar"><div><h2>الأعمال المختارة</h2><div class="muted">مشاريع مرتبطة بالقطاعات — تظهر في الرئيسية وصفحة المشاريع وصفحة القطاع</div></div>
      <div class="actions"><button class="btn btn-gold" data-work-new>عمل جديد</button></div></div>
      <div class="list">${rows || '<div class="muted">لا توجد أعمال بعد — أضف عملاً واربطه بقطاع</div>'}</div>`;
  },

  formView(state) {
    const esc = this.esc;
    const f = state.workForm || this.emptyForm();
    const work = state.workDetail;
    const sectors = state.sectors || [];
    return `<div class="topbar"><div><h2>${work ? 'تعديل عمل' : 'عمل جديد'}</h2><div class="muted">اربط العمل بقطاع ليظهر تلقائياً في صفحات القطاع والموقع</div></div>
      <div class="actions">
        <button class="btn btn-ghost" data-nav="works">رجوع</button>
        <button class="btn btn-gold" id="work-save">حفظ</button>
      </div></div>
      <form class="card form-grid" id="work-form">
        <label>الاسم (عربي)<input name="nameAr" required value="${esc(f.nameAr)}"></label>
        <label>الاسم (إنجليزي)<input name="nameEn" required value="${esc(f.nameEn)}"></label>
        <label>المعرّف (slug)<input name="slug" value="${esc(f.slug)}" placeholder="auto-from-english"></label>
        <label>القطاع
          <select name="sectorId" required>
            <option value="">— اختر قطاعاً —</option>
            ${sectors.map((s) => `<option value="${esc(s.id)}" ${f.sectorId === s.id ? 'selected' : ''}>${esc(s.nameAr)} (${esc(s.slug)})</option>`).join('')}
          </select>
        </label>
        <label>التصنيف عربي<input name="categoryAr" value="${esc(f.categoryAr)}"></label>
        <label>التصنيف إنجليزي<input name="categoryEn" value="${esc(f.categoryEn)}"></label>
        <label>الموقع عربي<input name="locationAr" value="${esc(f.locationAr)}"></label>
        <label>الموقع إنجليزي<input name="locationEn" value="${esc(f.locationEn)}"></label>
        <label class="full">الملخص عربي<textarea name="summaryAr" rows="3">${esc(f.summaryAr)}</textarea></label>
        <label class="full">الملخص إنجليزي<textarea name="summaryEn" rows="3">${esc(f.summaryEn)}</textarea></label>
        <label class="full">مسار الصورة أو الفيديو<input name="imagePath" value="${esc(f.imagePath || '')}" placeholder="/assets/..."></label>
        <label>الترتيب<input type="number" name="sortOrder" value="${esc(String(f.sortOrder ?? 0))}"></label>
        <label>الحالة
          <select name="status">
            <option value="DRAFT" ${f.status === 'DRAFT' ? 'selected' : ''}>مسودة</option>
            <option value="PUBLISHED" ${f.status === 'PUBLISHED' ? 'selected' : ''}>منشور</option>
            <option value="ARCHIVED" ${f.status === 'ARCHIVED' ? 'selected' : ''}>مؤرشف</option>
          </select>
        </label>
        <label style="font-weight:600"><input type="checkbox" name="featured" ${f.featured ? 'checked' : ''}> إظهار في الرئيسية (أعمال مختارة)</label>
      </form>`;
  },

  servicesListView(state) {
    const esc = this.esc;
    const rows = (state.servicesList || [])
      .map(
        (s) => `<div class="list-row">
        <div>
          <b>${esc(s.nameAr)}</b>
          <div class="muted">${esc(s.nameEn)} · ${esc(s.sector?.nameAr || 'بدون قطاع')} · ${esc(s.status)}</div>
        </div>
        <div class="actions">
          <button class="btn btn-ghost" data-service-edit="${esc(s.id)}">تعديل</button>
        </div>
      </div>`,
      )
      .join('');
    return `<div class="topbar"><div><h2>الخدمات</h2><div class="muted">كل خدمة مرتبطة بقطاع — الزائر ينتقل لصفحة القطاع</div></div>
      <div class="actions"><button class="btn btn-gold" data-service-new>خدمة جديدة</button></div></div>
      <div class="list">${rows || '<div class="muted">لا توجد خدمات</div>'}</div>`;
  },

  serviceFormView(state) {
    const esc = this.esc;
    const f = state.serviceForm || {
      slug: '',
      nameAr: '',
      nameEn: '',
      summaryAr: '',
      summaryEn: '',
      bodyAr: '',
      bodyEn: '',
      status: 'PUBLISHED',
      sortOrder: 0,
      imagePath: '',
      sectorId: '',
    };
    const service = state.serviceDetail;
    const sectors = state.sectors || [];
    return `<div class="topbar"><div><h2>${service ? 'تعديل خدمة' : 'خدمة جديدة'}</h2><div class="muted">اختر القطاع الذي تنتمي إليه الخدمة</div></div>
      <div class="actions">
        <button class="btn btn-ghost" data-nav="services-cms">رجوع</button>
        <button class="btn btn-gold" id="service-save">حفظ</button>
      </div></div>
      <form class="card form-grid" id="service-form">
        <label>الاسم (عربي)<input name="nameAr" required value="${esc(f.nameAr)}"></label>
        <label>الاسم (إنجليزي)<input name="nameEn" required value="${esc(f.nameEn)}"></label>
        <label>المعرّف (slug)<input name="slug" value="${esc(f.slug)}"></label>
        <label>القطاع
          <select name="sectorId" required>
            <option value="">— اختر قطاعاً —</option>
            ${sectors.map((s) => `<option value="${esc(s.id)}" ${f.sectorId === s.id ? 'selected' : ''}>${esc(s.nameAr)}</option>`).join('')}
          </select>
        </label>
        <label class="full">الملخص عربي<textarea name="summaryAr" rows="3">${esc(f.summaryAr)}</textarea></label>
        <label class="full">الملخص إنجليزي<textarea name="summaryEn" rows="3">${esc(f.summaryEn)}</textarea></label>
        <label class="full">مسار الصورة<input name="imagePath" value="${esc(f.imagePath || '')}" placeholder="/assets/..."></label>
        <label>الترتيب<input type="number" name="sortOrder" value="${esc(String(f.sortOrder ?? 0))}"></label>
        <label>الحالة
          <select name="status">
            <option value="DRAFT" ${f.status === 'DRAFT' ? 'selected' : ''}>مسودة</option>
            <option value="PUBLISHED" ${f.status === 'PUBLISHED' ? 'selected' : ''}>منشور</option>
            <option value="ARCHIVED" ${f.status === 'ARCHIVED' ? 'selected' : ''}>مؤرشف</option>
          </select>
        </label>
      </form>`;
  },
};
