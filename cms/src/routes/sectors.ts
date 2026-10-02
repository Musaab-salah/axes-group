import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import {
  SECTOR_EDITABLE_KEYS,
  assertValidSlug,
  cmsPageSlugForSector,
  normalizeSlug,
  parseDraft,
  resolveSectorFields,
  snapshotSector,
} from '../lib/sectors.js';
import { publishSectorMedia } from './sector-media.js';

export const sectorsRouter = Router();

const editableSchema = z
  .object({
    nameAr: z.string().min(1).optional(),
    nameEn: z.string().min(1).optional(),
    summaryAr: z.string().optional(),
    summaryEn: z.string().optional(),
    bodyAr: z.string().optional(),
    bodyEn: z.string().optional(),
    iconPath: z.string().nullable().optional(),
    coverPath: z.string().nullable().optional(),
    galleryJson: z.string().optional(),
    videoPath: z.string().nullable().optional(),
    contactPhone: z.string().optional(),
    contactEmail: z.string().optional(),
    contactWhatsapp: z.string().optional(),
    ctaLabelAr: z.string().optional(),
    ctaLabelEn: z.string().optional(),
    ctaUrl: z.string().optional(),
    seoTitleAr: z.string().optional(),
    seoTitleEn: z.string().optional(),
    seoDescAr: z.string().optional(),
    seoDescEn: z.string().optional(),
    sortOrder: z.number().int().optional(),
    showInHome: z.boolean().optional(),
    showInNav: z.boolean().optional(),
    serviceIds: z.array(z.string()).optional(),
    projectIds: z.array(z.string()).optional(),
  })
  .strict();

function pickEditable(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of SECTOR_EDITABLE_KEYS) {
    if (key in data) out[key] = data[key];
  }
  return out;
}

async function ensureCmsPage(sector: { id: string; slug: string; nameAr: string; nameEn: string; pageId: string | null }) {
  if (sector.pageId) {
    const page = await prisma.page.findUnique({ where: { id: sector.pageId } });
    if (page) return page;
  }
  const slug = cmsPageSlugForSector(sector.slug);
  const page = await prisma.page.upsert({
    where: { slug },
    update: { titleAr: sector.nameAr, titleEn: sector.nameEn },
    create: {
      slug,
      titleAr: sector.nameAr,
      titleEn: sector.nameEn,
      template: 'sector',
      status: 'DRAFT',
    },
  });
  await prisma.sector.update({ where: { id: sector.id }, data: { pageId: page.id } });
  return page;
}

async function loadSector(idOrSlug: string) {
  const byId = await prisma.sector.findUnique({
    where: { id: idOrSlug },
    include: {
      services: { orderBy: { sortOrder: 'asc' } },
      projects: { orderBy: { sortOrder: 'asc' } },
      versions: { orderBy: { createdAt: 'desc' }, take: 20 },
      page: true,
    },
  });
  if (byId) return byId;
  return prisma.sector.findUnique({
    where: { slug: idOrSlug },
    include: {
      services: { orderBy: { sortOrder: 'asc' } },
      projects: { orderBy: { sortOrder: 'asc' } },
      versions: { orderBy: { createdAt: 'desc' }, take: 20 },
      page: true,
    },
  });
}

async function syncLinks(sectorId: string, serviceIds?: string[], projectIds?: string[]) {
  if (serviceIds) {
    await prisma.service.updateMany({ where: { sectorId }, data: { sectorId: null } });
    if (serviceIds.length) {
      await prisma.service.updateMany({ where: { id: { in: serviceIds } }, data: { sectorId } });
    }
  }
  if (projectIds) {
    await prisma.project.updateMany({ where: { sectorId }, data: { sectorId: null } });
    if (projectIds.length) {
      await prisma.project.updateMany({ where: { id: { in: projectIds } }, data: { sectorId } });
    }
  }
}

sectorsRouter.use(requireAuth);

sectorsRouter.get('/', async (_req, res) => {
  const sectors = await prisma.sector.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { services: true, projects: true, versions: true } },
      page: { select: { id: true, slug: true, status: true } },
    },
  });
  res.json({ sectors });
});

