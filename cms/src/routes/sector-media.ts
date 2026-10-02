import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { SECTOR_MEDIA_ROLES, isSectorMediaRole } from '../lib/media-utils.js';

export const sectorMediaRouter = Router({ mergeParams: true });

const attachmentSchema = z.object({
  mediaId: z.string().min(1),
  role: z.enum(SECTOR_MEDIA_ROLES).default('gallery'),
  sortOrder: z.number().int().optional(),
  titleAr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  altAr: z.string().optional(),
  altEn: z.string().optional(),
  showCaptions: z.boolean().optional(),
  posterMediaId: z.string().nullable().optional(),
});

async function getSector(idOrSlug: string) {
  return (
    (await prisma.sector.findUnique({ where: { id: idOrSlug } })) ||
    (await prisma.sector.findUnique({ where: { slug: idOrSlug } }))
  );
}

function includeMedia() {
  return {
    media: true,
    posterMedia: true,
  } as const;
}

sectorMediaRouter.use(requireAuth);

sectorMediaRouter.get('/', async (req, res) => {
  const sector = await getSector(req.params.sectorId || req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'القطاع غير موجود' });
    return;
  }
  const layer = req.query.layer === 'published' ? 'published' : 'draft';
  const items = await prisma.sectorMedia.findMany({
    where: { sectorId: sector.id, layer },
    orderBy: { sortOrder: 'asc' },
    include: includeMedia(),
  });
  res.json({ items, sectorId: sector.id, layer });
});

sectorMediaRouter.post('/', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await getSector(req.params.sectorId || req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'القطاع غير موجود' });
    return;
  }
  const parsed = attachmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صالحة', details: parsed.error.flatten() });
    return;
  }
  const media = await prisma.media.findUnique({ where: { id: parsed.data.mediaId } });
  if (!media) {
    res.status(404).json({ error: 'الملف غير موجود في المكتبة' });
    return;
  }
  if (parsed.data.role === 'intro_video' && media.kind !== 'video') {
    res.status(400).json({ error: 'الفيديو التعريفي يجب أن يكون ملف فيديو' });
    return;
  }
  if ((parsed.data.role === 'cover' || parsed.data.role === 'main' || parsed.data.role === 'gallery') && media.kind === 'video' && parsed.data.role !== 'gallery') {
    // cover/main should be images; gallery can be image (video as gallery item rare — allow only intro_video for video)
    if (parsed.data.role === 'cover' || parsed.data.role === 'main') {
      res.status(400).json({ error: 'غلاف القطاع والصورة الرئيسية يجب أن تكون صورًا' });
      return;
    }
  }

  const max = await prisma.sectorMedia.aggregate({
    where: { sectorId: sector.id, layer: 'draft' },
    _max: { sortOrder: true },
  });

  // Unique cover/main/intro_video: demote previous
  if (parsed.data.role === 'cover' || parsed.data.role === 'main' || parsed.data.role === 'intro_video') {
    await prisma.sectorMedia.updateMany({
      where: { sectorId: sector.id, layer: 'draft', role: parsed.data.role },
      data: { role: 'gallery' },
    });
  }

  const item = await prisma.sectorMedia.create({
    data: {
      sectorId: sector.id,
      mediaId: parsed.data.mediaId,
      role: parsed.data.role,
      sortOrder: parsed.data.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      layer: 'draft',
      titleAr: parsed.data.titleAr ?? media.titleAr,
      titleEn: parsed.data.titleEn ?? media.titleEn,
      descriptionAr: parsed.data.descriptionAr ?? media.descriptionAr,
      descriptionEn: parsed.data.descriptionEn ?? media.descriptionEn,
      altAr: parsed.data.altAr ?? media.altAr,
      altEn: parsed.data.altEn ?? media.altEn,
      showCaptions: parsed.data.showCaptions ?? true,
      posterMediaId: parsed.data.posterMediaId ?? null,
    },
    include: includeMedia(),
  });

  await logActivity({
    userId: req.user?.id,
    action: 'attach_sector_media',
    resource: 'sector_media',
    resourceId: item.id,
    meta: { sectorId: sector.id, role: item.role },
  });

  res.status(201).json({ item });
});

sectorMediaRouter.put('/reorder', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await getSector(req.params.sectorId || req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'القطاع غير موجود' });
    return;
  }
  const parsed = z.object({ ids: z.array(z.string()).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صالحة' });
    return;
  }
  let i = 0;
  for (const id of parsed.data.ids) {
    await prisma.sectorMedia.updateMany({
      where: { id, sectorId: sector.id, layer: 'draft' },
      data: { sortOrder: i++ },
    });
  }
  res.json({ ok: true });
});

