import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

const uploadsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(uploadsRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsRoot),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'video/mp4' ||
      file.mimetype === 'video/webm';
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

mediaRouter.get('/', async (_req, res) => {
  const items = await prisma.media.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ items });
});

mediaRouter.post('/', requireRole('EDITOR', 'ADMIN', 'SUPER_ADMIN'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  const kind = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  const item = await prisma.media.create({
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
      kind,
      altAr: String(req.body.altAr || ''),
      altEn: String(req.body.altEn || ''),
    },
  });
  await logActivity({
    userId: req.user?.id,
    action: 'upload_media',
    resource: 'media',
    resourceId: item.id,
  });
  res.status(201).json({ item });
});
