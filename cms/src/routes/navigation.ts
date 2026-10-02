import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import {
  buildNavTree,
  loadNavLayer,
  pathForPage,
  publishNavigation,
  resolveNavHref,
  resolveServiceHref,
  pathForSector,
} from '../lib/navigation.js';

export const navRouter = Router();
navRouter.use(requireAuth);

const itemSchema = z.object({
  targetType: z.enum(['page', 'sector', 'service', 'custom']),
  pageId: z.string().nullable().optional(),
  sectorId: z.string().nullable().optional(),
  serviceId: z.string().nullable().optional(),
  href: z.string().optional(),
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
  showInHeader: z.boolean().optional(),
  showInFooter: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  parentId: z.string().nullable().optional(),
});

navRouter.get('/', async (req, res) => {
  const layer = req.query.layer === 'published' ? 'published' : 'draft';
  const items = await loadNavLayer(layer);
  for (const item of items) item.href = await resolveNavHref(item);
  res.json({
    items,
    tree: buildNavTree(items),
    headerPreview: buildNavTree(items, { header: true }),
    footerPreview: buildNavTree(items, { footer: true }),
  });
});

navRouter.get('/catalog', async (_req, res) => {
  const [pages, sectors, services] = await Promise.all([
    prisma.page.findMany({
      orderBy: { navSortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        titleAr: true,
        titleEn: true,
        navLabelAr: true,
        navLabelEn: true,
        status: true,
        showInHeader: true,
        showInFooter: true,
        isHome: true,
        template: true,
      },
    }),
    prisma.sector.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, slug: true, nameAr: true, nameEn: true, status: true },
    }),
    prisma.service.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        nameAr: true,
        nameEn: true,
        status: true,
        sectorId: true,
        sector: { select: { slug: true, status: true } },
      },
    }),
  ]);
  res.json({
    pages: pages.map((p) => ({ ...p, href: pathForPage(p.slug) })),
    sectors: sectors.map((s) => ({ ...s, href: pathForSector(s.slug) })),
    services: services.map((s) => ({
      ...s,
      href: resolveServiceHref(s.slug, s.sector?.status === 'PUBLISHED' ? s.sector.slug : null),
    })),
  });
});

navRouter.post('/items', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صالحة' });
    return;
  }
  const data = parsed.data;
  let href = data.href || '/';
  if (data.targetType === 'page' && data.pageId) {
    const page = await prisma.page.findUnique({ where: { id: data.pageId } });
    if (!page) {
      res.status(404).json({ error: 'الصفحة غير موجودة' });
      return;
    }
    href = pathForPage(page.slug);
  } else if (data.targetType === 'sector' && data.sectorId) {
    const sector = await prisma.sector.findUnique({ where: { id: data.sectorId } });
    if (!sector) {
      res.status(404).json({ error: 'القطاع غير موجود' });
      return;
    }
    href = pathForSector(sector.slug);
  } else if (data.targetType === 'service' && data.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
      include: { sector: { select: { slug: true, status: true } } },
    });
    if (!service) {
      res.status(404).json({ error: 'الخدمة غير موجودة' });
      return;
    }
    href = resolveServiceHref(service.slug, service.sector?.status === 'PUBLISHED' ? service.sector.slug : null);
  }

  const max = await prisma.navItem.aggregate({
    where: { layer: 'draft', parentId: data.parentId || null },
    _max: { sortOrder: true },
  });

  const item = await prisma.navItem.create({
    data: {
      layer: 'draft',
      targetType: data.targetType,
      pageId: data.pageId || null,
      sectorId: data.sectorId || null,
      serviceId: data.serviceId || null,
      href,
      labelAr: data.labelAr,
      labelEn: data.labelEn,
      showInHeader: data.showInHeader ?? true,
      showInFooter: data.showInFooter ?? false,
      sortOrder: data.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      parentId: data.parentId || null,
    },
  });
  res.status(201).json({ item });
});

navRouter.put('/items/reorder', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = z
    .object({
      items: z.array(
        z.object({
          id: z.string(),
          sortOrder: z.number().int(),
          parentId: z.string().nullable().optional(),
        }),
      ),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صالحة' });
    return;
  }
  for (const row of parsed.data.items) {
    await prisma.navItem.updateMany({
      where: { id: row.id, layer: 'draft' },
      data: {
        sortOrder: row.sortOrder,
        parentId: row.parentId === undefined ? undefined : row.parentId,
      },
    });
  }
  res.json({ ok: true });
});

navRouter.put('/items/:id', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const existing = await prisma.navItem.findFirst({ where: { id: req.params.id, layer: 'draft' } });
  if (!existing) {
    res.status(404).json({ error: 'عنصر القائمة غير موجود' });
    return;
  }
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صالحة' });
    return;
  }
  const data = parsed.data;
  const next = { ...existing, ...data };
  const href = await resolveNavHref(next);
  const item = await prisma.navItem.update({
    where: { id: existing.id },
    data: {
      targetType: data.targetType,
      pageId: data.pageId,
      sectorId: data.sectorId,
      serviceId: data.serviceId,
      href,
      labelAr: data.labelAr,
      labelEn: data.labelEn,
      showInHeader: data.showInHeader,
      showInFooter: data.showInFooter,
      sortOrder: data.sortOrder,
      parentId: data.parentId === undefined ? undefined : data.parentId,
    },
  });
  res.json({ item });
});

navRouter.delete('/items/:id', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const existing = await prisma.navItem.findFirst({ where: { id: req.params.id, layer: 'draft' } });
  if (!existing) {
    res.status(404).json({ error: 'عنصر القائمة غير موجود' });
    return;
  }
  await prisma.navItem.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

navRouter.post('/publish', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  await publishNavigation();
  await logActivity({
    userId: req.user?.id,
    action: 'publish_navigation',
    resource: 'navigation',
  });
  const items = await loadNavLayer('published');
  res.json({ ok: true, tree: buildNavTree(items) });
});

navRouter.post('/reset-from-pages', requireRole('ADMIN', 'SUPER_ADMIN'), async (_req, res) => {
  // Rebuild draft nav from page flags — optional helper
  res.status(501).json({ error: 'Use migrate script' });
});
