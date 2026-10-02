import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';

export const projectsRouter = Router();

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
  categoryAr: z.string().optional(),
  categoryEn: z.string().optional(),
  locationAr: z.string().optional(),
  locationEn: z.string().optional(),
  featured: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  sortOrder: z.number().int().optional(),
  imagePath: z.string().nullable().optional(),
  sectorId: z.string().nullable().optional(),
});

projectsRouter.use(requireAuth);

projectsRouter.get('/', async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: { sector: { select: { id: true, slug: true, nameAr: true, nameEn: true, status: true } } },
  });
  res.json({ projects });
});

projectsRouter.get('/:id', async (req, res) => {
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
    include: { sector: { select: { id: true, slug: true, nameAr: true, nameEn: true, status: true } } },
  });
  if (!project) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ project });
});

projectsRouter.post('/', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
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
  const existing = await prisma.project.findUnique({ where: { slug } });
  if (existing) {
    res.status(409).json({ error: 'Slug already exists' });
    return;
  }
  const project = await prisma.project.create({
    data: {
      slug,
      nameAr: data.nameAr,
      nameEn: data.nameEn,
      summaryAr: data.summaryAr || '',
      summaryEn: data.summaryEn || '',
      categoryAr: data.categoryAr || '',
      categoryEn: data.categoryEn || '',
      locationAr: data.locationAr || '',
      locationEn: data.locationEn || '',
      featured: data.featured ?? false,
      status: data.status || 'DRAFT',
      sortOrder: data.sortOrder ?? 0,
      imagePath: data.imagePath ?? null,
      sectorId: data.sectorId ?? null,
    },
    include: { sector: { select: { id: true, slug: true, nameAr: true, nameEn: true } } },
  });
  await logActivity({
    userId: req.user?.id,
    action: 'project.create',
    resource: 'project',
    resourceId: project.id,
    meta: { slug },
  });
  res.json({ project });
});

projectsRouter.put('/:id', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  const current = await prisma.project.findFirst({
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
      const clash = await prisma.project.findUnique({ where: { slug } });
      if (clash) {
        res.status(409).json({ error: 'Slug already exists' });
        return;
      }
    }
  }
  const project = await prisma.project.update({
    where: { id: current.id },
    data: {
      ...(data.nameAr !== undefined ? { nameAr: data.nameAr } : {}),
      ...(data.nameEn !== undefined ? { nameEn: data.nameEn } : {}),
      ...(data.summaryAr !== undefined ? { summaryAr: data.summaryAr } : {}),
      ...(data.summaryEn !== undefined ? { summaryEn: data.summaryEn } : {}),
      ...(data.categoryAr !== undefined ? { categoryAr: data.categoryAr } : {}),
      ...(data.categoryEn !== undefined ? { categoryEn: data.categoryEn } : {}),
      ...(data.locationAr !== undefined ? { locationAr: data.locationAr } : {}),
      ...(data.locationEn !== undefined ? { locationEn: data.locationEn } : {}),
      ...(data.featured !== undefined ? { featured: data.featured } : {}),
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
    action: 'project.update',
    resource: 'project',
    resourceId: project.id,
  });
  res.json({ project });
});

projectsRouter.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const current = await prisma.project.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }] },
  });
  if (!current) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await prisma.project.delete({ where: { id: current.id } });
  await logActivity({
    userId: req.user?.id,
    action: 'project.delete',
    resource: 'project',
    resourceId: current.id,
    meta: { slug: current.slug },
  });
  res.json({ ok: true });
});