sectorsRouter.get('/meta/options', async (_req, res) => {
  const [services, projects] = await Promise.all([
    prisma.service.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, slug: true, nameAr: true, nameEn: true, sectorId: true } }),
    prisma.project.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, slug: true, nameAr: true, nameEn: true, sectorId: true } }),
  ]);
  res.json({ services, projects });
});

sectorsRouter.post('/reorder', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = z.object({ ids: z.array(z.string()).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  let order = 0;
  for (const id of parsed.data.ids) {
    await prisma.sector.update({ where: { id }, data: { sortOrder: order++ } });
  }
  res.json({ ok: true });
});

sectorsRouter.get('/:id', async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  const draft = parseDraft(sector);
  const fields = resolveSectorFields(sector, true);
  res.json({ sector, draft, fields });
});

sectorsRouter.post('/', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = z
    .object({
      slug: z.string().min(1),
      nameAr: z.string().min(1),
      nameEn: z.string().min(1),
    })
    .merge(editableSchema.partial())
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    return;
  }
  const slug = normalizeSlug(parsed.data.slug);
  try {
    assertValidSlug(slug);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
    return;
  }
  const exists = await prisma.sector.findUnique({ where: { slug } });
  if (exists) {
    res.status(409).json({ error: 'Slug already exists' });
    return;
  }
  const pageSlug = cmsPageSlugForSector(slug);
  const pageExists = await prisma.page.findUnique({ where: { slug: pageSlug } });
  if (pageExists) {
    res.status(409).json({ error: 'CMS page slug conflict' });
    return;
  }

  const { serviceIds, projectIds, ...rest } = parsed.data;
  const editable = pickEditable(rest);

  const page = await prisma.page.create({
    data: {
      slug: pageSlug,
      titleAr: parsed.data.nameAr,
      titleEn: parsed.data.nameEn,
      template: 'sector',
      status: 'DRAFT',
    },
  });

  const sector = await prisma.sector.create({
    data: {
      slug,
      nameAr: parsed.data.nameAr,
      nameEn: parsed.data.nameEn,
      status: 'DRAFT',
      pageId: page.id,
      ...editable,
    },
  });
  await syncLinks(sector.id, serviceIds, projectIds);

  await logActivity({
    userId: req.user?.id,
    action: 'create_sector',
    resource: 'sector',
    resourceId: sector.id,
    meta: { slug },
  });

  const full = await loadSector(sector.id);
  res.status(201).json({ sector: full });
});

