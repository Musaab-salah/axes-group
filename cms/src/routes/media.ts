import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole, loadUserFromRequest } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  assertAllowedUpload,
  mediaLimits,
} from '../lib/media-utils.js';

export const mediaRouter = Router();

const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 40);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}${ext}`);
  },
});

const limits = mediaLimits();
const upload = multer({
  storage,
  limits: { fileSize: Math.max(limits.imageBytes, limits.videoBytes), files: 20 },
  fileFilter: (_req, file, cb) => {
    const ok = ALLOWED_IMAGE_MIME.has(file.mimetype) || ALLOWED_VIDEO_MIME.has(file.mimetype);
    cb(ok ? null : new Error('نوع الملف غير مدعوم. المسموح: JPG, PNG, WebP, MP4, WebM'), ok);
  },
});

mediaRouter.get('/limits', (_req, res) => {
  const l = mediaLimits();
  res.json({
    imageMb: l.imageMb,
    videoMb: l.videoMb,
    accept: 'image/jpeg,image/png,image/webp,video/mp4,video/webm',
  });
});

mediaRouter.use(requireAuth);

mediaRouter.get('/', async (_req, res) => {
  const items = await prisma.media.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

async function persistUploadedFile(
  file: Express.Multer.File,
  meta: { titleAr?: string; titleEn?: string; altAr?: string; altEn?: string; isDraft?: boolean },
  userId?: string,
) {
  let verified;
  try {
    verified = assertAllowedUpload(file.path, file.mimetype, file.size);
  } catch (e) {
    fs.unlinkSync(file.path);
    throw e;
  }
  const item = await prisma.media.create({
    data: {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: verified.mime,
      size: file.size,
      path: `/uploads/${file.filename}`,
      kind: verified.kind,
      isDraft: meta.isDraft !== false,
      titleAr: meta.titleAr || '',
      titleEn: meta.titleEn || '',
      altAr: meta.altAr || '',
      altEn: meta.altEn || '',
    },
  });
  await logActivity({
    userId,
    action: 'upload_media',
    resource: 'media',
    resourceId: item.id,
    meta: { kind: item.kind, isDraft: item.isDraft },
  });
  return item;
}

mediaRouter.post('/', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'فشل الرفع' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'لم يتم اختيار ملف' });
      return;
    }
    try {
      const item = await persistUploadedFile(
        req.file,
        {
          titleAr: String(req.body.titleAr || ''),
          titleEn: String(req.body.titleEn || ''),
          altAr: String(req.body.altAr || ''),
          altEn: String(req.body.altEn || ''),
          isDraft: req.body.isDraft !== '0' && req.body.isDraft !== 'false',
        },
        req.user?.id,
      );
      res.status(201).json({ item });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
});

mediaRouter.post('/batch', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), (req, res) => {
  upload.array('files', 20)(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || 'فشل الرفع' });
      return;
    }
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) {
      res.status(400).json({ error: 'لم يتم اختيار ملفات' });
      return;
    }
    const items = [];
    const errors: { name: string; error: string }[] = [];
    for (const file of files) {
      try {
        items.push(await persistUploadedFile(file, { isDraft: true }, req.user?.id));
      } catch (e) {
        errors.push({ name: file.originalname, error: (e as Error).message });
      }
    }
    res.status(items.length ? 201 : 400).json({ items, errors });
  });
});

mediaRouter.put('/:id', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const parsed = z
    .object({
      titleAr: z.string().optional(),
      titleEn: z.string().optional(),
      descriptionAr: z.string().optional(),
      descriptionEn: z.string().optional(),
      altAr: z.string().optional(),
      altEn: z.string().optional(),
      posterPath: z.string().nullable().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'بيانات غير صالحة' });
    return;
  }
  const item = await prisma.media.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ item });
});

mediaRouter.delete('/:id', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
  const item = await prisma.media.findUnique({ where: { id: req.params.id } });
  if (!item) {
    res.status(404).json({ error: 'الملف غير موجود' });
    return;
  }

  const publishedUse = await prisma.sectorMedia.count({
    where: { mediaId: item.id, layer: 'published' },
  });
  const posterUse = await prisma.sectorMedia.count({
    where: { posterMediaId: item.id, layer: 'published' },
  });
  if (publishedUse || posterUse) {
    res.status(409).json({
      error: 'لا يمكن حذف ملف مستخدم في محتوى منشور. أزله من القطاعات المنشورة أولًا أو استبدله.',
      publishedUse,
      posterUse,
    });
    return;
  }

  // Also block if path appears in published content blocks
  const publishedBlocks = await prisma.contentBlock.findMany({
    where: {
      OR: [{ valueAr: item.path }, { valueEn: item.path }],
      page: { status: 'PUBLISHED' },
    },
    take: 1,
  });
  if (publishedBlocks.length) {
    res.status(409).json({ error: 'الملف مستخدم في صفحة منشورة ولا يمكن حذفه.' });
    return;
  }

  await prisma.sectorMedia.deleteMany({ where: { OR: [{ mediaId: item.id }, { posterMediaId: item.id }] } });
  await prisma.media.delete({ where: { id: item.id } });
  const abs = path.join(uploadsRoot, item.filename);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);

  await logActivity({
    userId: req.user?.id,
    action: 'delete_media',
    resource: 'media',
    resourceId: item.id,
  });
  res.json({ ok: true });
});

/** Gate draft uploads — only authenticated staff can fetch draft files. */
export async function serveUpload(req: import('express').Request, res: import('express').Response) {
  const filename = path.basename(req.params.filename || '');
  if (!filename || filename.includes('..')) {
    res.status(400).send('Bad request');
    return;
  }
  const abs = path.join(uploadsRoot, filename);
  if (!fs.existsSync(abs)) {
    res.status(404).send('Not found');
    return;
  }
  const item = await prisma.media.findFirst({ where: { filename } });
  if (item?.isDraft) {
    const user = await loadUserFromRequest(req);
    if (!user) {
      res.status(401).send('Unauthorized');
      return;
    }
  }
  res.sendFile(abs);
}

export { uploadsRoot };
