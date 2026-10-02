import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';

export const servicesCmsRouter = Router();

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(raw: string) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const bodySchema = z.object({
  slug: z.string().min(1).optional(),
  nameAr: z.string().min(1),
  nameEn: z.string().min(1),
  summaryAr: z.string().optional(),
  summaryEn: z.string().optional(),
  bodyAr: z.string().optional(),
  bodyEn: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sortOrder: z.number().int().optional(),
  imagePath: z.string().nullable().optional(),
  sectorId: z.string().nullable().optional(),
});

servicesCmsRouter.use(requireAuth);

servicesCmsRouter.get('/', async (_req, res) => {
  const services = await prisma.service.findMany({
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: { sector: { select: { id: true, slug: true, nameAr: true, nameEn: true, status: true } } },
  });
  res.json({ services });
});

servicesCmsRouter.get('/:id', async (req, res) => {
  const service = await prisma.service.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
    include: { sector: { select: { id: true, slug: true, nameAr: true, nameEn: true, status: true } } },
  });
  if (!service) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ service });
});

servicesCmsRouter.post('/', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const data = parsed.data;
  const slug = normalizeSlug(data.slug || data.nameEn || data.nameAr);
  if (!slugRe.test(slug)) {
    res.status(400).json({ error: 'Invalid slug' });
    return;
  }
  const existing = await prisma.service.findUnique({ where: { slug } });
  if (existing) {
    res.status(409).json({ error: 'Slug already exists' });
    return;
  }
  const service = await prisma.service.create({
    data: {
      slug,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      summaryAr: data.summaryAr || '',
      summaryEn: data.summaryEn || '',
      bodyAr: data.bodyAr || '',
      bodyEn: data.bodyEn || '',
      status: data.status || 'DRAFT',
      sortOrder: data.sortOrder ?? 0,
      imagePath: data.imagePath ?? null,
      sectorId: data.sectorId ?? null,
    },
    include: { sector: { select: { id: true, slug: true, nameAr: true, nameEn: true } } },
  });
  await logActivity({
    userId: req.user?.id,
    action: 'service.create',
    resource: 'service',
    resourceId: service.id,
    meta: { slug },
  });
  res.json({ service });
});

servicesCmsRouter.put('/:id', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const current = await prisma.service.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!current) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const data = parsed.data;
  let slug = current.slug;
  if (data.slug) {
    slug = normalizeSlug(data.slug);
    if (!slugRe.test(slug)) {
      res.status(400).json({ error: 'Invalid slug' });
      return;
    }
    if (slug !== current.slug) {
      const clash = await prisma.service.findUnique({ where: { slug } });
      if (clash) {
        res.status(409).json({ error: 'Slug already exists' });
        return;
      }
    }
  }
  const service = await prisma.service.update({
    where: { id: current.id },
    data: {
      ...(data.nameAr !== undefined ? { nameAr: data.nameAr } : {}),
      ...(data.nameEn !== undefined ? { nameEn: data.nameEn } : {}),
      ...(data.summaryAr !== undefined ? { summaryAr: data.summaryAr } : {}),
      ...(data.summaryEn !== undefined ? { summaryEn: data.summaryEn } : {}),
      ...(data.bodyAr !== undefined ? { bodyAr: data.bodyAr } : {}),
      ...(data.bodyEn !== undefined ? { bodyEn: data.bodyEn } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.imagePath !== undefined ? { imagePath: data.imagePath } : {}),
      ...(data.sectorId !== undefined ? { sectorId: data.sectorId } : {}),
      slug,
    },
    include: { sector: { select: { id: true, slug: true, nameAr: true, nameEn: true } } },
  });
  await logActivity({
    userId: req.user?.id,
    action: 'service.update',
    resource: 'service',
    resourceId: service.id,
  });
  res.json({ service });
});

servicesCmsRouter.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const current = await prisma.service.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!current) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await prisma.service.delete({ where: { id: current.id } });
  await logActivity({
    userId: req.user?.id,
    action: 'service.delete',
    resource: 'service',
    resourceId: current.id,
    meta: { slug: current.slug },
  });
  res.json({ ok: true });
});
