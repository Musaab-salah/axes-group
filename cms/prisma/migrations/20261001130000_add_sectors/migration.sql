-- CreateTable
CREATE TABLE IF NOT EXISTS "Sector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "summaryAr" TEXT NOT NULL DEFAULT '',
    "summaryEn" TEXT NOT NULL DEFAULT '',
    "bodyAr" TEXT NOT NULL DEFAULT '',
    "bodyEn" TEXT NOT NULL DEFAULT '',
    "iconPath" TEXT,
    "coverPath" TEXT,
    "galleryJson" TEXT NOT NULL DEFAULT '[]',
    "videoPath" TEXT,
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactWhatsapp" TEXT NOT NULL DEFAULT '',
    "ctaLabelAr" TEXT NOT NULL DEFAULT 'طلب الخدمة',
    "ctaLabelEn" TEXT NOT NULL DEFAULT 'Request Service',
    "ctaUrl" TEXT NOT NULL DEFAULT '/contact',
    "seoTitleAr" TEXT NOT NULL DEFAULT '',
    "seoTitleEn" TEXT NOT NULL DEFAULT '',
    "seoDescAr" TEXT NOT NULL DEFAULT '',
    "seoDescEn" TEXT NOT NULL DEFAULT '',
    "draftJson" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "showInHome" BOOLEAN NOT NULL DEFAULT true,
    "showInNav" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "pageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    CONSTRAINT "Sector_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Sector_slug_key" ON "Sector"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Sector_pageId_key" ON "Sector"("pageId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "SectorVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SectorVersion_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SectorVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN "sectorId" TEXT;

-- AlterTable Service
ALTER TABLE "Service" ADD COLUMN "sectorId" TEXT;
