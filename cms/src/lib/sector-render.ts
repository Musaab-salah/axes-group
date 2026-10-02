import fs from 'node:fs';
import path from 'node:path';
import type { Sector, Service, Project, Media, SectorMedia } from '@prisma/client';
import { parseGallery, resolveSectorFields, cmsPageSlugForSector } from './sectors.js';

function esc(s: unknown) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export type SectorMediaItem = SectorMedia & {
  media: Media;
  posterMedia?: Media | null;
};

export type SectorRenderInput = Sector & {
  services?: Service[];
  projects?: Project[];
  mediaItems?: SectorMediaItem[];
};

export function renderSectorPageHtml(opts: {
  templateHtml: string;
  sector: SectorRenderInput;
  preferDraft?: boolean;
  injectEditor?: boolean;
}) {
  const f = resolveSectorFields(opts.sector, !!opts.preferDraft) as Record<string, unknown>;
  const mediaItems = opts.sector.mediaItems || [];

  const coverItem = mediaItems.find((m) => m.role === 'cover') || mediaItems.find((m) => m.role === 'main');
  const mainItem = mediaItems.find((m) => m.role === 'main');
  const galleryItems = mediaItems.filter((m) => m.role === 'gallery' || (m.role === 'main' && coverItem && m.id !== coverItem.id));

  const cover =
    coverItem?.media.path ||
    String(f.coverPath || opts.sector.coverPath || 'assets/service-construction.jpg');
  const icon = String(f.iconPath || opts.sector.iconPath || 'assets/axes-group-mark.png');

  const legacyGallery = parseGallery(String(f.galleryJson || '[]'));
  const nameAr = String(f.nameAr || opts.sector.nameAr);
  const nameEn = String(f.nameEn || opts.sector.nameEn);
  const summaryAr = String(f.summaryAr || '');
  const summaryEn = String(f.summaryEn || '');
  const bodyAr = String(f.bodyAr || '');
  const bodyEn = String(f.bodyEn || '');
  const seoTitleAr = String(f.seoTitleAr || nameAr);
  const seoTitleEn = String(f.seoTitleEn || nameEn);
  const seoDescAr = String(f.seoDescAr || summaryAr);
  const seoDescEn = String(f.seoDescEn || summaryEn);
  const ctaLabelAr = String(f.ctaLabelAr || 'طلب الخدمة');
  const ctaLabelEn = String(f.ctaLabelEn || 'Request Service');
  const ctaUrl = String(f.ctaUrl || '/contact');
  const phone = String(f.contactPhone || '');
  const email = String(f.contactEmail || '');
  const wa = String(f.contactWhatsapp || '');

  const services = opts.sector.services || [];
  const projects = opts.sector.projects || [];

  const servicesHtml = services.length
    ? services
        .map(
          (s, i) => `<article class="service-card">
      <div class="service-body">
        <span class="service-index">${String(i + 1).padStart(2, '0')}</span>
        <h3 data-ar="${esc(s.nameAr)}" data-en="${esc(s.nameEn)}">${esc(s.nameAr)}</h3>
        <p data-ar="${esc(s.summaryAr)}" data-en="${esc(s.summaryEn)}">${esc(s.summaryAr || s.summaryEn)}</p>
      </div>
    </article>`,
        )
        .join('')
    : `<p class="muted-note" data-ar="سيتم إضافة خدمات هذا القطاع قريبًا." data-en="Services for this sector will be added soon.">سيتم إضافة خدمات هذا القطاع قريبًا.</p>`;

  const isVideoPath = (path: string) => /\.(mp4|webm|ogg)(\?|$)/i.test(path || '');
  const projectsHtml = projects.length
    ? projects
        .map((p) => {
          const media = p.imagePath
            ? isVideoPath(p.imagePath)
              ? `<video src="${esc(p.imagePath)}" muted loop playsinline autoplay preload="metadata"></video>`
              : `<img src="${esc(p.imagePath)}" alt="" loading="lazy">`
            : '';
          return `<article class="project-card">
      <div class="project-media">${media}</div>
      <div class="project-meta">
        <small data-ar="${esc(p.categoryAr)}" data-en="${esc(p.categoryEn)}">${esc(p.categoryAr || p.categoryEn)}</small>
        <h3 data-ar="${esc(p.nameAr)}" data-en="${esc(p.nameEn)}">${esc(p.nameAr)}</h3>
        <p data-ar="${esc(p.summaryAr)}" data-en="${esc(p.summaryEn)}">${esc(p.summaryAr || p.summaryEn)}</p>
      </div>
    </article>`;
        })
        .join('')
    : '';

  const isPeopleShot = (path: string, title = '') =>
    /team|selfie|portrait|engineer|crew|duo|workers|brick-branded|cover-engineer|main-portrait|field-presence|وجه|فريق|مهندس|ميدان/i.test(
      `${path} ${title}`,
    );

  const galleryOnly = galleryItems.filter((m) => m.media.kind !== 'video');

  let galleryHtml = '';
  if (galleryOnly.length) {
    galleryHtml = galleryOnly
      .map((item, i) => {
        const alt = item.altAr || item.titleAr || '';
        const people = isPeopleShot(item.media.path || '', `${item.titleAr || ''} ${item.titleEn || ''}`);
        const imgClass = people ? ' class="shot-face"' : '';
        const caption =
          item.showCaptions && (item.titleAr || item.titleEn)
            ? `<figcaption><strong data-ar="${esc(item.titleAr)}" data-en="${esc(item.titleEn)}">${esc(item.titleAr || item.titleEn)}</strong>${
                item.descriptionAr || item.descriptionEn
                  ? `<span data-ar="${esc(item.descriptionAr)}" data-en="${esc(item.descriptionEn)}">${esc(item.descriptionAr || item.descriptionEn)}</span>`
                  : ''
              }</figcaption>`
            : '';
        return `<figure class="sector-gallery-item">
          <img data-cms="sector.gallery.${i}"${imgClass} src="${esc(item.media.path)}" alt="${esc(alt)}" loading="lazy">
          ${caption}
        </figure>`;
      })
      .join('');
  } else if (legacyGallery.length) {
    galleryHtml = legacyGallery
      .map((src, i) => {
        const people = isPeopleShot(src);
        return `<figure class="sector-gallery-item"><img data-cms="sector.gallery.${i}" class="${people ? 'shot-face' : 'shot-scene'}" src="${esc(src)}" alt="" loading="lazy"></figure>`;
      })
      .join('');
  }

  const mainPeople = mainItem ? isPeopleShot(mainItem.media.path || '', `${mainItem.titleAr || ''} ${mainItem.titleEn || ''}`) : false;
  const mainHtml =
    mainItem && mainItem.id !== coverItem?.id
      ? `<div class="sector-overview-card">
          <figure class="sector-main-media${mainPeople ? ' is-people' : ''}">
          <img class="${mainPeople ? 'shot-face' : 'shot-scene'}" src="${esc(mainItem.media.path)}" alt="${esc(mainItem.altAr || mainItem.titleAr)}" loading="lazy">
          ${
            mainItem.showCaptions && (mainItem.titleAr || mainItem.titleEn)
              ? `<figcaption><strong data-ar="${esc(mainItem.titleAr)}" data-en="${esc(mainItem.titleEn)}">${esc(mainItem.titleAr || mainItem.titleEn)}</strong></figcaption>`
              : ''
          }
        </figure>
        </div>`
      : '';

  const waDigits = (wa || phone || '+249912348243').replace(/\D/g, '') || '249912348243';
  const waIcon =
    '<svg class="whatsapp-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
  const contactBits = [
    phone
      ? `<a class="contact-phone" href="tel:${esc(phone.replace(/\s/g, ''))}" dir="ltr"><bdi>${esc(phone)}</bdi></a>`
      : `<a class="contact-phone" href="tel:+249912348243" dir="ltr"><bdi>+249 91 234 8243</bdi></a>`,
    email
      ? `<a href="mailto:${esc(email)}">${esc(email)}</a>`
      : `<a href="mailto:aseeng2017@gmail.com">aseeng2017@gmail.com</a>`,
    `<a class="whatsapp-btn" href="https://wa.me/${esc(waDigits)}" target="_blank" rel="noopener" aria-label="WhatsApp">${waIcon}<span>WhatsApp</span></a>`,
  ]
    .filter(Boolean)
    .join('');

  const coverCaption =
    coverItem?.showCaptions && (coverItem.titleAr || coverItem.titleEn)
      ? `<p class="hero-cover-caption"><strong data-ar="${esc(coverItem.titleAr)}" data-en="${esc(coverItem.titleEn)}">${esc(
          coverItem.titleAr || coverItem.titleEn,
        )}</strong>${
          coverItem.descriptionAr || coverItem.descriptionEn
            ? `<span data-ar="${esc(coverItem.descriptionAr)}" data-en="${esc(coverItem.descriptionEn)}"> — ${esc(
                coverItem.descriptionAr || coverItem.descriptionEn,
              )}</span>`
            : ''
        }</p>`
      : '';

  let html = opts.templateHtml
    .replaceAll('{{SLUG}}', esc(opts.sector.slug))
    .replaceAll('{{CMS_PAGE}}', esc(cmsPageSlugForSector(opts.sector.slug)))
    .replaceAll('{{SEO_TITLE_AR}}', esc(seoTitleAr))
    .replaceAll('{{SEO_TITLE_EN}}', esc(seoTitleEn))
    .replaceAll('{{SEO_DESC_AR}}', esc(seoDescAr))
    .replaceAll('{{SEO_DESC_EN}}', esc(seoDescEn))
    .replaceAll('{{NAME_AR}}', esc(nameAr))
    .replaceAll('{{NAME_EN}}', esc(nameEn))
    .replaceAll('{{SUMMARY_AR}}', esc(summaryAr))
    .replaceAll('{{SUMMARY_EN}}', esc(summaryEn))
    .replaceAll('{{COVER_CAPTION}}', coverCaption)
    .replaceAll('{{COVER}}', esc(cover))
    .replaceAll('{{ICON}}', esc(icon))
    .replaceAll('{{BODY_AR_HTML}}', nl2brBlocks(bodyAr, bodyEn, 'sector.body'))
    .replaceAll('{{MAIN_MEDIA_HTML}}', mainHtml)
    .replaceAll('{{SERVICES_HTML}}', servicesHtml)
    .replaceAll('{{PROJECTS_HTML}}', projectsHtml)
    .replaceAll('{{PROJECTS_SECTION_CLASS}}', projects.length ? '' : 'is-empty')
    .replaceAll('{{GALLERY_HTML}}', galleryHtml)
    .replaceAll('{{GALLERY_SECTION_CLASS}}', galleryHtml ? '' : 'is-empty')
    .replaceAll('{{VIDEO_HTML}}', '')
    .replaceAll('{{VIDEO_SECTION_CLASS}}', 'is-empty')
    .replaceAll('{{CTA_LABEL_AR}}', esc(ctaLabelAr))
    .replaceAll('{{CTA_LABEL_EN}}', esc(ctaLabelEn))
    .replaceAll('{{CTA_URL}}', esc(ctaUrl))
    .replaceAll('{{CONTACT_HTML}}', contactBits || `<a href="/contact" data-ar="تواصل معنا" data-en="Contact us">تواصل معنا</a>`);

  if (opts.injectEditor && !html.includes('cms-editor-bridge.js')) {
    html = html.replace('</body>', '<script src="/assets/cms-editor-bridge.js"></script></body>');
  }
  return html;
}

