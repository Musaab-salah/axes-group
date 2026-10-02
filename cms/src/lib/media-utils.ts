import fs from 'node:fs';
import path from 'node:path';

export const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm']);

export function mediaLimits() {
  const imageMb = Number(process.env.MEDIA_MAX_IMAGE_MB || 12);
  const videoMb = Number(process.env.MEDIA_MAX_VIDEO_MB || 200);
  return {
    imageBytes: Math.max(1, imageMb) * 1024 * 1024,
    videoBytes: Math.max(1, videoMb) * 1024 * 1024,
    imageMb,
    videoMb,
  };
}

export function detectKindFromMime(mime: string): 'image' | 'video' | null {
  if (ALLOWED_IMAGE_MIME.has(mime)) return 'image';
  if (ALLOWED_VIDEO_MIME.has(mime)) return 'video';
  return null;
}

/** Sniff real file type from magic bytes (more reliable than client MIME). */
export function sniffMime(filePath: string): string | null {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(16);
  try {
    fs.readSync(fd, buf, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // WEBP: RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  // MP4 / ISO BMFF: ....ftyp
  if (buf.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
  // WebM: EBML
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  return null;
}

export function assertAllowedUpload(filePath: string, declaredMime: string, size: number) {
  const sniffed = sniffMime(filePath);
  const mime = sniffed || declaredMime;
  const kind = detectKindFromMime(mime);
  if (!kind) {
    throw new Error('نوع الملف غير مدعوم. الصور: JPG/PNG/WebP — الفيديو: MP4/WebM');
  }
  if (sniffed && declaredMime && sniffed !== declaredMime) {
    // allow jpeg/jpg alias mismatches only when sniffed is authoritative
  }
  const limits = mediaLimits();
  if (kind === 'image' && size > limits.imageBytes) {
    throw new Error(`حجم الصورة يتجاوز الحد المسموح (${limits.imageMb}MB)`);
  }
  if (kind === 'video' && size > limits.videoBytes) {
    throw new Error(`حجم الفيديو يتجاوز الحد المسموح (${limits.videoMb}MB)`);
  }
  return { mime, kind };
}

export function uploadsRootFrom(metaUrl: string) {
  return path.resolve(path.dirname(metaUrl), '../../uploads');
}

export const SECTOR_MEDIA_ROLES = ['cover', 'main', 'gallery', 'intro_video'] as const;
export type SectorMediaRole = (typeof SECTOR_MEDIA_ROLES)[number];

export function isSectorMediaRole(v: string): v is SectorMediaRole {
  return (SECTOR_MEDIA_ROLES as readonly string[]).includes(v);
}
