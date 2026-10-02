import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';

export const contentRouter = Router();

contentRouter.use(requireAuth);

contentRouter.get('/pages', async (_req, res) => {
  const pages = await prisma.page.findMany({
    orderBy: [{ navSortOrder: 'asc' }, { slug: 'asc' }],
    include: { _count: { select: { blocks: true } } },
  });
  res.json({ pages });
});

contentRouter.get('/pages/:slug', async (req, res) => {
  const page = await prisma.page.findUnique({
    where: { slug: req.params.slug },
    include: { blocks: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  res.json({ page });
});

contentRouter.post('/pages/:slug/blocks', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = z
    .object({
      key: z.string().min(1),
      type: z.string().default('text'),
      draftAr: z.string().optional(),
      draftEn: z.string().optional(),
      valueAr: z.string().optional(),
      valueEn: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  const block = await prisma.contentBlock.upsert({
    where: { pageId_key: { pageId: page.id, key: parsed.data.key } },
    update: {
      type: parsed.data.type,
      draftAr: parsed.data.draftAr ?? parsed.data.valueAr,
      draftEn: parsed.data.draftEn ?? parsed.data.valueEn,
    },
    create: {
      pageId: page.id,
      key: parsed.data.key,
      type: parsed.data.type,
      valueAr: parsed.data.valueAr || '',
      valueEn: parsed.data.valueEn || '',
      draftAr: parsed.data.draftAr ?? parsed.data.valueAr,
      draftEn: parsed.data.draftEn ?? parsed.data.valueEn,
    },
  });
  res.status(201).json({ block });
});

contentRouter.put('/blocks/:id', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = z
    .object({
      draftAr: z.string().optional(),
      draftEn: z.string().optional(),
      valueAr: z.string().optional(),
      valueEn: z.string().optional(),
      type: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const block = await prisma.contentBlock.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  await logActivity({
    userId: req.user?.id,
    action: 'update_block',
    resource: 'content_block',
    resourceId: block.id,
    meta: { key: block.key },
  });
  res.json({ block });
});

contentRouter.post('/pages/:slug/publish', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const page = await prisma.page.findUnique({
    where: { slug: req.params.slug },
    include: { blocks: true },
  });
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  await prisma.contentVersion.create({
    data: {
      pageId: page.id,
      label: `Publish ${new Date().toISOString()}`,
      snapshot: JSON.stringify(page.blocks),
      userId: req.user?.id,
    },
  });

  for (const block of page.blocks) {
    await prisma.contentBlock.update({
      where: { id: block.id },
      data: {
        valueAr: block.draftAr ?? block.valueAr,
        valueEn: block.draftEn ?? block.valueEn,
        draftAr: null,
        draftEn: null,
      },
    });
  }

  const updated = await prisma.page.update({
    where: { id: page.id },
    data: { status: 'PUBLISHED' },
    include: { blocks: { orderBy: { sortOrder: 'asc' } } },
  });

  await writePublicContentBundle();

  await logActivity({
    userId: req.user?.id,
    action: 'publish_page',
    resource: 'page',
    resourceId: page.id,
    meta: { slug: page.slug },
  });

  res.json({ page: updated });
});

contentRouter.put('/pages/:slug', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  const parsed = z
    .object({
      titleAr: z.string().optional(),
      titleEn: z.string().optional(),
      navLabelAr: z.string().optional(),
      navLabelEn: z.string().optional(),
      showInHeader: z.boolean().optional(),
      showInFooter: z.boolean().optional(),
      navSortOrder: z.number().int().optional(),
      slug: z.string().min(1).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  let nextSlug = page.slug;
  if (parsed.data.slug && parsed.data.slug !== page.slug) {
    const newSlug = parsed.data.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!newSlug) {
      res.status(400).json({ error: 'رابط غير صالح' });
      return;
    }
    if (page.isHome || page.slug === 'home') {
      res.status(400).json({ error: 'لا يمكن تغيير رابط الصفحة الرئيسية' });
      return;
    }
    const clash = await prisma.page.findUnique({ where: { slug: newSlug } });
    if (clash) {
      res.status(409).json({ error: 'الرابط مستخدم مسبقًا' });
      return;
    }
    const { pathForPage } = await import('../lib/navigation.js');
    const fromPath = pathForPage(page.slug);
    const toPath = pathForPage(newSlug);
    await prisma.pageRedirect.upsert({
      where: { fromPath },
      update: { toPath },
      create: { fromPath, toPath },
    });
    await prisma.navItem.updateMany({
      where: { pageId: page.id },
      data: { href: toPath },
    });
    nextSlug = newSlug;
  }

  const updated = await prisma.page.update({
    where: { id: page.id },
    data: {
      slug: nextSlug,
      titleAr: parsed.data.titleAr,
      titleEn: parsed.data.titleEn,
      navLabelAr: parsed.data.navLabelAr,
      navLabelEn: parsed.data.navLabelEn,
      showInHeader: parsed.data.showInHeader,
      showInFooter: parsed.data.showInFooter,
      navSortOrder: parsed.data.navSortOrder,
    },
  });

  // Sync draft nav labels/flags for linked items
  const navPatch: Record<string, unknown> = {};
  if (parsed.data.navLabelAr !== undefined) navPatch.labelAr = parsed.data.navLabelAr;
  if (parsed.data.navLabelEn !== undefined) navPatch.labelEn = parsed.data.navLabelEn;
  if (parsed.data.showInHeader !== undefined) navPatch.showInHeader = parsed.data.showInHeader;
  if (parsed.data.showInFooter !== undefined) navPatch.showInFooter = parsed.data.showInFooter;
  if (Object.keys(navPatch).length) {
    await prisma.navItem.updateMany({
      where: { pageId: page.id, layer: 'draft' },
      data: navPatch,
    });
  }

  res.json({ page: updated });
});

contentRouter.post('/pages/:slug/unpublish', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  if (page.isHome || page.slug === 'home') {
    const alt = await prisma.page.findFirst({
      where: { status: 'PUBLISHED', isHome: true, NOT: { id: page.id } },
    });
    const altHome = alt || (await prisma.page.findFirst({
      where: { status: 'PUBLISHED', slug: { not: page.slug }, showInHeader: true },
    }));
    if (!alt && page.isHome) {
      res.status(409).json({
        error: 'لا يمكن إلغاء نشر الصفحة الرئيسية قبل تعيين صفحة رئيسية بديلة منشورة.',
      });
      return;
    }
    void altHome;
  }

  const { pathForPage, findInboundLinksToPath } = await import('../lib/navigation.js');
  const path = pathForPage(page.slug);
  const warnings = await findInboundLinksToPath(path);
  if (req.query.confirm !== '1' && (warnings.contentBlocks.length || warnings.navItems.length)) {
    res.status(409).json({
      error: 'توجد روابط واردة إلى هذه الصفحة. أكّد الإلغاء بـ confirm=1',
      warnings,
    });
    return;
  }

  const updated = await prisma.page.update({
    where: { id: page.id },
    data: { status: 'DRAFT', isHome: false },
  });

  // Remove from published nav; keep in draft but hide
  await prisma.navItem.deleteMany({ where: { pageId: page.id, layer: 'published' } });
  await prisma.navItem.updateMany({
    where: { pageId: page.id, layer: 'draft' },
    data: { showInHeader: false, showInFooter: false },
  });

  await writePublicContentBundle();
  await logActivity({
    userId: req.user?.id,
    action: 'unpublish_page',
    resource: 'page',
    resourceId: page.id,
    meta: { slug: page.slug, warnings },
  });

  res.json({ page: updated, warnings });
});

contentRouter.delete('/pages/:slug', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }
  if (page.isHome || page.slug === 'home') {
    res.status(409).json({ error: 'لا يمكن حذف الصفحة الرئيسية قبل تعيين بديل منشور.' });
    return;
  }
  if (page.status === 'PUBLISHED') {
    res.status(409).json({ error: 'ألغِ نشر الصفحة قبل حذفها.' });
    return;
  }
  await prisma.navItem.deleteMany({ where: { pageId: page.id } });
  await prisma.page.delete({ where: { id: page.id } });
  res.json({ ok: true });
});

contentRouter.post('/pages/reorder', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = z.object({ ids: z.array(z.string()) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  let i = 0;
  for (const id of parsed.data.ids) {
    await prisma.page.update({ where: { id }, data: { navSortOrder: i++ } });
  }
  res.json({ ok: true });
});

contentRouter.get('/dashboard', async (_req, res) => {
  const [publishedPages, draftPages, projects, services, images, videos, inquiries, activities, publishedSectors, draftSectors] =
    await Promise.all([
      prisma.page.count({ where: { status: 'PUBLISHED' } }),
      prisma.page.count({ where: { status: 'DRAFT' } }),
      prisma.project.count(),
      prisma.service.count(),
      prisma.media.count({ where: { kind: 'image' } }),
      prisma.media.count({ where: { kind: 'video' } }),
      prisma.contactInquiry.count({ where: { read: false } }),
      prisma.activityLog.findMany({
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.sector.count({ where: { status: 'PUBLISHED' } }),
      prisma.sector.count({ where: { status: 'DRAFT' } }),
    ]);

  res.json({
    stats: {
      publishedPages,
      draftPages,
      projects,
      services,
      images,
      videos,
      unreadInquiries: inquiries,
      publishedSectors,
      draftSectors,
    },
    activities,
  });
});

async function writePublicContentBundle() {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../site/assets');
  const pages = await prisma.page.findMany({
    where: { status: 'PUBLISHED' },
    include: { blocks: true },
  });
  const bundle: Record<string, Record<string, { ar: string; en: string; type: string }>> = {};
  for (const page of pages) {
    bundle[page.slug] = {};
    for (const block of page.blocks) {
      bundle[page.slug][block.key] = {
        ar: block.valueAr,
        en: block.valueEn,
        type: block.type,
      };
    }
  }
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'cms-content.json'), JSON.stringify(bundle, null, 2), 'utf8');
}

export { writePublicContentBundle };
