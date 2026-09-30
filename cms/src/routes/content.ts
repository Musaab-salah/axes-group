import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';

export const contentRouter = Router();

contentRouter.use(requireAuth);

contentRouter.get('/pages', async (_req, res) => {
  const pages = await prisma.page.findMany({
    orderBy: { slug: 'asc' },
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

contentRouter.get('/dashboard', async (_req, res) => {
  const [publishedPages, draftPages, projects, services, images, videos, inquiries, activities] =
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