sectorMediaRouter.put('/:attachmentId', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await getSector(req.params.sectorId || req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'القطاع غير موجود' });
    return;
  }
  const existing = await prisma.sectorMedia.findFirst({
    where: { id: req.params.attachmentId, sectorId: sector.id, layer: 'draft' },
  });
  if (!existing) {
    res.status(404).json({ error: 'العنصر غير موجود في مسودة القطاع' });
    return;
  }
  const parsed = attachmentSchema.partial().extend({ mediaId: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صالحة' });
    return;
  }
  if (parsed.data.role && !isSectorMediaRole(parsed.data.role)) {
    res.status(400).json({ error: 'دور غير صالح' });
    return;
  }
  if (parsed.data.role === 'cover' || parsed.data.role === 'main' || parsed.data.role === 'intro_video') {
    await prisma.sectorMedia.updateMany({
      where: {
        sectorId: sector.id,
        layer: 'draft',
        role: parsed.data.role,
        NOT: { id: existing.id },
      },
      data: { role: 'gallery' },
    });
  }

  // Replace media file without deleting library original
  if (parsed.data.mediaId && parsed.data.mediaId !== existing.mediaId) {
    const media = await prisma.media.findUnique({ where: { id: parsed.data.mediaId } });
    if (!media) {
      res.status(404).json({ error: 'الملف البديل غير موجود' });
      return;
    }
  }

  const item = await prisma.sectorMedia.update({
    where: { id: existing.id },
    data: {
      mediaId: parsed.data.mediaId,
      role: parsed.data.role,
      sortOrder: parsed.data.sortOrder,
      titleAr: parsed.data.titleAr,
      titleEn: parsed.data.titleEn,
      descriptionAr: parsed.data.descriptionAr,
      descriptionEn: parsed.data.descriptionEn,
      altAr: parsed.data.altAr,
      altEn: parsed.data.altEn,
      showCaptions: parsed.data.showCaptions,
      posterMediaId: parsed.data.posterMediaId === undefined ? undefined : parsed.data.posterMediaId,
    },
    include: includeMedia(),
  });
  res.json({ item });
});

sectorMediaRouter.delete('/:attachmentId', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const sector = await getSector(req.params.sectorId || req.params.id);
  if (!sector) {
    res.status(404).json({ error: 'القطاع غير موجود' });
    return;
  }
  const existing = await prisma.sectorMedia.findFirst({
    where: { id: req.params.attachmentId, sectorId: sector.id, layer: 'draft' },
  });
  if (!existing) {
    res.status(404).json({ error: 'العنصر غير موجود' });
    return;
  }
  await prisma.sectorMedia.delete({ where: { id: existing.id } });
  await logActivity({
    userId: req.user?.id,
    action: 'detach_sector_media',
    resource: 'sector_media',
    resourceId: existing.id,
    meta: { sectorId: sector.id, mediaId: existing.mediaId },
  });
  res.json({ ok: true });
});

/** Promote draft media attachments to published layer; mark used Media as public. */
export async function publishSectorMedia(sectorId: string) {
  const drafts = await prisma.sectorMedia.findMany({
    where: { sectorId, layer: 'draft' },
    orderBy: { sortOrder: 'asc' },
  });
  await prisma.sectorMedia.deleteMany({ where: { sectorId, layer: 'published' } });
  for (const d of drafts) {
    await prisma.sectorMedia.create({
      data: {
        sectorId,
        mediaId: d.mediaId,
        role: d.role,
        sortOrder: d.sortOrder,
        layer: 'published',
        titleAr: d.titleAr,
        titleEn: d.titleEn,
        descriptionAr: d.descriptionAr,
        descriptionEn: d.descriptionEn,
        altAr: d.altAr,
        altEn: d.altEn,
        showCaptions: d.showCaptions,
        posterMediaId: d.posterMediaId,
      },
    });
  }
  const mediaIds = [
    ...new Set(drafts.flatMap((d) => [d.mediaId, d.posterMediaId].filter(Boolean) as string[])),
  ];
  if (mediaIds.length) {
    await prisma.media.updateMany({ where: { id: { in: mediaIds } }, data: { isDraft: false } });
  }

  // Keep legacy path fields in sync for older templates/home cards
  const cover = drafts.find((d) => d.role === 'cover') || drafts.find((d) => d.role === 'main');
  const video = drafts.find((d) => d.role === 'intro_video');
  const gallery = drafts.filter((d) => d.role === 'gallery');
  const coverMedia = cover ? await prisma.media.findUnique({ where: { id: cover.mediaId } }) : null;
  const videoMedia = video ? await prisma.media.findUnique({ where: { id: video.mediaId } }) : null;
  const galleryPaths = [];
  for (const g of gallery) {
    const m = await prisma.media.findUnique({ where: { id: g.mediaId } });
    if (m) galleryPaths.push(m.path);
  }
  await prisma.sector.update({
    where: { id: sectorId },
    data: {
      coverPath: coverMedia?.path || null,
      videoPath: videoMedia?.path || null,
      galleryJson: JSON.stringify(galleryPaths),
    },
  });
}

export async function loadSectorMedia(sectorId: string, layer: 'draft' | 'published') {
  return prisma.sectorMedia.findMany({
    where: { sectorId, layer },
    orderBy: { sortOrder: 'asc' },
    include: { media: true, posterMedia: true },
  });
}
