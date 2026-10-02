import type { Sector, Service, Project } from '@prisma/client';

export const SECTOR_EDITABLE_KEYS = [
  'nameAr',
  'nameEn',
  'summaryAr',
  'summaryEn',
  'bodyAr',
  'bodyEn',
  'iconPath',
  'coverPath',
  'galleryJson',
  'videoPath',
  'contactPhone',
  'contactEmail',
  'contactWhatsapp',
  'ctaLabelAr',
  'ctaLabelEn',
  'ctaUrl',
  'seoTitleAr',
  'seoTitleEn',
  'seoDescAr',
  'seoDescEn',
  'sortOrder',
  'showInHome',
  'showInNav',
] as const;

export type SectorEditableKey = (typeof SECTOR_EDITABLE_KEYS)[number];

export type SectorView = Sector & {
  services?: Service[];
  projects?: Project[];
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function assertValidSlug(slug: string) {
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error('Invalid slug. Use lowercase letters, numbers and hyphens.');
  }
}

export function parseDraft(sector: Sector): Record<string, unknown> {
  if (!sector.draftJson) return {};
  try {
    const parsed = JSON.parse(sector.draftJson);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveSectorFields(sector: Sector, preferDraft = false): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  for (const key of SECTOR_EDITABLE_KEYS) {
    base[key] = (sector as Record<string, unknown>)[key];
  }
  base.slug = sector.slug;
  base.status = sector.status;
  if (!preferDraft) return base;
  return { ...base, ...parseDraft(sector) };
}

export function snapshotSector(sector: SectorView) {
  return JSON.stringify({
    ...resolveSectorFields(sector, false),
    slug: sector.slug,
    status: sector.status,
    pageId: sector.pageId,
    serviceIds: (sector.services || []).map((s) => s.id),
    projectIds: (sector.projects || []).map((p) => p.id),
  });
}

export function parseGallery(json: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(json || '[]');
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function cmsPageSlugForSector(slug: string) {
  return `sector-${slug}`;
}