sectorsRouter.put('/:id', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  const parsed = editableSchema
    .extend({
      slug: z.string().min(1).optional(),
      saveMode: z.enum(['draft', 'direct']).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const { serviceIds, projectIds, slug: nextSlugRaw, saveMode, ...rest } = parsed.data;
  if (nextSlugRaw) {
    const nextSlug = normalizeSlug(nextSlugRaw);
    try {
      assertValidSlug(nextSlug);
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
      return;
    }
    if (nextSlug !== sector.slug) {
      const clash = await prisma.sector.findUnique({ where: { slug: nextSlug } });
      if (clash) {
        res.status(409).json({ error: 'Slug already exists' });
        return;
      }
      await prisma.sector.update({ where: { id: sector.id }, data: { slug: nextSlug } });
      if (sector.pageId) {
        await prisma.page.update({
          where: { id: sector.pageId },
          data: { slug: cmsPageSlugForSector(nextSlug) },
        });
      }
    }
  }

  const editable = pickEditable(rest);
  const mode = saveMode || 'draft';

  if (mode === 'draft' && sector.status === 'PUBLISHED') {
    const currentDraft = parseDraft(sector);
    const merged = { ...currentDraft, ...editable };
    await prisma.sector.update({
      where: { id: sector.id },
      data: { draftJson: JSON.stringify(merged) },
    });
  } else {
    await prisma.sector.update({
      where: { id: sector.id },
      data: {
        ...editable,
        ...(sector.status === 'PUBLISHED' ? {} : { draftJson: null }),
      },
    });
  }

  await syncLinks(sector.id, serviceIds, projectIds);
  await ensureCmsPage({
    id: sector.id,
    slug: nextSlugRaw ? normalizeSlug(nextSlugRaw) : sector.slug,
    nameAr: (editable.nameAr as string) || sector.nameAr,
    nameEn: (editable.nameEn as string) || sector.nameEn,
    pageId: sector.pageId,
  });

  await logActivity({
    userId: req.user?.id,
    action: 'update_sector',
    resource: 'sector',
    resourceId: sector.id,
    meta: { mode },
  });

  res.json({ sector: await loadSector(sector.id) });
});

sectorsRouter.post('/:id/duplicate', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  let base = `${sector.slug}-copy`;
  let n = 1;
  while (await prisma.sector.findUnique({ where: { slug: base } })) {
    n += 1;
    base = `${sector.slug}-copy-${n}`;
  }
  const fields = resolveSectorFields(sector, true);
  const page = await prisma.page.create({
    data: {
      slug: cmsPageSlugForSector(base),
      titleAr: `${sector.nameAr} (نسخة)`,
      titleEn: `${sector.nameEn} (Copy)`,
      template: 'sector',
      status: 'DRAFT',
    },
  });
  const created = await prisma.sector.create({
    data: {
      slug: base,
      nameAr: `${sector.nameAr} (نسخة)`,
      nameEn: `${sector.nameEn} (Copy)`,
      summaryAr: String(fields.summaryAr || ''),
      summaryEn: String(fields.summaryEn || ''),
      bodyAr: String(fields.bodyAr || ''),
      bodyEn: String(fields.bodyEn || ''),
      iconPath: (fields.iconPath as string) || null,
      coverPath: (fields.coverPath as string) || null,
      galleryJson: String(fields.galleryJson || '[]'),
      videoPath: (fields.videoPath as string) || null,
      contactPhone: String(fields.contactPhone || ''),
      contactEmail: String(fields.contactEmail || ''),
      contactWhatsapp: String(fields.contactWhatsapp || ''),
      ctaLabelAr: String(fields.ctaLabelAr || 'طلب الخدمة'),
      ctaLabelEn: String(fields.ctaLabelEn || 'Request Service'),
      ctaUrl: String(fields.ctaUrl || '/contact'),
      seoTitleAr: String(fields.seoTitleAr || ''),
      seoTitleEn: String(fields.seoTitleEn || ''),
      seoDescAr: String(fields.seoDescAr || ''),
      seoDescEn: String(fields.seoDescEn || ''),
      sortOrder: sector.sortOrder + 1,
      showInHome: false,
      showInNav: false,
      status: 'DRAFT',
      pageId: page.id,
      draftJson: null,
    },
  });
  await logActivity({
    userId: req.user?.id,
    action: 'duplicate_sector',
    resource: 'sector',
    resourceId: created.id,
    meta: { from: sector.slug, to: created.slug },
  });
  res.status(201).json({ sector: await loadSector(created.id) });
});