function nl2brBlocks(ar: string, en: string, key: string) {
  const arParts = String(ar || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const enParts = String(en || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const count = Math.max(arParts.length, enParts.length, 1);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = arParts[i] || arParts[0] || '';
    const e = enParts[i] || enParts[0] || '';
    if (!a && !e) continue;
    out.push(`<p data-cms="${key}.${i}" data-ar="${esc(a)}" data-en="${esc(e)}">${esc(a || e)}</p>`);
  }
  if (!out.length) out.push(`<p data-cms="${key}.0" data-ar="" data-en=""></p>`);
  return out.join('');
}

export function renderSectorsIndexHtml(opts: {
  templateHtml: string;
  sectors: Sector[];
}) {
  const cards = opts.sectors
    .map(
      (s) => `<a class="sector-card" href="/sectors/${esc(s.slug)}">
      <div class="sector-card-media"><img class="${/engineer|portrait|team|selfie|crew|duo|cover-engineer|main-portrait/i.test(String(s.coverPath || '')) ? 'shot-face' : 'shot-scene'}" src="${esc(s.coverPath || 'assets/service-construction.jpg')}" alt="" loading="lazy"></div>
      <div class="sector-card-body">
        <h2 data-ar="${esc(s.nameAr)}" data-en="${esc(s.nameEn)}">${esc(s.nameAr)}</h2>
        <p data-ar="${esc(s.summaryAr)}" data-en="${esc(s.summaryEn)}">${esc(s.summaryAr || s.summaryEn)}</p>
        <span data-ar="استكشف القطاع" data-en="Explore sector">استكشف القطاع</span>
      </div>
    </a>`,
    )
    .join('');

  return opts.templateHtml.replaceAll(
    '{{SECTOR_CARDS}}',
    cards ||
      `<p data-ar="لا توجد قطاعات منشورة حاليًا." data-en="No published sectors yet.">لا توجد قطاعات منشورة حاليًا.</p>`,
  );
}

export function readTemplate(siteRoot: string, name: string) {
  return fs.readFileSync(path.join(siteRoot, name), 'utf8');
}