sectorsRouter.post('/:id/publish', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  const draft = parseDraft(sector);
  const merged = { ...resolveSectorFields(sector, false), ...draft };

  await prisma.sectorVersion.create({
    data: {
      sectorId: sector.id,
      label: `Publish ${new Date().toISOString()}`,
      snapshot: snapshotSector(sector),
      userId: req.user?.id,
    },
  });

  await prisma.sector.update({
    where: { id: sector.id },
    data: {
      nameAr: String(merged.nameAr || sector.nameAr),
      nameEn: String(merged.nameEn || sector.nameEn),
      summaryAr: String(merged.summaryAr || ''),
      summaryEn: String(merged.summaryEn || ''),
      bodyAr: String(merged.bodyAr || ''),
      bodyEn: String(merged.bodyEn || ''),
      iconPath: (merged.iconPath as string) || null,
      coverPath: (merged.coverPath as string) || null,
      galleryJson: String(merged.galleryJson || '[]'),
      videoPath: (merged.videoPath as string) || null,
      contactPhone: String(merged.contactPhone || ''),
      contactEmail: String(merged.contactEmail || ''),
      contactWhatsapp: String(merged.contactWhatsapp || ''),
      ctaLabelAr: String(merged.ctaLabelAr || 'طلب الخدمة'),
      ctaLabelEn: String(merged.ctaLabelEn || 'Request Service'),
      ctaUrl: String(merged.ctaUrl || '/contact'),
      seoTitleAr: String(merged.seoTitleAr || ''),
      seoTitleEn: String(merged.seoTitleEn || ''),
      seoDescAr: String(merged.seoDescAr || ''),
      seoDescEn: String(merged.seoDescEn || ''),
      sortOrder: Number(merged.sortOrder ?? sector.sortOrder),
      showInHome: Boolean(merged.showInHome ?? sector.showInHome),
      showInNav: Boolean(merged.showInNav ?? sector.showInNav),
      draftJson: null,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  if (sector.pageId) {
    await prisma.page.update({ where: { id: sector.pageId }, data: { status: 'PUBLISHED' } });
  }

  await publishSectorMedia(sector.id);

  await logActivity({
    userId: req.user?.id,
    action: 'publish_sector',
    resource: 'sector',
    resourceId: sector.id,
    meta: { slug: sector.slug },
  });

  res.json({ sector: await loadSector(sector.id) });
});

sectorsRouter.post('/:id/unpublish', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  await prisma.sector.update({ where: { id: sector.id }, data: { status: 'DRAFT' } });
  if (sector.pageId) {
    await prisma.page.update({ where: { id: sector.pageId }, data: { status: 'DRAFT' } });
  }
  await logActivity({
    userId: req.user?.id,
    action: 'unpublish_sector',
    resource: 'sector',
    resourceId: sector.id,
  });
  res.json({ sector: await loadSector(sector.id) });
});

sectorsRouter.post('/:id/archive', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  await prisma.sector.update({
    where: { id: sector.id },
    data: { status: 'ARCHIVED', showInHome: false, showInNav: false },
  });
  await logActivity({
    userId: req.user?.id,
    action: 'archive_sector',
    resource: 'sector',
    resourceId: sector.id,
  });
  res.json({ sector: await loadSector(sector.id) });
});

sectorsRouter.post('/:id/restore/:versionId', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  const version = await prisma.sectorVersion.findFirst({
    where: { id: req.params.versionId, sectorId: sector.id },
  });
  if (!version) {
    res.status(404).json({ error: 'Version not found' });
    return;
  }
  let snap: Record<string, unknown>;
  try {
    snap = JSON.parse(version.snapshot);
  } catch {
    res.status(400).json({ error: 'Invalid snapshot' });
    return;
  }
  const editable = pickEditable(snap);
  await prisma.sectorVersion.create({
    data: {
      sectorId: sector.id,
      label: `Before restore ${new Date().toISOString()}`,
      snapshot: snapshotSector(sector),
      userId: req.user?.id,
    },
  });
  await prisma.sector.update({
    where: { id: sector.id },
    data: {
      ...editable,
      draftJson: JSON.stringify(editable),
    },
  });
  await logActivity({
    userId: req.user?.id,
    action: 'restore_sector_version',
    resource: 'sector',
    resourceId: sector.id,
    meta: { versionId: version.id },
  });
  res.json({ sector: await loadSector(sector.id) });
});

sectorsRouter.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await loadSector(req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'Sector not found' });
    return;
  }
  const linkedServices = sector.services?.length || 0;
  const linkedProjects = sector.projects?.length || 0;
  if (linkedServices || linkedProjects) {
    res.status(409).json({
      error: 'Sector has linked services or projects. Reassign or unlink them, or archive instead of deleting.',
      linkedServices,
      linkedProjects,
    });
    return;
  }
  const pageId = sector.pageId;
  await prisma.sector.delete({ where: { id: sector.id } });
  if (pageId) {
    await prisma.page.delete({ where: { id: pageId } }).catch(() => undefined);
  }
  await logActivity({
    userId: req.user?.id,
    action: 'delete_sector',
    resource: 'sector',
    resourceId: sector.id,
  });
  res.json({ ok: true });
});
